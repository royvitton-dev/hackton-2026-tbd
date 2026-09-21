"""Native-resolution, overlapping-tile analysis of every archived drawing.

This extracts image evidence, not surveyed building semantics. Public originals
are immutable. Coordinates in this artifact always refer to the original image.
Reviewed route geometry is applied separately by convert.mjs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import tempfile

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
METHOD = "opencv-native-overlapping-tiles-v1"
CONFIG = {"tileSize": 1024, "overlap": 160, "claheClip": 2.0,
          "adaptiveBlock": 31, "adaptiveC": 9, "maxPixels": 50_000_000}
cv2.setNumThreads(1)
cv2.setRNGSeed(0)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def tiles_for(width, height, size=1024, overlap=160):
    if min(width, height, size) <= 0 or not 0 <= overlap < size:
        raise ValueError("Invalid tile dimensions")

    def starts(length):
        values = list(range(0, max(1, length - size + 1), size - overlap))
        if values[-1] + size < length:
            values.append(max(0, length - size))
        return values

    return [{"id": f"tile-{row + 1}-{col + 1}", "x": x, "y": y,
             "width": min(size, width - x), "height": min(size, height - y)}
            for row, y in enumerate(starts(height)) for col, x in enumerate(starts(width))]


def grayscale(image):
    if image is None or image.size == 0:
        raise ValueError("Cannot decode drawing")
    if image.shape[0] * image.shape[1] > CONFIG["maxPixels"]:
        raise ValueError("Drawing exceeds the 50 megapixel analysis limit")
    if image.ndim == 2:
        return image.copy()
    if image.shape[2] == 4:
        alpha = image[:, :, 3:4].astype(np.float32) / 255
        image = np.rint(image[:, :, :3] * alpha + 255 * (1 - alpha)).astype(np.uint8)
    return cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)


def preprocess(gray):
    height, width = gray.shape
    sample = gray[::max(1, height // 800), ::max(1, width // 800)]
    low, high = [float(v) for v in np.percentile(sample, [0.5, 99.5])]
    # An almost empty sheet must not be converted into a solid black image.
    if high - low >= 4:
        lut = np.clip((np.arange(256) - low) * 255 / (high - low), 0, 255).astype(np.uint8)
        contrast = cv2.LUT(gray, lut)
    else:
        contrast = gray.copy()
    clahe = cv2.createCLAHE(CONFIG["claheClip"], (max(2, width // 128), max(2, height // 128)))
    enhanced = clahe.apply(contrast)
    threshold, global_mask = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    # Bound the global threshold so JPEG background shading is not a wall.
    global_mask[enhanced > min(100, threshold)] = 0
    # On a normal-contrast sheet, CLAHE-darkened soil/shadow fills must not
    # become solid ink. Low-contrast originals still use their stretched range.
    if high - low > 80:
        global_mask[gray > 100] = 0
    local_mask = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY_INV, CONFIG["adaptiveBlock"], CONFIG["adaptiveC"])
    ink = cv2.bitwise_or(global_mask, local_mask)
    return enhanced, ink, {"contrastRange": [low, high], "otsuThreshold": round(threshold, 2),
                           "grayscale": "BT.601, alpha composited on white", "claheClip": CONFIG["claheClip"],
                           "adaptiveBlock": CONFIG["adaptiveBlock"], "adaptiveC": CONFIG["adaptiveC"]}


def text_exclusions(ink, labels):
    """Remove bounded text and title boxes, never a page-sized OCR paragraph."""
    height, width = ink.shape
    mask = ink.copy()
    count = 0
    for label in labels:
        x, y, w, h = [label.get(k, 0) for k in ("x", "z", "width", "depth")]
        if label.get("confidence", 0) < .25 or not (0 < h <= .12 and 0 < w <= 1 and w * h < .1):
            continue
        x0, y0 = max(0, round((x - w / 2) * width)), max(0, round((y - h / 2) * height))
        x1, y1 = min(width, round((x + w / 2) * width)), min(height, round((y + h / 2) * height))
        if x1 > x0 and y1 > y0:
            mask[y0:y1, x0:x1] = 0
            count += 1
    return mask, count


def line_record(x1, y1, x2, y2, thickness, tile, evidence):
    if (x1, y1) > (x2, y2):
        x1, y1, x2, y2 = x2, y2, x1, y1
    return {"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2),
            "thickness": float(thickness), "tiles": {tile}, "evidence": {evidence}}


def tile_lines(mask, tile, minimum):
    x, y, width, height = [tile[k] for k in ("x", "y", "width", "height")]
    crop = mask[y:y + height, x:x + width]
    result = []
    for horizontal in (True, False):
        # Close only 1–2px scan gaps. Door openings are never spanned deliberately.
        short = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 1) if horizontal else (1, 3))
        long = cv2.getStructuringElement(cv2.MORPH_RECT, (minimum, 1) if horizontal else (1, minimum))
        opened = cv2.morphologyEx(cv2.morphologyEx(crop, cv2.MORPH_CLOSE, short), cv2.MORPH_OPEN, long)
        count, _, stats, _ = cv2.connectedComponentsWithStats(opened, connectivity=8)
        for sx, sy, sw, sh, area in stats[1:count]:
            length, thick = (sw, sh) if horizontal else (sh, sw)
            if length < minimum or thick > min(50, length * .22) or area / (sw * sh) < .65:
                continue
            if horizontal:
                result.append(line_record(x + sx, y + sy + (sh - 1) / 2, x + sx + sw - 1,
                                          y + sy + (sh - 1) / 2, sh, tile["id"], "continuous-stroke"))
            else:
                result.append(line_record(x + sx + (sw - 1) / 2, y + sy, x + sx + (sw - 1) / 2,
                                          y + sy + sh - 1, sw, tile["id"], "continuous-stroke"))
    # Sloped walls cannot be found with the horizontal/vertical kernels above.
    eroded = cv2.erode(crop, np.ones((3, 3), np.uint8))
    diagonal = cv2.HoughLinesP(eroded, 1, np.pi / 180, max(25, minimum),
                               minLineLength=max(30, minimum * 2), maxLineGap=2)
    if diagonal is not None:
        distance = cv2.distanceTransform(crop, cv2.DIST_L2, 3)
        for x1, y1, x2, y2 in diagonal.reshape(-1, 4):
            angle = abs(math.degrees(math.atan2(y2 - y1, x2 - x1))) % 180
            if min(angle, 180 - angle) < 8 or abs(angle - 90) < 8:
                continue
            xs = np.rint(np.linspace(x1, x2, 24)).astype(int)
            ys = np.rint(np.linspace(y1, y2, 24)).astype(int)
            thickness = float(np.median(distance[ys, xs]) * 2)
            if 2.5 <= thickness <= 40:
                result.append(line_record(x + x1, y + y1, x + x2, y + y2, thickness,
                                          tile["id"], "diagonal-filled-stroke"))
    return result


def geometry(line):
    dx, dy = line["x2"] - line["x1"], line["y2"] - line["y1"]
    length = math.hypot(dx, dy)
    return length, dx / length, dy / length


def merge_lines(lines, gap=2):
    """Merge overlapping collinear tile fragments, retaining both tile IDs."""
    result = []
    for line in sorted(lines, key=lambda l: (-geometry(l)[0], l["x1"], l["y1"])):
        length, ux, uy = geometry(line)
        joined = False
        for existing in result:
            base_length, vx, vy = geometry(existing)
            if abs(ux * vx + uy * vy) < math.cos(math.radians(1.5)):
                continue
            offsets = [(line[kx] - existing["x1"], line[ky] - existing["y1"])
                       for kx, ky in (("x1", "y1"), ("x2", "y2"))]
            tolerance = max(1.2, min(line["thickness"], existing["thickness"]) * .45)
            if max(abs(dx * vy - dy * vx) for dx, dy in offsets) > tolerance:
                continue
            a, b = sorted(dx * vx + dy * vy for dx, dy in offsets)
            if b < -gap or a > base_length + gap:
                continue
            lo, hi = min(0, a), max(base_length, b)
            ox, oy = existing["x1"], existing["y1"]
            existing.update(x1=ox + lo * vx, y1=oy + lo * vy,
                            x2=ox + hi * vx, y2=oy + hi * vy,
                            thickness=max(existing["thickness"], line["thickness"]))
            existing["tiles"].update(line["tiles"])
            existing["evidence"].update(line["evidence"])
            joined = True
            break
        if not joined:
            result.append({**line, "tiles": set(line["tiles"]), "evidence": set(line["evidence"])})
    # A short later fragment can bridge two earlier fragments at a tile seam.
    if len(result) < len(lines):
        return merge_lines(result, gap)
    return result


def classify_lines(lines, width, height):
    candidates = []
    minimum = max(18, round(min(width, height) * .012))
    for line in lines:
        length, _, _ = geometry(line)
        if length < minimum:
            continue
        # Page frames and crop edges should not become full-height buildings.
        near_x = min(line["x1"], line["x2"]) < width * .025 or max(line["x1"], line["x2"]) > width * .975
        near_y = min(line["y1"], line["y2"]) < height * .025 or max(line["y1"], line["y2"]) > height * .975
        if (near_x and abs(line["x2"] - line["x1"]) < 2 and length > height * .4) or (near_y and abs(line["y2"] - line["y1"]) < 2 and length > width * .4):
            continue
        thick = line["thickness"]
        structural = (max(2.2, min(width, height) * .0018) <= thick <= max(8, min(width, height) * .015)
                      and length >= max(minimum * 1.5, thick * 6))
        score = min(95, round(40 + min(25, thick * 4) + min(20, length / minimum * 3) + (5 if len(line["tiles"]) > 1 else 0)))
        candidates.append({**{k: round(line[k], 3) for k in ("x1", "y1", "x2", "y2", "thickness")},
                           "evidence": sorted(line["evidence"]), "tileIds": sorted(line["tiles"]),
                           "patternScore": score, "structuralStroke": structural,
                           "status": "review-required"})
    candidates.sort(key=lambda c: (round(c["y1"], 1), round(c["x1"], 1), c["x2"], c["y2"]))
    return [{"id": f"stroke-{i + 1}", **candidate} for i, candidate in enumerate(candidates)]


def pair_outlines(lines, width, height):
    """Recover narrow hollow wall outlines; dense repeated stair treads stay lines."""
    limit = max(4, min(width, height) * .008)
    thin = [line for line in lines if line["thickness"] < max(2.2, min(width, height) * .0018)]
    paired = []
    used = set()
    for i, a in enumerate(thin):
        if i in used:
            continue
        _, ux, uy = geometry(a)
        if abs(ux * uy) > .001:
            continue
        horizontal = abs(ux) > .9
        along, normal = (("x1", "x2"), ("y1", "y2")) if horizontal else (("y1", "y2"), ("x1", "x2"))
        choices = []
        for j, b in enumerate(thin):
            if j <= i or j in used or abs(b[normal[1]] - b[normal[0]]) > .1:
                continue
            gap = abs(b[normal[0]] - a[normal[0]])
            lo, hi = max(a[along[0]], b[along[0]]), min(a[along[1]], b[along[1]])
            overlap = hi - lo
            shorter = min(geometry(a)[0], geometry(b)[0])
            if max(2.5, a["thickness"] + b["thickness"]) <= gap <= limit and overlap >= max(40, 12 * gap) and overlap >= shorter * .8:
                choices.append((gap, j, lo, hi))
        if not choices:
            continue
        gap, j, lo, hi = min(choices)
        b = thin[j]
        # Three equally spaced lines are more likely a hatch or staircase.
        centre = (a[normal[0]] + b[normal[0]]) / 2
        repeated = any(k not in (i, j) and abs(c[normal[1]] - c[normal[0]]) < .1
                       and abs(abs(c[normal[0]] - centre) - gap * 1.5) < 1.5
                       and min(c[along[1]], hi) - max(c[along[0]], lo) > (hi - lo) * .7
                       for k, c in enumerate(thin))
        if repeated:
            continue
        line = line_record(lo, centre, hi, centre, gap + (a["thickness"] + b["thickness"]) / 2,
                           next(iter(a["tiles"])), "paired-wall-outline") if horizontal else line_record(
                           centre, lo, centre, hi, gap + (a["thickness"] + b["thickness"]) / 2,
                           next(iter(a["tiles"])), "paired-wall-outline")
        line["tiles"] = a["tiles"] | b["tiles"]
        paired.append(line)
        used.update((i, j))
    return lines + paired


def analyze_image(image, labels=(), context_map=False):
    gray = grayscale(image)
    height, width = gray.shape
    enhanced, ink, settings = preprocess(gray)
    mask, removed = text_exclusions(ink, labels)
    tiles = tiles_for(width, height, CONFIG["tileSize"], CONFIG["overlap"])
    minimum = max(18, round(min(width, height) * .012))
    lines = []
    for tile in tiles:
        detected = tile_lines(mask, tile, minimum)
        tile["rawSegments"] = len(detected)
        lines.extend(detected)
    merged = merge_lines(lines)
    candidates = classify_lines(pair_outlines(merged, width, height), width, height)
    # Context maps have paths, trees, labels and colored areas, not wall semantics.
    for candidate in candidates:
        if context_map:
            candidate["structuralStroke"] = False
    result = {"method": METHOD, "engine": {"opencv": cv2.__version__, "numpy": np.__version__},
              "sourcePixels": {"width": width, "height": height}, "resizeScale": 1,
              "preprocessing": settings, "tileSize": CONFIG["tileSize"], "overlap": CONFIG["overlap"],
              "tiles": tiles, "excludedTextBoxes": removed, "rawSegmentCount": len(lines),
              "mergedSegmentCount": len(candidates), "structuralStrokeCount": sum(c["structuralStroke"] for c in candidates),
              "contextMap": context_map, "status": "processed-review-required", "candidates": candidates,
              "limitations": ["Image strokes may include furniture, dimensions, boundary lines and parking markings.",
                              "Doors, entrances, allowed vehicle aisles and scale require source review.",
                              "Pattern scores describe stroke support, not semantic confidence or RF strength."]}
    return result, enhanced, ink


def write_image(file, image):
    parameters = [cv2.IMWRITE_PNG_COMPRESSION, 9] if file.suffix == ".png" else [cv2.IMWRITE_WEBP_QUALITY, 90]
    if not cv2.imwrite(str(file), image, parameters):
        raise RuntimeError(f"Cannot write {file}")


def write_assets(directory, result, enhanced, ink):
    height, width = enhanced.shape
    write_image(directory / "grayscale.webp", enhanced)
    write_image(directory / "binary.png", 255 - ink)
    scale = min(1, 2000 / max(width, height))
    preview = cv2.cvtColor(cv2.resize(enhanced, (round(width * scale), round(height * scale))), cv2.COLOR_GRAY2BGR)
    preview = cv2.addWeighted(preview, .6, np.full_like(preview, 255), .4, 0)
    for c in result["candidates"]:
        color = (135, 97, 29) if c["structuralStroke"] else (52, 158, 221)
        start = (round(c["x1"] * scale), round(c["y1"] * scale))
        end = (round(c["x2"] * scale), round(c["y2"] * scale))
        cv2.line(preview, start, end, color, max(1, min(5 if c["structuralStroke"] else 2, round(c["thickness"] * scale))), cv2.LINE_AA)
    write_image(directory / "overlay.webp", preview)
    (directory / "tiles").mkdir()
    for tile in result["tiles"]:
        x, y, w, h = [tile[k] for k in ("x", "y", "width", "height")]
        tile["file"] = "tiles/" + tile["id"] + ".png"
        write_image(directory / tile["file"], 255 - ink[y:y + h, x:x + w])
    return {str(p.relative_to(directory)): sha(p.read_bytes()) for p in sorted(directory.rglob("*")) if p.is_file()}


def process_site(site, force=False):
    site_id = site["id"]
    if not all(c.isalnum() or c in "-_" for c in site_id):
        raise ValueError("Invalid drawing ID")
    source = PUBLIC / site["sourceAsset"]["file"]
    source_bytes = source.read_bytes()
    source_sha = sha(source_bytes)
    if site["sourceAsset"].get("sha256", source_sha) != source_sha:
        raise ValueError(f"Source hash mismatch: {site_id}")
    ocr_path = PUBLIC / "sources/ocr" / (site_id + ".json")
    ocr_bytes = ocr_path.read_bytes() if ocr_path.exists() else b"{}"
    ocr = json.loads(ocr_bytes)
    if ocr.get("sourceSha256", source_sha) != source_sha:
        raise ValueError(f"OCR source hash mismatch: {site_id}")
    reviews = json.loads((PUBLIC / "sources/drawing-kinds.json").read_text())
    review = reviews.get(site_id, {})
    if review.get("sourceSha256", source_sha) != source_sha:
        raise ValueError(f"Drawing-kind review hash mismatch: {site_id}")
    signature = sha(Path(__file__).read_bytes() + json.dumps(CONFIG, sort_keys=True).encode()
                    + source_sha.encode() + ocr_bytes + site["buildingType"].encode()
                    + cv2.__version__.encode() + np.__version__.encode() + json.dumps(review, sort_keys=True).encode())
    target = PUBLIC / "analysis" / site_id
    if not force and (target / "analysis.json").exists():
        prior = json.loads((target / "analysis.json").read_text())
        if prior.get("signature") == signature and all((target / name).is_file() and sha((target / name).read_bytes()) == digest
                                                       for name, digest in prior.get("assetHashes", {}).items()) and prior.get("assetHashes"):
            print(f"{site_id}: cached {len(prior['tiles'])} native tiles", flush=True)
            return prior
    image = cv2.imdecode(np.frombuffer(source_bytes, np.uint8), cv2.IMREAD_UNCHANGED)
    context_map = site["buildingType"] == "park" or site_id == "complex-onepentas-0"
    non_plan = review.get("kind") in ("reference-document", "axonometric")
    result, enhanced, ink = analyze_image(image, ocr.get("labels", []), context_map or non_plan)
    result.update(contextMap=context_map, planarDrawing=not (context_map or non_plan),
                  drawingKind=review.get("kind", "site-map" if context_map else "plan-candidate"),
                  sourceReview=review or None)
    result.update(id=site_id, name=site["name"], sourceAsset=site["sourceAsset"]["file"],
                  sourceSha256=source_sha, ocrSha256=sha(ocr_bytes), signature=signature)
    (ROOT / ".runtime").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="vision-", dir=ROOT / ".runtime") as temporary:
        stage = Path(temporary) / site_id
        stage.mkdir()
        result["assetHashes"] = write_assets(stage, result, enhanced, ink)
        (stage / "analysis.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(stage), str(target))
    print(f"{site_id}: {result['sourcePixels']['width']}×{result['sourcePixels']['height']}, "
          f"{len(result['tiles'])} tiles, {result['structuralStrokeCount']} structural / {len(result['candidates'])} strokes", flush=True)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    sites = json.loads((PUBLIC / "sources/catalog.json").read_text())
    if args.site:
        sites = [site for site in sites if site["id"] == args.site]
        if not sites:
            parser.error("Unknown drawing ID")
    results = [process_site(site, args.force) for site in sites]
    summary = {"method": METHOD, "drawings": len(results), "nativeResolution": True,
               "tiles": sum(len(result["tiles"]) for result in results),
               "candidates": sum(len(result["candidates"]) for result in results),
               "structuralStrokes": sum(result["structuralStrokeCount"] for result in results),
               "items": [{k: result[k] for k in ("id", "name", "sourcePixels", "sourceSha256", "signature",
                                                  "structuralStrokeCount", "mergedSegmentCount", "contextMap", "drawingKind")}
                         | {"tiles": len(result["tiles"]), "file": f"analysis/{result['id']}/analysis.json"}
                         for result in results]}
    if not args.site:
        (PUBLIC / "analysis/index.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    print(f"Processed {len(results)} drawings / {summary['tiles']} overlapping native tiles", flush=True)


if __name__ == "__main__":
    main()

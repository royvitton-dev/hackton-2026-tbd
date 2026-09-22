"""Real rembg inference. No placeholder, opaque PNG, or missing mask is accepted."""
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('U2NET_HOME', str(ROOT / '.cache/rembg'))
os.environ.setdefault('NUMBA_CACHE_DIR', str(ROOT / '.cache/numba'))
os.environ.setdefault('OMP_NUM_THREADS', '2')
MANIFEST = ROOT / 'battery_health/resoures/images/image_sources.json'
entries = json.loads(MANIFEST.read_text())


def main():
    try:
        from PIL import Image, ImageDraw, ImageChops
        from rembg import remove, new_session
        session = new_session('u2net', providers=['CPUExecutionProvider'])
    except Exception as error:
        for e in entries:
            e['cutoutGenerated'] = False
            e['failureReason'] = f'cutout: {type(error).__name__}: {error}. Install scripts/requirements-cutouts.txt and retry.'
            e.setdefault('failures', []).append({'stage':'cutout-init','message':str(error),'url':e['resourceOriginalPath'],'nextAction':'Install requirements-cutouts.txt, check model download network, then rerun.'})
        MANIFEST.write_text(json.dumps(entries, ensure_ascii=False, indent=2)+'\n')
        raise
    processed = {}
    for e in entries:
        if e['fileName'] in processed:
            e.update(processed[e['fileName']])
            continue
        try:
            if not e['downloaded']:
                raise ValueError('Original download failed; no placeholder generated')
            original = ROOT / e['resourceOriginalPath']
            output = ROOT / e['resourceCutoutPath']
            digest = hashlib.sha256(original.read_bytes()).hexdigest()
            cached = output.exists() and e.get('cutoutGenerated') and e.get('cutoutSourceSha256') == digest and '--force' not in sys.argv
            if cached:
                result = Image.open(output).convert('RGBA')
            else:
                source_path = ROOT / e['resourceSourcePath'] if e.get('sourceKind') == 'user-upload' else original
                source = Image.open(source_path)
                source.thumbnail((2400, 2400))
                if e.get('sourceKind') == 'user-upload' and e.get('sourceHasAlpha') and e.get('cutoutAlphaMode') != 'refine':
                    result = source.convert('RGBA')
                    e['cutoutTool'] = 'User-supplied alpha preserved; Pillow transparent crop'
                else:
                    rgb_source = source.convert('RGB')
                    if e.get('sourceHasAlpha'):
                        backdrop = Image.new('RGBA', source.size, 'white')
                        backdrop.alpha_composite(source.convert('RGBA'))
                        rgb_source = backdrop.convert('RGB')
                    result = remove(rgb_source, session=session, post_process_mask=True).convert('RGBA')
                    if e.get('sourceHasAlpha'):
                        result.putalpha(ImageChops.darker(result.getchannel('A'), source.convert('RGBA').getchannel('A')))
                    e['cutoutTool'] = 'rembg 2.0.67 / u2net / CPU'
                if e.get('cutoutMaskCorrectionsPath'):
                    corrections = json.loads((ROOT / e['cutoutMaskCorrectionsPath']).read_text())
                    if hashlib.sha256(source_path.read_bytes()).hexdigest() != corrections['sourceSha256']:
                        raise ValueError('Mask corrections belong to a different source image')
                    alpha = result.getchannel('A')
                    draw = ImageDraw.Draw(alpha)
                    for polygon in corrections.get('preserve', []):
                        draw.polygon([tuple(point) for point in polygon], fill=255)
                    for polygon in corrections.get('clear', []):
                        draw.polygon([tuple(point) for point in polygon], fill=0)
                    # Recover the original RGB too: inference may zero RGB where alpha was zero.
                    result = source.convert('RGBA')
                    result.putalpha(alpha)
                    e['cutoutTool'] += ' / reviewed local alpha corrections'
                alpha = result.getchannel('A')
                box = alpha.point(lambda p: 255 if p>32 else 0).getbbox()
                if not box:
                    raise ValueError('Empty foreground mask')
                result = result.crop(box)
                # Padding preserves full vehicle edges and gives normalized hotspot coordinates.
                padded = Image.new('RGBA', (result.width+48, result.height+48))
                padded.alpha_composite(result, (24,24))
                result = padded
            hist = result.getchannel('A').histogram()
            pixels = result.width*result.height
            transparent = sum(hist[:16])/pixels
            opaque = sum(hist[240:])/pixels
            if transparent<0.08 or opaque<0.08:
                raise ValueError(f'Invalid cutout mask: transparent={transparent:.3f}, opaque={opaque:.3f}')
            if not cached:
                result.save(output, optimize=True)
            e.update(cutoutGenerated=True, failureReason=None, cutoutSourceSha256=digest,
                     cutoutSha256=hashlib.sha256(output.read_bytes()).hexdigest(),
                     alphaTransparentRatio=transparent,
                     alphaOpaqueRatio=opaque, cutoutWidth=result.width, cutoutHeight=result.height)
            print(f'OK {output.name} ({result.width}x{result.height}, transparent {transparent:.1%})', flush=True)
        except Exception as error:
            e['cutoutGenerated'] = False
            e['failureReason'] = f'cutout: {type(error).__name__}: {error}'
            e.setdefault('failures', []).append({'stage':'cutout','message':str(error),'url':e['resourceOriginalPath'],'nextAction':'Inspect source/mask or install rembg and rerun.'})
            print(e['model'], e['failureReason'], file=sys.stderr, flush=True)
        processed[e['fileName']] = {k:v for k,v in e.items() if k.startswith('cutout') or k.startswith('alpha') or k in ('failureReason','failures')}
        MANIFEST.write_text(json.dumps(entries, ensure_ascii=False, indent=2)+'\n')
    MANIFEST.write_text(json.dumps(entries, ensure_ascii=False, indent=2)+'\n')
    if any(not e['cutoutGenerated'] for e in entries):
        sys.exit(1)


if __name__ == '__main__':
    main()

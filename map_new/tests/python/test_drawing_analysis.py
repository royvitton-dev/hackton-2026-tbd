import sys
from pathlib import Path
import unittest

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from analyze_drawings import analyze_image, grayscale, merge_lines, line_record, tiles_for


class DrawingAnalysisTest(unittest.TestCase):
    def test_tiles_cover_original_and_overlap_even_at_partial_edges(self):
        for width, height in [(4958, 7008), (1025, 2048), (1000, 600), (1, 1)]:
            tiles = tiles_for(width, height)
            coverage = np.zeros((height, width), np.uint8)
            for tile in tiles:
                x, y, w, h = [tile[k] for k in ("x", "y", "width", "height")]
                coverage[y:y + h, x:x + w] += 1
                self.assertLessEqual(max(w, h), 1024)
            self.assertTrue(np.all(coverage > 0))
            if width > 1024 or height > 1024:
                self.assertTrue(np.any(coverage > 1))
        for args in [(0, 100), (100, 100, 100, 100), (100, 100, 100, -1)]:
            with self.assertRaises(ValueError):
                tiles_for(*args)

    def test_merge_keeps_door_opening_and_parallel_walls_separate(self):
        lines = [line_record(0, 10, 500, 10, 6, "a", "test"),
                 line_record(400, 10, 950, 10, 6, "b", "test"),
                 line_record(980, 10, 1200, 10, 6, "c", "test"),
                 line_record(0, 30, 1200, 30, 6, "a", "test")]
        result = merge_lines(lines)
        self.assertEqual(len(result), 3)
        joined = next(line for line in result if line["x2"] == 950)
        self.assertEqual(joined["x1"], 0)
        self.assertEqual(joined["tiles"], {"a", "b"})

    def test_full_resolution_recovers_wall_crossing_multiple_tiles(self):
        image = np.full((1100, 2500), 255, np.uint8)
        image[290:298, 50:2400] = 25
        result, _, _ = analyze_image(image)
        walls = [c for c in result["candidates"] if c["structuralStroke"]]
        wall = max(walls, key=lambda c: c["x2"] - c["x1"])
        self.assertGreater(wall["x2"] - wall["x1"], 2300)
        self.assertGreaterEqual(len(wall["tileIds"]), 3)
        self.assertEqual(result["resizeScale"], 1)

    def test_contrast_recovers_pale_colored_wall_without_transparent_ink(self):
        image = np.full((320, 640, 4), 255, np.uint8)
        image[80:87, 40:600, :3] = [230, 232, 237]
        image[180:190, 40:600, :3] = 0
        image[180:190, 40:600, 3] = 0
        result, _, _ = analyze_image(image)
        self.assertTrue(any(abs(c["y1"] - 83) < 6 and c["x2"] - c["x1"] > 500 for c in result["candidates"]))
        self.assertFalse(any(abs(c["y1"] - 185) < 12 for c in result["candidates"]))
        self.assertEqual(int(grayscale(image)[185, 100]), 255)

    def test_text_regions_are_excluded_but_large_ocr_boxes_do_not_erase_plan(self):
        image = np.full((500, 800), 255, np.uint8)
        image[195:201, 100:200] = 0
        image[300:307, 50:750] = 0
        labels = [{"x": 150 / 800, "z": 198 / 500, "width": 110 / 800,
                   "depth": 14 / 500, "confidence": .9},
                  {"x": .5, "z": .5, "width": 1, "depth": 1, "confidence": .9}]
        result, _, _ = analyze_image(image, labels)
        self.assertEqual(result["excludedTextBoxes"], 1)
        self.assertFalse(any(abs(c["y1"] - 198) < 5 for c in result["candidates"]))
        self.assertTrue(any(c["x2"] - c["x1"] > 650 for c in result["candidates"]))

    def test_detects_diagonal_stroke_and_leaves_blank_and_context_maps_unmodeled(self):
        image = np.full((600, 800), 255, np.uint8)
        empty, _, _ = analyze_image(image)
        self.assertEqual(empty["candidates"], [])
        cv2.line(image, (70, 70), (650, 460), 0, 8)
        result, _, _ = analyze_image(image)
        self.assertTrue(any("diagonal-filled-stroke" in c["evidence"] for c in result["candidates"]))
        context, _, _ = analyze_image(image, context_map=True)
        self.assertGreater(len(context["candidates"]), 0)
        self.assertEqual(context["structuralStrokeCount"], 0)

    def test_pairs_hollow_wall_but_not_repeated_stair_treads(self):
        image = np.full((600, 800), 255, np.uint8)
        image[100, 50:500] = 0
        image[104, 50:500] = 0
        for y in range(300, 325, 4):
            image[y, 50:500] = 0
        result, _, _ = analyze_image(image)
        pairs = [c for c in result["candidates"] if "paired-wall-outline" in c["evidence"]]
        self.assertTrue(any(abs(c["y1"] - 102) < 2 for c in pairs))
        self.assertFalse(any(c["y1"] > 250 for c in pairs))

    def test_gray_ground_fill_and_large_title_are_not_structural_walls(self):
        image = np.full((600, 900), 255, np.uint8)
        image[300:580, 10:890] = 130
        image[55:63, 40:850] = 0
        image[150:157, 100:800] = 0
        labels = [{"text": "Floor plan title", "confidence": .5, "x": .5, "z": .1,
                   "width": .95, "depth": .1}]
        result, _, _ = analyze_image(image, labels)
        walls = [c for c in result["candidates"] if c["structuralStroke"]]
        self.assertFalse(any(c["y1"] < 100 for c in walls))
        self.assertFalse(any(c["y1"] > 320 and c["y2"] > 320 and c["thickness"] > 8 for c in walls))
        self.assertTrue(any(abs(c["y1"] - 153) < 5 for c in walls))


if __name__ == "__main__":
    unittest.main()

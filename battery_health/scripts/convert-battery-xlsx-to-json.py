#!/usr/bin/env python3
"""Convert the supplied workbook to browser-friendly JSON without third-party packages."""

from __future__ import annotations

import json
import re
import shutil
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "resoures" / "ev_battery_health_mock_data_10000_v2.xlsx"
OUTPUT = ROOT / "public" / "data" / "battery"
IMAGE_MANIFEST = ROOT / "resoures" / "images" / "image_sources.json"
IMAGE_OUTPUT = ROOT / "public" / "assets" / "vehicles"
MAIN_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
REL_ID = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
REQUIRED_SHEETS = (
    "01_Vehicle_Master",
    "02_Score_Rules",
    "03_User_Profile_Mock",
    "04_Charge_Sessions_Raw",
    "05_Feature_Sessions",
    "06_User_Summary",
    "07_Guide",
)
DATE_FIELDS = {"mockStartDate", "mockEndDate", "startedAt", "endedAt", "unpluggedAt"}


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference)
    if not letters:
        raise ValueError(f"Invalid cell reference: {reference}")
    value = 0
    for letter in letters.group(0):
        value = value * 26 + ord(letter) - 64
    return value - 1


def excel_date(value: float) -> str:
    parsed = datetime(1899, 12, 30) + timedelta(days=value)
    if parsed.time() == datetime.min.time():
        return parsed.date().isoformat()
    return parsed.isoformat(timespec="seconds")


def scalar(value: str | None):
    if value in (None, ""):
        return None
    try:
        number = float(value)
        return int(number) if number.is_integer() else number
    except ValueError:
        return value


def read_workbook(path: Path) -> dict[str, list[dict]]:
    with zipfile.ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {node.attrib["Id"]: node.attrib["Target"] for node in relationships}
        sheet_paths: dict[str, str] = {}
        for sheet in workbook.find(MAIN_NS + "sheets") or []:
            target = targets[sheet.attrib[REL_ID]]
            sheet_paths[sheet.attrib["name"]] = target[1:] if target.startswith("/") else "xl/" + target

        missing = set(REQUIRED_SHEETS) - set(sheet_paths)
        if missing:
            raise ValueError(f"Required workbook sheets are missing: {sorted(missing)}")

        result: dict[str, list[dict]] = {}
        for sheet_name in REQUIRED_SHEETS:
            root = ET.fromstring(archive.read(sheet_paths[sheet_name]))
            xml_rows = root.findall(f".//{MAIN_NS}sheetData/{MAIN_NS}row")
            matrix: list[list] = []
            for xml_row in xml_rows:
                row: list = []
                for cell in xml_row.findall(MAIN_NS + "c"):
                    index = column_index(cell.attrib["r"])
                    while len(row) <= index:
                        row.append(None)
                    formula = cell.find(MAIN_NS + "f")
                    value_node = cell.find(MAIN_NS + "v")
                    if cell.attrib.get("t") == "inlineStr":
                        value = "".join(node.text or "" for node in cell.iter(MAIN_NS + "t"))
                    else:
                        value = value_node.text if value_node is not None else None
                    row[index] = {"value": scalar(value), "formula": formula.text if formula is not None else None}
                matrix.append(row)

            headers = [str(cell["value"]) for cell in matrix[0]]
            records: list[dict] = []
            for source_row in matrix[1:]:
                record = {}
                for index, header in enumerate(headers):
                    cell = source_row[index] if index < len(source_row) else None
                    value = cell["value"] if cell else None
                    formula = cell["formula"] if cell else None
                    if value is None and formula and sheet_name in ("05_Feature_Sessions", "06_User_Summary"):
                        value = {"formula": formula}
                    if header in DATE_FIELDS and isinstance(value, (int, float)):
                        value = excel_date(float(value))
                    record[header] = value
                records.append(record)
            result[sheet_name] = records
        return result


def write_json(name: str, value, compact: bool = False) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    kwargs = {"ensure_ascii": False}
    if not compact:
        kwargs["indent"] = 2
    (OUTPUT / name).write_text(json.dumps(value, **kwargs) + "\n", encoding="utf-8")


def main() -> None:
    sheets = read_workbook(SOURCE)
    vehicles = sheets["01_Vehicle_Master"]
    for vehicle in vehicles:
        gross = float(vehicle["batteryGrossKwh"])
        usable_factor = float(vehicle["usableFactor"])
        voltage = float(vehicle["packVoltage"])
        vehicle["batteryUsableKwh"] = round(gross * usable_factor, 3)
        vehicle["packVoltageClass"] = "800V" if voltage >= 550 else "400V" if voltage >= 300 else "LOW"

    rules = sheets["02_Score_Rules"]
    guides = [
        {
            "category": row["구분"],
            "criteria": row["기준"],
            "message": row["사용자 가이드"],
            "algorithm": row["알고리즘 반영"],
        }
        for row in sheets["07_Guide"]
    ]

    write_json("vehicleMaster.json", vehicles)
    write_json("scoreRules.json", rules)
    write_json("mockUsers.json", sheets["03_User_Profile_Mock"], compact=True)
    write_json("mockChargingSessions.json", sheets["04_Charge_Sessions_Raw"], compact=True)
    write_json("guides.json", guides)
    image_entries = json.loads(IMAGE_MANIFEST.read_text(encoding="utf-8")) if IMAGE_MANIFEST.exists() else []
    if image_entries:
        IMAGE_OUTPUT.mkdir(parents=True, exist_ok=True)
        for entry in image_entries:
            source = ROOT.parent / entry["resourceOriginalPath"]
            if not source.exists():
                raise FileNotFoundError(f"Vehicle image is missing: {source}")
            shutil.copy2(source, IMAGE_OUTPUT / entry["fileName"])
        write_json("vehicleImages.json", [
            {
                "vehicleId": entry["vehicleId"],
                "imagePath": f"./assets/vehicles/{entry['fileName']}",
                "sourceUrl": entry["sourceUrl"],
                "license": entry["license"],
                "licenseUrl": entry["licenseUrl"],
                "author": entry["author"],
                "representativeNote": entry["representativeNote"],
            }
            for entry in image_entries
        ])
    write_json(
        "workbookSchema.json",
        {
            "source": SOURCE.name,
            "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            "sheets": {
                name: {
                    "rowCount": len(rows),
                    "columns": list(rows[0]) if rows else [],
                    "runtimeUsage": "derived-at-runtime" if name in ("05_Feature_Sessions", "06_User_Summary") else "static-json",
                }
                for name, rows in sheets.items()
            },
        },
    )
    print(f"Converted {len(vehicles)} vehicles, {len(sheets['03_User_Profile_Mock'])} users, "
          f"{len(sheets['04_Charge_Sessions_Raw'])} sessions, and {len(image_entries)} vehicle image mappings into {OUTPUT}")


if __name__ == "__main__":
    main()

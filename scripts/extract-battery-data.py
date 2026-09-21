"""Export the existing workbook without Excel or third-party Python dependencies.

Formula caches are empty in this workbook. Export input sheets only; battery.ts
implements the inspected workbook rules rather than silently treating formulas as 0.
"""
from pathlib import Path
import datetime as dt
import hashlib
import json
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'battery_health/resoures/ev_battery_health_mock_data_10000_v2.xlsx'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'


def read_workbook(path):
    with zipfile.ZipFile(path) as archive:
        shared = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            shared = [''.join(s.itertext()) for s in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        relationships = {r.attrib['Id']: posixpath.normpath(posixpath.join('xl', r.attrib['Target']))
                         if not r.attrib['Target'].startswith('/') else r.attrib['Target'].lstrip('/')
                         for r in ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        sheets = ET.fromstring(archive.read('xl/workbook.xml')).find('m:sheets', NS)
        selected = {'01_Vehicle_Master', '02_Score_Rules', '03_User_Profile_Mock', '04_Charge_Sessions_Raw', '07_Guide'}
        output = {}
        for sheet in sheets:
            name = sheet.attrib['name']
            if name not in selected:
                continue
            rows = []
            for row in ET.fromstring(archive.read(relationships[sheet.attrib[REL]])).findall('m:sheetData/m:row', NS):
                cells = {}
                for cell in row:
                    column = re.sub(r'\d', '', cell.attrib['r'])
                    value = cell.find('m:v', NS)
                    inline = cell.find('m:is', NS)
                    if cell.find('m:f', NS) is not None:
                        cells[column] = None
                    elif inline is not None:
                        cells[column] = ''.join(inline.itertext())
                    elif value is not None and value.text is not None:
                        cells[column] = shared[int(value.text)] if cell.attrib.get('t') == 's' else float(value.text)
                    else:
                        cells[column] = None
                rows.append(cells)
            headers = rows[0]
            output[name] = [{key: row.get(col) for col, key in headers.items() if key}
                            for row in rows[1:] if any(v is not None for v in row.values())]
        return output


def main():
    sheets = read_workbook(SOURCE)
    for name in ('03_User_Profile_Mock', '04_Charge_Sessions_Raw'):
        for row in sheets[name]:
            for key in ('mockStartDate', 'mockEndDate', 'startedAt', 'endedAt', 'unpluggedAt'):
                if row.get(key) is not None:
                    date = dt.datetime(1899, 12, 30) + dt.timedelta(days=row[key])
                    # Workbook dates are local mock times, explicitly interpreted in Seoul.
                    row[key] = date.isoformat(timespec='seconds') + '+09:00'
    data = {
        'provenance': {'source': str(SOURCE.relative_to(ROOT)), 'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                       'formulaPolicy': 'Recompute inspected 05/06 formulas from input sheets; missing SOH stays null.'},
        'vehicles': sheets['01_Vehicle_Master'],
        'users': sheets['03_User_Profile_Mock'],
        'sessions': sheets['04_Charge_Sessions_Raw'],
        'rules': {r['parameter']: r['value'] for r in sheets['02_Score_Rules']},
        'guides': sheets['07_Guide'],
    }
    target = ROOT / 'src/data/battery/workbook.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f"Exported {len(data['vehicles'])} vehicles, {len(data['users'])} users, {len(data['sessions'])} sessions -> {target.relative_to(ROOT)}")


if __name__ == '__main__':
    main()

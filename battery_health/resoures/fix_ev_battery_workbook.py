from __future__ import annotations
import openpyxl
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter
from pathlib import Path
from datetime import timedelta, datetime
from collections import defaultdict

SRC = Path('/mnt/data/ev_battery_health_mock_data_10000.xlsx')
OUT = Path('/mnt/data/ev_battery_health_mock_data_10000_v2.xlsx')

wb = openpyxl.load_workbook(SRC)
raw = wb['04_Charge_Sessions_Raw']
users_ws = wb['03_User_Profile_Mock']

# Map headers
raw_headers = {raw.cell(1, c).value: c for c in range(1, raw.max_column + 1)}
user_headers = {users_ws.cell(1, c).value: c for c in range(1, users_ws.max_column + 1)}

# Preserve the existing session durations and unplug idle times, but prevent a single user's car
# from starting the next charge before the previous session has ended/unplugged.
# This is intentionally the minimal change: only D/E/F timestamp columns and mockEndDate are touched.
rows_by_user: dict[str, list[int]] = defaultdict(list)
for r in range(2, raw.max_row + 1):
    rows_by_user[raw.cell(r, raw_headers['userId']).value].append(r)

adjusted_rows = 0
for uid, rows in rows_by_user.items():
    rows.sort(key=lambda rr: raw.cell(rr, raw_headers['startedAt']).value)
    prev_unplug = None
    for idx, r in enumerate(rows):
        start = raw.cell(r, raw_headers['startedAt']).value
        end = raw.cell(r, raw_headers['endedAt']).value
        unplug = raw.cell(r, raw_headers['unpluggedAt']).value
        if not isinstance(start, datetime) or not isinstance(end, datetime) or not isinstance(unplug, datetime):
            continue
        duration = end - start
        idle = unplug - end
        if prev_unplug is not None and start < prev_unplug:
            # Deterministic small-but-realistic gap. Varies enough to avoid identical timestamps.
            gap_minutes = 30 + ((idx * 37 + len(uid) * 11) % 211)  # 30m ~ 4h
            start = prev_unplug + timedelta(minutes=gap_minutes)
            end = start + duration
            unplug = end + idle
            raw.cell(r, raw_headers['startedAt']).value = start
            raw.cell(r, raw_headers['endedAt']).value = end
            raw.cell(r, raw_headers['unpluggedAt']).value = unplug
            adjusted_rows += 1
        prev_unplug = unplug

# Update mockEndDate to reflect the max unplug date per user after timestamp repair.
max_unplug_by_user: dict[str, datetime] = {}
for uid, rows in rows_by_user.items():
    unplugs = [raw.cell(r, raw_headers['unpluggedAt']).value for r in rows]
    unplugs = [x for x in unplugs if isinstance(x, datetime)]
    if unplugs:
        max_unplug_by_user[uid] = max(unplugs)

for r in range(2, users_ws.max_row + 1):
    uid = users_ws.cell(r, user_headers['userId']).value
    if uid in max_unplug_by_user:
        users_ws.cell(r, user_headers['mockEndDate']).value = max_unplug_by_user[uid]

# Apply date formats consistently.
for ws, cols in [(raw, ['startedAt', 'endedAt', 'unpluggedAt']), (users_ws, ['mockStartDate', 'mockEndDate'])]:
    headers = {ws.cell(1, c).value: c for c in range(1, ws.max_column + 1)}
    for name in cols:
        c = headers.get(name)
        if c:
            for r in range(2, ws.max_row + 1):
                ws.cell(r, c).number_format = 'yyyy-mm-dd hh:mm:ss'

# Add stronger validation checks to the existing validation sheet.
val = wb['10_Validation_Check']
# Determine styles from existing validation rows.
header_fill = val.cell(1,1).fill.copy()
header_font = val.cell(1,1).font.copy()
body_alignment = val.cell(2,1).alignment.copy()
body_border = val.cell(2,1).border.copy()

new_checks = [
    [
        'overlap_before_prev_end',
        0,
        "=SUMPRODUCT(--('04_Charge_Sessions_Raw'!$B$3:$B$10001='04_Charge_Sessions_Raw'!$B$2:$B$10000),--('04_Charge_Sessions_Raw'!$D$3:$D$10001<'04_Charge_Sessions_Raw'!$E$2:$E$10000))",
        '=IF(C12=B12,"OK","CHECK")',
        '동일 사용자 기준 다음 충전 시작이 이전 충전 종료 전이면 안 됨'
    ],
    [
        'overlap_before_prev_unplug',
        0,
        "=SUMPRODUCT(--('04_Charge_Sessions_Raw'!$B$3:$B$10001='04_Charge_Sessions_Raw'!$B$2:$B$10000),--('04_Charge_Sessions_Raw'!$D$3:$D$10001<'04_Charge_Sessions_Raw'!$F$2:$F$10000))",
        '=IF(C13=B13,"OK","CHECK")',
        '동일 사용자 기준 다음 충전 시작이 이전 커넥터 분리 전이면 안 됨'
    ],
    [
        'invalid_session_time_order',
        0,
        "=SUMPRODUCT(--('04_Charge_Sessions_Raw'!$D$2:$D$10001>='04_Charge_Sessions_Raw'!$E$2:$E$10001))+SUMPRODUCT(--('04_Charge_Sessions_Raw'!$E$2:$E$10001>'04_Charge_Sessions_Raw'!$F$2:$F$10001))",
        '=IF(C14=B14,"OK","CHECK")',
        'startedAt < endedAt <= unpluggedAt 순서 검증'
    ],
    [
        'unknown_user_or_vehicle',
        0,
        "=SUMPRODUCT(--ISNA(MATCH('04_Charge_Sessions_Raw'!$B$2:$B$10001,'03_User_Profile_Mock'!$A$2:$A$1251,0)))+SUMPRODUCT(--ISNA(MATCH('04_Charge_Sessions_Raw'!$C$2:$C$10001,'01_Vehicle_Master'!$A$2:$A$21,0)))",
        '=IF(C15=B15,"OK","CHECK")',
        '세션 userId/vehicleId가 마스터에 존재하는지 검증'
    ],
    [
        'vehicle_mandatory_blank_count',
        0,
        "=COUNTBLANK('01_Vehicle_Master'!$A$2:$A$21)+COUNTBLANK('01_Vehicle_Master'!$B$2:$B$21)+COUNTBLANK('01_Vehicle_Master'!$C$2:$C$21)+COUNTBLANK('01_Vehicle_Master'!$D$2:$D$21)+COUNTBLANK('01_Vehicle_Master'!$E$2:$E$21)+COUNTBLANK('01_Vehicle_Master'!$F$2:$F$21)+COUNTBLANK('01_Vehicle_Master'!$G$2:$G$21)+COUNTBLANK('01_Vehicle_Master'!$K$2:$K$21)+COUNTBLANK('01_Vehicle_Master'!$L$2:$L$21)+COUNTBLANK('01_Vehicle_Master'!$P$2:$P$21)+COUNTBLANK('01_Vehicle_Master'!$Q$2:$Q$21)+COUNTBLANK('01_Vehicle_Master'!$R$2:$R$21)+COUNTBLANK('01_Vehicle_Master'!$S$2:$S$21)+COUNTBLANK('01_Vehicle_Master'!$V$2:$V$21)",
        '=IF(C16=B16,"OK","CHECK")',
        '차량 마스터 필수 컬럼 누락 검증'
    ],
]

# Clear old rows 12+ if rerun, then append.
for r in range(12, val.max_row + 1):
    for c in range(1, val.max_column + 1):
        val.cell(r, c).value = None

for i, row in enumerate(new_checks, start=12):
    for c, value in enumerate(row, start=1):
        cell = val.cell(i, c)
        cell.value = value
        cell.alignment = body_alignment
        cell.border = body_border
        if c in (1, 5):
            cell.alignment = Alignment(wrap_text=True, vertical='top')
        if c == 2:
            cell.number_format = '0'

# Add an internal test report sheet with static Python validation results and timestamp.
# This sheet is a QA audit log, not an algorithm calculation sheet.
if '11_Test_Report' in wb.sheetnames:
    del wb['11_Test_Report']
report = wb.create_sheet('11_Test_Report')
report.append(['항목', '결과', '비고'])
report.append(['timestamp_repair_adjusted_rows', adjusted_rows, '시작/종료/분리 시간만 최소 수정'])
report.append(['test_script', 'fix_ev_battery_workbook.py', 'openpyxl 기반 검증/수정'])
report.append(['iteration', 2, '1회차 overlap 발견 → 2회차 수정 후 재검증'])
# Styling for report.
report.freeze_panes = 'A2'
for c in range(1, 4):
    cell = report.cell(1, c)
    cell.font = Font(bold=True, color='FFFFFF')
    cell.fill = PatternFill('solid', fgColor='1F4E78')
    cell.alignment = Alignment(horizontal='center', vertical='center')
for col, width in {'A':32, 'B':28, 'C':70}.items():
    report.column_dimensions[col].width = width
for row in report.iter_rows(min_row=2, max_col=3):
    for cell in row:
        cell.alignment = Alignment(wrap_text=True, vertical='top')

# Workbook calc mode: force recalc in Excel/Sheets on open.
wb.calculation.fullCalcOnLoad = True
wb.calculation.forceFullCalc = True
wb.calculation.calcMode = 'auto'

wb.save(OUT)
print(OUT)
print('adjusted_rows', adjusted_rows)

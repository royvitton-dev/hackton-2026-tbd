# EV 배터리 관리 산출물 리소스

이 폴더는 `hackton-2026-tbd/베터리 관리/리소스` 하위에 배치할 최종 산출물입니다.

## 포함 파일

- `ev_battery_health_mock_data_10000_v2.xlsx`
  - 차량별 배터리 기초 정보, 사용자 mock 프로필, 10,000건 충전 세션, 피처 계산, 사용자별 BatteryCareScore/SOC 신뢰도 요약, 검증 시트를 포함한 최종 엑셀 데이터셋입니다.
- `ev_battery_health_mock_data_10000_v2_validation.json`
  - 최종 검증 결과 JSON입니다.
- `validate_ev_battery_workbook.py`
  - 엑셀 데이터셋 검증 스크립트입니다.
- `fix_ev_battery_workbook.py`
  - 세션 시간 겹침 등 데이터 정합성 수정에 사용한 스크립트입니다.

## 로컬 프로젝트에 복사

현재 실행 환경에서는 `/Users/demonic/object/git/hackton-2026-tbd` 경로에 직접 접근할 수 없습니다.
ZIP을 프로젝트 루트에서 풀거나, 아래 명령 형태로 복사하면 됩니다.

```bash
mkdir -p "/Users/demonic/object/git/hackton-2026-tbd/베터리 관리/리소스"
cp -R "베터리 관리/리소스/." "/Users/demonic/object/git/hackton-2026-tbd/베터리 관리/리소스/"
```

## 점수 정의 주의

이 데이터셋의 점수는 실제 BMS SOH 진단값이 아니라, 차량별 배터리 제원과 충전 세션 기반의 BatteryCareScore / SOCConfidenceScore입니다.

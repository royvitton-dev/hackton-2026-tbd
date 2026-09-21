요구사항을 구현하라.

작업 원칙:
- 코드 조사 → 최소 변경 → 테스트 → 실패 원인 분석 → 재수정을 반복하라.
- 모든 관련 테스트와 빌드가 통과해야 완료로 간주한다.
- 최대 8회 반복하고, 같은 장애가 3회 반복되면 원인과 필요한 사용자 입력을 보고하고 중단하라.
- 기존 구조와 스타일을 최대한 유지하고, 불필요한 대규모 리팩터링은 하지 마라.
- DB는 사용하지 않는다. 브라우저 localStorage와 정적 리소스 JSON 기반으로 구현한다.
- 외부 API 호출 없이 현재 프로젝트 내부 리소스와 정적 데이터만 사용한다.
- 하드코딩된 화면용 더미값을 제거하고, 리소스/계산 결과 기반으로 표시한다.
- TypeScript/ESLint/빌드 에러가 없도록 구현한다.

프로젝트 루트:
- /Users/demonic/object/git/hackton-2026-tbd

리소스 위치:
- 베터리 관리/리소스

리소스 파일:
- ev_battery_health_mock_data_10000_v2.xlsx
- ev_battery_health_mock_data_10000_v2_validation.json
- validate_ev_battery_workbook.py
- fix_ev_battery_workbook.py
- README_산출물_안내.md
- manifest.json

리소스가 없으면:
- 현재 프로젝트 안에서 find로 먼저 확인하라.
- 없으면 임의 구현하지 말고 필요한 파일명과 위치를 보고하라.

구현 목표:
전기차 배터리 관리 MVP를 구현한다.
차량별 배터리 기초 정보와 사용자별 충전 세션 데이터를 기반으로 SOC 신뢰도, BatteryCareScore, 충전 습관 분석, 사용자 가이드를 제공한다.

핵심 제품 정의:
- 차량 내부 BMS/SOH 직접 진단 서비스가 아니다.
- 차량별 배터리 제원과 충전 세션 로그 기반의 BatteryCareScore / SOCConfidenceScore 서비스다.
- 사용자에게 어떤 충전 습관이 배터리를 오래 안정적으로 쓰는 데 유리한지 안내한다.

필수 정책:
- 점수는 충전 1건으로 산정하지 않는다.
- 최소 조건을 만족해야 점수를 산정한다.
  - 충전 세션 5건 이상
  - 관측 기간 7일 이상
  - 누적 EFC 0.3 이상
- 조건 미충족 사용자는 점수 대신 INSUFFICIENT 상태와 추가 데이터 필요 안내를 표시한다.

데이터 처리 요구사항:
1. 엑셀 리소스에서 다음 시트를 읽거나 빌드/런타임에서 사용 가능한 JSON으로 변환하라.
   - 01_Vehicle_Master
   - 02_Score_Rules
   - 03_User_Profile_Mock
   - 04_Charge_Sessions_Raw
   - 05_Feature_Sessions
   - 06_User_Summary
   - 07_Guide

2. 브라우저에서 xlsx를 직접 읽기 어렵거나 번들이 커지면 개발 시점에 JSON으로 변환하는 스크립트를 추가하라.
   예:
   - scripts/convert-battery-xlsx-to-json.*
   - src/data/battery/vehicleMaster.json
   - src/data/battery/scoreRules.json
   - src/data/battery/mockUsers.json
   - src/data/battery/mockChargingSessions.json
   - src/data/battery/guides.json

3. 앱 런타임에서는 localStorage를 사용한다.
   localStorage key:
   - ev_battery_selected_user_v1
   - ev_battery_selected_vehicle_v1
   - ev_battery_charging_sessions_v1
   - ev_battery_health_state_v1
   - ev_battery_settings_v1

4. 최초 진입 시 localStorage에 사용자 데이터가 없으면 mock 사용자 중 하나를 기본 선택한다.
5. 사용자는 한 대의 차량만 가진다.
6. 사용자 전환 기능을 제공한다.
7. 사용자 선택 시 해당 사용자의 차량, 충전 세션, 점수, 가이드가 함께 갱신되어야 한다.

알고리즘 요구사항:
세션 단위 계산:
- chargingDurationMinutes = endedAt - startedAt
- idleMinutes = unpluggedAt - endedAt
- avgPowerKw = chargedKwh / chargingDurationHours
- deltaSocPct = chargedKwh / batteryUsableKwh * 100
- cRate = avgPowerKw / batteryUsableKwh
- chargerClass = AC_SLOW | DC_FAST | ULTRA_FAST
- isNightCharge = 23:00~07:00 충전 시작 또는 충전 구간이 심야 시간과 겹치면 true
- isLongIdle = idleMinutes >= 120
- isShortTopup = chargingDurationMinutes가 짧고 chargedKwh가 낮은 보충 충전이면 true
- isHighC = cRate가 높은 세션이면 true
- isDeepDischarge = mockTruthStartSocPct 또는 userReportedStartSocPct가 20% 미만이면 true
- isHighSocEnd = mockTruthEndSocPct 또는 userReportedEndSocPct가 90% 이상이면 true

사용자 단위 계산:
- sessionCount
- observationDays
- totalChargedKwh
- estimatedEfc = totalChargedKwh / batteryUsableKwh
- fastChargeRatio
- ultraFastChargeRatio
- slowChargeRatio
- nightSlowChargeRatio
- longIdleCount
- highSocIdleCount
- deepDischargeCount
- avgCRate
- maxCRate
- socAnchorCount
- dataCompletenessScore
- eligibleFlag
- socConfidenceScore
- batteryCareScore
- grade
- feedback/guides

점수 산정 방향:
- 급속/초급속 비중이 높으면 감점
- C-rate가 높으면 감점
- 저SOC 진입 후 급속 충전이 잦으면 감점
- 고SOC 종료 후 장시간 미분리/방치가 있으면 감점
- 심야 완속 충전 비중이 높으면 가점
- 20~80% 중심의 안정적인 충전 습관이면 가점
- 데이터가 부족하거나 관측 기간이 짧으면 점수 산정 보류
- 실제 BMS SOH처럼 표현하지 말고 충전 습관 기반 관리 점수로 표현하라.

UI 요구사항:
현재 프로젝트 구조를 조사해서 가장 자연스러운 위치에 구현하라.
기존 대시보드/차량/배터리 관련 화면이 있으면 그 화면에 최소 변경으로 연결하라.
없으면 새 페이지 또는 섹션을 추가하라.

화면 표시 항목:
1. 선택 사용자 정보
   - userId
   - driverProfile
   - 선택 차량
   - initialSocPct

2. 차량 배터리 정보
   - manufacturer
   - modelName
   - modelYear
   - trimName
   - batteryGrossKwh
   - batteryUsableKwh
   - batteryChemistry
   - packVoltageClass
   - maxAcChargeKw
   - maxDcChargeKw

3. 점수 카드
   - BatteryCareScore
   - SOCConfidenceScore
   - grade
   - eligibleFlag
   - insufficient 사유

4. 충전 습관 요약
   - 세션 수
   - 관측 기간
   - 누적 충전량
   - estimatedEfc
   - 급속 비율
   - 초급속 비율
   - 심야 완속 비율
   - 장시간 미분리 횟수
   - 저SOC 충전 횟수

5. 최근 충전 세션 테이블
   - startedAt
   - endedAt
   - unpluggedAt
   - chargerType
   - chargedKwh
   - avgPowerKw
   - cRate
   - deltaSocPct
   - idleMinutes
   - 주요 flag

6. 맞춤형 가이드
   - 좋은 습관
   - 주의할 습관
   - 다음 충전 추천 행동

문구 요구사항:
- “실제 SOH 진단”이라고 단정하지 마라.
- “BMS 연동 없이 충전 세션 기반으로 추정한 관리 점수”라고 표현하라.
- 데이터 부족 시: “최소 5건 이상, 7일 이상, 누적 0.3EFC 이상의 충전 데이터가 필요합니다.”
- 장시간 미분리 시: “충전 완료 후 장시간 연결 상태가 반복되면 고SOC 방치 스트레스가 커질 수 있습니다.”
- 급속/초급속 과다 시: “급속/초급속 충전 비중이 높습니다. 가능하면 일상 충전은 완속 위주로 분산하세요.”
- 심야 완속 우수 시: “심야 완속 충전 비중이 높아 안정적인 충전 습관으로 평가됩니다.”

차량 데이터 필수 필드:
- vehicleId
- manufacturer
- modelName
- modelYear
- trimName
- batteryGrossKwh
- batteryUsableKwh
- batteryChemistry
- packVoltage
- packVoltageClass
- maxAcChargeKw
- maxDcChargeKw
- certifiedRangeKm
- efficiencyKmPerKwh
- sourceUrl
- dataConfidence

충전 세션 데이터 필수 필드:
- sessionId
- userId
- vehicleId
- chargedKwh
- startedAt
- endedAt
- unpluggedAt
- chargerType
- paymentAmountKrw
- stationType
- taperDetected
- userReportedStartSocPct
- userReportedEndSocPct
- mockTruthStartSocPct
- mockTruthEndSocPct

검증 요구사항:
구현 후 다음을 반드시 확인하라.
1. 충전 세션 총 10,000건 로드 가능
2. 사용자 총 1,250명 로드 가능
3. 차량 마스터 20종 로드 가능
4. 사용자 1명당 차량 1대 매핑 유지
5. unknown user 없음
6. unknown vehicle 없음
7. startedAt < endedAt <= unpluggedAt 조건 위반 없음
8. 동일 사용자 충전 세션 시간 겹침 없음
9. 점수 산정 가능/불가 조건 정상 동작
10. UI에서 사용자 변경 시 값 정상 갱신
11. 빌드 통과
12. 테스트가 있으면 전체 테스트 통과
13. 린트가 있으면 린트 통과

테스트/빌드 수행:
프로젝트를 조사한 뒤 실제 존재하는 명령만 실행하라.
예:
- npm test
- npm run lint
- npm run build
- pnpm test
- pnpm lint
- pnpm build
- yarn test
- yarn lint
- yarn build
- ./gradlew test
- ./gradlew build

빌드 실패 시 원인을 분석하고 최소 수정 후 재실행하라.

성능 요구사항:
- 10,000건 세션을 브라우저에서 한 번에 무겁게 렌더링하지 마라.
- 최근 세션은 기본 20~50건만 보여주고, 필요하면 페이지네이션 또는 slice를 사용하라.
- 계산은 useMemo, 캐시 함수, selector 등 프로젝트 스타일에 맞게 불필요한 반복을 줄여라.
- localStorage에는 필요한 선택 상태와 세션 원본/계산 결과만 저장하라.

구현 산출물:
- 데이터 변환 스크립트 또는 정적 JSON
- Battery scoring engine
- localStorage adapter
- 사용자/차량 선택 로직
- 대시보드 UI 반영
- 검증 로직 또는 테스트
- README 또는 주석으로 실행 방법 보완

최종 보고 형식:
1. 구현 요약
2. 변경 파일 목록
3. 데이터 로드 결과
4. 점수 산정 조건 동작 결과
5. 실행한 테스트/빌드 명령과 결과
6. 남은 한계 또는 사용자 확인 필요 사항

바로 코드 조사를 시작하고, 구현-테스트-수정 루프를 수행하라.

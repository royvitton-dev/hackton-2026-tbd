# Cellwise EV Battery Care MVP

차량 제원과 충전 세션 로그로 `BatteryCareScore`와 `SOCConfidenceScore`를 계산하는 정적 웹 대시보드입니다. DB나 외부 API를 사용하지 않으며, 제공된 엑셀을 JSON으로 변환해 사용합니다. BatteryCareScore는 Schmalstieg–Ecker NMC111/graphite 열화식을 적용한 25°C 기준 상대 스트레스 점수이며 실제 BMS SOH 진단값이 아닙니다.

## 실행

Node.js 20.19 이상을 사용합니다.

```bash
npm install
npm run convert:data
npm run dev
```

데이터 검증과 품질 확인:

```bash
npm run validate:data
npm run validate:scenarios
npm run lint
npm test
npm run build
```

변환 스크립트는 `resoures/ev_battery_health_mock_data_10000_v2.xlsx`의 필수 7개 시트를 읽습니다. 원본 시트 `05_Feature_Sessions`와 `06_User_Summary`의 수식 결과는 브라우저 점수 엔진에서 다시 계산하며, 변환한 시트 구조와 행 수는 `public/data/battery/workbookSchema.json`에 남깁니다. `resoures/images/image_sources.json`이 있으면 20종의 `vehicleId`별 대표 이미지와 출처도 정적 자산으로 동기화하며, 사용자 전환 시 차량 제원과 함께 갱신합니다.

임의 점수 가중치는 사용하지 않습니다. 잔량과 시간이 유효한 기록이 최소 5건·7일·0.3EFC를 충족하면 점수를 표시합니다. 배터리 종류 미확정 또는 1C 초과 기록은 전체 보류 대신 표준 NMC 셀을 가정한 **참고 평가**로 표시하며, 실제 화학계 차이·급속 충전 열화는 평가하지 않습니다. 결측·유효하지 않은 기록은 제외하고 반영/제외 건수를 표시합니다. 현재 1,188명은 점수 표시, 62명은 최소 데이터 부족으로 보류합니다. 온도는 미제공이므로 25°C를 가정하며, 0–100점 환산과 조건 완화 자체는 논문으로 검증된 진단법이 아닙니다. 상세 식과 한계는 `../docs/battery-scoring-methodology.md`를 참고합니다.

## 저장 정책

전체 10,000건은 정적 JSON에서 한 번 로드한 뒤 사용자별로 메모리 인덱싱합니다. localStorage에는 선택 사용자/차량, 해당 사용자의 원본 세션, 최근 계산 결과와 UI 설정만 저장합니다. 최근 세션 표는 기본 20건만 렌더링합니다.

## 확장 충전 패턴 검증

8주·9개 생활 패턴의 합성 데이터 18,189건/360명을 별도로 추가했습니다. 기존 자료와 합산하면 28,189건/1,610명/20종입니다. `npm run generate:scenarios`로 재생성하고 `npm run validate:scenarios`로 재현성과 시간·차량·충전량·잔량 연결을 검증합니다. 기본 화면 데이터는 교체하지 않으며 테스트용 JSON은 브라우저에 로드하지 않습니다.

최소·최대 통계, 패턴별 점수, 실제 연구와의 비교 및 한계는 [확장 데이터 검수 보고서](tests/fixtures/README.md)를 참고하세요. 실제 운전자 분포나 실차 SOH 검증을 완료한 데이터는 아닙니다.

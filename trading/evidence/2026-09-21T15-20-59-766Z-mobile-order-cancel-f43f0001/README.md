# 모바일 실제 주문·체결·취소·새로고침

2026-09-22 00:20:59–00:26:46 KST, 기존 독립 UI http://127.0.0.1:5175/와 실행 중인 엔진·12봇을 이용했다. 임시 브라우저 탭13에390×844 viewport를 적용하고 user-03(시연 임직원3 / GS건썰)을 선택했다. 브라우저 조작은 root가 수행했으며 이 문서는 보존된 원본을 기준으로 작성했다.

| 단계 | 실제 결과 |
| --- | --- |
| 시작 | 1,000,000P / 1,000h, 예약0, 주문·체결0 |
| 첫 매수 | 1P×1h, 주문115979, durable 명령133026. placed.jpg에 미체결과1P 예약 |
| 기존 봇과 체결 | bot-05가 상대방인 trade74196, 명령133076, 00:21:38.744 KST. 999,999P / 1,001h, 예약0 |
| 두 번째 매수 | 같은1P×1h, 주문116413, durable 명령133569. second-placed-dom.txt에999,998P available +1P reserved |
| UI 취소 | 주문116413 취소, durable 명령133574. cancel-confirmed DOM에 취소 확정; 대응 JPG에는 미체결0이 보이며 확정 배너는 화면 밖이다. 999,999P /1,001h, 예약0 |
| 새로고침 | 계정을 다시 선택하고 요청 결과 탭에서 세 UUID 복원. reload-requests-dom의 codes 및 reload-requests.jpg |

첫 주문은 취소용 미체결로 남을 것으로 예상했지만 실제 봇에 체결됐다. 뒤이은 읽기 검증의 미체결 가정이 실패했으며 원본 placed-state.json에 실제 체결과 잔고가 있다. 이를 취소 성공으로 간주하거나 되돌리지 않았다. 별도 두 번째 주문에서 취소를 확인했다.

첫 새로고침 직후의 요청 탭 선택은 유지되지 않았다. reload-dom/reload-confirmed-dom은 미체결 탭이고 배너의 취소 UUID만 있다. 이후 요청 탭을 명시적으로 다시 선택한 reload-requests-dom에 세 고유 UUID가 모두 있다. 초기 클릭이 유지되지 않은 원인은 확정하지 않는다. 현재 공개 상태의 완료 주문 목록은 제한된 시장 전체 범위이므로, 나중 상태에서 두 주문이 빠진 사실을 영속 데이터 삭제로 해석하지 않는다.

세 lookup 파일은 공개 요청 조회 API가 반환한 accepted/durable=true 원본이다. 최초 ACK의 trades=[]는 당시 호가장에 접수된 결과이며 이후 봇 체결을 포함하는 결과가 아니다. before/placed/final state의 전체 자산은15,000,000P·15,000h로 보존됐다. 예약 해제와 사용자 잔고의1P 감소/1h 증가가 실제 체결과 일치한다.

문서 폭375px≤viewport390px, 캡처한 console warning/error0. 마지막 browser-cleanup.json에서 탭13 닫기와 viewport 복원을 확인했다. 기존 사용자 탭과 엔진·Park는 재시작하지 않았다. 브라우저DOM과 API는 순차 수집으로 동일 순간이 아니며, 동작 중인 봇과 합성 수동 주문이 장시간 관찰에 포함된다. 이 자료는 quiet benchmark나 모바일 실기기 테스트가 아니다.

원본 검산은 `node evidence/2026-09-21T15-20-59-766Z-mobile-order-cancel-f43f0001/verify-artifacts.mjs`로 수행했다. verified.json이 이미 있으면 덮어쓰기를 거절한다. root 최초 PowerShell 검산은 UUID를 축약 표시된 body text에서 찾는 잘못된 단언 때문에 실패했다. 실제 캡처의 code 원문 배열에 세 UUID가 있어 그 필드를 검증하도록 고쳤다. 원래 오류 문자열은 `Mobile artifact verification mismatch`였으며 운영 거래 실패가 아니다.

[독립 검토](../2026-09-21T15-31-30-570Z-mobile-order-independent-review-0ef65e58/README.md)는 원본32개와 소스3개, JPG4개를 대조했다. 반환된 JPG는375×812로 DOM viewport390×844와 다르며, 세 UUID 전체는 화면 이미지 하나가 아닌 DOM의 code 원문으로 확인했다. 원본은 변경하지 않았다.

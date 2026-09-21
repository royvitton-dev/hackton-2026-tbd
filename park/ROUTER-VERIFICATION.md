# 통합 서버 검증 기록

2026-09-21 UTC, macOS Chrome/SwiftShader에서 검증했습니다.

| 검증 | 결과 |
| --- | --- |
| `npm run server:test` | 20개 통과 |
| 경로·프록시 커버리지 | 줄 100%, 문장 94.82%, 함수 90.47%, 분기 85% |
| 통합 개발 모드, 5193 | 10개 브라우저 테스트 통과, 골든 독립 비교 통과 |
| 통합 배포 모드, 5194 | 10개 브라우저 테스트 통과, 같은 골든 독립 비교 통과 |
| `npm test` | 차량 데이터·점수 회귀 12개 통과 |
| 원격 병합 후 `npm run build` | Vite 6개 앱과 Next.js 통합 빌드 통과 |
| 최종 5190의 차량 경로 | GLB·충전 이력·API·사용자 유지 1개 테스트 통과 |
| 최종 5190의 `npm run park:test:golden` | 기존 파크 9개 테스트 통과, 기준 이미지 변경 없음 |
| 보고서 HTTP | `/reports/router/`, `/reports/router/e2e/`, `/reports/router/coverage/` 모두 200 |

개발·배포 브라우저 테스트는 모든 localhost/127.0.0.1 HTTP 및 WebSocket 요청의 포트가 해당 통합 서버 포트와 일치하는지 검사합니다. PC·모바일 디렉터리와 B2 동선 화면은 골든 기준을 검토한 뒤 갱신 옵션 없는 별도 실행으로 비교했습니다.

원격 병합 시 README의 차량 안내 충돌은 최신 모델 목록과 새 `/vehicle/` 주소를 함께 보존하여 해결했습니다. 이후 전체 빌드를 다시 통과했고 최종 로컬 서버에서 차량 경로를 재검증했습니다.

현재 사용자용 서버는 http://localhost:5190/projects/ 입니다. 검증용 5193·5194 서버는 종료했습니다. 파크의 무한 자동 입장 검증과 기존 10분 커밋 감시를 유지합니다.

실제 Rust 거래 엔진은 이 환경에서 실행되지 않았습니다. 거래소 UI와 동일 출처 요청, 모의 백엔드의 HTTP/WebSocket 전송·장애 동작을 검증했습니다. `/voice/`는 macOS CLI 실행 안내이며 네이티브 마이크 동작을 브라우저 테스트 통과로 간주하지 않습니다.

HTML: [통합 검증](http://localhost:5190/reports/router/), [기존 파크](http://localhost:5190/reports/), [무한 순회](http://localhost:5190/reports/circuit/).

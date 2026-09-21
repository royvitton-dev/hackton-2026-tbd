# Wonder Park 자동 시작 연결 검증

2026-09-21 21:59–22:03 KST. 사용자 요청에 따라 `park/server.mjs`의 시작 콜백과 거래소 입장 API를 `scripts/park-launcher.mjs` → `demo.mjs ensure`에 연결했다.

- `verify.mjs`가 실제 Park 서버를 별도 5196 포트, 별도 상태 파일로 실행했다. 원래 5190 파크와 실행 중인 시장을 유지했다.
- 시작 직후 `Trading reused: http://127.0.0.1:5175` 로그 확인. 등록 조회와 입장 POST가 HTTP 200 및 정확한 UI 주소를 반환했다.
- 실제 브라우저에서 휴가 거래소 카드 → 입장 → 준비 완료 모달과 5175 링크를 확인했다. 동일 검증 탭을 그 주소로 이동해 시장 연결됨, 12개 봇, 엔진 정상 운영을 확인했다. 새 창 생성 여부는 검증 범위에 포함하지 않는다.
- 검증용 탭을 닫고 `stop.request`로 소유한 추가 Park PID21732만 종료했다. 실제 종료 SIGTERM, supervisor exit0. 실행 중 시장의 manifest 바이트는 전후 동일했다. 원본 파크 상태 파일은 PID19636/5190을 유지했다.

`run.json`은 이 실행 시점 소스 해시와 실제 시간을 담는다. 이후 독립 리뷰에서 발견한 wrapper 강제 종료 문제를 수정했다. 현재 wrapper는 CLI를 중간에 죽이지 않고 CLI의 준비·정리 완료를 기다린다. 최종 wrapper 단위 5/5 및 구문 검사는 `../20260921T130450249Z-park-launcher-final-59fa1535`에 있다.

이번 실제 Park 실행은 **실행 중 시장 재사용** 경로다. 전체 미실행 상태의 신규 시작은 기존 검증된 `start` 경로에 연결하고 정책/잠금 검사로 검증했으며, 이번에는 진행 중 6시간 관찰을 중단해 새 시장을 띄우지 않았다. 실제 UI 단독 복원은 원래 demo의 `frontend-recovery-2026-09-21T12-52-39-767Z-7c1fadc6`에 기록했다.

처음 한 번 `trading/scripts/setup.ps1`로 의존성과 release 빌드를 준비한 뒤 루트 `npm run park:dev` 또는 `npm run park:preview`가 거래소 준비를 수행한다. 기존에 이미 실행 중인 5190 서버는 소스를 다시 읽지 않으므로 다음 시작부터 적용된다. Park 종료는 공유 거래소를 종료하지 않으며 거래소 종료 명령은 `node scripts/demo.mjs stop`이다.

22:09 확인에서 원래 Park19636과5190/5290 listener가 사라져 있었다. 이 작업은 해당 PID를 종료하지 않았으며 원인은 미확정이다. 기본5190 재실행을 시도한 명령은 CreateProcess 이전 자동 승인검토에서 `blocked by policy`로 거절됐다. 재시도하거나 우회하지 않았다. 이후 원격main의 공통 npm명령이 변경되어 최종 실행 안내는 `npm run park:dev`로 맞췄다.

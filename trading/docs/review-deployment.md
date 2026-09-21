# 배포 준비 독립 검토

검토일: 2026-09-21 KST. 범위: `trading/frontend`, `trading/deploy`, 선택적 루트 링크 어댑터 및 관련 문서. 기존 시연 서버·봇·데이터를 유지했고 Docker 실행과 외부 배포는 수행하지 않았다.

## 결론

Vite production 산출물을 기존 dev 서버와 분리하여 재현할 수 있으며, Vercel UI / 별도 영속 Rust 엔진의 배포 설정이 준비되어 있다. 입증한 범위는 로컬 production 빌드, 정적 산출물 HTTP 제공, 격리 엔진의 Origin 설정, 실제 production 브라우저 주문·체결·취소·리로드와 fixture 정상 종료다. Vercel 원격 빌드·실제 HTTPS/WSS·컨테이너 실행과 루트 앱 적용은 완료로 표시하지 않는다.

## 발견한 빈틈과 조치

| 관찰 | 조치 / 현재 상태 |
| --- | --- |
| 이전 Vite dev 화면 QA만으로 production bundle을 실제 제공했다고 볼 수 없었음 | 새 evidence outDir에 빌드하고 Vite preview 5177에서 제공. dev 5175와 `frontend/dist`를 덮어쓰지 않음 |
| 현재 demo 엔진의 허용 Origin은 5175뿐이어서 5177 화면을 직접 연결할 수 없음 | 새 데이터·release 바이너리 복사본의 격리 엔진 8790 생성, `http://127.0.0.1:5177`만 허용. Origin 우회나 기존 엔진 재시작 없음 |
| 루트 연결 문서는 anchor 예시만 있었음 | `frontend/src/integration/ExchangeLink.tsx` 및 [적용 절차](integration-adapter.md) 준비, strict TypeScript 검사 통과. 기존 앱에는 미적용 |
| Vercel Install Command를 plain pnpm으로 강제하는 지침은 오래된 pnpm 선택 위험이 있음 | 기본 자동 감지 + `ENABLE_EXPERIMENTAL_COREPACK=1` + `packageManager: pnpm@11.25.0`로 문서 정정. 원격 실제 버전은 아직 미검증 |
| 로컬 preview가 Vercel 설정까지 검증한 것으로 오해될 수 있음 | preview는 `vercel.json`의 보안 헤더·호스팅·TLS를 적용하지 않는다는 한계를 명시 |

Vercel의 현재 공식 문서는 Vite 정적 배포, Corepack packageManager 선택, 그리고 WebSocket 연결이 Function 최대 실행 시간에 종료된다는 점을 설명한다. 별도 Rust 엔진 선택은 공유 거래 상태와 영속 파일을 한 writer가 소유하기 위한 결정이다. WebSocket 미지원이라는 과거 전제를 사용하지 않는다. [Vite](https://vercel.com/docs/frameworks/frontend/vite), [Package Managers](https://vercel.com/docs/package-managers), [Corepack](https://vercel.com/docs/builds/configure-a-build#corepack), [WebSockets](https://vercel.com/docs/functions/websockets).

## 실제 fixture와 증거

Run ID: `frontend-production-20260921T093830224Z-33aae872`.

| 항목 | 실제 값 |
| --- | --- |
| UI | `http://127.0.0.1:5177` |
| API / WS | `http://127.0.0.1:8790` / `ws://127.0.0.1:8790/ws` |
| Preview PID | `16560` (시작 당시 값; 사용 전 manifest·프로세스 정체성 확인) |
| 격리 엔진 PID | `18372` (시작 당시 값) |
| 데이터 | `evidence/<run-id>/engine-data` — 새 빈 데이터, 실제 demo 데이터 복사 없음 |
| 정적 파일 | `evidence/<run-id>/dist` |
| 환경·명령·PID·해시 | `evidence/<run-id>/processes.json`, `artifact-sha256.json` |
| 타입·빌드 | `processes.json`의 `tsc -b` 명령·준비 완료 기록과 `build.log`. 타입 검사가 무출력이어서 별도 `typecheck.log`는 생성되지 않음; 시작 스크립트는 타입 검사 실패 시 빌드 전에 중단 |
| HTTP 정적 검증 | `verify-static.mjs`, `static-verification.json`; passed true |
| 기존 시연 보존 | `demo-preserved.json`; 기존 engine·frontend·12 bots PID 모두 실행 중, 데이터 경로 분리 |
| 포트 충돌 보호 | `occupied-port-guard.log`; 재실행은 exit 1로 거절, 두 기존 fixture PID 유지 |
| Production 브라우저 | `browser/`의 DOM·PNG·`verified-state.json`·`browser-console.json` |
| 정상 종료 | `shutdown-verification.json`; fixture 두 PID 종료·두 포트 해제, 기존 demo 14개 PID 실행 유지 |

Vite 7.3.6 production build는 JS 262.19 kB (gzip 82.39 kB), CSS 119.97 kB (gzip 33.95 kB)를 생성했다. 폰트는 로컬 woff2 자산이며 이 크기에는 별도로 표시된다. 빌드 경고의 “outDir is not inside project root and will not be emptied”는 frontend 밖의 새 evidence 디렉터리에 빌드했기 때문이다. 삭제 옵션을 켜지 않았고 실제 산출물과 빌드 성공을 확인했다.

저장소의 기존 `dist/` ignore 규칙은 이 evidence 안의 정적 산출물에도 적용된다. 빌드 파일은 로컬에 보존하고 Git에는 명령·해시·검증 로그를 남기는 형태다. 별도 dist ignore 추가는 필요하지 않았다. 반대로 루트 `.env.*` 규칙이 공개 URL 템플릿 `.env.production.example`까지 숨기던 점은 `frontend/.gitignore`의 정확한 예외로 수정했고, 해당 템플릿이 추적 가능한 untracked 파일로 표시됨을 확인했다. 실제 `.env`나 비밀값을 예외 처리하지 않는다.

HTTP 검증은 HTML·JS·CSS·SVG·폰트를 포함한 130개 파일의 응답 200과 SHA-256 일치를 확인했다. HTML은 `/assets/` 번들을 참조하고 `/@vite/client` 및 `/src/main.tsx`를 참조하지 않는다. 번들에 격리 API/WS 8790 설정이 포함됐다. API는 지정한 Origin으로 상태 200과 일치하는 Access-Control-Allow-Origin을 반환했고, 5175 Origin의 preflight에는 허용 헤더를 반환하지 않았다. 이 검증은 명령을 제출하지 않았다. 첫 상태는 ready, command/event 순번 0, 주문·체결 0이었다.

fixture는 봇 없이 시작했다. 주 작업의 실제 production 브라우저 QA에서 user-01이 1,000 P × 4시간 매수 주문을 내고, user-02가 990 P × 2시간 매도하여 maker 가격 1,000 P로 2시간 체결됐다. user-01의 남은 2시간은 취소했다. 명령·이벤트 순번 3, 주문 2, 체결 1이며 buyer 998,000 P / 1,002시간, seller 1,002,000 P / 998시간, 양쪽 예약 0, 총자산 보존을 확인했다. 새로고침 후에도 복원됐고 브라우저 warn/error는 없었다. `browser/verified-state.json`을 읽어 서버 상태와 이 결과를 대조했다. 브라우저 셀렉터 문구 차이를 수정한 도구 재시도는 제품 결함으로 기록하지 않는다.

## 재실행·종료

```powershell
Set-Location C:\project\hackton-2026-tbd\trading\frontend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-production-preview.ps1
```

기본 포트 5177·8790이 비어 있을 때만 시작한다. 매 실행에 고유 run ID, 새 데이터와 산출물을 사용한다. Windows PowerShell 스크립트이며 다른 OS 실행을 검증하지 않았다. 설정한 환경변수는 스크립트 종료 시 기존 프로세스 값으로 복원한다.

새로 시작한 fixture는 해당 시작 명령이 출력한 `processes.json`의 절대 경로로 종료한다. 위 검증 run은 이미 종료했으므로 그 과거 manifest를 새 실행의 종료 명령에 재사용하지 않는다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-production-preview.ps1 -ManifestPath '<새 실행에서 출력된 절대 processes.json 경로>'
```

종료 스크립트는 manifest 종류와 PID 명령줄을 확인한 뒤 엔진 정상 shutdown을 요청하고 preview 프로세스를 종료한다. 데이터나 증거를 삭제하지 않는다. 브라우저 QA 완료 후 실제 종료 명령도 exit 0으로 완료했다. 현재 manifest 상태는 stopped이며 기존 dev/엔진/12개 봇은 유지했다.

## 좁은 후속 검증 계획과 남은 경계

1. 초기 상태·두 계정 주문/체결/예약/취소·리로드의 production 브라우저 검증은 완료했고 `browser/`에 보존했다. 향후 UI 변경 뒤 필요하면 새 run으로 재검증한다.
2. 격리 엔진 종료·같은 데이터 복구가 필요한 경우 manifest의 바이너리·환경·데이터 경로를 유지한다. 다른 fixture 데이터와 섞지 않는다.
3. 향후 승인된 Vercel 배포에서 Root Directory `trading/frontend`, Node 24.x, 실제 pnpm 11.25.0, `dist`, HTTPS/WSS 공개 주소, 정확한 Origin을 빌드·네트워크 로그로 확인한다. 현재 기본 pnpm 지원 표에 11이 없으므로 Corepack 설정을 실제 원격 빌드 증거로 대체해야 한다.
4. Dockerfile·Compose·Caddy 예시는 정적 검토만 수행했다. Rust Linux 빌드, 컨테이너 UID 10001의 볼륨 쓰기·재시작 복구, SIGTERM·TLS·WSS는 실제 컨테이너/배포 환경에서 검증해야 한다. 현재 Docker·외부 배포를 실행한 것으로 주장하지 않는다.

루트 앱과 어댑터의 시각적 조화·새 탭 연결은 실제 적용 이후 검증 대상이다. 이번 결과는 독립 UI를 보존한 배포 준비와 미적용 연동 산출물이다.

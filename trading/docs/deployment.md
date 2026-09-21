# 배포 준비 — Vercel 프런트엔드와 별도 Rust 엔진

이 문서는 배포 설정과 실행 절차의 준비 상태를 설명한다. **실제 외부 배포·프로젝트 업로드·가입·결제는 수행하지 않았다.** 온라인 주소·인증서·영속 볼륨은 실행할 환경이 정해진 뒤 운영자가 설정해야 한다.

## 구조와 현재 공식 문서 확인

Vercel에는 `trading/frontend`에서 빌드한 정적 React/Vite UI만 배치한다. Rust 엔진은 별도 상시 실행 프로세스 또는 컨테이너로 운영하고 영속 저널·스냅샷 디렉터리를 연결한다. 봇도 엔진과 통신하는 독립 프로세스다. 브라우저는 엔진의 HTTPS API와 WSS 전체 상태 스트림을 직접 사용한다.

2026-09-21 확인한 공식 문서에 따르면 Vercel은 Vite 정적 산출물 빌드와 환경변수를 지원한다. Root Directory와 Output Directory는 프로젝트의 빌드 설정으로 지정한다. [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Configuring a Build](https://vercel.com/docs/builds/configure-a-build).

현재 Vercel Functions는 WebSocket 연결을 지원하며 Fluid compute를 사용한다. 연결은 Function 최대 실행 시간에 종료될 수 있어 재연결이 필요하다. 따라서 “Vercel은 WebSocket을 지원하지 않는다”는 과거 설명은 이 프로젝트의 설계 근거로 사용하지 않는다. 별도 Rust 엔진 선택은 지속되는 단일 writer 시장과 영속 저널·스냅샷 소유권을 명확히 하기 위한 결정이다. Vercel Function의 인스턴스 메모리를 공유 호가장·잔고 저장소로 사용하지 않는다. [Vercel WebSockets](https://vercel.com/docs/functions/websockets).

## Vercel 설정

| 항목 | 값 |
| --- | --- |
| Root Directory | `trading/frontend` |
| Framework Preset | Vite |
| Install Command | 기본 자동 감지 유지. Corepack 활성화 및 실제 pnpm 버전을 빌드 로그에서 확인 |
| Build Command | `pnpm build` |
| Output Directory | `dist` |
| Development Command | `pnpm dev` |
| Node.js Version | `24.x` (`package.json` engines에 명시) |
| 빌드 도구 설정 | `ENABLE_EXPERIMENTAL_COREPACK=1` |
| 클라이언트 환경변수 | `VITE_API_URL`, `VITE_WS_URL` |

`frontend/vercel.json`은 Vite·빌드·출력 디렉터리와 기본 보안 헤더를 명시한다. Root Directory는 Vercel 프로젝트 설정에 별도로 입력한다. UI 내 탐색은 해시(`#market`, `#my-orders`, `#bots`)를 사용하므로 서버 경로 rewrite가 필요 없다. `pnpm-lock.yaml`과 `package.json`의 버전을 함께 유지한다. 로컬 검증은 Node 24.19.0 / pnpm 11.25.0으로 수행했다. Node 24.x는 현재 Vercel의 지원 기본 버전이며 패치 버전은 서비스에서 관리한다. [Supported Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

`pnpm-workspace.yaml`은 pnpm 11의 설정 파일로 빌드에 필요한 `esbuild` 설치 스크립트만 명시적으로 허용한다. 로컬 저장소 경로는 `../.tools/pnpm-store`이며 `trading` 안에 머문다. 배포 빌드 캐시가 다른 위치여야 한다면 해당 환경에서 `pnpm_config_store_dir`를 지정하고 설치와 빌드 모두 같은 값을 유지한다.

Vercel 공식 기본 제공 목록은 pnpm 6~10이며 로컬 환경은 pnpm 11.25.0이다. 이 차이를 묵인하지 않고 Corepack을 켜서 `packageManager`에 고정한 버전을 사용하도록 준비한다. 공식 문서의 Corepack 선택 동작을 근거로 한 설정이며, 실제 Vercel 빌드에서의 pnpm 11 실행은 아직 미검증이다. 배포 전 빌드 로그의 실제 Node·pnpm 버전을 확인해야 한다. [Package Managers](https://vercel.com/docs/package-managers), [Corepack build configuration](https://vercel.com/docs/builds/configure-a-build#corepack).

공식 문서는 plain `pnpm install`을 Install Command로 강제하면 빌드 컨테이너의 가장 오래된 pnpm을 선택할 수 있다고 경고한다. 따라서 `vercel.json`에는 installCommand override를 넣지 않고 기본 감지와 Corepack 설정을 함께 사용한다. 로컬 의존성 재현 확인은 `pnpm install --frozen-lockfile`로 실행할 수 있다. 온라인 빌드에서 다른 pnpm 버전이 찍히면 배포 성공으로 간주하기 전에 설정을 수정해야 한다. [Package Managers](https://vercel.com/docs/package-managers).

환경변수 예시는 `frontend/.env.production.example`에 있다. `engine.example.com`은 실행 가능한 서버 주소가 아니라 명시적인 교체용 자리표시자다.

```dotenv
VITE_API_URL=https://<실제-엔진-도메인>
VITE_WS_URL=wss://<실제-엔진-도메인>/ws
```

Vite의 `VITE_*` 값은 클라이언트 번들에 포함되므로 URL처럼 공개 가능한 값만 넣는다. 서버 비밀키·인증서·인증 토큰을 넣지 않는다. 환경변수 변경 후 프런트엔드를 재빌드해야 한다. 개발/Preview/Production의 값을 구분해 지정한다. [Vercel Environment Variables](https://vercel.com/docs/environment-variables).

배포된 브라우저의 `localhost`는 배포 서버가 아니라 해당 접속자의 PC다. UI는 비로컬 호스트에서 API/WS 설정 누락 또는 HTTP/WS·localhost 설정을 감지하면 주문 연결을 중단하고 설정 안내를 표시한다. 실제 공개 주소로 HTTPS/WSS를 설정한 뒤 브라우저 네트워크와 주문 흐름을 다시 검증해야 한다.

## 엔진 운영 설정

상세 실행 패키지와 통합 명령은 `trading/README.md` 및 엔진 배포 파일을 따른다. 엔진이 현재 읽는 설정:

| 변수 | 로컬 기본값 / 배포 준비 |
| --- | --- |
| `ENGINE_BIND` | `127.0.0.1:8787`. 컨테이너 내부는 필요한 경우 `0.0.0.0:8787`; 호스트 공개는 TLS 프록시 뒤에서 제어 |
| `ENGINE_DATA_DIR` | 데이터 디렉터리. 컨테이너 수명과 별개인 영속 볼륨의 절대 경로로 설정 |
| `ALLOWED_ORIGINS` | 쉼표로 구분한 정확한 UI Origin. 공개 시 `https://<실제-UI-도메인>`만 허용 |
| `ALLOW_REMOTE_DEMO` | 비로컬 바인딩의 모의 거래 공개를 명시적으로 허용할 때만 `true` |

위 데모 허용 설정은 모의 계정 매핑의 공개 시연을 허용할 뿐 실제 사용자 인증을 추가하지 않는다. 합성 데이터 전용 공개 시연 환경의 접근 범위를 운영자가 제한해야 한다.

엔진 바이너리·컨테이너 재배포와 무관하게 데이터 볼륨을 그대로 다시 연결한다. 동일 영속 데이터 경로를 여러 엔진 writer가 동시에 열지 않는다. 시작 시 저장소 복구가 끝난 뒤 `/health`, `/api/state`를 확인하고 브라우저 접속을 허용한다. 기존 저널·스냅샷·손상 증거는 임의 삭제하지 않는다. 장애 복구 정책은 스토리지 ADR과 테스트 기록을 따른다.

TLS 프록시는 HTTPS 요청과 `/ws`의 WebSocket upgrade를 엔진으로 전달하고 연결 idle timeout을 시연 시간에 맞춰 설정한다. `Origin`은 HTTP와 WebSocket 양쪽에서 정확히 제한한다. 서버 방화벽에서 원시 엔진 포트를 직접 공개하지 않고 필요한 TLS 포트로 접근시킨다.

## 봇 위치와 연결

온라인 시연 준비 형태는 엔진과 동일 서버 또는 접근 가능한 별도 서버에서 12개 봇 프로세스를 실행하는 방식이다. 봇은 엔진 공개 API URL 또는 같은 호스트의 내부 API URL을 설정하고 각자의 고유 모의 계정·seed·로그를 사용한다. 엔진 상태를 직접 수정하지 않는다. 브라우저 프런트엔드를 Vercel에 올리는 것만으로 봇이 실행되지는 않는다.

로컬에서 봇을 실행해 원격 엔진을 시연할 수도 있으나 해당 PC 프로세스 종료·네트워크 단절이 시연 중단 원인이 된다. 본 납품의 기본 검증은 localhost 전체 시연이며 실제 원격 서버·TLS·Origin·Vercel 호스팅 상태는 별도 검증 대상이다.

## 실행 전 검토 순서

1. 로컬 frontend `pnpm build` 및 엔진 release 빌드가 통과했는지 기록 확인.
2. 실제 도메인·TLS·허용 Origin·영속 볼륨을 구체적인 값으로 설정.
3. 운영자가 외부 업로드·배포를 명시적으로 승인한 뒤에만 배포 수행.
4. 실제 브라우저에서 전체 상태 수신, 주문·취소·체결·잔고 변화, WS 재연결을 검증.
5. 엔진 재시작 후 같은 데이터·요청 ID의 조회와 중복 방지 확인.
6. 실제 서버에서 12개 봇 실행 및 최소 10개 API 참여·5분 시장 변화를 검증.

Wonder Park에는 `trading/attraction.json`으로 로컬 독립 UI 주소를 등록했다. 기존 파크 소스 수정 없이 입장 링크가 연결되며, 전체 시연 프로세스는 별도로 시작해야 한다. 공개 환경에서는 등록 URL도 실제 HTTPS UI 주소로 교체한다. 다른 호스트용 선택적 React 어댑터와 실제 검증 범위는 `ui.md`에 있다.

## 격리된 로컬 production preview

개발 서버의 화면 확인과 production 산출물 확인은 다르다. `frontend/scripts/start-production-preview.ps1`은 매번 새 evidence run 아래에 production `dist`, release 엔진 복사본과 빈 합성 데이터 디렉터리를 만든다. 기본 주소는 UI `http://127.0.0.1:5177`, 엔진 `http://127.0.0.1:8790`이며 해당 UI Origin만 허용한다. 기존 개발 UI 5175·엔진 8787·12개 봇·데이터는 변경하지 않는다.

```powershell
Set-Location C:\project\hackton-2026-tbd\trading\frontend
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-production-preview.ps1
# 출력된 processes.json 경로를 사용하여 시연 종료
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-production-preview.ps1 -ManifestPath '<출력된 절대 processes.json 경로>'
```

두 포트가 이미 사용 중이면 시작을 거절한다. 종료 스크립트는 기록된 PID의 명령줄 정체성을 확인하고 격리 엔진만 정상 종료한다. 데이터·빌드·원본 로그는 삭제하지 않는다. 이 preview는 Vercel 보안 헤더·TLS·원격 네트워크를 재현하지 않는다. 구체적인 검증 범위와 미검증 항목은 [배포 준비 독립 검토](review-deployment.md)를 따른다.

# Wonder Park · Sites 배포

Sites용 빌드는 파크와 모든 웹 화면을 한 사이트의 하위 경로로 제공합니다. 기존 로컬 통합 서버는 그대로 사용할 수 있습니다.

## 경로

| 경로 | 기능 |
| --- | --- |
| `/park/` | Wonder Park 3D 파크와 8개 어트랙션 입장 |
| `/projects/` | 전체 프로젝트 목록 |
| `/map/`, `/map/mobility.html` | ATLAS 도면·모빌리티 |
| `/map_new/`, `/map_new/?view=address` | 주차 내비게이션·주소 기반 건물 |
| `/dopamin/` | BREW RACERS |
| `/pinball/` | DROP LAND |
| `/webpage/`, `/webpage/health/` | DEBUT : ON·VITALIS |
| `/battery_health/` | EVision 3D 차량·충전 이력 |
| `/vehicle/` | 사용자 선택을 보존하는 배터리 화면 리다이렉트 |
| `/movie/` | 상영작·투어·예고편 |
| `/trading/` | LEAVE PARK 거래 화면 |
| `/voice/` | 기존 macOS 음성 CLI 실행 안내 |

## 실행 범위

- 거래소의 Rust 엔진·12개 봇은 Sites Worker에서 실행하지 않습니다. 별도 실행 서버의 HTTPS 주소를 Sites 환경변수 `TRADING_ENGINE_URL`에 설정하고 재배포해야 실제 주문·취소·잔고·실시간 체결을 사용할 수 있습니다. 연결 전에는 파크 카드와 API가 미연결 상태를 명시합니다. 데이터를 만들어 정상 동작으로 표시하지 않습니다.
- 매직 보이스는 기존과 동일하게 macOS 네이티브 CLI입니다. 웹 페이지는 실행 안내이며 원격 방문자의 Mac 명령을 실행하지 않습니다.
- OpenCelliD 실시간 조회는 선택적인 Sites 비밀 환경변수 `OPENCELLID_API_KEY`가 필요합니다. 기존 작업 폴더에도 설정된 키가 없었습니다. 도면과 수집된 신호 자료는 별도로 제공됩니다.
- 지도 서비스의 사용자가 직접 입력하는 API 설정은 해당 브라우저에서 관리합니다.

## 빌드와 검증

```sh
npm run build:sites
node --test tests/sites-router.test.mjs
SITES_PREVIEW_PORT=15398 npm run preview:sites
node scripts/verify-sites.mjs http://127.0.0.1:15398
```

`dist/server/index.js`는 Sites Worker이며 `dist/client/`는 공개 정적 파일입니다. Next.js 화면과 1,250명의 합성 충전 이력 API를 정적으로 생성합니다. VITALIS는 별도 HTML 진입점도 빌드합니다. 큰 영상은 8 MiB 조각으로 저장하고 Worker가 원래 URL의 HTTP Range 요청을 처리하므로 화질과 탐색 기능을 유지합니다.

`--assemble-only`는 직전 프레임워크 빌드의 입력이 변하지 않은 상태에서 포장 단계만 복구할 때 사용합니다. 코드 변경 후 일반 배포에서는 전체 빌드를 실행합니다.

로컬 브라우저 검증 결과는 [local-verification.json](sites/local-verification.json)에 있습니다. 16개 항목 중 15개 통과, 거래소 백엔드 상태 검사는 엔진 주소 미설정으로 실패했습니다. 게임 시작·정지, 어트랙션 입장, 실제 3D 차량, 충전 이력과 새로고침, 세 상영작의 실제 재생·탐색을 확인했습니다. `/reports/`의 ATLAS 결과는 시각이 보존된 기존 로컬 검증 기록입니다.

## Sites 원본과 GitHub

`.openai/hosting.json`의 프로젝트 ID를 재사용합니다. `node scripts/prepare-sites-source.mjs`로 `.sites-workspace/wonder-park`에 배포용 소스 사본을 준비합니다. 로컬 자격 증명·실행 로그·과거 관찰 기록은 복사하지 않습니다. Sites 워크플로는 이 사본을 전용 Git 저장소에 저장한 뒤 동일 소스의 빌드 산출물을 배포합니다. 기존 GitHub 저장소의 최종 커밋·푸시는 배포 단계와 별도로 수행합니다.

새 Sites 사이트의 접근 범위는 기본 비공개입니다. 공유 범위를 변경하려면 Sites의 공유 설정에서 지정합니다.

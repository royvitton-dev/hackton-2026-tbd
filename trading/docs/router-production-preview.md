# 통합 경로의 production 거래소 화면 검증

2026-09-22 00:08–00:12 KST에 `/trading/`용 배포 파일을 만들고 실제 브라우저에서 연결과 새로고침을 확인했다. 전체 Park 서버의 시작 검증과는 구분한다. 기존 Park·엔진·12개 봇·독립 UI·장시간 관찰은 유지했다.

## 빌드와 정적 자산

[빌드 원본](../evidence/2026-09-21T15-07-30-187Z-unified-trading-build-3c4f9b7c/README.md)은 `scripts/build-unified.mjs`의 거래소 부분과 같은 루트 Vite 7.3.6, 설정 파일, frontend 작업 디렉터리, `--base /trading/`를 사용했다. 출력 디렉터리만 새로운 evidence run의 `dist`로 바꾸고 기존 파일 삭제 옵션은 생략했다. Node 24.19.0에서 exit0이며 입력40개 파일의 전후 SHA가 같다. 다른 앱·Next.js 빌드나 별도 TypeScript 재검사를 수행한 결과는 아니다.

산출물130개를 임시 HTTP 서버에서 각각 읽어 파일과 응답의 SHA를 비교했다. HTML의 src/href와 CSS의 url 참조129개가 `/trading/` 아래의 실제 자산으로 해석됐다. 이 정적 검사는 JavaScript의 모든 동적 URL을 분석한 것은 아니다.

## 실제 화면과 요청 경로

[`router-preview-readonly.mjs`](../scripts/router-preview-readonly.mjs)는 이미 빌드된 evidence/dist를 loopback 임시 포트에 제공한다. 운영 코드의 `createTradingProxy`를 사용하여 기존 엔진의 state·sessions·bots GET 및 WS만 연결하고, 명령 제출은 허용하지 않는다. Park 시작·입장 API·엔진 실행 관리·주문 체결 기능은 이 fixture의 검증 대상이 아니다.

[실행 증거](../evidence/2026-09-21T15-09-51-005Z-router-preview-bd08bc54/verified.json)에서 브라우저는 `/trading/assets/`의 JS·CSS·DM Sans·Noto Sans KR 폰트를 HTTP200으로 읽었다. API는 `/trading/backend/api/state` 2회, sessions·bots 각각26회 모두200이었다. `/trading/backend/ws` upgrade 요청2회와 화면의 시장 연결됨·정상 운영·실시간 차트를 확인했다. 처음 기록한 EVENT129214에서 새로고침 후129447로 진행했고, 경고·오류 로그는0건이었다. 새로고침 이후 수신 복원은 확인했지만 이 결과를 전체 이벤트 순번의 무누락 증명으로 사용하지 않는다.

브라우저 초기 DOM과 새로고침 후 DOM·이미지를 원본으로 보존했다. 전체 페이지 캡처에는 하단이 반복된 부분이 있어 시각 확인에는 [뷰포트 캡처](../evidence/2026-09-21T15-09-51-005Z-router-preview-bd08bc54/browser-reload.jpg)를 사용했다. DOM과 이미지는 순차 수집이며 같은 순간의 원자적 시장 상태로 취급하지 않는다.

임시 탭12를 닫은 뒤 해당 fixture만 정상 종료했다. 실제 실행 session99877의 exit0, PID19860 부재, tracked socket0을 확인했다. 기존18개 프로세스의 PID·시작 시각과 시장 manifest는 그대로였다. 요청 기록에 GET·HEAD 외의 메서드와 URL query는 없었다.

## 진단 도구의 로그 보완

독립 읽기 검토가 fixture의 요청 URL·Origin 원문 로깅을 지적했다. 최초 실행 소스는 `fixture-as-run.mjs`로 보존했고 실제 실행에서 query 토큰 노출은 관측하지 않았다. 종료 후 현재 도구는 알려진 pathname만 기록하고 미등록 경로는 일반 표식으로 바꾸며, Origin은 존재 여부만 남기도록 수정했다. 문법 검사와 소스 검토 범위이며 이 로그 변경 뒤 동일 브라우저 시험을 다시 수행했다고 주장하지 않는다.

이 결과는 거래소 부분의 production 자산·동일 출처 연결·새로고침 검증이다. 전체 통합 Park의 cold start, 공개 HTTPS/WSS, 실제 Vercel 배포 및 Linux 컨테이너 실행은 별도로 남아 있다.

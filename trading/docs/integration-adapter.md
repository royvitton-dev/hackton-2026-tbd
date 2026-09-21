# Wonder Park 등록과 선택적 React 연결 어댑터

## Wonder Park — 로컬 등록 적용

`trading/attraction.json`의 `url`은 `http://127.0.0.1:5175/`다. 기존 `park/lib/registry.mjs`가 이를 발견하고 `/api/launch?id=trading`이 이 주소를 반환한다. 파크 소스 변경 없이 **휴가 거래소 → 휴가 거래소 입장 → 어트랙션 열기**로 연결된다. 별도로 `node scripts/demo.mjs start`로 전체 시연을 실행해야 하며, 등록 파일만으로 프로세스를 시작하지는 않는다.

2026-09-21 21:37 KST 로컬 파크의 등록·실행 API와 실제 입장 안내/목적지 화면을 확인했다. [원본과 검증 범위](../evidence/20260921T123546085Z-wonder-park-link-c489e646/README.md). 공개 시에는 URL을 실제 HTTPS UI 주소로 변경한다. 외부 배포는 수행하지 않았다.

## 다른 React 호스트 — 선택적 어댑터 미적용

독립 UI를 다른 화면에 합치는 대신 기존 앱에서 새 탭으로 열 수 있는 최소 링크 컴포넌트를 준비했다. 구현은 `frontend/src/integration/ExchangeLink.tsx`다. 독립 거래소의 `App.tsx`에는 import하지 않으며 기존 루트 파일에도 적용하지 않았다. React 19 및 현재 TypeScript strict 빌드로 타입을 확인했다.

기존 `dopamin/src/App.tsx`에는 로비·리플레이·가이드 메뉴가 있다. 향후 루트 변경이 승인되면 컴포넌트를 호스트 앱의 컴포넌트 경로로 복사하고 해당 메뉴에 링크를 추가할 수 있다. 기본 URL을 컴포넌트에 하드코딩하지 않고 호스트가 정확한 독립 거래소 주소를 전달한다.

```tsx
import { ExchangeLink } from './components/ExchangeLink'

// 호스트 App 내부. VITE_EXCHANGE_URL을 설정한 경우에만 노출한다.
const exchangeUrl = import.meta.env.VITE_EXCHANGE_URL as string | undefined

// 기존 메뉴 안에 삽입할 예시
{exchangeUrl && <ExchangeLink href={exchangeUrl} className="exchange-link" />}
```

로컬 주소는 `http://127.0.0.1:5175`, 공개 배포에서는 실제 HTTPS 거래소 주소를 지정한다. 링크는 새 탭을 열고 `noopener noreferrer`를 사용하며 접근성 이름에 새 탭임을 알린다. 합성 세션 토큰·요청 ID·잔고를 URL로 전달하지 않는다.

호스트 메뉴가 button에만 스타일을 적용하므로 필요하면 승인된 호스트 스타일 파일에 `.exchange-link`의 폰트·간격·focus 표시를 맞춘다. 이 문서는 외부 CSS를 자동 수정하거나 전체 거래소 CSS를 호스트로 가져오는 절차가 아니다.

적용 후 확인할 항목은 링크 표시, 정확한 주소와 새 탭, 키보드 Enter, 기존 로비·리플레이의 보존, 새 탭 거래소의 정상 연결이다. 현재 상태는 **어댑터 준비 및 타입 검사 완료 / 루트 적용·루트 브라우저 연동 검증 미실행**이다.

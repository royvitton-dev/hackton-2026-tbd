# 사용자 제공 차량 이미지 검수 (2026-09-22)

대상은 충전 리소스의 `mini_electric_cooper_2026`, `audi_q4_45_etron_2026`, `bmw_i5_edrive40_2026`이다. 사용자 U0040, U0059, U0007로 선택 전환을 확인한다.

- MINI: `MINI-Cooper-PNG-Clipart.png`, 956×490, 실제 alpha 보존. 여백 제거 후 694×394. 사진의 Cooper S와 데이터의 전기 MINI 사양 차이를 출처 패널에 기록했다.
- Audi Q4: `2024-Audi-Q4-e-tron.webp`, 2000×1250, 불투명 체크무늬 배경을 rembg로 제거. 1570×764. u2net이 지운 밝은 헤드램프와 바퀴 틈의 배경은 원본 SHA에 묶인 alpha 보정 파일로 처리하며 RGB는 원본에서 복원한다.
- BMW: 최종 사용자 선택 `4_221_f.webp`, 999×564, 파란색 i5. rembg 처리 후 여백 포함 1005×431. 이전의 작은 흰색 파일은 이력에 보존하고 런타임에서는 사용하지 않는다.

원본 파일은 `battery_health/resoures/images/sources/`, JPEG와 누끼는 각각 `originals/`, `cutouts/`에 저장한다. public 복사본과 세 출처 manifest를 동기화했다. 새 이미지 import는 누끼 캐시를 무효화하고, 브라우저 텍스처 URL은 최종 PNG의 SHA-256으로 버전 관리한다. 원본 인터넷 URL과 라이선스가 제공되지 않은 사용자 파일에는 이를 명시한다.

검증 명령:

```sh
npm run cutout:vehicles
npm run sync:vehicle-assets
npm run verify:assets
npm run lint
npm run typecheck
npm run test
npm run vehicle:build
npm run build
npm run demo -- --port 3113
npm run test:e2e -- --config=.cache/upload-review.playwright.config.ts tests/browser/user-images.spec.ts tests/browser/cutouts.spec.ts
```

하위 앱의 미설치 패키지는 각 잠금 파일에 맞춰 설치했다(map/dopamin/webpage는 npm, trading/frontend는 pnpm 11.25.0). 전체 통합 빌드는 성공했다. 사용자 이미지 E2E는 실제 브라우저에서 Canvas, 최종 텍스처 URL과 응답 파일 해시, 선택 전환, 배터리 정보 버튼, 출처 링크, 모바일 넘침을 검사한다. 캡처는 `test-results/user-image-*.png`, `test-results/png-*.png`에 남긴다.

최종 결과: lint/typecheck, 단위 테스트 16개, 위 브라우저 테스트 2개(3.3분), asset 검증, 차량 단독 빌드와 전체 통합 빌드 통과. 저장소의 `playwright.review.config.ts`로 같은 두 spec을 실행하면 별도 3101 포트에서 재현할 수 있다. 이 기록의 `.cache/upload-review.playwright.config.ts`는 이미 실행 중인 3113 데모에 연결한 로컬 설정이다.

**3D 완료 보고가 아니다.** 세 이미지는 고정 WebGL 텍스처다. BMW i5, Audi Q4/Q6, MINI의 GLB는 여전히 없으며 회전·차체 투시는 지원하지 않는다. `npm run verify:vehicle-3d`는 이 네 항목을 명시하고 종료 코드 1을 반환한다. PNG 표시 통과를 3D 기능 완료로 간주하지 않는다.

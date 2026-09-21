# Git 전달 검증

대상: https://github.com/royvitton-dev/hackton-2026-tbd

작업 브랜치: **main**. 작업 트리: `work/main-integration`. 사용자 요청 이후 기능 브랜치를 만들거나 사용하지 않고 직접 main에 커밋했다.

| 커밋 | 내용 | 원격 확인 |
|---|---|---|
| c7f1e00e74997027f34f6243a3d10ae6fe4fe79c | 긴 맵 4종, 실제 3D 렌더러, 결승 구멍 4개, 1·2·3배속, 검증 자료 | Fork 일반 push 후 `git ls-remote` 일치 |
| 67a6e48ba336e0074288903533811b5c4d7ec8ff | 원근 3D 카메라·입체 시점 선택·두꺼운 보드, PC·모바일 60개 공·3배속 검증 | Fork `Updated origin/main` 및 `git ls-remote` 일치 |

실제 마지막 코드 전달 확인 출력:

```text
git ls-remote origin refs/heads/main
67a6e48ba336e0074288903533811b5c4d7ec8ff refs/heads/main
git rev-parse HEAD
67a6e48ba336e0074288903533811b5c4d7ec8ff
git status --porcelain
(출력 없음)
git diff d249d3d --name-only -- . ':!pinball'
(출력 없음)
```

원본 체크아웃은 `feature/bwlee`, 미추적 `.idea/` 상태 그대로 보존했다. 수정된 기존 프로젝트 파일은 없다. 강제 푸시·태그 일괄 푸시·웹사이트 공개 배포는 하지 않았다.

CLI HTTPS 인증 실패는 Fork에 저장된 토큰이 CLI 자격 증명 도우미로 공유되지 않아서 발생했다. 사용자 안내에 따라 Fork UI를 사용해 해결했으며 토큰을 추출하거나 채팅/파일에 보존하지 않았다. 이 문서는 위 코드 커밋 이후의 문서 커밋으로 보존된다.

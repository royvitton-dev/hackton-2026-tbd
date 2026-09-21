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

## 놀이공원 개선 후속 전달 (2026-09-21 KST)

| 커밋 | 전달 내용 | 검증 |
|---|---|---|
| a1ad801,5d61f72,680a1ef,fae9aad | 놀이공원UI·3D놀이기구·그래픽최적화 | 각 ForkPush 후 원격main 확인 |
| 24e7256,1e3ac2c,d04ed02 | 네온·화면오류복구·3~5초흔들림·즉시종료 | 각 ForkPush 후 원격main 확인 |
| 97622c13860caca8a8e6f726979dd46362aae669 | 기본1.5배·자석/대포·맵별결승부 |20:18 원격main 일치 |
| 7b0c004a8b11ebfb0d4c04297400e148df6bd43f | 리턴포털·맵마다자석/대포2개·독립다중타이머 |20:49 원격main 일치 |

20:38에는Mac잠금으로Fork접근이 막혀 위마지막커밋푸시를 보류했으나20:49 접근복구후일반Push와원격해시검증을 완료했다. 원격의 다른 프로젝트 변경은pinball차이없음을확인한뒤보존했다. 이후 하프모드와최종검증자료는 후속main커밋으로전달한다.


## 20:58 확인

`fcb7a006dc9abd653ab0a7ad521ca55efef6ddeb` (창전체·하프모드·GOAL/BACK표시)를main에직접커밋하고Fork일반Push후원격해시일치를확인했다. 이후캐논퍼레이드·입력·로또·0.4초회전은다음검증묶음으로준비중이며이문단만으로푸시완료를주장하지않는다.


## 21:40 전달 확인

`527d4c93f5df243cb2960a144a4c5ca71e5a9115`를main에직접커밋·Fork일반Push했다. 원격main과로컬HEAD가같고작업트리가깨끗함을확인했다. 캐논퍼레이드6대포·콤마/이름*수량·기본5명·로또탭·대포0.4초회전과41검사/600경기/PC모바일증빙을포함한다. 이후9대포·강한스윙은다음후보버전이며이커밋에포함됐다고주장하지않는다.

로컬미리보기는`main-527d4c93f5df`를사용한다. 첫열기와새로고침에서21실행파일전체가커밋과일치함을확인했다(`22a-pushed-preview.json`).


## 2026-09-21T22:03:22.259594+09:00 — 강한 스윙·9대포·지정 기본 이름

main `789866bb653d285ad7f6149e384223743cfa4054` 직접 커밋. Fork 일반 Push 뒤 실제 원격 main 해시 일치 및 깨끗한 작업트리 확인. 4188 미리보기를 `main-789866bb653d`로 원자적으로 전환했다. 첫 열기·새로고침 모두21개실행파일의바이트가해당커밋과일치하고기본명단5개가정확함을23-pushed-preview로확인했다.


## 2026-09-21 22:34 KST — Mac / Android packaging

Packaging source commit: `1c857b5811a0f4e18c1b3a28ca7c18400cbba99d`. Two normal push attempts were rejected because other tasks advanced remote main. No pinball conflicts were found. Remote work was preserved with normal merges, including `aea4cba`, `b314b3a`, and `2131c72`. The last fetch/merge was performed after preparing the Fork push dialog, then normal Push succeeded. The remote main hash exactly matched `2131c72f70bfb0e609928b94b7d535d3ba389c41`; worktree clean. The source commit is included. No force push or token extraction occurred. The local preview was switched to main-2131c72f70bf.

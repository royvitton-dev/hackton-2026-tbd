# hackton-2026-tbd

push 테스트

2026 해커톤 작업 모음입니다. 각 프로젝트는 해당 폴더에서 독립적으로 실행합니다.

## Wonder Park 홈페이지

각 프로젝트를 3D 미니어처 어트랙션으로 연결한 홈페이지입니다. 저장소 최상위에서 실행합니다.

```sh
npm ci
npm run dev
```

[로컬 파크](http://localhost:5190) · [HTML 품질 보고서](http://localhost:5190/reports/) · [홈페이지 안내](park/README.md)

`npm run park:hooks`와 `npm run park:watch`로 Git 훅과 10분 간격 커밋 감시를 실행합니다. `npm run park:circuit`은 모든 어트랙션에 순서대로 실제 입장해 검증하는 무한 순회를 실행합니다. `webpage`는 파크 지도에서 제외합니다.

| 폴더 | 내용 | 실행 안내 |
| --- | --- | --- |
| `dopamin/` | 음성 참가자 등록과 3D 커피 내기 레이싱 게임 BREW RACERS | [README](dopamin/README.md) |
| `webpage/` | 아이돌 성장 보드게임 DEBUT : ON (`/`)과 3D 건강 기록 대시보드 VITALIS (`/health/`) | [게임](webpage/GAME.md), [건강 대시보드](webpage/HEALTH.md) |
| `voice/` | macOS 음성 명령으로 Codex 작업을 실행하는 TBD CLI | [README](voice/README.md) |
| `movie/` | VITALIS 해커톤 소개 영상, 원본 에셋, 편집·렌더 스크립트 | [README](movie/README.md) |

## 빠른 시작

Node.js 22.12 이상을 권장합니다. 웹 프로젝트는 원하는 폴더에서 의존성을 설치한 뒤 실행합니다.

```sh
cd dopamin
npm ci
npm run dev
```

`webpage/`도 같은 명령으로 실행할 수 있습니다. 여러 프로젝트를 동시에 실행할 때는 각 README의 포트 설정을 확인하세요. 음성 CLI와 영상 제작에는 macOS 등 추가 요구사항이 있습니다.

## 작업 결과물

- [30초 소개 영상](movie/output/vitalis-hackathon-30s.mp4)
- [영상 구성안](movie/STORYBOARD.md)
- [레이싱 게임 검증 기록](dopamin/docs/verification.md)
- [음성 CLI 검증 기록](voice/VERIFICATION.md)

소스, 테스트, 화면 비교 기준 이미지, 문서, 검증 보고서와 영상 에셋을 포함합니다. 의존성 설치 폴더, 빌드 캐시, 임시 파일과 로컬 환경 설정은 제외합니다. 각 프로젝트의 검증 범위와 알려진 제한은 해당 문서에서 확인할 수 있습니다.

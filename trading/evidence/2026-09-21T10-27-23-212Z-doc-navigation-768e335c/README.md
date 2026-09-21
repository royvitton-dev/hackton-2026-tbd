# 문서 탐색·실행 안내 정적 감사

2026-09-21 19:26–19:30 KST, `/root/frontend`. 범위는 `trading/README.md`와 `trading/docs/**/*.md` 25개다. 정확한 파일 목록·SHA-256·각 링크 위치는 `link-audit.json`, 인라인 파일 참조 후보는 `reference-candidates.json`, 실행 안내 발췌는 `commands.txt`에 있다. 실행한 감사 명령은 `trading`에서 `node evidence/2026-09-21T10-27-23-212Z-doc-navigation-768e335c/audit.mjs`다.

최종 로컬 Markdown 링크 120개 모두 대상이 존재했다. 링크 대상 중 Git에서 제외된 파일은 0개이고, 아직 추적되지 않은 대상 12개는 새 slow-WS 검증·소스 재현 증거와 관련된 실제 존재 파일이다. 누락된 소스 납품물로 분류하지 않았다. 이 작업에서는 commit/push를 하지 않았으며 다음 커밋은 root가 관리한다.

인라인 참조의 로컬 전용 대상 15개는 `data/demo`·저널·genesis·현재 PID manifest, Rust target/실행 파일, `.tmp` 소스 재현 디렉터리, pnpm 저장소, production dist 및 전체 Core 복구 JSON이다. 실제 존재와 `git check-ignore` 결과를 구분해 기록했다. 재현 가능한 소스와 작은 테스트 fixture를 대신하는 누락 파일로 취급하지 않았다.

수정한 구체적 오류:

- `docs/review-deployment.md`: 새 preview를 시작한 뒤 종료 예시가 이미 종료된 과거 run의 manifest를 가리켰다. 새 시작 명령이 출력한 manifest를 사용하도록 수정했다.
- 같은 문서가 존재하지 않는 `typecheck.log`를 원본 증거로 열거했다. 해당 run의 파일 목록과 시작 스크립트를 대조했다. 무출력 타입 검사는 Tee-Object 파일을 생성하지 않았으므로 별도 로그가 없다는 사실과 실제 `processes.json`의 명령/준비 완료 기록 및 `build.log`로 정정했다. 과거 증거 파일을 새로 만들지 않았다.
- `docs/ui.md`: 검증 명령의 cwd를 `trading/frontend`로 명시하고 `frontend/scripts/verify.ps1`의 위치를 정확히 적었다.
- root에 전달한 README의 `cd engine` 이후 `cd frontend` 경로 문제와 `bench-plan.md`의 cargo cwd 문제는 root가 수정했다. `--manifest-path`와 `pnpm --dir`를 사용한 현재 문서를 재확인했다. root는 설치된 pnpm의 `--dir`을 읽기 전용 cwd 출력으로 확인했다고 보고했으며, 이 감사가 Linux/macOS 실제 실행을 입증한 것은 아니다.

명령은 실행하지 않고 실제 parser/param/package scripts와 대조했다. setup/env/run-evidence의 매개변수와 기본 cwd, demo의 start/stop/status/restart-engine, observe의 310초 positional 인수, 두 summary 스크립트의 run-ID 인수, aged-recovery의 --self-test/--source, core_bench의 cycles/warmup-cycles, network-bench/perf-probe/queue-stress/slow-ws 플래그, frontend pnpm scripts 및 preview의 ManifestPath가 현재 구현과 일치한다. 문서 수정 뒤 `git diff --check -- docs/ui.md docs/review-deployment.md`는 exit 0이었다.

29개 자동 분류 미결 후보는 문맥으로 검토했다. 에이전트/브랜치 식별자, `.bin` 확장자, 모듈 나열, 설치 도구 내부 경로, Tokio 의존성 `watch.rs`, benchmark가 생성하는 출력 이름, Git 제외 정책의 전체 Core 파일 이름, 그리고 없다고 명시한 `typecheck.log`다. benchmark 출력 이름은 `network-bench.mjs`의 실제 쓰기 경로와 대조했고, Tokio watch.rs와 도구 경로는 로컬 설치 위치에서 확인했다. 해결되지 않은 깨진 파일 링크나 현재 사용법 오류는 발견하지 못했다.

한계: 링크 검사는 파일/디렉터리 존재 검사다. 문서 안 heading anchor와 외부 URL, 모든 문장의 기술적 정확성, 과거 소스 줄 번호의 현재 일치, 새 실행·플랫폼 동작은 검증하지 않았다. 역사적 evidence Markdown은 검사 입력에서 제외했고 기존 evidence를 변경하지 않았다. 서비스·API·관찰기·빌드·테스트를 실행하거나 정지하지 않았으며 checkpoint.md/agents.jsonl/verification.md를 편집하지 않았다. 감사 도구 첫 시도는 비파일 `/` 후보가 빈 Git pathspec으로 변환돼 실패했고, 해당 후보를 제외한 뒤 완료했다. 제품 실패가 아니다.

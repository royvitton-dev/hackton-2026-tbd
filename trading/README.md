# LEAVE PARK · 모의 휴가 거래소

**휴가 거래소만 독립적으로 실행하는 UI**입니다. 기존 통합 화면이나 로그인 없이 가격·호가·체결 차트·주문·취소·잔고·12개 거래 봇을 확인합니다. 모든 계정·휴가 시간·포인트는 합성 데이터이며, 그룹사 표기는 GS리테이 / GS칼테스 / GS건썰입니다.

현재 마감까지 검증·개선을 진행 중입니다. 항목별 실제 상태는 [누적 검증](docs/verification.md), 현재 프로세스와 다음 작업은 [체크포인트](docs/checkpoint.md), 요구 범위는 [원본 명세](docs/requirements.ko.md)를 확인하세요. 외부 배포를 실행하지 않았습니다.

## 준비와 한 명령 실행

검증 환경: Windows 11, Node 24.19.0, pnpm 11.25.0, Rust 1.98.1 GNU. Node와 pnpm이 PATH에 필요합니다. Rust·링커 도구와 캐시는 이 폴더의 `.tools` 안에 설치합니다.

PowerShell에서 이 `trading` 폴더로 이동한 뒤 최초 한 번:

```powershell
./scripts/setup.ps1
```

준비 후 전체 로컬 시연을 한 명령으로 시작합니다.

```powershell
node scripts/demo.mjs start
```

- 독립 UI: http://127.0.0.1:5175
- Rust API·WebSocket: http://127.0.0.1:8787 / ws://127.0.0.1:8787/ws
- 기본 12개의 별도 Node 봇 프로세스가 공개 API로 같은 시장에 참여합니다.
- 데이터는 `data/demo`, 실행별 로그·프로세스·봇 seed는 `evidence/<고유-run-ID>`에 보존됩니다.

```powershell
node scripts/demo.mjs status
node scripts/demo.mjs stop
```

UI와 봇을 유지한 엔진 정상 재시작·브라우저 자동 재연결은 `node scripts/demo.mjs restart-engine`으로 확인할 수 있습니다. 기존 엔진의 실제 종료를 기다린 뒤 같은 영속 데이터로 새 프로세스를 시작하고 전후 상태·로그·PID를 기록합니다.

종료는 봇 중지 → 일관된 스냅샷 요청 → 엔진 정상 종료 → 추적된 UI/잔여 프로세스 정리 순서입니다. 데이터와 증거를 삭제하지 않습니다. 재시작하면 같은 `data/demo`의 저널·스냅샷·요청 ID를 복구합니다. 다른 합성 데이터 실행은 `ENGINE_DATA_DIR`에 **새 디렉터리**를 지정하세요.

Linux/macOS에서는 Rust stable, Node 24.x, pnpm 11.25.0을 준비하고 `trading` 디렉터리에서 아래 명령을 순서대로 실행합니다. 해당 OS의 실제 실행은 아직 검증하지 않았습니다.

```sh
cargo build --manifest-path engine/Cargo.toml --release --locked --bin leave-engine
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend build
node scripts/demo.mjs start
```

## 시연 순서

1. 화면 상단 연결 상태가 정상이고 봇들이 활동하는지 확인합니다.
2. 합성 임직원 계정을 선택하고 현재 매도 호가 이상의 가격으로 1시간 매수합니다.
3. 내 주문의 확정 결과, 체결 내역과 포인트·휴가 잔고 변화를 확인합니다.
4. 현재가보다 충분히 낮은 가격으로 매수 주문을 내고 예약 포인트를 확인한 뒤 미체결 주문을 취소합니다.
5. 세션을 바꿔 동일 시장의 호가를 보고, 새로고침/재연결 후 상태 복원을 확인합니다.

## 검증과 증거

```powershell
. ./scripts/env.ps1
./scripts/run-evidence.ps1 -Label rust-tests -Command cargo -CommandArgs @('test','--locked')
node --test scripts/api.integration.test.mjs
node scripts/observe.mjs 310
```

API 통합 테스트는 별도 합성 데이터와 임시 포트의 엔진 프로세스를 만듭니다. 저널 손상·강제 종료 테스트도 전용 데이터에만 수행합니다. 관찰 스크립트는 실행 중 데모를 대상으로 5분 이상 실제 체결·호가·봇 참여·WebSocket 이벤트와 프로세스 메모리·로그 증가량을 수집합니다. 15초를 넘는 표본 공백은 연속 관찰 실패로 기록합니다. Windows에서는 관찰 중에만 유휴 절전 방지 요청을 유지하고 종료 시 해제하며, 영구 전원 설정은 변경하지 않습니다. 이 요청을 생략하려면 `OBSERVE_ALLOW_IDLE_SLEEP=1`을 지정합니다.

이미 수집한 기록에서 [CPU·메모리 사용량 확인](docs/resource-observation.md)도 가능합니다. `node scripts/summarize-observation.mjs <관찰-run-ID> --logical-processors 16`으로 구간별 CPU 평균과 메모리를 새 증거 파일에 저장합니다. `16`은 이번 호스트의 논리 프로세서 수이며 다른 호스트의 기록에는 실제 해당 값을 지정합니다.

[실제 엔진 부하 테스트](docs/engine-load-test.md)는 동시 요청 6·24·96개에서 처리량·확정 응답 지연과 CPU·메모리를 함께 기록했습니다. 총 17,736개 주문의 정합성 검증을 통과했으며, 24개 단계의 WebSocket 단절과 이후 측정 조건 차이도 원본·그래프에 표시했습니다.

성능 코어 예제와 사전 목표: [측정 계획](docs/bench-plan.md), [실제 결과와 한계](docs/performance.md). 실제 측정 전 시연 봇·빌드·테스트를 중지하고 별도 조용한 구간을 사용합니다. A 코어, B 내구성 ACK, C 이벤트 수신과 D 실제 배포 네트워크를 구분합니다.

## 문서

- [설계·공통 계약](docs/contract.md), [API·재시도·실시간 프로토콜](docs/protocol.md)
- [실행 경계·독립 UI ADR](docs/adr/001-execution-and-ui.md), [증거·로그 보존 정책](docs/evidence-policy.md)
- [매칭·정산 코어](docs/core.md), [저널·스냅샷 ADR](docs/adr/002-durability.md)
- [독립 UI·연동 범위](docs/ui.md), [Vercel·별도 엔진 배포 준비](docs/deployment.md)
- [작업 체크포인트](docs/checkpoint.md), [실제 개발 에이전트 기록](docs/agents.jsonl)

Vercel Root Directory는 `trading/frontend`, 빌드 `pnpm build`, 산출물 `dist`입니다. API 주소는 실제 별도 엔진의 HTTPS/WSS 주소로 지정해야 합니다. Rust 컨테이너/영속 볼륨 예시는 `deploy`에 있으며, Docker가 없는 현재 호스트에서는 컨테이너 빌드를 아직 검증하지 않았습니다. 루트 UI는 수정하지 않았으며 독립 실행 UI와 연동 절차를 제공합니다.

기본 요청 ID 정책은 데이터셋 수명 동안 보존, 용량 도달 시 신규 접수 거절입니다. 파일/스냅샷/원본 증거를 자동 삭제하지 않습니다. 봇 로그는 파일당 5 MiB에서 새 파일로 분할합니다. OS·전원 장애 검증과 프로세스 강제 종료 검증은 구분합니다.

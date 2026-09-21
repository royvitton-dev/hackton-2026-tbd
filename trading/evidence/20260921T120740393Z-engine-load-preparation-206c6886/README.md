# 새 binary의 동일 engine-load 실행 준비

2026-09-21 21:08 KST, 준비만 완료했다. **새 엔진·sampler·부하·네트워크 listener·빌드·프로세스 제어를 실행하지 않았다.** 실제 유효 SHA로의 실행은 root가 별도로 수행할 예정이다.

수정 범위는 `scripts/engine-load.mjs`의 사전 binary 검증, source hash 기록, cleanup 전 WS 관측 보존이다. [diff](change.diff), [수정 전](engine-load.before.mjs), [준비된 실행본](engine-load.prepared.mjs)을 보존했다. 준비된 script SHA256는 **`7c1d4d2d2455dc20bb0950319cd078f68b6cbd0abc2ebf2f979ce4f0eb0412ea`**다.

## 변경 내용

- 필수 CLI: `--competing-resource-stress --expected-binary-sha256 <64hex>`. 64 hex 형식을 검사하고 대문자는 소문자로 정규화한다. source binary SHA가 기대값과 다르면 evidence 실행 폴더 생성 전 거절한다. 복사본 SHA 및 복사 후 source SHA도 기대값과 대조하고 모두 통과해야 프로세스 실행 경로에 도달한다.
- metadata의 `binary.expected_sha256`와 `source_sha256.script/main/ws_frame`을 추가했다. 현재 release 파일을 읽어 얻은 SHA는 root가 지정한 **`f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240`**와 같다.
- `finally` 첫 부분에서 intentional socket close·관리 shutdown **이전**의 readyState, final sequence 도달, gaps/errors/disconnects를 `websocket.workload_end`와 `events.json`의 `ws_workload_end`로 고정한다. cleanup 중 발생한 추가 error가 이 고정 관측을 바꾸지 않는다.
- `websocket.continuous_through_final_state`는 성공적으로 검증한 workload, OPEN socket, state 수신, 최종 sequence 도달, gap/error/unexpected disconnect 0이면 `true`다. 관측된 WS 실패 또는 검증 완료 후 최종 도달/OPEN 조건 미달이면 `false`다. workload가 미완료이고 WS 실패도 관측하지 못한 경우 `null`이다. 미완료 workload의 final sequence/caught-up도 `null`로 남긴다.
- 기존 `complete`의 ACK·회계 검증·엔진 정상 종료·sampler 정리·main 변화 없음이라는 조건은 수정하지 않았다. WS 연속성 결과는 별도이며 실제 실행 결과를 미리 주장하지 않는다.

입력/phase/측정 로직은 동일하다: 12 bots, warm-up 2 rounds, 6/24/96 concurrency, 각 phase 약 20초 또는 6,000 commands, 전체 18,000 commands/20,000 HTTP, 75초 work/90초 전체 한도, 동일 maker→taker barrier 및 자산 검사. 보호 대상 main engine 20540/observer 18184, 실제 16 logical CPU 검사, 양 프로세스 512MiB 관측 cap과 약 500ms CPU·memory sampler도 유지했다.

## 실제 오프라인 확인

[check-cli.mjs](check-cli.mjs)로 아래만 실행했고 [actual-checks.json](actual-checks.json)에 명령·시각·실제 exit code를 보존했다. 각 stdout/stderr 원본도 같은 폴더에 있다.

| 확인 | 실제 exit | 결과 |
| --- | ---: | --- |
| `node --check scripts/engine-load.mjs` | 0 | 구문 검사 통과 |
| `node scripts/engine-load.mjs --help` | 0 | 필수 SHA 옵션 안내 |
| SHA 옵션 누락 | 1 | usage 오류로 거절 |
| `not-a-sha` | 1 | 64 hex 형식 검사에서 거절 |
| 길이 64의 `g` 문자열 | 1 | non-hex 거절 |
| 길이 64의 `0` SHA | 1 | 실제 source SHA 불일치로 거절 |

체크 전후 engine-load 실행 폴더 목록이 동일하다. 허용된 구문/help/실패 CLI만 호출했으며 올바른 SHA로 workload 경로를 실행하지 않았다. WS `true/false/null` 분기는 코드로 검토했으나 새로운 socket 회귀 테스트는 이 준비 작업에서 실행하지 않았다.

## 준비된 실제 실행 명령 — 이번 준비에서 실행하지 않음

`C:\project\hackton-2026-tbd\trading`에서 root가 실행할 명령:

```powershell
node scripts/engine-load.mjs --competing-resource-stress --expected-binary-sha256 f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240
```

기존 장기관찰이 경쟁하는 조건의 실제 부하는 별도 1회 실행이며, 기존 raw baseline을 덮어쓰거나 조용한 성능 비교로 대체하지 않는다. 공유 docs 및 다른 production 파일은 이 작업에서 수정하지 않았다.

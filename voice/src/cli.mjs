#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { VoiceController } from './controller.mjs';
import { createCodexRunner } from './codex.mjs';
import { launchSpeech } from './speech.mjs';
import { createWarpRunner } from './warp.mjs';

const help = `TBD — 음성으로 Codex CLI 실행 (macOS)

사용: node src/cli.mjs [옵션]
  --cwd <폴더>        Codex가 작업할 폴더 (기본: 실행 위치)
  --dry-run           음성 인식과 명령 조합만 확인, Codex 실행 안 함
  --text              마이크 대신 한 줄씩 텍스트 입력
  --model <이름>      Codex 모델 (기본: 기존 Codex 설정)
  --thread <ID/이름>  기존 Codex 대화에 전달 (current: 이 앱을 실행한 Codex 대화)
  --warp-focus        시작어를 말할 때 포커스된 Warp 탭에 붙여넣고 Enter
  --timeout <초>      명령 수집 중 무입력 제한 (기본: 120)
  --on-device         기기 내 음성 인식만 허용 (지원되지 않으면 오류)
  --no-sound          인식 알림은 표시하고 효과음은 끔
  --test-feedback     마이크·Codex 없이 호출/실행 알림과 효과음 시연 후 종료
  --diagnostics       마이크 입력 음량과 호출 대기 중 인식 원문을 출력
  --help              도움말

“헤이 TBD야” → 작업 내용 → “TBD야 시작해줘”
한국어 발음 “헤이 티비디야”도 지원합니다.
“TBD야 취소해줘”로 수집 취소, Ctrl+C로 프로그램과 진행 중인 작업 종료.
`;

async function main() {
  const { values } = parseArgs({ options: {
    cwd: { type: 'string' }, model: { type: 'string' }, thread: { type: 'string' }, timeout: { type: 'string', default: '120' },
    'dry-run': { type: 'boolean' }, text: { type: 'boolean' },
    'no-sound': { type: 'boolean' }, 'test-feedback': { type: 'boolean' },
    diagnostics: { type: 'boolean' },
    'warp-focus': { type: 'boolean' },
    'on-device': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) { process.stdout.write(help); return; }
  if (values['warp-focus'] && (values.thread != null || values.model != null)) throw new Error('--warp-focus는 --thread 또는 --model과 함께 사용할 수 없습니다.');
  if (values['warp-focus'] && values.text && !values['dry-run']) throw new Error('--warp-focus의 --text 확인은 --dry-run과 함께 사용하세요.');
  if (values.thread != null && !values.thread.trim()) throw new Error('--thread에 대상 Codex 대화 ID 또는 이름이 필요합니다.');
  if (values.thread === 'current') {
    const currentThread = process.env.CODEX_THREAD_ID?.trim();
    if (!currentThread) throw new Error('현재 Codex 대화를 확인할 수 없습니다. Codex 안에서 실행하거나 --thread에 대화 ID 또는 이름을 지정하세요.');
    values.thread = currentThread;
  }
  if (values.thread && values.model) throw new Error('--thread 모드에서는 연결할 대화의 모델 설정을 사용합니다. --model을 제외하세요.');
  if (values.text && values['test-feedback']) throw new Error('--test-feedback은 --text와 함께 사용할 수 없습니다.');
  const timeout = Number(values.timeout);
  if (!Number.isFinite(timeout) || timeout < 1 || timeout > 3600) throw new Error('--timeout은 1~3600초여야 합니다.');
  const cwd = resolve(values.cwd ?? process.env.INIT_CWD ?? process.cwd());
  if (!(await stat(cwd)).isDirectory()) throw new Error(`작업 폴더가 아닙니다: ${cwd}`);
  const helper = fileURLToPath(new URL('../.build/TBD Speech.app/Contents/MacOS/tbd-speech', import.meta.url));
  if (!values.text) {
    if (process.platform !== 'darwin') throw new Error('음성 입력은 macOS에서 지원합니다. --text로 흐름을 확인할 수 있습니다.');
    try { await access(helper, constants.X_OK); }
    catch { throw new Error('음성 인식 도우미를 먼저 빌드하세요: npm run build'); }
  }
  if (!values['dry-run'] && !values['test-feedback'] && !values['warp-focus']) {
    const probe = spawnSync('codex', ['--version'], { encoding: 'utf8' });
    if (probe.error || probe.status !== 0) throw new Error('Codex CLI를 찾을 수 없습니다. codex --version 및 codex login을 확인하세요.');
  }
  let speech;
  const runner = values['warp-focus'] ? createWarpRunner({ dryRun: values['dry-run'], send: command => {
    if (!speech?.stdin.writable || speech.stdin.destroyed) throw new Error('Warp 전달 도우미에 연결되지 않았습니다.');
    speech.stdin.write(`${command}\n`);
  } }) : createCodexRunner({ cwd, model: values.model, thread: values.thread, dryRun: values['dry-run'] });
  const controller = new VoiceController({ run: prompt => runner.run(prompt), timeoutMs: timeout * 1000 });
  let lines;
  let stopping = false;
  let microphoneReady = false;
  const log = message => process.stdout.write(`[TBD] ${message}\n`);
  const control = command => {
    if (speech?.stdin.writable && !speech.stdin.destroyed) speech.stdin.write(`${command}\n`);
  };
  const shutdown = (code = 0) => {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    controller.close();
    runner.cancel();
    lines?.close();
    if (values.text) process.stdin.pause();
    speech?.stop();
  };
  process.once('SIGINT', () => shutdown(130));
  process.once('SIGTERM', () => shutdown(143));
  controller.on('notice', log);
  controller.on('state', state => {
    if (state !== 'closed') control(`state:${state}`);
  });
  controller.on('feedback', kind => control(`feedback:${kind}`));
  controller.on('transcript', text => log(`수집한 명령:\n${text}`));
  controller.on('partial', text => { if (process.stdout.isTTY) log(`인식 중: ${text}`); });
  controller.on('running', prompt => {
    control('pause');
    log(values['warp-focus'] ? '포커스된 Warp CLI로 전달 중' : values.thread ? `기존 Codex 대화로 전달 중 · ${values.thread}` : `Codex 실행 중 · ${cwd}`);
    log(`전달할 명령:\n${prompt}`);
  });
  controller.on('idle', () => { control('resume'); log('“헤이 TBD야”를 기다립니다.'); });
  controller.on('failure', error => { process.exitCode = 1; log(error.message); });
  log(`작업 폴더: ${cwd}${values['dry-run'] ? ' · 연습 모드' : ''}`);
  if (values.thread) log(`연결할 Codex 대화: ${values.thread}`);
  if (values['warp-focus']) log('전달 대상: 시작어 인식 시 포커스된 Warp 탭. CLI의 빈 입력줄을 선택하세요.');

  if (values.text) {
    log('텍스트 입력 모드. “헤이 TBD야”부터 한 줄씩 입력하세요.');
    lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    let id = 0;
    lines.on('line', text => controller.accept({ type: 'final', id: ++id, text }));
    lines.once('close', () => { void controller.pending.finally(() => shutdown(process.exitCode ?? 0)); });
  } else {
    log(values['test-feedback'] ? '호출·실행 알림을 차례로 시연합니다. 마이크와 Codex는 사용하지 않습니다.' : 'macOS 마이크·음성 인식 권한을 허용하세요. 인식 결과를 기다립니다.');
    const bundle = fileURLToPath(new URL('../.build/TBD Speech.app', import.meta.url));
    speech = await launchSpeech(bundle, {
      onDevice: values['on-device'], sound: !values['no-sound'],
      feedbackOnly: values['test-feedback'], dryRun: values['dry-run'],
      diagnostics: values.diagnostics,
      thread: values.thread,
      warpFocus: values['warp-focus'],
    });
    if (stopping) { speech.stop(); return; }
    speech.stdin.on('error', error => { if (!stopping) { log(`음성 도우미 연결 오류: ${error.message}`); shutdown(1); } });
    speech.once('error', error => { log(`음성 도우미 실행 실패: ${error.message}`); shutdown(1); });
    speech.once('close', (code, signal) => { if (!stopping) { log(`음성 도우미가 종료되었습니다 (${signal ?? code}).`); shutdown(1); } });
    lines = createInterface({ input: speech.stdout, crlfDelay: Infinity });
    lines.on('line', line => {
      try {
        const event = JSON.parse(line);
        if (runner.accept?.(event)) return;
        if (values.diagnostics && ['partial', 'final'].includes(event.type)) log(`인식 원문 (${event.type}): ${event.text}`);
        if (event.type === 'ready') {
          if (!microphoneReady) log('마이크 준비 완료. 메뉴 막대의 “TBD · 호출 대기”에서 상태를 확인하세요.');
          microphoneReady = true;
        }
        else if (event.type === 'audio-level' && values.diagnostics) log(`마이크 입력: ${event.device} · ${event.decibels.toFixed(1)} dBFS · ${event.frames} 샘플`);
        else if (event.type === 'status-changed' && values.diagnostics) log(`상태: ${event.title} · ${event.microphoneText}`);
        else if (event.type === 'quit-requested') { log('메뉴 막대에서 종료했습니다.'); shutdown(0); }
        else if (event.type === 'feedback-ready' && values['test-feedback']) control('feedback:wake');
        else if (event.type === 'feedback-shown') log(`알림: ${event.title} · ${event.message}`);
        else if (event.type === 'feedback-hidden' && values['test-feedback']) {
          if (event.kind === 'wake') control('feedback:start');
          else shutdown(0);
        }
        else if (event.type === 'warning') log(event.message);
        else if (event.type === 'error') { log(event.message); shutdown(1); }
        else controller.accept(event);
      } catch { log('음성 도우미가 잘못된 데이터를 반환했습니다.'); shutdown(1); }
    });
  }
}

main().catch(error => { process.stderr.write(`[TBD] ${error.message}\n`); process.exitCode = 1; });

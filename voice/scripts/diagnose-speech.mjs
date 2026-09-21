import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { VoiceController } from '../src/controller.mjs';
import { launchSpeech } from '../src/speech.mjs';

const audioFile = fileURLToPath(new URL('../.build/wake-test.aiff', import.meta.url));
const generated = spawnSync('/usr/bin/say', ['-v', 'Yuna', '-r', '150', '-o', audioFile, '헤이 티비디야'], { stdio: 'inherit' });
if (generated.error || generated.status !== 0) throw new Error('진단용 음성 파일 생성 실패');
const bundle = fileURLToPath(new URL('../.build/TBD Speech.app', import.meta.url));
const session = await launchSpeech(bundle, { audioFile, sound: false, dryRun: true });
const controller = new VoiceController({ run: async () => { throw new Error('진단에서는 Codex를 실행하지 않습니다.'); } });
controller.on('feedback', kind => session.stdin.write(`feedback:${kind}\n`));
controller.on('notice', message => console.log(message));
const lines = createInterface({ input: session.stdout });
const closed = new Promise(resolve => session.once('close', resolve));
let passed = false;
const timeout = setTimeout(() => { console.error('음성 진단 시간 초과'); session.stop(); }, 35_000);
try {
  for await (const line of lines) {
    const event = JSON.parse(line);
    if (['partial', 'final', 'error', 'probe-ready', 'feedback-shown'].includes(event.type)) console.log(JSON.stringify(event));
    controller.accept(event);
    if (event.type === 'feedback-shown' && event.kind === 'wake') {
      passed = event.visible === true;
      session.stop();
    }
    if (event.type === 'final' && controller.state !== 'listening') {
      console.error('음성은 인식했으나 호출어와 일치하지 않습니다.');
      session.stop();
    }
    if (event.type === 'error') session.stop();
  }
  await closed;
} finally {
  clearTimeout(timeout);
  controller.close();
  session.stop();
}
if (!passed) process.exitCode = 1;

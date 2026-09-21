import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { launchSpeech } from '../src/speech.mjs';

test('built macOS speech helper loads frameworks and its privacy bundle without requesting access', { skip: process.platform !== 'darwin' }, () => {
  const helper = fileURLToPath(new URL('../.build/TBD Speech.app/Contents/MacOS/tbd-speech', import.meta.url));
  const result = spawnSync(helper, ['--check'], { encoding: 'utf8', timeout: 15_000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const event = JSON.parse(result.stdout);
  assert.equal(event.type, 'check'); assert.equal(event.locale, 'ko-KR');
  assert.equal(event.supported, true);
  assert.equal(event.bundleIdentifier, 'local.tbd.voice.speech');
});

test('LaunchServices helper communicates over its private socket and exits cleanly', { skip: process.platform !== 'darwin', timeout: 20_000 }, async t => {
  const bundle = fileURLToPath(new URL('../.build/TBD Speech.app', import.meta.url));
  const session = await launchSpeech(bundle, { check: true });
  t.after(() => session.stop());
  const closed = new Promise(resolve => session.once('close', resolve));
  const lines = createInterface({ input: session.stdout });
  const events = [];
  for await (const line of lines) events.push(JSON.parse(line));
  assert.equal(await closed, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'check');
  assert.equal(events[0].bundleIdentifier, 'local.tbd.voice.speech');
});

test('recognition overlays are visible without taking focus; distinct sounds, dry-run label and dismissal work', { skip: process.platform !== 'darwin', timeout: 20_000 }, async t => {
  const bundle = fileURLToPath(new URL('../.build/TBD Speech.app', import.meta.url));
  const session = await launchSpeech(bundle, { feedbackOnly: true, sound: false, dryRun: true });
  t.after(() => session.stop());
  const closed = new Promise(resolve => session.once('close', resolve));
  const lines = createInterface({ input: session.stdout });
  const iterator = lines[Symbol.asyncIterator]();
  const next = async () => {
    while (true) {
      const event = await iterator.next();
      assert.equal(event.done, false, 'helper stopped before feedback arrived');
      const parsed = JSON.parse(event.value);
      if (parsed.type !== 'status-changed') return parsed;
    }
  };
  assert.equal((await next()).type, 'feedback-ready');
  const sounds = new Set();
  for (const [kind, title] of [['wake', '듣고 있어요'], ['start', '명령을 실행합니다'], ['empty', '작업 내용이 필요해요']]) {
    session.stdin.write(`feedback:${kind}\n`);
    const event = await next();
    assert.equal(event.type, 'feedback-shown');
    assert.equal(event.kind, kind); assert.ok(event.title.includes(title));
    assert.equal(event.visible, true);
    assert.equal(event.takesFocus, false); assert.equal(event.blocksClicks, false);
    assert.equal(event.soundAvailable, true); assert.equal(event.soundPlayed, false);
    if (kind === 'start') assert.match(event.message, /연습 모드: 실제 실행하지 않습니다/);
    sounds.add(event.sound);
  }
  assert.equal(sounds.size, 3);
  const hidden = await next();
  assert.equal(hidden.type, 'feedback-hidden'); assert.equal(hidden.kind, 'empty');
  session.stop();
  assert.equal(await closed, 0);
  lines.close();
});

test('menu bar reports actual microphone state, tracks command phases and supports quitting', { skip: process.platform !== 'darwin', timeout: 20_000 }, async t => {
  const bundle = fileURLToPath(new URL('../.build/TBD Speech.app', import.meta.url));
  const session = await launchSpeech(bundle, { feedbackOnly: true, sound: false });
  t.after(() => session.stop());
  const closed = new Promise(resolve => session.once('close', resolve));
  const lines = createInterface({ input: session.stdout });
  const iterator = lines[Symbol.asyncIterator]();
  const next = async () => {
    const event = await iterator.next();
    assert.equal(event.done, false);
    return JSON.parse(event.value);
  };
  let status;
  while (true) {
    const event = await next();
    if (event.type === 'feedback-ready') break;
    status = event;
  }
  assert.equal(status.title, 'TBD · 시연');
  assert.equal(status.visible, true);
  assert.equal(status.hasQuitAction, true);
  assert.equal(status.microphoneActive, false);
  assert.equal(status.microphoneText, '마이크: 꺼짐');
  // A command state must never claim that an inactive microphone is recording.
  for (const [command, title, phase] of [
    ['state:listening', 'TBD · 시연', 'listening'],
    ['pause', 'TBD · 일시정지', 'listening'],
    ['state:running', 'TBD · 실행 중', 'running'],
    ['state:idle', 'TBD · 일시정지', 'idle'],
    ['resume', 'TBD · 시연', 'idle'],
    ['quit', 'TBD · 꺼짐', 'idle'],
  ]) {
    session.stdin.write(`${command}\n`);
    const event = await next();
    assert.equal(event.type, 'status-changed');
    assert.equal(event.title, title); assert.equal(event.phase, phase);
    assert.equal(event.microphoneActive, false);
  }
  assert.equal((await next()).type, 'quit-requested');
  session.stop();
  assert.equal(await closed, 0);
  lines.close();
});

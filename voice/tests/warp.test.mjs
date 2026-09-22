import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWarpRunner } from '../src/warp.mjs';

test('Warp delivery sends literal Korean content and waits for the native acknowledgement', async () => {
  const sent = [];
  const runner = createWarpRunner({ send: line => sent.push(line) });
  const prompt = '한글 작업\n"인용문" $(not-a-shell-command)';
  const pending = runner.run(prompt);
  const request = JSON.parse(sent[0].slice('warp-submit:'.length));
  assert.deepEqual(request, { id: 1, text: prompt });
  assert.equal(runner.accept({ type: 'warp-delivery', id: 2, ok: true }), false);
  assert.equal(runner.accept({ type: 'ready', id: 1 }), false);
  runner.accept({ type: 'warp-delivery', id: 1, ok: true, target: 'focused-warp' });
  assert.deepEqual(await pending, { delivery: 'warp', target: 'focused-warp' });
  assert.equal(runner.accept({ type: 'warp-delivery', id: 1, ok: true }), false);
});

test('missing focus or permission is surfaced without another delivery attempt', async () => {
  const sent = [];
  const runner = createWarpRunner({ send: line => sent.push(line) });
  const pending = runner.run('작업');
  runner.accept({ type: 'warp-delivery', id: 1, ok: false, message: 'Warp 입력줄을 선택하세요.' });
  await assert.rejects(pending, /Warp 입력줄/);
  assert.equal(sent.length, 1);
});

test('concurrent delivery is rejected and cancel prevents a late acknowledgement from succeeding', async () => {
  const sent = [];
  const runner = createWarpRunner({ send: line => sent.push(line) });
  const pending = runner.run('첫 작업');
  await assert.rejects(runner.run('다른 작업'), /이미 전달 중/);
  runner.cancel();
  await assert.rejects(pending, /중단/);
  assert.equal(sent.at(-1), 'warp-cancel:1');
  assert.equal(runner.accept({ type: 'warp-delivery', id: 1, ok: true }), false);
});

test('timeout cancels native delivery without retrying or selecting a fixed Codex session', async () => {
  const sent = [];
  const runner = createWarpRunner({ send: line => sent.push(line), timeoutMs: 10 });
  await assert.rejects(runner.run('작업'), /응답이 없습니다/);
  assert.equal(sent.length, 2);
  assert.equal(sent[1], 'warp-cancel:1');
});

test('a disconnected helper rejects immediately and leaves the runner reusable', async () => {
  let connected = false;
  const runner = createWarpRunner({ send: () => { if (!connected) throw new Error('연결 끊김'); } });
  await assert.rejects(runner.run('작업'), /연결 끊김/);
  connected = true;
  const pending = runner.run('다시 요청');
  runner.accept({ type: 'warp-delivery', id: 2, ok: true, target: 'focused-warp' });
  assert.equal((await pending).delivery, 'warp');
});

test('Warp dry run neither sends input nor reports an actual delivery', async () => {
  let output = '';
  const runner = createWarpRunner({ dryRun: true, send: () => assert.fail('must not send'), output: { write: text => { output += text; } } });
  assert.equal((await runner.run('작업')).delivery, 'warp-preview');
  assert.match(output, /포커스된 Warp CLI에 전달할 내용\]\n작업/);
});

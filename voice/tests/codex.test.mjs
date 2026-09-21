import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCodexRunner, codexArgs } from '../src/codex.mjs';

async function fakeCodex(t, body) {
  const cwd = await mkdtemp(join(tmpdir(), 'tbd-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const executable = join(cwd, 'fake-codex');
  await writeFile(executable, `#!${process.execPath}\n${body}`, { mode: 0o755 });
  return { cwd, executable };
}

test('Codex subprocess receives a literal UTF-8 stdin prompt, correct cwd and scoped sandbox', async t => {
  const options = await fakeCodex(t, `const fs = require('node:fs'); let text = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', x => text += x); process.stdin.on('end', () => fs.writeFileSync('received.json', JSON.stringify({ text, cwd: process.cwd(), args: process.argv.slice(2) })));`);
  const prompt = '로그인 오류 수정\n$(touch SHOULD_NOT_EXIST) `whoami`; "따옴표"';
  await createCodexRunner({ ...options, model: 'configured-model' }).run(prompt);
  const received = JSON.parse(await readFile(join(options.cwd, 'received.json'), 'utf8'));
  assert.equal(received.text, prompt); assert.equal(received.cwd, await realpath(options.cwd));
  assert.deepEqual(received.args, codexArgs({ cwd: options.cwd, model: 'configured-model' }));
  assert.ok(received.args.includes('workspace-write'));
  assert.ok(!received.args.includes('--dangerously-bypass-approvals-and-sandbox'));
  await assert.rejects(readFile(join(options.cwd, 'SHOULD_NOT_EXIST')), { code: 'ENOENT' });
});

test('subprocess errors and nonzero exits reject cleanly', async t => {
  const options = await fakeCodex(t, 'process.stdin.resume(); process.stdin.on("end", () => process.exit(7));');
  await assert.rejects(createCodexRunner(options).run('test'), /7/);
  await assert.rejects(createCodexRunner({ ...options, executable: join(options.cwd, 'missing') }).run('test'), /실행할 수 없습니다/);
});

test('runner prevents overlap and cancellation terminates its subprocess', async t => {
  const options = await fakeCodex(t, 'process.stdin.resume(); setInterval(() => {}, 1000);');
  const runner = createCodexRunner(options);
  const pending = runner.run('long job');
  await assert.rejects(runner.run('overlap'), /이미 실행 중/);
  runner.cancel();
  await assert.rejects(pending, /실행 실패/);
});

test('existing-session queue uses the explicit target and preserves the literal prompt', async t => {
  const options = await fakeCodex(t, `const fs = require('node:fs'); let stdin = ''; process.stdin.on('data', x => stdin += x); process.stdin.on('end', () => fs.writeFileSync('queued.json', JSON.stringify({ stdin, args: process.argv.slice(2) })));`);
  const prompt = '디즈니랜드 검색해줘\n$(touch QUEUE_INJECTION) "따옴표"';
  const thread = '지정한 CLI 대화';
  const result = await createCodexRunner({ ...options, thread }).run(prompt);
  const received = JSON.parse(await readFile(join(options.cwd, 'queued.json'), 'utf8'));
  assert.deepEqual(received.args, ['queue', '--thread', thread, '--message', prompt]);
  assert.equal(received.stdin, '');
  assert.deepEqual(result, { delivery: 'queued', thread });
  await assert.rejects(readFile(join(options.cwd, 'QUEUE_INJECTION')), { code: 'ENOENT' });
});

test('queue failure is surfaced without falling back to a different session or fresh execution', async t => {
  const options = await fakeCodex(t, 'process.stdin.resume(); process.stdin.on("end", () => process.exit(9));');
  await assert.rejects(createCodexRunner({ ...options, thread: 'missing-session' }).run('test'), /9/);
});

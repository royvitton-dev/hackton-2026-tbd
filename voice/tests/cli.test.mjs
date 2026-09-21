import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const run = (args, input = '') => spawnSync(process.execPath, [cli, ...args], { input, encoding: 'utf8', timeout: 5000 });

test('CLI dry run consumes the entire Korean command, strips triggers and exits on EOF', () => {
  const result = run(['--text', '--dry-run'], '헤이 TBD야\n로그인 화면을 만들어줘\n테스트도 실행해줘\ntbd야 시작해줘\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /연습 모드 · Codex에 전달할 내용\]\n로그인 화면을 만들어줘\n테스트도 실행해줘/);
  assert.equal(result.stdout.match(/Codex 실행 중/g)?.length, 1);
});

test('CLI never runs without wake and submit; pending content is discarded at EOF', () => {
  for (const input of ['TBD야 시작해줘\n', '헤이 TBD야\n미완성 명령\n', '헤이 TBD야\n명령\nTBD야 취소해줘\nTBD야 시작해줘\n']) {
    const result = run(['--text', '--dry-run'], input);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Codex 실행 중/);
  }
});

test('help needs neither microphone nor Codex', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0); assert.match(result.stdout, /헤이 TBD야/);
});

test('invalid options and missing cwd fail visibly', () => {
  for (const args of [['--timeout', 'NaN'], ['--timeout', '0'], ['--unknown'], ['--cwd', '/missing-tbd-directory'], ['--test-feedback']]) {
    const result = run(['--text', '--dry-run', ...args]);
    assert.equal(result.status, 1); assert.match(result.stderr, /\[TBD\]/);
  }
});

test('silent mode leaves the command flow available', () => {
  const result = run(['--text', '--dry-run', '--no-sound'], '헤이 티비디야 수정해줘 티비디야 시작해줘\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /연습 모드 · Codex에 전달할 내용\]\n수정해줘/);
});

test('observed Apple Speech spelling activates the full CLI flow', () => {
  const result = run(['--text', '--dry-run', '--diagnostics'], 'Hey TV 디아\n로그인 오류 수정\nTV 디아 시작해줘\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /듣고 있습니다/);
  assert.match(result.stdout, /연습 모드 · Codex에 전달할 내용\]\n로그인 오류 수정/);
});

test('CLI submits observed proceed phrasing to the chosen session', () => {
  const result = run(['--text', '--dry-run', '--thread', 'voice-target'], 'Hey TV 디아\n디즈니랜드 검색해줘\n헤이 TV 디아 작업 시작해줘\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /기존 Codex 대화로 전달 중 · voice-target/);
  assert.match(result.stdout, /전달할 명령:\n디즈니랜드 검색해줘/);
  assert.match(result.stdout, /기존 Codex 대화로 명령을 전달했습니다/);
  assert.doesNotMatch(result.stdout, /Codex 실행이 끝났습니다/);
});

test('an empty session or model override with an existing session is rejected', () => {
  for (const args of [['--thread', '  '], ['--thread', 'target', '--model', 'another-model']]) {
    assert.equal(run(['--text', '--dry-run', ...args]).status, 1);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { VoiceController } from '../src/controller.mjs';

function fixture(t, options = {}) {
  const calls = [], notices = [], failures = [];
  const controller = new VoiceController({ run: async prompt => { calls.push(prompt); }, ...options });
  controller.on('notice', text => notices.push(text));
  controller.on('failure', error => failures.push(error));
  t.after(() => controller.close());
  const say = (text, extra = {}) => controller.accept({ type: 'final', text, ...extra });
  return { controller, calls, notices, failures, say };
}

test('wake → multiple instructions → explicit start runs exactly once', async t => {
  const { controller, calls, say } = fixture(t);
  say('그냥 하는 이야기'); say('TBD야 시작해줘');
  assert.equal(controller.state, 'idle'); assert.deepEqual(calls, []);
  say('헤이 TBD야'); say('로그인 버튼을 추가해줘'); say('테스트도 실행해줘');
  assert.deepEqual(calls, []);
  say('tbd야 시작해줘'); say('TBD야 시작해줘');
  await controller.pending;
  assert.deepEqual(calls, ['로그인 버튼을 추가해줘\n테스트도 실행해줘']);
  assert.equal(controller.state, 'idle');
});

for (const phrase of ['헤이 티비디야', '헤이 티 비 디야', 'Hey T B D야', '헤이ＴＢＤ야', 'Hey TV 디아', '헤이 티비디아', '헤이 TVD야', '헤이 티 B 디야']) {
  test(`supports spoken/transcribed name: ${phrase}`, async t => {
    const { controller, calls, say } = fixture(t);
    say(`${phrase}, 빌드 오류를 수정해줘. 티 비 디야 시작 해 줘!`);
    await controller.pending;
    assert.deepEqual(calls, ['빌드 오류를 수정해줘.']);
  });
}

test('mixed Speech spelling is recognized for start and cancel without accepting generic TV mentions', async t => {
  const { controller, calls, say } = fixture(t);
  say('Hey TV야'); say('헤이 티비야'); say('Hey TV 디아를 설명하는 중');
  // Reset the intentional quoted wake before verifying start/cancel behavior.
  controller.reset();
  say('헤이 TV야 작업 TV야 시작해줘');
  assert.equal(controller.state, 'idle');
  say('Hey TV 디아'); say('폐기할 작업'); say('TV 디아 취소해줘');
  assert.equal(controller.state, 'idle');
  say('헤이 티비디야 수정할 작업'); say('TV 디아 시작해줘');
  await controller.pending;
  assert.deepEqual(calls, ['수정할 작업']);
});

test('partial hypotheses and duplicate final callbacks never resubmit', async t => {
  const { controller, calls, say } = fixture(t);
  say('헤이 TBD야', { id: 1 });
  say('틀린 명령 TBD야 시작해줘', { type: 'partial', id: 2 });
  assert.deepEqual(calls, []);
  say('올바른 명령', { id: 2 }); say('올바른 명령', { id: 2 });
  say('TBD야 시작해줘', { id: 3 }); await controller.pending;
  say('헤이 TBD야 새 명령 TBD야 시작해줘', { id: 3 });
  await controller.pending;
  assert.deepEqual(calls, ['올바른 명령']);
});

test('start with empty buffer stays listening; generic start wording is content', async t => {
  const { controller, calls, say } = fixture(t);
  say('헤이 TBD야'); say('TBD야 시작해줘');
  assert.equal(controller.state, 'listening'); assert.deepEqual(calls, []);
  say('서버를 시작해줘'); say('TBD야 시작해줘'); await controller.pending;
  assert.deepEqual(calls, ['서버를 시작해줘']);
});

test('cancel and a new wake clear old instructions', async t => {
  const { controller, calls, say } = fixture(t);
  say('헤이 TBD야'); say('폐기할 내용'); say('티비디야 취소해줘');
  say('TBD야 시작해줘'); assert.deepEqual(calls, []);
  say('헤이 TBD야 옛 지시'); say('헤이 TBD야 새 지시'); say('TBD야 시작해줘');
  await controller.pending; assert.deepEqual(calls, ['새 지시']);
});

test('quoted trigger in the middle is content, not a submit', t => {
  const { calls, say } = fixture(t);
  say('헤이 TBD야'); say('TBD야 시작해줘 라는 버튼을 만들어줘');
  assert.deepEqual(calls, []);
});

test('timeout and size limit discard stale content', async t => {
  const { controller, calls, say } = fixture(t, { timeoutMs: 15, maxLength: 10 });
  say('헤이 TBD야 명령'); await delay(40);
  say('TBD야 시작해줘'); assert.equal(controller.state, 'idle');
  say('헤이 TBD야'); say('12345678901');
  assert.equal(controller.state, 'idle'); assert.deepEqual(calls, []);
});

test('a failed run reports error, recovers, and is never retried automatically', async t => {
  let count = 0;
  const { controller, failures, say } = fixture(t, { run: async () => { count++; throw new Error('offline'); } });
  say('헤이 TBD야 테스트 TBD야 시작해줘'); await controller.pending;
  assert.equal(count, 1); assert.equal(failures[0].message, 'offline');
  assert.equal(controller.state, 'idle');
});

test('execution ignores incoming speech and shutdown never resumes listening', async t => {
  let finish;
  const { controller, say } = fixture(t, { run: () => new Promise(resolve => { finish = resolve; }) });
  say('헤이 TBD야 첫 작업 TBD야 시작해줘'); await Promise.resolve();
  say('헤이 TBD야 두 번째 작업 TBD야 시작해줘');
  assert.equal(controller.state, 'running');
  controller.close(); finish(); await controller.pending;
  assert.equal(controller.state, 'closed');
});

test('confirmed wake and submit emit distinct feedback exactly once, after pause and before execution', async t => {
  const order = [];
  const { controller, say } = fixture(t, { run: async () => { order.push('execute'); } });
  controller.on('feedback', kind => order.push(kind));
  controller.on('running', () => order.push('pause'));
  say('헤이 티비디야', { type: 'partial', id: 1 });
  assert.deepEqual(order, []);
  say('헤이 티비디야', { id: 1 });
  say('헤이 티비디야', { id: 1 });
  say('작업 내용', { id: 2 });
  say('티비디야 시작해줘', { type: 'partial', id: 3 });
  assert.deepEqual(order, ['wake']);
  say('티비디야 시작해줘', { id: 3 });
  say('티비디야 시작해줘', { id: 3 });
  await controller.pending;
  assert.deepEqual(order, ['wake', 'pause', 'start', 'execute']);
});

test('empty submit has its own feedback and never claims execution started', t => {
  const { controller, calls, say } = fixture(t);
  const feedback = [];
  controller.on('feedback', kind => feedback.push(kind));
  say('일반 대화'); say('티비디야 시작해줘');
  assert.deepEqual(feedback, []);
  say('헤이 티비디야'); say('티비디야 시작해줘');
  assert.deepEqual(feedback, ['wake', 'empty']);
  assert.deepEqual(calls, []);
  assert.equal(controller.state, 'listening');
});

test('one utterance containing wake, task and submit reports both recognitions', async t => {
  const { controller, say } = fixture(t);
  const feedback = [];
  controller.on('feedback', kind => feedback.push(kind));
  say('헤이 티비디야 오류를 고쳐줘 티비디야 시작해줘');
  await controller.pending;
  assert.deepEqual(feedback, ['wake', 'start']);
});

test('status returns to idle after cancel, timeout and rejected execution', async t => {
  const { controller, say } = fixture(t, { timeoutMs: 15, run: async () => { throw new Error('offline'); } });
  const states = [];
  controller.on('state', state => states.push(state));
  say('헤이 티비디야'); say('티비디야 취소해줘');
  assert.deepEqual(states, ['listening', 'idle']);
  states.length = 0;
  say('헤이 티비디야'); await delay(40);
  assert.deepEqual(states, ['listening', 'idle']);
  states.length = 0;
  say('헤이 티비디야 작업 티비디야 시작해줘'); await controller.pending;
  assert.deepEqual(states, ['listening', 'running', 'idle']);
  controller.close();
  assert.equal(states.at(-1), 'closed');
});

for (const command of ['TV TV 디아 진행해줘', '헤이 TV 디아 작업 시작해줘', '티비디야 실행해줘', 'TBD야 작업 진행해줘', 'DVD 야 시작해줘']) {
  test(`observed submit phrasing preserves and delivers the existing draft: ${command}`, async t => {
    const { controller, calls, say } = fixture(t);
    say('헤이 티비디야'); say('디즈니랜드를 검색해줘'); say(command);
    await controller.pending;
    assert.deepEqual(calls, ['디즈니랜드를 검색해줘']);
  });
}

test('actual Apple transcription with DVD submit delivers only the collected content', async t => {
  const { controller, calls, say } = fixture(t);
  const feedback = [];
  controller.on('feedback', kind => feedback.push(kind));
  const content = '연결 확인용 메세지 입니다 파일은 수정 하지 말고 진행 중인 음성 연결 검증을 계속 해 주세요';
  say(`Hey TV 디아 ${content} DVD 야 시작해줘`);
  await controller.pending;
  assert.deepEqual(calls, [content]);
  assert.deepEqual(feedback, ['wake', 'start']);
});

test('DVD alias cannot wake the controller or submit ordinary DVD content', async t => {
  const { controller, calls, say } = fixture(t);
  say('헤이 DVD야 작업 DVD 야 시작해줘');
  assert.equal(controller.state, 'idle');
  say('헤이 티비디야');
  say('DVD 재생 기능을 추가해줘');
  say('DVD 야 시작해줘 라는 문구도 표시해줘');
  assert.equal(controller.state, 'listening');
  assert.deepEqual(calls, []);
  say('티비디야 시작해줘');
  await controller.pending;
  assert.deepEqual(calls, ['DVD 재생 기능을 추가해줘\nDVD 야 시작해줘 라는 문구도 표시해줘']);
});

test('a new wake with new instructions still replaces an earlier draft', async t => {
  const { controller, calls, say } = fixture(t);
  say('헤이 티비디야'); say('이전 작업');
  say('헤이 티비디야 새 작업 티비디야 시작해줘');
  await controller.pending;
  assert.deepEqual(calls, ['새 작업']);
});

test('existing-session delivery is reported as delivered, not completed', async t => {
  const { controller, notices, say } = fixture(t, { run: async () => ({ delivery: 'queued' }) });
  say('헤이 티비디야 작업 티비디야 시작해줘');
  await controller.pending;
  assert.equal(notices.at(-1), '기존 Codex 대화로 명령을 전달했습니다.');
});

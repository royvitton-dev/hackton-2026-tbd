import { EventEmitter } from 'node:events';

// Korean Speech can transcribe "티비디야" as "TV 디아". Match letter-by-letter
// English/Korean spellings and the B/V homophone, while still requiring all T-B-D sounds.
const name = '(?:t|티)\\s*(?:b|v|비|브이)\\s*(?:d|디)\\s*(?:야|아)';
const wake = new RegExp(`(?:^|[\\s,.!?，。！？])(?:헤이|hey)\\s*${name}[\\s,.!?，。！？]*`, 'iu');
const stutter = '(?:(?:t|티)\\s*(?:b|v|비|브이)\\s+)?';
// Apple also transcribes the submit phrase as "DVD 야 시작해줘".
// Accept that spelling only for submission after a valid wake, never as a wake.
const submitName = `(?:${name}|d\\s*v\\s*d\\s*(?:야|아))`;
const start = new RegExp(`(?:^|[\\s,.!?，。！？])(?:(?:헤이|hey)\\s*)?${stutter}${submitName}\\s*(?:작업\\s*)?(?:시작|진행|실행)\\s*해\\s*줘[\\s.!?。！？]*$`, 'iu');
const cancel = new RegExp(`^${name}\\s*취소(?:\\s*해\\s*줘)?[\\s.!?。！？]*$`, 'iu');

export class VoiceController extends EventEmitter {
  constructor({ run, timeoutMs = 120_000, maxLength = 32_000 }) {
    super();
    this.run = run;
    this.timeoutMs = timeoutMs;
    this.maxLength = maxLength;
    this.state = 'idle';
    this.parts = [];
    this.seen = new Set();
    this.pending = Promise.resolve();
  }

  reset() {
    clearTimeout(this.timer);
    this.parts = [];
    this.setState('idle');
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.emit('state', state);
  }

  armTimeout() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.reset();
      this.emit('notice', '입력이 없어 명령을 취소했습니다. 다시 “헤이 TBD야”라고 말하세요.');
    }, this.timeoutMs);
    this.timer.unref();
  }

  accept(event) {
    if (this.state === 'running' || this.state === 'closed') return;
    if (event.type === 'partial') {
      if (this.state === 'listening' && typeof event.text === 'string' && event.text.trim()) {
        this.armTimeout();
        this.emit('partial', event.text);
      }
      return;
    }
    if (event.type !== 'final' || typeof event.text !== 'string') return;
    if (event.id != null) {
      if (this.seen.has(event.id)) return;
      this.seen.add(event.id);
      if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value);
    }
    let text = event.text.normalize('NFKC').trim();
    if (!text) return;
    // A named "start/proceed" after a repeated wake submits the existing draft.
    // It must be detected before another wake resets the accumulated instructions.
    const submission = this.state === 'listening' ? start.exec(text) : null;
    const wakeCandidate = wake.exec(text);
    const activation = submission && wakeCandidate && wakeCandidate.index >= submission.index ? null : wakeCandidate;
    if (activation) {
      this.reset();
      this.setState('listening');
      text = text.slice(activation.index + activation[0].length).trim();
      this.emit('feedback', 'wake');
      this.emit('notice', '듣고 있습니다. 명령을 말한 뒤 “TBD야 시작해줘”라고 말하세요.');
    }
    if (this.state !== 'listening') return;
    this.armTimeout();
    if (cancel.test(text)) {
      this.reset();
      this.emit('notice', '명령을 취소했습니다. “헤이 TBD야”를 기다립니다.');
      return;
    }
    const execution = start.exec(text);
    const content = (execution ? text.slice(0, execution.index) : text).trim();
    if (content) this.parts.push(content);
    const prompt = this.parts.join('\n');
    if (prompt.length > this.maxLength) {
      this.reset();
      this.emit('notice', '명령이 너무 길어 취소했습니다. 짧게 나누어 다시 말하세요.');
      return;
    }
    if (content) this.emit('transcript', prompt);
    if (!execution) return;
    if (!prompt) {
      this.emit('feedback', 'empty');
      this.emit('notice', '아직 명령이 없습니다. 실행할 내용을 먼저 말하세요.');
      return;
    }
    clearTimeout(this.timer);
    this.setState('running');
    this.emit('running', prompt);
    this.emit('feedback', 'start');
    this.pending = Promise.resolve().then(() => this.run(prompt)).then(
      result => this.emit('notice', result?.delivery === 'warp' ? '포커스된 Warp CLI에 붙여넣기와 Enter를 전달했습니다.'
        : result?.delivery === 'warp-preview' ? '연습 모드: Warp에 전송하지 않았습니다.'
        : result?.delivery === 'queued' ? '기존 Codex 대화로 명령을 전달했습니다.' : 'Codex 실행이 끝났습니다.'),
      error => this.emit('failure', error),
    ).finally(() => {
      if (this.state === 'closed') return;
      this.reset();
      this.emit('idle');
    });
  }

  close() {
    clearTimeout(this.timer);
    this.parts = [];
    this.setState('closed');
  }
}

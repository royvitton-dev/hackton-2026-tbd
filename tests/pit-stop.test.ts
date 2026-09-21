import test from 'node:test';
import assert from 'node:assert/strict';
import { isPitStopEntry, pitStopFrame, PIT_STOP_SECONDS } from '../src/lib/pitStop';

test('Pit stop entry is opt-in and leaves ordinary dashboard links unchanged', () => {
  assert.equal(isPitStopEntry('?user=U0004'), false);
  assert.equal(isPitStopEntry('?user=U0004&intro=pitstop'), true);
  assert.equal(isPitStopEntry('?intro=other'), false);
});

test('Cinematic timeline progresses from racing through service and fades away', () => {
  assert.equal(pitStopFrame(0).phase, 'racing');
  assert.equal(pitStopFrame(0).opacity, 0);
  assert.equal(pitStopFrame(2).phase, 'entering');
  assert.equal(pitStopFrame(4).phase, 'service');
  assert.equal(pitStopFrame(6).phase, 'ready');
  assert.equal(pitStopFrame(PIT_STOP_SECONDS).opacity, 0);
  assert.equal(pitStopFrame(PIT_STOP_SECONDS).done, true);
  let progress = 0;
  for (let t = 0; t < 9; t += .01) {
    const frame = pitStopFrame(t);
    assert.ok(frame.progress >= progress && frame.progress <= 1);
    assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
    assert.ok(frame.speed >= 0 && frame.speed <= 1);
    progress = frame.progress;
  }
  assert.equal(pitStopFrame(-10).progress, 0);
  assert.equal(pitStopFrame(Number.NaN).progress, 0);
});

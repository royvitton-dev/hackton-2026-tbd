import type { Driver, VoicePrint } from './types';

export function detectPitch(samples: Float32Array, sampleRate: number): number {
  let energy = 0;
  for (const v of samples) energy += v * v;
  if (Math.sqrt(energy / samples.length) < .012) return 0;
  const minLag = Math.floor(sampleRate / 400), maxLag = Math.min(Math.floor(sampleRate / 65), samples.length / 2);
  let best = 0, bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0, left = 0, right = 0;
    for (let i = 0; i < samples.length - maxLag; i += 2) {
      sum += samples[i] * samples[i + lag]; left += samples[i] ** 2; right += samples[i + lag] ** 2;
    }
    const correlation = sum / Math.sqrt(left * right + 1e-12);
    if (correlation > best + .003) { best = correlation; bestLag = lag; }
  }
  return best > .65 ? sampleRate / bestLag : 0;
}

export function spectralFeatures(spectrum: Float32Array, sampleRate: number): number[] {
  const bands = 26;
  const mel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
  const hz = (m: number) => 700 * (10 ** (m / 2595) - 1);
  const min = mel(80), max = mel(Math.min(7600, sampleRate / 2));
  const energies: number[] = [];
  for (let band = 0; band < bands; band++) {
    const from = Math.max(0, Math.floor(hz(min + (max - min) * band / bands) / (sampleRate / 2) * spectrum.length));
    const to = Math.min(spectrum.length - 1, Math.ceil(hz(min + (max - min) * (band + 1) / bands) / (sampleRate / 2) * spectrum.length));
    let sum = 0;
    for (let i = from; i <= to; i++) sum += 10 ** (Math.max(-100, spectrum[i]) / 10);
    energies.push(Math.log(sum / Math.max(1, to - from + 1) + 1e-10));
  }
  // Discard coefficient 0 (loudness); keep 12 cepstral shape coefficients.
  const vector = Array.from({ length: 12 }, (_, k) => energies.reduce((sum, e, i) => sum + e * Math.cos(Math.PI * (k + 1) * (i + .5) / bands), 0) / bands);
  const norm = Math.hypot(...vector) || 1;
  return vector.map(v => v / norm);
}

export function buildVoicePrint(frames: { vector: number[]; pitch: number }[]): VoicePrint {
  const voiced = frames.filter(f => f.pitch >= 65 && f.pitch <= 400 && f.vector.length === 12 && f.vector.every(Number.isFinite));
  if (voiced.length < 15) throw new Error('목소리가 충분히 들리지 않았어요. 조용한 곳에서 3초 이상 말해 주세요.');
  const vector = Array.from({ length: 12 }, (_, i) => voiced.reduce((s, frame) => s + frame.vector[i], 0) / voiced.length);
  const norm = Math.hypot(...vector) || 1;
  const pitches = voiced.map(f => f.pitch).sort((a, b) => a - b);
  return { vector: vector.map(v => v / norm), pitch: pitches[Math.floor(pitches.length / 2)], frames: voiced.length };
}

export function voiceSimilarity(a: VoicePrint, b: VoicePrint) {
  if (a.vector.length !== 12 || b.vector.length !== 12 || !a.vector.every(Number.isFinite) || !b.vector.every(Number.isFinite) || !Number.isFinite(a.pitch) || !Number.isFinite(b.pitch) || a.pitch <= 0 || b.pitch <= 0) return 0;
  const norm = Math.hypot(...a.vector) * Math.hypot(...b.vector);
  if (!norm) return 0;
  const cosine = a.vector.reduce((sum, v, i) => sum + v * b.vector[i], 0) / norm;
  const pitch = Math.exp(-Math.abs(Math.log2(a.pitch / b.pitch)) * 1.8);
  return Math.max(0, Math.min(1, (cosine + 1) / 2 * .75 + pitch * .25));
}

export function identifySpeaker(voice: VoicePrint, drivers: Driver[]) {
  const ranked = drivers.filter(d => d.voice).map(driver => ({ driver, score: voiceSimilarity(voice, driver.voice!) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < .84 || (ranked[1] && best.score - ranked[1].score < .035)) return { match: null, candidates: ranked, reason: best ? 'ambiguous' : 'empty' };
  return { match: best.driver, candidates: ranked, reason: 'matched' };
}

export function cleanNickname(transcript: string) {
  return transcript.replace(/^(제\s*(별명|이름)은?|내\s*(별명|이름)은?|저는|나는)\s*/, '').replace(/(입니다|이에요|예요|이라고 해요|라고 해요)[.!?\s]*$/, '').trim().slice(0, 12);
}

export function detectDrink(transcript: string): string | null {
  if (/말차|녹차/.test(transcript)) return '말차 라떼';
  if (/초코|초콜릿/.test(transcript)) return '초콜릿 라떼';
  if (/바닐라/.test(transcript)) return '바닐라 라떼';
  if (/콜드\s*브루|콜드브루/.test(transcript)) return '콜드브루';
  if (/라[떼테]/.test(transcript)) return '카페 라떼';
  if (/아메리카노|아아|아이스\s*커피/.test(transcript)) return /따뜻|뜨거|핫/.test(transcript) ? '따뜻한 아메리카노' : '아이스 아메리카노';
  return null;
}

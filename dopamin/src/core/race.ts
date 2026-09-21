import { TRACKS } from './catalog';
import type { CarState, Driver, Highlight, Item, RaceEvent, RaceLog, Snapshot } from './types';

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function simulateRace(drivers: Driver[], trackId: string, seed: number, createdAt = new Date().toISOString()): RaceLog {
  if (drivers.length < 2 || drivers.length > 8) throw new Error('참여자는 2명부터 8명까지 등록해 주세요.');
  if (new Set(drivers.map(d => d.id)).size !== drivers.length) throw new Error('중복된 레이서입니다.');
  const track = TRACKS.find(t => t.id === trackId);
  if (!track) throw new Error('트랙을 찾을 수 없습니다.');
  const random = seededRandom(seed);
  const dt = .05;
  const cars = drivers.map((d, index) => ({
    id: d.id, progress: 0, speed: 0, lane: (index % 4 - 1.5) * 1.15,
    effect: null as Item | null, finish: null as number | null,
    ability: .95 + random() * .10, effectUntil: 0,
    shieldUntil: 0, nextItem: 3 + random() * 3, lap: 0,
  }));
  const events: RaceEvent[] = [{ time: 0, type: 'start', actor: drivers[0].id }];
  const snapshots: Snapshot[] = [];
  const projectiles: { actor: string; target: string; item: Item; arrival: number }[] = [];
  const capture = (time: number) => snapshots.push({ time, cars: cars.map(({ id, progress, speed, lane, effect, finish }) => ({ id, progress, speed, lane, effect, finish })) });
  capture(0);
  let previousLeader = cars[0].id;
  let lastOvertake = 0;
  let time = 0;
  for (let step = 1; step <= 4800; step++) {
    time = Number((step * dt).toFixed(2));
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const shot = projectiles[i];
      if (time + .00001 < shot.arrival) continue;
      projectiles.splice(i, 1);
      const target = cars.find(c => c.id === shot.target)!;
      if (target.finish !== null) continue;
      const blocked = target.shieldUntil > time;
      events.push({ time, type: blocked ? 'blocked' : 'hit', actor: shot.actor, target: shot.target, item: shot.item });
      if (!blocked) { target.effect = shot.item; target.effectUntil = time + (shot.item === 'ice' ? 2 : 1.5); }
    }
    const ranked = [...cars].sort((a, b) => b.progress - a.progress);
    for (const car of cars) {
      if (car.finish !== null) continue;
      if (time >= car.effectUntil) car.effect = null;
      if (time >= car.nextItem) {
        const rank = ranked.indexOf(car);
        const roll = random();
        const item: Item = roll < (rank >= drivers.length / 2 ? .30 : .16) ? 'boost' : roll < .44 ? 'shield' : roll < .7 ? 'bean' : roll < .9 ? 'ice' : 'storm';
        events.push({ time, type: 'item', actor: car.id, item });
        if (item === 'boost' || item === 'shield') {
          if (item === 'shield') car.shieldUntil = time + 4;
          car.effect = item;
          car.effectUntil = time + (item === 'boost' ? 2.5 : 4);
        } else {
          const opponents = ranked.filter(c => c.id !== car.id && c.finish === null);
          const target = item === 'storm' ? opponents[0] : opponents.filter(c => c.progress >= car.progress).at(-1) || opponents.at(-1);
          if (target) {
            events.push({ time, type: 'launch', actor: car.id, target: target.id, item });
            projectiles.push({ actor: car.id, target: target.id, item, arrival: time + (item === 'storm' ? .7 : .9) });
          }
        }
        car.nextItem = time + 5 + random() * 4;
      }
      const corner = Math.pow(Math.sin(car.progress * Math.PI * (2 + track.level * .5)), 8);
      const cornerFactor = 1 - corner * (1 - track.grip);
      const effectFactor = car.effect === 'boost' ? 1.5 : car.effect === 'ice' ? .36 : car.effect === 'bean' ? .48 : car.effect === 'storm' ? .40 : 1;
      const catchup = 1 + Math.min(.09, Math.max(0, ranked[0].progress - car.progress) * .18);
      const cruise = 38 * car.ability * cornerFactor * effectFactor * catchup;
      car.speed += (cruise - car.speed) * .12;
      const before = car.progress;
      car.progress = Math.min(2, car.progress + car.speed / track.length * dt);
      car.lane += Math.sin(time * .9 + drivers.findIndex(d => d.id === car.id) * 2) * dt * .18;
      car.lane = Math.max(-2.2, Math.min(2.2, car.lane));
      if (Math.floor(car.progress) > car.lap) {
        car.lap = Math.floor(car.progress);
        if (car.lap < 2) events.push({ time, type: 'lap', actor: car.id, lap: 2 });
      }
      if (car.progress >= 2) {
        const fraction = (2 - before) / Math.max(.000001, car.speed / track.length * dt);
        car.finish = Number((time - dt + dt * fraction).toFixed(4));
        car.speed = 0;
        events.push({ time: car.finish, type: 'finish', actor: car.id });
      }
    }
    const leader = [...cars].sort((a, b) => b.progress - a.progress)[0];
    if (leader.id !== previousLeader && time - lastOvertake > 2) {
      events.push({ time, type: 'overtake', actor: leader.id, target: previousLeader });
      lastOvertake = time;
      previousLeader = leader.id;
    }
    const done = cars.every(c => c.finish !== null);
    if (step % 2 === 0 || done) capture(time);
    if (done) break;
  }
  if (cars.some(c => c.finish === null)) throw new Error('레이스가 제한 시간 안에 종료되지 않았습니다.');
  return {
    version: 1, id: `race-${seed}-${Date.parse(createdAt)}`, createdAt, seed, trackId,
    drivers: drivers.map(({ voice: _voice, ...driver }) => driver), duration: time,
    snapshots, events: events.sort((a, b) => a.time - b.time),
    order: [...cars].sort((a, b) => a.finish! - b.finish! || a.id.localeCompare(b.id)).map(c => c.id),
  };
}

export function sampleRace(log: RaceLog, time: number): Snapshot {
  const frames = log.snapshots;
  const clamped = Math.max(0, Math.min(time, log.duration));
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (frames[mid].time <= clamped) lo = mid; else hi = mid - 1; }
  const a = frames[lo], b = frames[Math.min(lo + 1, frames.length - 1)];
  const blend = a === b ? 0 : (clamped - a.time) / (b.time - a.time);
  return { time: clamped, cars: a.cars.map((car, i) => ({ ...car,
    progress: car.progress + (b.cars[i].progress - car.progress) * blend,
    speed: car.speed + (b.cars[i].speed - car.speed) * blend,
    lane: car.lane + (b.cars[i].lane - car.lane) * blend,
  })) };
}

export function getStandings(cars: CarState[]) {
  return [...cars].sort((a, b) => {
    if (a.finish !== null && b.finish !== null) return a.finish - b.finish || a.id.localeCompare(b.id);
    if (a.finish !== null) return -1;
    if (b.finish !== null) return 1;
    return b.progress - a.progress;
  });
}

export function getHighlights(log: RaceLog): Highlight[] {
  const action = log.events.filter(e => e.type === 'hit' || e.type === 'overtake');
  const selected = action.filter((e, i) => i === 0 || e.time - action[i - 1].time > 3).slice(-4);
  const clips: Highlight[] = selected.map(e => ({
    start: Math.max(0, e.time - 1.5), end: Math.min(log.duration, e.time + 3),
    title: e.type === 'hit' ? '짜릿한 아이템 한 방!' : '한 끗 차이, 선두 교체!', actor: e.target || e.actor,
  }));
  clips.push({ start: Math.max(0, log.duration - 6), end: log.duration, title: '오늘의 커피 히어로 탄생', actor: log.order.at(-1)! });
  return clips;
}

export function activeImpact(log: RaceLog, time: number) {
  return log.events.findLast(e => e.type === 'hit' && e.time <= time && time - e.time < 1.4);
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function parseReplay(text: string): RaceLog {
  if (text.length > 6_000_000) throw new Error('리플레이 파일은 6MB 이하여야 합니다.');
  let data: RaceLog;
  try { data = JSON.parse(text); } catch { throw new Error('올바른 JSON 파일이 아닙니다.'); }
  const invalid = () => { throw new Error('유효하지 않은 BREW RACERS 리플레이입니다.'); };
  if (!data || data.version !== 1 || !TRACKS.some(t => t.id === data.trackId) || !finite(data.duration) || data.duration <= 0 || data.duration > 240 || !finite(data.seed) || typeof data.id !== 'string' || data.id.length > 120 || !Number.isFinite(Date.parse(data.createdAt))) invalid();
  if (!Array.isArray(data.drivers) || data.drivers.length < 2 || data.drivers.length > 8) invalid();
  if (data.drivers.some(d => !d || typeof d.id !== 'string' || d.id.length > 100 || typeof d.nickname !== 'string' || d.nickname.length > 20 || typeof d.drink !== 'string' || d.drink.length > 40 || typeof d.celebrity !== 'string' || d.celebrity.length > 20 || !Number.isInteger(d.avatar) || d.avatar < 0 || d.avatar > 7 || !/^#[\da-f]{6}$/i.test(d.color))) invalid();
  const ids = new Set(data.drivers.map(d => d.id));
  if (ids.size !== data.drivers.length || !Array.isArray(data.order) || data.order.length !== ids.size || new Set(data.order).size !== ids.size || data.order.some(id => !ids.has(id))) invalid();
  if (!Array.isArray(data.snapshots) || data.snapshots.length < 2 || data.snapshots.length > 2402) invalid();
  let previousTime = -1;
  for (const snapshot of data.snapshots) {
    if (!snapshot || !finite(snapshot.time) || snapshot.time < 0 || snapshot.time <= previousTime || snapshot.time > data.duration || !Array.isArray(snapshot.cars) || snapshot.cars.length !== ids.size) invalid();
    snapshot.cars.forEach((car, i) => {
      if (!car || car.id !== data.drivers[i].id || !finite(car.progress) || car.progress < 0 || car.progress > 2 || !finite(car.speed) || car.speed < 0 || car.speed > 200 || !finite(car.lane) || Math.abs(car.lane) > 5 || (car.finish !== null && (!finite(car.finish) || car.finish < 0 || car.finish > data.duration)) || ![null, 'boost', 'bean', 'ice', 'shield', 'storm'].includes(car.effect)) invalid();
    });
    previousTime = snapshot.time;
  }
  if (data.snapshots[0].time !== 0 || data.snapshots.at(-1)!.time !== data.duration || data.snapshots.at(-1)!.cars.some(c => c.progress !== 2 || c.finish === null)) invalid();
  for (let i = 1; i < data.snapshots.length; i++) if (data.snapshots[i].cars.some((car, j) => car.progress < data.snapshots[i - 1].cars[j].progress)) invalid();
  if (getStandings(data.snapshots.at(-1)!.cars).some((car, i) => car.id !== data.order[i])) invalid();
  if (!Array.isArray(data.events) || data.events.length > 5000) invalid();
  previousTime = -1;
  for (const e of data.events) {
    if (!e || !finite(e.time) || e.time < previousTime || e.time < 0 || e.time > data.duration || !['start','item','launch','hit','blocked','lap','finish','overtake'].includes(e.type) || !ids.has(e.actor) || (e.target !== undefined && !ids.has(e.target)) || (e.item !== undefined && !['boost','bean','ice','shield','storm'].includes(e.item))) invalid();
    if (e.type === 'launch' && (!e.target || e.target === e.actor || !['bean','ice','storm'].includes(e.item || ''))) invalid();
    previousTime = e.time;
  }
  return data;
}

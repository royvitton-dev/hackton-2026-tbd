import type { Item, RaceEvent, RaceLog } from './types';

export const FLIGHT_TIME = { bean: .9, ice: .9, storm: .7 };
export const EFFECT_COLORS: Record<Item, string> = {
  bean: '#ff8c27', ice: '#43d9ff', storm: '#c292ff', boost: '#ffb529', shield: '#60efff',
};
export type RaceMoment = { phase: 'cruise'|'launch'|'hit'|'blocked'|'boost'|'shield'; event: RaceEvent|null; age: number; intensity: number; focus: string|null };
const cache = new WeakMap<RaceLog, RaceEvent[]>();

// Old version-1 recordings remain playable: infer the pre-impact flight only
// for logs that predate explicit launch events. No stored log is modified.
export function visualEvents(log: RaceLog): RaceEvent[] {
  const cached = cache.get(log);
  if (cached) return cached;
  let events = log.events;
  if (!events.some(e => e.type === 'launch')) {
    const launches = events.filter(e => (e.type === 'hit' || e.type === 'blocked') && e.target && e.item && e.item in FLIGHT_TIME)
      .map(e => ({ ...e, type: 'launch' as const, time: Math.max(0, e.time - FLIGHT_TIME[e.item as keyof typeof FLIGHT_TIME]) }));
    events = [...events, ...launches].sort((a, b) => a.time - b.time);
  }
  cache.set(log, events);
  return events;
}

export function eventKey(event: RaceEvent) { return `${event.type}:${event.time}:${event.actor}:${event.target || ''}`; }

export function raceMoment(log: RaceLog, time: number, preferred: string|null = null): RaceMoment {
  const events = visualEvents(log);
  const impact = events.findLast(e => (e.type === 'hit' || e.type === 'blocked') && time >= e.time && time - e.time < 1.4);
  const launch = events.findLast(e => e.type === 'launch' && time >= e.time && time - e.time < FLIGHT_TIME[e.item as keyof typeof FLIGHT_TIME]);
  const power = events.findLast(e => e.type === 'item' && (e.item === 'boost' || e.item === 'shield') && time >= e.time && time - e.time < 2.5 && (!preferred || e.actor === preferred));
  const event = impact || launch || power || null;
  if (!event) return { phase: 'cruise', event: null, age: 0, intensity: 0, focus: preferred };
  const age = time - event.time;
  const phase = event.type === 'item' ? event.item as 'boost'|'shield' : event.type as 'launch'|'hit'|'blocked';
  const intensity = phase === 'hit' ? Math.exp(-age * 2.7) : phase === 'launch' ? 1 - age / FLIGHT_TIME[event.item as keyof typeof FLIGHT_TIME] : Math.max(0, 1 - age / 2.5);
  return { phase, event, age, intensity, focus: event.type === 'hit' || event.type === 'blocked' ? event.target! : preferred || event.actor };
}

// Analytic positions make effects independent of frame rate and seek order.
export function burstParticle(seed: number, index: number, age: number) {
  const noise = (v: number) => { const n = Math.sin(v * 127.1 + seed * 31.7) * 43758.5453; return n - Math.floor(n); };
  const angle = noise(index + 1) * Math.PI * 2, velocity = 4 + noise(index + 11) * 10;
  return {
    x: Math.cos(angle) * velocity * age,
    y: (3 + noise(index + 29) * 9) * age - 8 * age * age,
    z: Math.sin(angle) * velocity * age,
    scale: Math.max(0, 1 - age / (1 + noise(index + 49) * .6)),
    rotation: noise(index + 71) * 6 + age * (3 + noise(index + 17) * 9),
  };
}

export function cameraKick(moment: RaceMoment, time: number, reducedMotion: boolean) {
  if (reducedMotion || !moment.event) return { x: 0, y: 0, roll: 0, fov: 0 };
  const shake = moment.phase === 'hit' ? .40 * moment.intensity : moment.phase === 'launch' ? .12 * moment.intensity : 0;
  return { x: Math.sin(time * 73) * shake, y: Math.cos(time * 91) * shake * .65, roll: Math.sin(time * 47) * shake * .06, fov: moment.phase === 'boost' ? 12 : moment.phase === 'hit' ? moment.intensity * 8 : 0 };
}

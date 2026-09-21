export type VoicePrint = { vector: number[]; pitch: number; frames: number };
export type Driver = {
  id: string; nickname: string; drink: string; color: string; avatar: number;
  celebrity: string; voice?: VoicePrint; demo?: boolean;
};
export type Track = {
  id: string; name: string; english: string; subtitle: string; level: number;
  accent: string; ground: string; road: string; sky: string;
  points: [number, number, number][]; length: number; grip: number;
};
export type Item = 'boost' | 'bean' | 'ice' | 'shield' | 'storm';
export type RaceEvent = {
  time: number; type: 'start' | 'item' | 'launch' | 'hit' | 'blocked' | 'lap' | 'finish' | 'overtake';
  actor: string; target?: string; item?: Item; lap?: number;
};
export type CarState = { id: string; progress: number; speed: number; lane: number; effect: Item | null; finish: number | null };
export type Snapshot = { time: number; cars: CarState[] };
export type RaceLog = {
  version: 1; id: string; createdAt: string; seed: number; trackId: string;
  drivers: Driver[]; duration: number; snapshots: Snapshot[];
  events: RaceEvent[]; order: string[];
};
export type Highlight = { start: number; end: number; title: string; actor: string };

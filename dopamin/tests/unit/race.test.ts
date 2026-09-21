import { describe, expect, it } from 'vitest';
import { demoDrivers, ITEMS, TRACKS } from '../../src/core/catalog';
import { activeImpact, getHighlights, getStandings, parseReplay, sampleRace, seededRandom, simulateRace } from '../../src/core/race';
import type { Driver, RaceLog } from '../../src/core/types';

const created='2026-09-20T00:00:00.000Z';
const drivers=demoDrivers();
const run=(seed=1234)=>simulateRace(drivers,'roastery',seed,created);
const clone=(value:RaceLog)=>JSON.parse(JSON.stringify(value)) as RaceLog;

describe('deterministic two-lap racing',()=>{
  it('reproduces the full race from the same seed',()=>{expect(run()).toEqual(run());expect(run(1).snapshots).not.toEqual(run(2).snapshots);});
  it('uses reproducible bounded random values',()=>{const a=seededRandom(7),b=seededRandom(7);for(let i=0;i<1000;i++){const value=a();expect(value).toBe(b());expect(value).toBeGreaterThanOrEqual(0);expect(value).toBeLessThan(1);}});
  it.each(TRACKS)('finishes exactly two laps on $name for eight racers',track=>{
    const eight:Driver[]=Array.from({length:8},(_,i)=>({...drivers[i%4],id:`player-${i}`}));const log=simulateRace(eight,track.id,100+track.level,created);
    expect(log.duration).toBeLessThan(100);expect(new Set(log.order).size).toBe(8);
    for(const [i,snapshot] of log.snapshots.entries())for(const [j,car] of snapshot.cars.entries()){
      expect(car.progress).toBeGreaterThanOrEqual(i?log.snapshots[i-1].cars[j].progress:0);expect(car.progress).toBeLessThanOrEqual(2);expect(Math.abs(car.lane)).toBeLessThanOrEqual(2.2);
    }
    expect(log.snapshots.at(-1)!.cars.every(c=>c.progress===2&&c.finish!==null)).toBe(true);
    expect(log.events.filter(e=>e.type==='finish')).toHaveLength(8);expect(log.events.filter(e=>e.type==='lap')).toHaveLength(8);
    expect(parseReplay(JSON.stringify(log))).toEqual(log);
  });
  it('does not systematically assign the same loser',()=>{const losers=new Set(Array.from({length:24},(_,i)=>run(i).order.at(-1)));expect(losers.size).toBe(4);});
  it('rejects invalid participant counts, duplicate IDs and missing tracks',()=>{
    expect(()=>simulateRace(drivers.slice(0,1),'roastery',1)).toThrow('2명');expect(()=>simulateRace(Array(9).fill(drivers[0]),'roastery',1)).toThrow('8명');
    expect(()=>simulateRace([drivers[0],drivers[0]],'roastery',1)).toThrow('중복');expect(()=>simulateRace(drivers,'missing',1)).toThrow('트랙');
  });
  it('never writes a voice print to the public race log',()=>{const voiced=drivers.map(d=>({...d,voice:{vector:Array(12).fill(1),pitch:180,frames:40}}));expect(JSON.stringify(simulateRace(voiced,'roastery',1,created))).not.toContain('"voice"');});
  it('exercises every item and shield blocking across seeded races',()=>{
    const logs=Array.from({length:12},(_,i)=>run(i));const events=logs.flatMap(l=>l.events);
    expect(new Set(events.filter(e=>e.type==='item').map(e=>e.item))).toEqual(new Set(Object.keys(ITEMS)));
    expect(events.some(e=>e.type==='blocked')).toBe(true);expect(events.some(e=>e.type==='hit')).toBe(true);expect(events.some(e=>e.type==='overtake')).toBe(true);
    for(const event of events.filter(e=>e.type==='hit'))expect(event.actor).not.toBe(event.target);
  });
  it('matches the race algorithm golden result',()=>{
    const log=run();expect({order:log.order,duration:log.duration,finishes:log.snapshots.at(-1)!.cars.map(c=>c.finish),eventCounts:Object.fromEntries(['hit','blocked','overtake','item'].map(type=>[type,log.events.filter(e=>e.type===type).length]))}).toMatchSnapshot();
  });
});

describe('replay and highlights',()=>{
  const log=run();
  it('interpolates between snapshots and clamps out-of-range seeking',()=>{
    expect(sampleRace(log,-10)).toEqual(log.snapshots[0]);expect(sampleRace(log,999)).toEqual(log.snapshots.at(-1));
    const a=log.snapshots[100],b=log.snapshots[101],sample=sampleRace(log,(a.time+b.time)/2);
    expect(sample.cars[0].progress).toBeCloseTo((a.cars[0].progress+b.cars[0].progress)/2,10);
  });
  it('sorts finished racers by crossing time and unfinished racers by progress',()=>{
    const car=log.snapshots[0].cars[0];expect(getStandings([{...car,id:'b',progress:2,finish:12},{...car,id:'a',progress:2,finish:10},{...car,id:'c',progress:1.8},{...car,id:'d',progress:1.9}]).map(c=>c.id)).toEqual(['a','b','d','c']);
    expect(getStandings([{...car,id:'z',finish:10},{...car,id:'a',finish:10}]).map(c=>c.id)).toEqual(['a','z']);
    expect(getStandings(log.snapshots.at(-1)!.cars).map(c=>c.id)).toEqual(log.order);
  });
  it('opens first-person camera only inside the impact window',()=>{const hit=log.events.find(e=>e.type==='hit')!;expect(activeImpact(log,hit.time)?.time).toBe(hit.time);expect(activeImpact({...log,events:[hit]},hit.time+1.5)).toBeUndefined();expect(activeImpact(log,0)).toBeUndefined();});
  it('always includes the last finisher in valid highlight clips',()=>{
    const clips=getHighlights(log);expect(clips.length).toBeGreaterThan(1);expect(clips.at(-1)!.actor).toBe(log.order.at(-1));
    for(const clip of clips){expect(clip.start).toBeGreaterThanOrEqual(0);expect(clip.end).toBeLessThanOrEqual(log.duration);expect(clip.end).toBeGreaterThan(clip.start);}
    expect(getHighlights({...log,events:[],duration:3})).toEqual([{start:0,end:3,title:'오늘의 커피 히어로 탄생',actor:log.order.at(-1)}]);
  });
  it('round-trips a complete recording without changing playback',()=>{const restored=parseReplay(JSON.stringify(log));for(const time of [0,5.55,20,log.duration])expect(sampleRace(restored,time)).toEqual(sampleRace(log,time));});
  it('rejects malformed JSON, nulls and oversized uploads',()=>{for(const text of ['{broken','null','x'.repeat(6_000_001)])expect(()=>parseReplay(text)).toThrow();});
  const invalidCases:[string,(l:RaceLog)=>void][]=[
    ['version',l=>{l.version=2 as 1;}],['track',l=>{l.trackId='missing';}],['duration',l=>{l.duration=-1;}],['huge duration',l=>{l.duration=999;}],['seed',l=>{l.seed=NaN;}],['id',l=>{l.id='x'.repeat(121);}],['date',l=>{l.createdAt='bad';}],
    ['no drivers',l=>{l.drivers=[];}],['duplicate drivers',l=>{l.drivers[1].id=l.drivers[0].id;}],['name',l=>{l.drivers[0].nickname='x'.repeat(21);}],['color',l=>{l.drivers[0].color='url(evil)';}],['avatar',l=>{l.drivers[0].avatar=100;}],['drink',l=>{l.drivers[0].drink='x'.repeat(41);}],['celebrity',l=>{l.drivers[0].celebrity='x'.repeat(21);}],
    ['invalid podium',l=>{l.order[0]='missing';}],['duplicate podium',l=>{l.order[1]=l.order[0];}],['wrong finish order',l=>{l.order.reverse();}],['no snapshots',l=>{l.snapshots=[];}],['too many snapshots',l=>{l.snapshots=Array(2403).fill(l.snapshots[0]);}],
    ['time ordering',l=>{l.snapshots[1].time=0;}],['time out of bounds',l=>{l.snapshots[1].time=999;}],['missing car',l=>{l.snapshots[1].cars.pop();}],['wrong car identity',l=>{l.snapshots[1].cars[0].id='evil';}],['position',l=>{l.snapshots[1].cars[0].progress=3;}],['speed',l=>{l.snapshots[1].cars[0].speed=-5;}],['lane',l=>{l.snapshots[1].cars[0].lane=8;}],['finish',l=>{l.snapshots[1].cars[0].finish=999;}],['effect',l=>{l.snapshots[1].cars[0].effect='evil' as never;}],
    ['missing start',l=>{l.snapshots.shift();}],['missing end',l=>{l.snapshots.pop();}],['not finished',l=>{l.snapshots.at(-1)!.cars[0].progress=1.9;}],['backwards car',l=>{l.snapshots[9].cars[0].progress=0;}],
    ['event time',l=>{l.events[0].time=-1;}],['event actor',l=>{l.events[0].actor='missing';}],['event target',l=>{l.events[0].target='missing';}],['event type',l=>{l.events[0].type='evil' as never;}],['event item',l=>{l.events[0].item='evil' as never;}],['event count',l=>{l.events=Array(5001).fill(l.events[0]);}],['event ordering',l=>{l.events.reverse();}],
  ];
  it.each(invalidCases)('rejects corrupt %s',(_,mutate)=>{const corrupted=clone(log);mutate(corrupted);expect(()=>parseReplay(JSON.stringify(corrupted))).toThrow();});
});

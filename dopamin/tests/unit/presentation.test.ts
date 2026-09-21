import { describe, it, expect } from 'vitest';
import { demoDrivers } from '../../src/core/catalog';
import { parseReplay, sampleRace, simulateRace } from '../../src/core/race';
import { burstParticle, cameraKick, eventKey, FLIGHT_TIME, raceMoment, visualEvents } from '../../src/core/presentation';
import type { RaceEvent } from '../../src/core/types';
const log=simulateRace(demoDrivers(),'roastery',1234,'2026-09-20T00:00:00Z');
const launch:RaceEvent={time:4,type:'launch',actor:'demo-1',target:'demo-2',item:'bean'};
const hit:RaceEvent={...launch,time:4.9,type:'hit'};
const withEvents=(events:RaceEvent[])=>({...log,events});

describe('projectiles resolve on arrival',()=>{
  const races=Array.from({length:25},(_,seed)=>simulateRace(demoDrivers(),'roastery',seed));
  it('every collision follows its launch by the full flight duration',()=>{
    for(const race of races)for(const impact of race.events.filter(e=>e.type==='hit'||e.type==='blocked')){
      const firing=race.events.findLast(e=>e.type==='launch'&&e.actor===impact.actor&&e.target===impact.target&&e.item===impact.item&&e.time<impact.time)!;
      expect(firing).toBeDefined();expect(impact.time-firing.time).toBeCloseTo(FLIGHT_TIME[impact.item as keyof typeof FLIGHT_TIME],8);
      expect(sampleRace(race,firing.time).cars.find(c=>c.id===impact.target)!.finish).toBeNull();
    }
  });
  it('shields block based on their state at impact, and completed racers are not hit',()=>{
    let blocks=0;
    for(const race of races)for(const event of race.events.filter(e=>e.type==='hit'||e.type==='blocked')){
      const shield=race.events.findLast(e=>e.type==='item'&&e.item==='shield'&&e.actor===event.target&&e.time<event.time);
      const active=shield&&shield.time+4>event.time;
      expect(event.type==='blocked').toBe(Boolean(active));
      expect(race.snapshots.at(-1)!.cars.find(c=>c.id===event.target)!.finish).toBeGreaterThan(event.time-.05);
      if(event.type==='blocked')blocks++;
    }
    expect(blocks).toBeGreaterThan(0);
  });
  it.each([
    {...launch,target:undefined},{...launch,target:launch.actor},{...launch,item:undefined},{...launch,item:'boost'},
  ])('rejects malformed launch events %#',event=>{expect(()=>parseReplay(JSON.stringify(withEvents([event as RaceEvent])))).toThrow();});
});

describe('deterministic replay presentation',()=>{
  it('uses explicit launch events without rewriting the log',()=>{expect(visualEvents(log)).toBe(log.events);expect(visualEvents(log)).toBe(visualEvents(log));});
  it('upgrades old recordings for playback without mutating stored events',()=>{
    const old=withEvents([{...hit,time:.4}]);const before=JSON.stringify(old);const upgraded=visualEvents(old);
    expect(upgraded[0]).toMatchObject({type:'launch',time:0});expect(upgraded[1].type).toBe('hit');expect(JSON.stringify(old)).toBe(before);
    expect(visualEvents(withEvents([]))).toEqual([]);
  });
  it('changes from chase to launch to impact and then back to chase',()=>{
    const race=withEvents([launch,hit]);
    expect(raceMoment(race,3.99,'demo-3')).toMatchObject({phase:'cruise',focus:'demo-3',event:null});
    expect(raceMoment(race,4.2)).toMatchObject({phase:'launch',focus:'demo-1'});
    expect(raceMoment(race,5.1,'demo-3')).toMatchObject({phase:'hit',focus:'demo-2'});
    expect(raceMoment(race,6.4)).toMatchObject({phase:'cruise',focus:null});
  });
  it('keeps a shield block in third person and gives impacts priority over launches',()=>{
    expect(raceMoment(withEvents([launch,{...hit,type:'blocked'}]),5).phase).toBe('blocked');
    expect(raceMoment(withEvents([launch,hit,{...launch,time:5}]),5.1).phase).toBe('hit');
  });
  it.each(['boost','shield'] as const)('directs %s effects and respects a chosen driver',item=>{
    const race=withEvents([{time:4,type:'item',actor:'demo-1',item}]);
    expect(raceMoment(race,4.5).phase).toBe(item);expect(raceMoment(race,4.5,'demo-2').phase).toBe('cruise');expect(raceMoment(race,7).phase).toBe('cruise');
  });
  it('reproduces camera and particles after arbitrary forwards and backwards seeking',()=>{
    const race=withEvents([launch,hit]),times=[0,4.5,5.2,10,4.5,5.2];
    const results=times.map(t=>({moment:raceMoment(race,t),kick:cameraKick(raceMoment(race,t),t,false),particle:burstParticle(42,8,Math.max(0,t-4.9))}));
    expect(results[1]).toEqual(results[4]);expect(results[2]).toEqual(results[5]);expect(burstParticle(42,8,4).scale).toBe(0);
    expect(burstParticle(43,8,.5)).not.toEqual(burstParticle(42,8,.5));
  });
  it('honors reduced motion and applies launch recoil, impact decay and boost FOV',()=>{
    const race=withEvents([launch,hit]),impact=raceMoment(race,5);
    expect(cameraKick(impact,5,true)).toEqual({x:0,y:0,roll:0,fov:0});expect(cameraKick(raceMoment(race,0),0,false)).toEqual({x:0,y:0,roll:0,fov:0});
    expect(cameraKick(raceMoment(race,4.3),4.3,false).x).not.toBe(0);
    expect(cameraKick(impact,5,false).fov).toBeGreaterThan(cameraKick(raceMoment(race,6),6,false).fov);
    expect(cameraKick(raceMoment(withEvents([{time:4,type:'item',actor:'demo-1',item:'boost'}]),4.5),4.5,false).fov).toBe(12);
    expect(cameraKick(raceMoment(withEvents([{time:4,type:'item',actor:'demo-1',item:'shield'}]),4.5),4.5,false).x).toBe(0);
  });
  it('distinguishes simultaneous event identities',()=>{expect(eventKey(launch)).not.toBe(eventKey(hit));expect(eventKey({...launch,target:undefined})).toContain('demo-1:');});
});

import { describe, expect, it } from 'vitest';
import { COFFEE_CYCLE, coffeeCast, coffeeDuration, coffeeServiceAt } from '../../src/core/coffee';
import { demoDrivers } from '../../src/core/catalog';
import { simulateRace } from '../../src/core/race';

describe('coffee truck choreography',()=>{
  it('assigns last place to the truck and every other finisher to the queue',()=>{
    const log=simulateRace(demoDrivers(),'coast',123);const {barista,guests}=coffeeCast(log);
    expect(barista.id).toBe(log.order.at(-1));expect(guests.map(g=>g.id)).toEqual(log.order.slice(0,-1));expect(guests.some(g=>g.id===barista.id)).toBe(false);
  });
  it('grinds, pours, delivers and cheers in order without giving a cup early',()=>{
    expect(coffeeServiceAt(0,3)).toMatchObject({phase:'grind',served:0,recipient:0});
    expect(coffeeServiceAt(1.3,3)).toMatchObject({phase:'pour',served:0});
    expect(coffeeServiceAt(2.3,3)).toMatchObject({phase:'serve',served:0});
    expect(coffeeServiceAt(3,3)).toMatchObject({phase:'cheers',served:1});
    expect(coffeeServiceAt(COFFEE_CYCLE,3)).toMatchObject({phase:'grind',served:1,recipient:1});
  });
  it.each([1,2,3,4,5,6,7])('serves all %i guests before the automatic highlight transition',count=>{
    const duration=coffeeDuration(count);expect(duration).toBeGreaterThanOrEqual(12);
    expect(coffeeServiceAt(duration-.1,count)).toMatchObject({phase:'cheers',served:count,recipient:count-1});
    for(let i=0;i<count;i++)expect(coffeeServiceAt(i*COFFEE_CYCLE+.2,count).recipient).toBe(i);
  });
  it('is deterministic when paused or rewound and safely handles missing time/guests',()=>{
    const first=coffeeServiceAt(5.5,7);coffeeServiceAt(17,7);expect(coffeeServiceAt(5.5,7)).toEqual(first);
    expect(coffeeServiceAt(-1,3)).toEqual(coffeeServiceAt(0,3));expect(coffeeServiceAt(Infinity,3)).toEqual(coffeeServiceAt(0,3));expect(coffeeServiceAt(10,0)).toMatchObject({recipient:-1,served:0});
  });
});

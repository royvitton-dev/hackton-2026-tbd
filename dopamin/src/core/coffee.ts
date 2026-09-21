import type { RaceLog } from './types';

export const COFFEE_CYCLE=3.2;
export function coffeeCast(log:RaceLog){
  const barista=log.drivers.find(driver=>driver.id===log.order.at(-1))!;
  const guests=log.order.slice(0,-1).map(id=>log.drivers.find(driver=>driver.id===id)!);
  return {barista,guests};
}
export function coffeeDuration(guests:number){return Math.max(12,guests*COFFEE_CYCLE+1);}
/** Pure service choreography: replaying a time always gives the same cup and recipient. */
export function coffeeServiceAt(time:number,guests:number){
  const count=Math.max(0,Math.floor(guests)),safeTime=Number.isFinite(time)?Math.max(0,time):0;
  if(!count)return {recipient:-1,phase:'cheers' as const,pour:0,delivery:1,served:0};
  const recipient=Math.min(count-1,Math.floor(safeTime/COFFEE_CYCLE));
  const progress=Math.min(1,(safeTime-recipient*COFFEE_CYCLE)/COFFEE_CYCLE);
  const phase=progress<.22?'grind':progress<.60?'pour':progress<.86?'serve':'cheers';
  return {recipient,phase,pour:Math.min(1,Math.max(0,(progress-.22)/.38)),delivery:Math.min(1,Math.max(0,(progress-.60)/.26)),served:Math.min(count,recipient+(progress>=.86?1:0))};
}

import type { RaceEvent } from '../core/types';
import type { Synth } from './synth';

export function scheduleItemSound(s:Synth,event:RaceEvent,now:number){
  if(event.type==='blocked'||event.item==='shield'){
    const blocked=event.type==='blocked';
    (blocked?[880,1320,1760]:[660,990,1320]).forEach((hz,i)=>s.tone('effects',hz,now+i*(blocked?.025:.07),blocked?.25:.55,.085,'sine',hz*(blocked?.98:1.08),i%2?.3:-.3));
    s.hiss('effects',now,blocked?.12:.4,blocked?.18:.09,2400,5000,'highpass');
    if(blocked)s.tone('effects',320,now,.12,.16,'triangle',140);return;
  }
  if(event.item==='boost'){
    s.hiss('effects',now,.65,.24,350,4800,'bandpass');s.tone('effects',95,now,.65,.16,'sawtooth',510);return;
  }
  if(event.type==='launch'){
    s.hiss('effects',now,.32,.22,500,6500,'bandpass',-.3);
    s.tone('effects',event.item==='ice'?1400:event.item==='storm'?700:270,now,.28,.12,event.item==='storm'?'sawtooth':'triangle',event.item==='ice'?2400:110,-.25);return;
  }
  if(event.item==='ice'){
    s.hiss('effects',now,.48,.37,5000,700,'highpass');
    for(let i=0;i<6;i++)s.tone('effects',1200+i*430,now+i*.018,.35,.09,'sine',1000+i*380,i%2?.5:-.5);
    s.tone('effects',135,now,.25,.2,'sine',50);
  }else if(event.item==='storm'){
    for(let i=0;i<3;i++){s.hiss('effects',now+i*.075,.24,.4,7000,140,'lowpass',i%2?.3:-.3);s.tone('effects',110+i*40,now+i*.06,.3,.15,'sawtooth',42);}
  }else{
    s.hiss('effects',now,.62,.48,3800,90,'lowpass',.2);s.tone('effects',170,now,.5,.34,'sine',36);s.tone('effects',360,now,.14,.08,'square',75);
  }
}

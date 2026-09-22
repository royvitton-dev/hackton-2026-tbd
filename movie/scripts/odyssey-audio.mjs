import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {film,voices} from '../assets/odyssey/timeline.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=path.join(root,'tmp/odyssey/audio');
await mkdir(scratch,{recursive:true});
await mkdir(path.join(root,'assets/odyssey/voices'),{recursive:true});
const SR=48000,N=SR*film.duration,L=new Float32Array(N),R=new Float32Array(N);
let seed=290921;const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
const hz=n=>440*2**((n-69)/12),tau=Math.PI*2;
function add(at,duration,fn,gain=.1,pan=0){const start=Math.round(at*SR),count=Math.min(Math.round(duration*SR),N-start);for(let i=Math.max(0,-start);i<count;i++){const v=fn(i/SR,i)*gain;L[start+i]+=v*(1-pan*.45);R[start+i]+=v*(1+pan*.45);}}
function strings(at,duration,notes,gain=.03){for(const [j,n]of notes.entries()){const f=hz(n);add(at,duration,t=>{const env=Math.max(0,Math.min(1,t/.7,(duration-t)/.9));return env*(Math.sin(tau*f*.998*t)+Math.sin(tau*f*1.002*t)+.3*Math.sin(tau*f*2*t)+.13*Math.sin(tau*f*3*t));},gain,j%2?.7:-.7);}}
function boom(at,gain=.32){add(at,2.3,t=>Math.min(1,t*150)*(Math.sin(tau*(37*t+1.4*(1-Math.exp(-t*20))))+.17*noise())*Math.exp(-t*3),gain);}
function horn(at,length=2,gain=.13){for(const [i,f]of [58.27,87.31,116.54].entries())add(at,length,t=>{const env=Math.min(1,t*9)*Math.min(1,(length-t)*2);return env*(Math.sin(tau*f*t)+.37*Math.sin(tau*f*2*t)+.16*Math.sin(tau*f*3*t))*(.85+Math.sin(tau*.6*t)*.15);},gain,i===0?0:i===1?-.5:.5);}
function whoosh(at,duration=1,gain=.05){let low=0;add(at,duration,t=>{low=low*.94+noise()*.06;return (noise()*.18+low)*Math.sin(Math.PI*t/duration)**2;},gain);}
function pluck(at,n,gain=.04,pan=0){const f=hz(n);add(at,.8,t=>Math.min(1,t*150)*(Math.sin(tau*f*t)+.3*Math.sin(tau*f*2*t))*Math.exp(-t*6),gain,pan);}
function tick(at){add(at,.035,t=>noise()*Math.exp(-t*110),.075,.4);}
function error(at){for(let i=0;i<2;i++)add(at+i*.19,.13,t=>Math.sin(tau*185*t)*Math.min(1,t*150)*Math.min(1,(.13-t)*100),.055);}

const chords=[[38,50,57,62,65],[34,46,53,58,62],[41,53,60,65,69],[36,48,55,60,64]];
for(let at=0;at<58;at+=4){const chord=chords[Math.floor(at/4)%4];strings(at,4.6,chord,at<16?.018:at<51?.025:.037);}
strings(61,4.5,[38,50,57,62,65],.025);strings(65,5.5,[34,46,53,58,62],.032);
strings(70,4.8,[41,53,60,65,69],.040);strings(74,4.5,[38,50,57,62,65],.042);
strings(78,7,[38,50,57,62,66,74],.049);
for(const t of [58,61,65,70,74,78,83]){boom(t,.34);if(t!==61)horn(t,2.8,.08);}
whoosh(69.1,.9,.09);whoosh(76.7,1.3,.12);
for(let i=0;i<20;i++)pluck(78+i*.23,[62,66,69,74][i%4],.043,Math.sin(i)*.6);
for(const t of [.5,2.5,5,9,12,16,24,27,31,35,39,43,48,51,55,56,57]){boom(t,t>=51?.32:.21);if([9,27,51,57].includes(t))horn(t,2.3,.065);}
for(let at=5;at<58;at+=.65){
  if((at>20&&at<23)||(at>43&&at<46))continue;
  const part=chords[Math.floor(at/4)%4];pluck(at,part[Math.floor(at/.65)%part.length]+12,at>49?.042:.023,Math.sin(at)*.6);
  if((at>26&&at<39)||(at>49&&at<57))boom(at,.075);
}
for(const at of [4.1,8.1,11.1,15.1,23.1,26.1,30.1,38.1,50.1,54.1,57.1,64.1])whoosh(at,.85,.1);
for(let i=0;i<12;i++)pluck(55.5+i*.12,[62,65,69,74][i%4],.04,-.6+i*.1);
// Dry error tones interrupt the oracle; a pizzicato run counts the returning bugs.
error(20.8);error(43.7);
for(let i=0;i<8;i++){tick(21.1+i*.13);pluck(21.1+i*.13,81-i*3,.045,1-i*.24);}
for(let i=0;i<12;i++)pluck(27.15+i*.14,[69,72,74,77][i%4]+(i%2?0:-12),.053,Math.sin(i)*.65);
for(let i=0;i<24;i++)tick(31.2+i*.13);
pluck(39.3,81,.055);pluck(39.55,69,.055);
add(43.3,.42,t=>Math.sin(tau*(300*t-310*t*t))*Math.sin(Math.PI*t/.42),.10);
// Sea air and a quiet creak give the animated boat physical presence.
let seaLow=0;add(5,9,t=>{seaLow=seaLow*.99+noise()*.01;return seaLow*(.7+.3*Math.sin(t*1.3));},.14,-.35);
for(let at=9.2;at<14;at+=1.45)add(at,.45,t=>Math.sin(tau*(180*t+20*t*t))*Math.sin(Math.PI*t/.45)*Math.exp(-t*4),.018,.5);
// Stone seal release, followed by a major chord rather than another punchline.
whoosh(75.3,1.6,.075);boom(77.2,.21);

// Short stereo reverberation. All musical material is synthesized for this film.
for(const [delay,gain]of [[.071,.11],[.143,.09],[.271,.07]]){const d=Math.round(delay*SR);for(let i=N-1;i>=d;i--){L[i]+=R[i-d]*gain;R[i]+=L[i-d]*gain;}}
const duck=new Float32Array(N).fill(1);
for(const v of voices){for(let i=Math.max(0,Math.floor((v.at-.2)*SR));i<Math.min(N,Math.ceil((v.until+.25)*SR));i++){const t=i/SR;const edge=Math.min(1,(t-v.at+.2)/.2,(v.until+.25-t)/.25);duck[i]=Math.min(duck[i],1-.69*Math.max(0,edge));}}
const data=Buffer.alloc(N*4);
for(let i=0;i<N;i++){
  const t=i/SR,fade=Math.max(0,Math.min(1,t/.35,(film.duration-t)/.7));
  const hush=(t>=20.7&&t<22.6)||(t>=43.6&&t<45)||(t>=61&&t<62.4)?.14:1;
  data.writeInt16LE(Math.round(Math.tanh(L[i])*22000*fade*duck[i]*hush),i*4);
  data.writeInt16LE(Math.round(Math.tanh(R[i])*22000*fade*duck[i]*hush),i*4+2);
}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(SR,24);header.writeUInt32LE(SR*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
const score=path.join(scratch,'score.wav');await writeFile(score,Buffer.concat([header,data]));
console.log('Original trailer score and effects synthesized.');

if(!process.argv.includes('--score-only')){
  execFileSync(process.execPath,[path.join(root,'scripts/odyssey-neural-voice.mjs'),'--audio-only'],{stdio:'inherit'});
}

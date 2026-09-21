import { writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('assets',{recursive:true});
const SR=48000,DURATION=30,N=SR*DURATION,L=new Float64Array(N),R=new Float64Array(N);
let seed=1037;
const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return seed/2147483648;};
function add(start,dur,fn,vol=1,pan=0){const k=Math.round(start*SR),len=Math.floor(dur*SR);for(let j=0;j<len&&k+j<N;j++){if(k+j<0)continue;const v=fn(j/SR,j)*vol;L[k+j]+=v*(1-pan*.4);R[k+j]+=v*(1+pan*.4);}}
for(let beat=0;beat<60;beat++){
 const t=beat*.5;
 if(!(t>=10&&t<14)&&t<29.5){
  add(t,.42,s=>Math.sin(2*Math.PI*(49*s+7*(1-Math.exp(-s*40))))*Math.exp(-s*15),.66);
  add(t,.015,s=>noise()*Math.exp(-s*350),.09);
 }
 if(beat%2===1&&t<29){add(t,.19,s=>noise()*(Math.exp(-s*30)+.3*Math.exp(-Math.pow((s-.03)*150,2))),.19,.12);}
 if(t>=2&&t<29){
  for(let j=0;j<4;j++){let prev=0;add(t+j*.125,.05,s=>{const n=noise(),v=n-prev;prev=n;return v*Math.exp(-s*100);},j===2?.09:.045,j%2?.65:-.65);}
 }
 const notes=[49,49,58.2705,49,43.6535,49,65.4064,58.2705];
 const f=notes[beat%8];
 if(t>=2&&t<29.5){for(const offset of [.125,.375])add(t+offset,.20,s=>Math.tanh(2.5*(Math.sin(2*Math.PI*f*s)+.3*Math.sin(4*Math.PI*f*s)))*Math.min(1,s*300)*Math.exp(-s*17),.19);}
 if(beat%2===0&&t>=6&&t<29){const n=[392,466.164,349.228,293.665][Math.floor(beat/2)%4];add(t+.25,.7,s=>(Math.sin(2*Math.PI*n*s)+.25*Math.sin(2*Math.PI*n*2.003*s))*Math.exp(-s*8)*Math.min(1,s*100),.10,-.5);}
}
for(const cut of [2,6,10,15,18,27]){
 add(cut-.3,.3,s=>noise()*Math.pow(s/.3,2)*.12,.7);
 add(cut,.7,s=>(Math.sin(2*Math.PI*98*s)+.3*noise())*Math.exp(-s*10),.17);
}
for(const f of [98,146.832,196,233.082])add(27,3,s=>Math.sin(2*Math.PI*f*s)*Math.exp(-s*1.8)*Math.min(1,s*80),.09);
const pcm=Buffer.alloc(N*4);
for(let i=0;i<N;i++){
 const t=i/SR,duck=t>=10&&t<14.4?.27:1;
 const fade=Math.min(1,t*25,Math.max(0,(30-t)/.4));
 pcm.writeInt16LE(Math.round(Math.tanh(L[i]*duck)*fade*25000),i*4);
 pcm.writeInt16LE(Math.round(Math.tanh(R[i]*duck)*fade*25000),i*4+2);
}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(SR,24);header.writeUInt32LE(SR*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
await writeFile('assets/original-beat.wav',Buffer.concat([header,pcm]));
const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','warning','-y','-i','assets/original-beat.wav','-i','assets/interview.aiff','-filter_complex','[0:a]volume=0.9[m];[1:a]aresample=48000,highpass=f=110,loudnorm=I=-17:TP=-2:LRA=7,adelay=10700|10700[v];[m][v]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1:LRA=8,aresample=48000[a]','-map','[a]','-t','30','-c:a','pcm_s16le','assets/soundtrack.wav'],{stdio:'inherit'});
if(result.status!==0)throw new Error('Audio mix failed');
console.log('Original 120 BPM beat + Korean sample interview: 30 seconds.');

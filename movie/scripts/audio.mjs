import {writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
await mkdir('assets/wonder',{recursive:true});
const SR=48000,N=SR*30,L=new Float64Array(N),R=new Float64Array(N);
const rnd=n=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return (v-Math.floor(v))*2-1;};
const midi=n=>440*Math.pow(2,(n-69)/12);
function add(at,dur,fn,gain=.1,pan=0){const start=Math.floor(at*SR),length=Math.min(Math.floor(dur*SR),N-start);for(let j=0;j<length;j++){const s=j/SR,v=fn(s,j)*gain;L[start+j]+=v*(1-pan*.45);R[start+j]+=v*(1+pan*.45);}}
function strings(at,dur,notes,gain=.06){notes.forEach((note,i)=>{const f=midi(note);add(at,dur,(s,j)=>{const env=Math.min(1,s/.8,(dur-s)/.9);return Math.max(0,env)*(Math.sin(2*Math.PI*f*.9985*s)+Math.sin(2*Math.PI*f*1.0015*s)+.23*Math.sin(4*Math.PI*f*s)+.12*Math.sin(6*Math.PI*f*s));},gain,i%2?.55:-.55);});}
function bell(at,n,gain=.15,pan=0){const f=midi(n);add(at,2.7,s=>(Math.sin(2*Math.PI*f*s)*Math.exp(-s*2.8)+.35*Math.sin(2*Math.PI*f*2.756*s)*Math.exp(-s*7))*Math.min(1,s*200),gain,pan);}
const score=[ [0,4,[50,57,61,66],.045],[3.5,3.3,[43,55,59,66],.049],[6,4.2,[47,54,59,62],.055],[9.5,4,[45,57,61,64],.056],[13,3.9,[43,55,59,62],.036],[16.5,2.7,[45,57,61,64],.04],[18.5,3.8,[50,57,62,66],.065],[21.5,3.7,[43,55,59,66],.068],[24.5,3.6,[45,57,61,64,69],.079],[27,3,[38,50,57,62,66,74],.062] ];
score.forEach(([at,dur,notes,gain])=>strings(at,dur,notes,gain));
const melody=[[.25,86],[.9,81],[1.55,78],[2.4,83],[3.7,79],[4.45,83],[5.15,86],[6.25,83],[7,78],[7.75,74],[8.5,81],[9.75,85],[10.5,81],[11.2,76],[12,78],[16.65,86],[17.1,88],[17.55,90],[18.5,86],[19.2,81],[19.85,78],[20.7,83],[21.7,79],[22.3,83],[23.1,86],[24.5,81],[25.1,85],[25.7,88],[26.4,93],[27.1,90]];
melody.forEach(([at,n],i)=>bell(at,n,at>=24.5?.16:.095,Math.sin(i)*.65));
for(const start of [5.35,9.85,17.85,23.85]){for(let i=0;i<9;i++)bell(start+i*.066,[62,66,69,74,78,81,86,90,93][i],.037,-.7+i*.16);}
for(const at of [6,10.5,18.5,24.5,27])add(at,1.4,s=>Math.sin(2*Math.PI*(54*s+1.7*(1-Math.exp(-s*15))))*Math.exp(-s*4)*Math.min(1,s*90),.22);
for(const start of [3.2,5.65,12.65,18.15,24.15])add(start,.35,(s,j)=>rnd(j)*Math.sin(Math.PI*s/.35)*.09,.2);
const pcm=Buffer.alloc(N*4);
for(let i=0;i<N;i++){const t=i/SR,duck=t>=13&&t<16.5?.28:1,fade=Math.min(1,t/.12,(30-t)/.65);pcm.writeInt16LE(Math.round(Math.tanh(L[i]*duck)*fade*25500),i*4);pcm.writeInt16LE(Math.round(Math.tanh(R[i]*duck)*fade*25500),i*4+2);}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(SR,24);header.writeUInt32LE(SR*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);await writeFile('assets/wonder/original-score.wav',Buffer.concat([header,pcm]));
const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','warning','-y','-i','assets/wonder/original-score.wav','-i','assets/wonder/interview.aiff','-filter_complex','[1:a]aresample=48000,highpass=f=100,loudnorm=I=-17:TP=-2:LRA=7,adelay=13200|13200[v];[0:a][v]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1:LRA=9,aresample=48000[a]','-map','[a]','-t','30','-c:a','pcm_s16le','assets/wonder/soundtrack.wav'],{stdio:'inherit'});if(r.status!==0)throw new Error('Soundtrack mix failed');console.log('New orchestral-style original score and sample interview mixed.');

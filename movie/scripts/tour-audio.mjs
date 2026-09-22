import {writeFile} from 'node:fs/promises';

export async function composeTourScore(file,{duration,chapters}){
 const SR=48000,N=Math.round(SR*duration),left=new Float32Array(N),right=new Float32Array(N);
 const noise=n=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return (v-Math.floor(v))*2-1;};
 const hz=n=>440*2**((n-69)/12);
 function add(at,length,fn,gain=.1,pan=0){
  const start=Math.round(at*SR),count=Math.min(Math.round(length*SR),N-start);
  for(let i=0;i<count;i++){const v=fn(i/SR,i)*gain;left[start+i]+=v*(1-pan*.5);right[start+i]+=v*(1+pan*.5);}
 }
 function strings(at,length,notes,gain=.035){notes.forEach((n,k)=>{const f=hz(n);add(at,length,t=>Math.max(0,Math.min(1,t/.6,(length-t)/.8))*(Math.sin(2*Math.PI*f*.9985*t)+Math.sin(2*Math.PI*f*1.0015*t)+.18*Math.sin(4*Math.PI*f*t)),gain,k%2?.6:-.6);});}
 function bell(at,n,gain=.09,pan=0){const f=hz(n);add(at,2.5,t=>Math.min(1,t*200)*(Math.sin(2*Math.PI*f*t)*Math.exp(-t*2.8)+.28*Math.sin(2*Math.PI*f*2.756*t)*Math.exp(-t*6)),gain,pan);}
 function drum(at,gain=.14){add(at,1.1,t=>Math.min(1,t*100)*Math.sin(2*Math.PI*(52*t+1.8*(1-Math.exp(-t*15))))*Math.exp(-t*4.5),gain);}
 const chords=[[50,57,62,66],[43,55,59,66],[47,54,59,62],[45,57,61,64]];
 strings(0,4.8,chords[0],.03);[86,81,78,83].forEach((n,i)=>bell(.35+i*.72,n,.09,Math.sin(i)*.5));
 for(const [i,shot] of chapters.filter(c=>!['opening','finale'].includes(c.id)).entries()){
  const notes=chords[i%4],length=shot.end-shot.start;strings(shot.start,length+.6,notes,.041);drum(shot.start,.16);drum(shot.start+length/2,.10);
  const beats=Math.round(length*2);
  for(let j=0;j<beats;j++)bell(shot.start+j*length/beats,notes[j%4]+24,.044+(j%4===0?.024:0),Math.sin(j+i)*.6);
  for(const moment of shot.id==='dopamin'?shot.segments||[]:[])if(moment.id!=='race'){
   const at=shot.demoStart+moment.start;drum(at,.12);
   [78,81,86].forEach((note,k)=>bell(at+k*.19,note,moment.id==='podium'?.07:.05,(k-1)*.4));
  }
  add(shot.start-.23,.35,(t,j)=>noise(j)*Math.sin(Math.PI*t/.35),.022);
 }
 const end=chapters.at(-1).start;
 strings(end,4.4,[45,57,61,64,69],.045);strings(end+3.5,6.5,[38,50,57,62,66,74],.055);
 for(let i=0;i<12;i++)bell(end+2.5+i*.15,[69,74,78,81,86,90][i%6],.04+i*.003,-.6+i*.1);
 for(const [at,gain] of [[end+1,.10],[end+2.35,.12],[end+3.6,.29],[end+5.05,.10],[end+6.4,.08]]){
  drum(at,gain);add(at,2,(t,j)=>noise(j)*Math.exp(-t*4.8)*Math.min(1,t*300),gain*.2);
 }
 add(end+2.65,.92,(t,j)=>noise(j)*Math.sin(Math.PI*t/.92)*(.3+Math.sin(t*1000)*.2),.045);
 [86,90,93,98].forEach((n,i)=>bell(end+4.7+i*.22,n,.09,(i-1.5)*.3));bell(end+8,86,.11);bell(end+8.25,90,.07);
 const data=Buffer.alloc(N*4);
 for(let i=0;i<N;i++){const t=i/SR,fade=Math.max(0,Math.min(1,t/.15,(duration-t)/1.0));data.writeInt16LE(Math.round(Math.tanh(left[i])*.8*32767*fade),i*4);data.writeInt16LE(Math.round(Math.tanh(right[i])*.8*32767*fade),i*4+2);}
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+data.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(SR,24);header.writeUInt32LE(SR*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
 await writeFile(file,Buffer.concat([header,data]));
}

export const BALL_LOOKS={sports:['basketball','football','baseball','pingpong','tennis','volleyball'],animals:['panda','cat','fox','bear','frog','pig']};
// Cosmetic shuffle has its own entropy and never reads or advances the race RNG.
export function assignLooks(balls,theme,random=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/2**32;}){
 const source=BALL_LOOKS[theme];if(!source)return new Map();let bag=[];
 return new Map(balls.map(b=>{if(!bag.length){bag=[...source];for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}return [b.id,bag.pop()];}));
}
// Original canvas illustrations: offline, with no remote image request or font dependency.
export function drawBallLook(kind){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
 const colors={basketball:'#ec812d',football:'#fcfaf0',baseball:'#fcf9ed',pingpong:'#fffaf0',tennis:'#d4ed46',volleyball:'#ffda48',panda:'#fff9ee',cat:'#f1ba65',fox:'#ed8c48',bear:'#bb8359',frog:'#98cc75',pig:'#f3a2b5'};
 c.fillStyle=colors[kind]||'#fff';c.fillRect(0,0,256,256);c.lineCap='round';c.lineJoin='round';
 const line=(points,color='#342b30',width=8)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();};
 const oval=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
 if(kind==='basketball'){line([[128,0],[128,256]]);line([[0,128],[256,128]]);for(const sign of [-1,1]){c.beginPath();c.moveTo(128+sign*105,0);c.bezierCurveTo(128+sign*12,62,128+sign*12,194,128+sign*105,256);c.stroke();}c.fillStyle='#78492155';for(let x=4;x<256;x+=12)for(let y=4;y<256;y+=12){c.beginPath();c.arc(x,y,1.1,0,7);c.fill();}}
 if(kind==='football'){const polygon=(x,y,r)=>{c.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}c.closePath();c.fillStyle='#273142';c.fill();};polygon(128,128,45);for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;line([[128+Math.cos(a)*42,128+Math.sin(a)*42],[128+Math.cos(a)*124,128+Math.sin(a)*124]],'#485064',4);polygon(128+Math.cos(a)*150,128+Math.sin(a)*150,42);}}
 if(kind==='baseball'){for(const sign of [-1,1]){const pts=[];for(let y=0;y<=256;y+=8)pts.push([128+sign*(45+((y-128)/128)**2*48),y]);line(pts,'#ce4a52',4);for(let y=16;y<256;y+=18){const x=128+sign*(45+((y-128)/128)**2*48);line([[x-9,y-6],[x,y],[x+9,y-6]],'#cf3549',5);}}}
 if(kind==='pingpong'){c.strokeStyle='#d7d8ce';c.lineWidth=3;c.beginPath();c.ellipse(128,130,110,47,.4,0,Math.PI*2);c.stroke();c.fillStyle='#587476';c.textAlign='center';c.font='bold 27px sans-serif';c.fillText('PING',128,126);c.font='20px sans-serif';c.fillText('★★★',128,155);}
 if(kind==='tennis'){c.strokeStyle='#ffffe8';c.lineWidth=15;for(const x of [-16,272]){c.beginPath();c.ellipse(x,128,93,157,0,0,7);c.stroke();}}
 if(kind==='volleyball'){for(let i=0;i<3;i++){c.save();c.translate(128,128);c.rotate(i*Math.PI*2/3);c.fillStyle=i===1?'#fff8e4':'#315fc1';c.beginPath();c.moveTo(0,0);c.bezierCurveTo(100,-20,80,-130,150,-140);c.lineTo(140,20);c.bezierCurveTo(65,70,22,42,0,0);c.fill();c.strokeStyle='#423b40';c.lineWidth=4;c.stroke();c.restore();}}
 if(BALL_LOOKS.animals.includes(kind)){
  const ink='#372b32';
  if(kind==='panda'){oval(61,53,35,36,ink);oval(195,53,35,36,ink);oval(128,139,99,96,'#fff9ee');oval(87,123,30,36,ink);oval(169,123,30,36,ink);}
  if(kind==='cat'||kind==='fox'){for(const x of [42,172]){c.fillStyle=kind==='fox'?'#653e35':'#ad723d';c.beginPath();c.moveTo(x,92);c.lineTo(x+16,14);c.lineTo(x+51,83);c.fill();}if(kind==='fox'){oval(87,158,57,57,'#fff1db');oval(169,158,57,57,'#fff1db');}else{line([[115,38],[124,69]],'#ad723d',9);line([[144,38],[137,69]],'#ad723d',9);for(const sign of [-1,1])for(const y of [161,184])line([[128+sign*54,y],[128+sign*102,y-7]],'#ad723d',5);}}
  if(kind==='bear'){oval(60,56,34,36,'#704b39');oval(196,56,34,36,'#704b39');oval(128,168,60,48,'#f2d5a9');}
  if(kind==='frog'){oval(77,75,37,39,'#c9e9a2');oval(179,75,37,39,'#c9e9a2');}
  if(kind==='pig'){for(const x of [46,167]){c.fillStyle='#d56e8a';c.beginPath();c.moveTo(x,95);c.lineTo(x+3,27);c.lineTo(x+46,75);c.fill();}oval(128,166,57,41,'#e983a0');oval(108,165,10,15,'#a84b6b');oval(148,165,10,15,'#a84b6b');}
  const ey=kind==='frog'?80:124;for(const x of [86,170]){oval(x,ey,kind==='panda'?10:12,15,kind==='panda'?'#fff9ee':ink);oval(x-3,ey-5,3.5,4,'#fff');}
  if(kind!=='pig'){oval(128,157,kind==='frog'?7:13,9,ink);c.strokeStyle=ink;c.lineWidth=5;c.beginPath();c.arc(128,166,26,.15,Math.PI-.15);c.stroke();}
  if(kind!=='panda')for(const x of [62,194])oval(x,155,15,8,'#ee829288');
 }
 return canvas;
}

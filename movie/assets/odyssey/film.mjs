import {film, scenes} from './timeline.mjs';
import {createOdyssey3D} from './scene3d.mjs';
const canvas=document.querySelector('#film'),ctx=canvas.getContext('2d',{alpha:false});
const W=1920,H=1080,gold='#e6c18c',white='#f5f0e6',teal='#a6dfdc';
const sans='"Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
const serif='"AppleMyungjo", "Nanum Myeongjo", serif';
const mono='Menlo, monospace';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const rand=i=>{const s=Math.sin(i*127.1+311.7)*43758.5453;return s-Math.floor(s);};
const cache=new Map();
async function load(src){if(cache.has(src))return cache.get(src);const img=new Image();img.src=src;await img.decode();cache.set(src,img);if(cache.size>12)cache.delete(cache.keys().next().value);return img;}
const gs=await load('./gs.svg'),chargev=await load('./chargev.png');
const animated=scenes.some(s=>s.kind==='3d')?await createOdyssey3D():null;

function text(value,x,y,size=64,{color=white,weight=600,font=sans,align='center',spacing=0}={}){
  ctx.save();ctx.font=`${weight} ${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.letterSpacing=`${spacing}px`;ctx.fillText(value,x,y);ctx.restore();
}
function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function mist(t,accent='#24676d'){
  ctx.fillStyle='#05090c';ctx.fillRect(0,0,W,H);
  const g=ctx.createRadialGradient(1200+Math.sin(t*.12)*160,580,0,950,540,1150);g.addColorStop(0,accent);g.addColorStop(.45,'#0b1820');g.addColorStop(1,'#020507');ctx.globalAlpha=.65;ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
  for(let i=0;i<65;i++){const x=(rand(i)*W+t*(4+rand(i+300)*10))%W,y=(rand(i+100)*H-t*(4+rand(i+700)*14)+H*10)%H;ctx.fillStyle=`rgba(230,191,137,${.1+rand(i+400)*.35})`;ctx.beginPath();ctx.arc(x,y,.5+rand(i+200)*1.7,0,Math.PI*2);ctx.fill();}
}
function vignette(){const g=ctx.createRadialGradient(960,480,270,960,500,1150);g.addColorStop(0,'#0000');g.addColorStop(1,'#000b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
function bars(){ctx.fillStyle='#000';ctx.fillRect(0,0,W,137);ctx.fillRect(0,943,W,137);}
function lower(s,p){
  const opacity=smooth(p/.3);ctx.save();ctx.globalAlpha=opacity;
  const g=ctx.createLinearGradient(0,630,0,947);g.addColorStop(0,'#0000');g.addColorStop(1,'#000e');ctx.fillStyle=g;ctx.fillRect(0,630,W,313);
  if(s.kicker)text(s.kicker,960,755,30,{color:gold,spacing:5});
  if(s.speaker)text(s.speaker,960,758,27,{color:gold,spacing:3});
  const size=s.id==='no'?140:s.line.length>25?53:65;
  ctx.shadowColor='#000';ctx.shadowBlur=18;ctx.shadowOffsetY=3;
  text(s.line,960,s.id==='no'?775:838,size,{weight:700});ctx.restore();
}
async function background(s,t){
  let time=s.source+(t-s.start)*(s.speed??1);
  if(s.kind==='montage'){const elapsed=t-s.start,index=Math.min(s.sources.length-1,Math.floor(elapsed));time=s.sources[index]+(elapsed-index)*.85;}
  const frame=Math.floor(time*24+1e-6)+1;
  const slow=s.source!=null&&(s.speed??1)<1;
  const img=await load(slow?`../../tmp/odyssey/smooth/${s.id}/${String(Math.floor((t-s.start)*24+1e-6)+1).padStart(5,'0')}.jpg`:`../../tmp/odyssey/frames/${String(frame).padStart(5,'0')}.jpg`);
  // Exclude both lines of the original burned subtitles, including their tops.
  ctx.filter='brightness(1.12) saturate(.94)';
  if(slow)ctx.drawImage(img,0,138,W,803);
  else ctx.drawImage(img,213,138,1494,624,0,138,W,803);
  ctx.filter='none';
  vignette();bars();return time;
}
function planet(t){
  mist(t,'#17455d');
  const x=960,y=540,r=310+t*2;
  ctx.save();ctx.shadowColor='#6ccbd4';ctx.shadowBlur=55;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.strokeStyle='#8de4df';ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;
  const fill=ctx.createRadialGradient(x-r*.55,y-r*.5,10,x,y,r);fill.addColorStop(0,'#377477');fill.addColorStop(.48,'#0c354c');fill.addColorStop(.9,'#030b15');fill.addColorStop(1,'#01050a');ctx.fillStyle=fill;ctx.fill();ctx.clip();
  for(let i=-5;i<=5;i++){ctx.beginPath();ctx.ellipse(x,y+i*r/6,r,25+Math.sqrt(1-(i/6)**2)*r*.12,0,0,Math.PI*2);ctx.strokeStyle='#78cfd12c';ctx.lineWidth=1;ctx.stroke();}
  for(let i=0;i<10;i++){const a=i*Math.PI/10+t*.08;ctx.beginPath();ctx.ellipse(x,y,Math.max(1,Math.abs(Math.sin(a))*r),r,0,0,Math.PI*2);ctx.strokeStyle='#78cfd125';ctx.stroke();}
  // Small illuminated islands suggest a turning globe without an external texture.
  for(let i=0;i<650;i++){const lat=(rand(i+20)-.5)*Math.PI,lon=rand(i+1500)*Math.PI*2+t*.075;const z=Math.cos(lat)*Math.cos(lon);if(z<=0)continue;const a=Math.sin(i*.9)+Math.sin(i*.15);if(a<.5)continue;ctx.globalAlpha=z*.65;ctx.fillStyle=i%4?'#6caaaa':'#f0c383';ctx.fillRect(x+Math.cos(lat)*Math.sin(lon)*r,y+Math.sin(lat)*r,1.7,1.7);}ctx.restore();
  const scale=1.03-.03*smooth(t/4);ctx.save();ctx.translate(960,510);ctx.scale(scale,scale);ctx.shadowColor='#b7edff';ctx.shadowBlur=27;ctx.drawImage(gs,-175,-107,350,214);ctx.restore();
  text('GS 해커콘',960,756,27,{color:'#d4e8e4',spacing:10});
  const flare=ctx.createRadialGradient(715+t*12,304,0,715+t*12,304,110);flare.addColorStop(0,'#fff5');flare.addColorStop(1,'#fff0');ctx.fillStyle=flare;ctx.fillRect(500,100,500,400);
}
function chargeLogo(p){
  mist(p,'#204e55');
  const alpha=smooth(p/.65);ctx.save();ctx.globalAlpha=alpha;
  line(410,365,1510,365,'#9ed2cb66');line(410,710,1510,710,'#9ed2cb66');
  ctx.drawImage(gs,555,430,150,92);text('차지비',1072,482,113,{weight:700,spacing:8});
  ctx.drawImage(chargev,684,598,551,55.6);
  ctx.restore();
  text('우리의 여정에 에너지를',960,778,27,{color:gold,spacing:5});
  ctx.strokeStyle='#82cfc786';ctx.lineWidth=1.5;const reveal=smooth(p/1.5);ctx.strokeRect(455,399,1010*reveal,267);
}
function card(s,p){mist(p,'#162f3d');const alpha=smooth(p/.55);ctx.save();ctx.globalAlpha=alpha;ctx.translate(960,535);const scale=1+.018*p;ctx.scale(scale,scale);text(s.kicker,0,-100,32,{color:gold,spacing:6});text(s.line,0,5,s.line.length>14?76:99,{font:serif,weight:600,spacing:4});line(-42,94,42,94,gold,2);if(s.english)text(s.english,0,157,21,{font:mono,color:'#a5b5bb',spacing:3});ctx.restore();}
function terminal(s,p){
  ctx.fillStyle=s.source?'#02070bb0':'#04080bf2';ctx.fillRect(0,137,W,806);
  const x=290,y=320,w=1340,h=365;
  ctx.fillStyle='#081116ef';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#7a989b70';ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);line(x,y+55,x+w,y+55,'#7a989b40');
  ['#ce7464','#d0ae73','#7ba791'].forEach((color,i)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x+28+i*25,y+27,6,0,Math.PI*2);ctx.fill();});
  text(s.id==='context'?'AI · NEW CONVERSATION':'AI CODE · /journey/home',x+w/2,y+28,19,{font:mono,color:'#96aaae'});
  const terminalText=(v,yy,size=32,color='#d7e4df')=>text(v,x+55,yy,size,{font:mono,color,align:'left',weight:500});
  if(s.id==='hallucination'){
    terminalText('$ npm install @olympus/go-home',y+110,31);
    if(p>.5)terminalText('npm ERR! 404 · Package not found',y+178,36,'#efa292');
    if(p>1.35){line(x+55,y+220,x+w-55,y+220,'#365056');text('자신감 100%   /   존재 확률 0%',960,y+274,39,{color:gold});}
  }else if(s.id==='refactor'){
    terminalText('✔ Fixed 1 issue.',y+112,34,teal);
    if(p>.65)terminalText('↳ Changed 47 files.',y+183,34,gold);
    if(p>1.3){text('통과한 테스트',665,y+279,29,{color:'#a7b8b9'});text('0 / 48',1110,y+280,67,{font:mono,color:'#efa292',weight:700});}
  }else{
    terminalText('Context window exceeded.',y+119,42,'#efa292');
    if(p>.6)terminalText('Previous conversation: unavailable',y+187,28,'#8da2a7');
    if(p>1.15)text('우리의 기억은… 저장되지 않았다.',960,y+273,35,{color:gold});
  }
  lower(s,p);
}
function title(p){
  mist(p,'#27545a');
  for(let i=0;i<12;i++){const y=780+i*7;ctx.beginPath();for(let x=0;x<=1920;x+=12){const yy=y+Math.sin(x*.006+p*.55+i*.3)*12+i*3; if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.strokeStyle=`rgba(112,170,171,${.14-i*.008})`;ctx.stroke();}
  ctx.save();ctx.globalAlpha=smooth(p/.5);ctx.translate(960,470);const scale=1+.012*p;ctx.scale(scale,scale);
  text('집에 못 가는 개발자 리그',0,-159,32,{color:gold,spacing:6});
  ctx.shadowColor='#e9c48950';ctx.shadowBlur=35;const gradient=ctx.createLinearGradient(0,-60,0,100);gradient.addColorStop(0,'#fff1d5');gradient.addColorStop(.45,'#e4bd7d');gradient.addColorStop(1,'#957454');
  text('코 드 세 이',0,-4,173,{font:serif,weight:700,color:gradient,spacing:10});ctx.shadowBlur=0;
  text('T H E   C O D E Y S S E Y',0,112,27,{font:serif,color:'#ccbd9e',spacing:5});
  text('집에 가는 길',0,207,56,{font:serif,weight:500,spacing:9});ctx.restore();
  text('GS 해커콘   |   9월 21일 — 22일',960,830,36,{color:gold,spacing:3});
}
async function prize(s,p){
  const img=await load(`./${s.image}`),progress=p/(s.end-s.start);
  const zoom=s.id==='victory'?1.015+progress*.025:1+progress*.035;
  const w=1920*zoom,h=w*img.height/img.width;
  // The prize remains above the lower caption; a slow camera move links both frames.
  const top=s.id==='victory'?132-progress*6:75-progress*15;
  ctx.drawImage(img,(1920-w)/2,top,w,h);
  vignette();
  for(let i=0;i<30;i++){const x=(rand(i+2600)*1920+p*8)%1920,y=(rand(i+3000)*806-p*14+806)%806+137;ctx.fillStyle=`rgba(255,226,172,${rand(i+3500)*.23})`;ctx.beginPath();ctx.arc(x,y,.5+rand(i)*1.3,0,Math.PI*2);ctx.fill();}
}
function ending(p){mist(p,'#0b202b');text('9월 21일 — 22일',960,368,77,{font:serif,color:gold,spacing:5});text('GS 해커콘',960,490,56,{spacing:7});text('집에 못 가는 개발자 리그',960,587,37,{color:'#d0dada',spacing:4});line(850,668,1070,668,'#a88e62');text('우리가 원한 단 하나의 보물, 맥미니.',960,734,32,{color:gold});text('GS 해커콘 참가자 패러디 · 원본 영상: 유니버설 픽쳐스 〈오디세이〉',960,860,20,{color:'#9aa9ac'});text('실사풍 AI 애니메이션 · 남성 합성 내레이션 · 창작 음악',960,895,18,{color:'#809197'});}

window.drawFrame=async t=>{
  t=Math.min(film.duration-1/film.fps,Math.max(0,t));const s=scenes.find(s=>t>=s.start&&t<s.end),p=t-s.start;
  ctx.globalAlpha=1;ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);let sourceTime=null,motion=null;
  if(s.source!=null||s.kind==='montage')sourceTime=await background(s,t);
  else mist(t);
  if(s.kind==='gs')planet(p);
  else if(s.kind==='chargev')chargeLogo(p);
  else if(s.kind==='card')card(s,p);
  else if(s.kind==='terminal')terminal(s,p);
  else if(s.kind==='title')title(p);
  else if(s.kind==='prize')await prize(s,p);
  else if(s.kind==='3d'){
    const shot=animated.render(s,p,t);motion=shot.probe;
    ctx.drawImage(shot.canvas,0,137,1920,806);
    vignette();
  }
  else if(s.kind==='motion'){
    const fps=s.shot==='lift'?32:24,clipTime=(s.in??0)+p*(s.speed??1),frame=Math.floor(clipTime*fps+1e-6)+1;
    const img=await load(`../../tmp/odyssey/cinematic/${s.shot}/${String(frame).padStart(5,'0')}.jpg`);
    const cropHeight=img.width*806/1920;
    // Keep the computer and hands in frame; the reference has no burned captions.
    ctx.drawImage(img,0,Math.max(0,(img.height-cropHeight)*.5),img.width,cropHeight,0,137,1920,806);
    vignette();motion={kind:'generated-video',shot:s.shot,clipTime,frame,fps};
  }
  else if(s.kind==='end')ending(p);
  if(s.id==='manybugs'){text('BUG COUNT: 01 → 12',960,218,24,{font:mono,color:gold,spacing:3});}
  if(s.id==='battery'){
    const x=1500,y=205;ctx.fillStyle='#070b10bb';ctx.fillRect(x-25,y-25,238,81);ctx.strokeStyle='#cd8177';ctx.lineWidth=3;ctx.strokeRect(x,y,113,35);ctx.fillStyle='#d78075';ctx.fillRect(x+5,y+5,4,25);ctx.fillRect(x+114,y+9,7,17);text('1%',x+166,y+19,33,{font:mono,color:'#efa292'});
  }
  bars();
  if(s.line){
    const kicker=s.kicker||s.speaker;
    if(kicker)text(kicker,960,971,22,{color:gold,spacing:3});
    text(s.line,960,kicker?1024:1007,s.line.length>25?45:50,{weight:700});
    if(s.id==='hallucination')text('404 · SOLUTION NOT FOUND   /   자신감 100%',960,83,26,{font:mono,color:gold,spacing:2});
    if(s.id==='context')text('CONTEXT WINDOW EXCEEDED · 기억 0%',960,83,26,{color:gold,spacing:3});
  }
  // Fade only slate boundaries; comedy cuts stay sharp.
  let fade=0;
  if(['gs','chargev','card','title','end'].includes(s.kind))fade=Math.max(1-smooth(p/.3),1-smooth((s.end-t)/.3));
  if(t<.5)fade=Math.max(fade,1-smooth(t/.5));if(t>film.duration-.5)fade=Math.max(fade,smooth((t-film.duration+.5)/.5));
  if(fade>0){ctx.fillStyle=`rgba(0,0,0,${fade})`;ctx.fillRect(0,0,W,H);}
  return {time:t,scene:s.id,sourceTime,motion,line:s.line??s.name};
};
await document.fonts.ready;
window.film={...film,scenes};window.filmReady=true;await window.drawFrame(2);

const canvas=document.querySelector('#film'), ctx=canvas.getContext('2d',{alpha:false});
const W=1920,H=1080,LIME='#d9ff62',WHITE='#f3f2eb',MUTED='#8b918e',BLACK='#090b0a';
const SANS='"Arial", "Apple SD Gothic Neo", sans-serif';
const KOREAN='"Apple SD Gothic Neo", sans-serif';
const MONO='"Menlo", monospace';
const images=new Map();
async function asset(url){
  if(images.has(url))return images.get(url);
  const img=new Image();img.src=url;await img.decode();images.set(url,img);
  if(images.size>12){const old=[...images.keys()].find(k=>k.includes('/demo/'));if(old)images.delete(old);}
  return img;
}
const code=await fetch('assets/source-excerpt.json').then(r=>r.json());
await Promise.all(['team','interview','food'].map(n=>asset(`assets/${n}.png`)));
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function line(x1,y1,x2,y2,c='#ffffff30',w=1){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function text(s,x,y,size=24,c=WHITE,weight=500,font=SANS,align='left'){
 ctx.fillStyle=c;ctx.font=`${weight} ${size}px ${font}`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(s,x,y);ctx.textAlign='left';
}
function fit(s,x,y,maxW,size,c=WHITE,weight=800,font=SANS){
 ctx.font=`${weight} ${size}px ${font}`;const width=ctx.measureText(s).width;
 ctx.save();ctx.translate(x,y);ctx.scale(Math.min(1,maxW/width),1);text(s,0,0,size,c,weight,font);ctx.restore();
}
function pill(s,x,y,w,c=LIME){rect(x,y,w,38,c);text(s,x+13,y+26,18,BLACK,700,MONO);}
function cover(img,zoom=1,px=.5,py=.5){
 const scale=Math.max(W/img.width,H/img.height)*zoom,w=img.width*scale,h=img.height*scale;
 ctx.drawImage(img,(W-w)*px,(H-h)*py,w,h);
}
function shade(a=.9){const g=ctx.createLinearGradient(0,0,1600,0);g.addColorStop(0,`rgba(4,7,5,${a})`);g.addColorStop(.58,'rgba(4,7,5,.15)');g.addColorStop(1,'rgba(4,7,5,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);}
function tick(x,y,r=16){line(x-r,y,x+r,y,LIME);line(x,y-r,x,y+r,LIME);}
function noise(t){
 ctx.fillStyle='#ffffff05';let seed=Math.floor(t*15)+7;
 for(let i=0;i<340;i++){seed=(seed*16807)%2147483647;const x=seed%W;seed=(seed*16807)%2147483647;ctx.fillRect(x,seed%H,2,2);}
}
function chrome(t,name,detail='SAMPLE FILM'){
 rect(0,0,W,64,'#090b0ae8');text('V / VITALIS',56,42,21,WHITE,800);text('HACKATHON — THE MAKING',W/2,42,17,MUTED,400,MONO,'center');
 text(detail,W-56,42,16,LIME,500,MONO,'right');
 rect(0,H-62,W,62,'#090b0aee');text(name,56,H-25,17,WHITE,500,MONO);
 text(`${String(Math.floor(t)).padStart(2,'0')}:${String(Math.floor((t%1)*30)).padStart(2,'0')} / 00:30`,W-56,H-25,17,MUTED,400,MONO,'right');
 rect(0,H-3,W*(t/30),3,LIME);
}
function rings(t,x,y){ctx.save();ctx.translate(x,y);ctx.rotate(t*.15);ctx.strokeStyle='#d9ff6225';ctx.lineWidth=1;for(let r=130;r<550;r+=78){ctx.beginPath();ctx.ellipse(0,0,r,r*.55,.7,0,Math.PI*2);ctx.stroke();}ctx.restore();}
function opening(t){
 cover(images.get('assets/team.png'),1.03+t*.022);shade(.89);
 const enter=ease(t/.45);ctx.save();ctx.translate((1-enter)*-90,0);
 pill('30 SECONDS. ONE TEAM.',84,184,286);
 fit('MAKE IT',74,490,1540,255,WHITE,900);
 fit('COME ALIVE.',74,719,1680,255,LIME,900);
 text('아이디어가 살아나는 순간.',88,838,38,WHITE,600,KOREAN);
 text('VITALIS  /  HACKATHON RECAP',90,916,21,MUTED,400,MONO);
 ctx.restore();tick(1790,178);chrome(t,'00 / THE SPARK','재연 이미지 · 샘플');
}
function timeline(t){
 const p=t-2;rect(0,0,W,H,BLACK);rings(p,1530,560);
 text('01 / THE TIMELINE',88,169,22,LIME,500,MONO);
 text('아이디어에서 데모까지.',84,307,88,WHITE,800,KOREAN);
 text('한 팀의 시간은 이렇게 흘렀다.',89,370,29,MUTED,500,KOREAN);
 const active=Math.min(3,Math.floor(p));
 const items=[['T+00','IDEA','무엇을 만들까'],['T+02','DESIGN','건강을 3D로'],['T+06','BUILD','화면에 생명을'],['T+10','DEMO','이제, 보여줄 시간']];
 line(146,547,1763,547,'#4a5148',2);line(146,547,146+1617*clamp(p/3.5),547,LIME,3);
 items.forEach(([tm,en,ko],i)=>{const x=88+i*456,on=i<=active;rect(x+48,536,22,22,on?LIME:'#41483f');text(tm,x,504,24,on?LIME:MUTED,500,MONO);text(en,x,692,62,on?WHITE:'#4e554d',800);text(ko,x,751,27,on?WHITE:'#4e554d',500,KOREAN);text('0'+(i+1),x,895,82,i===active?LIME:'#292e29',400,MONO);});
 chrome(t,'01 / IDEA → DESIGN → BUILD → DEMO','예시 일정');
}
function build(t){
 const p=t-6;
 cover(images.get('assets/team.png'),1.06+p*.025);shade(.93);
 if(p<1.5){
  text('02 / IN THE MAKING',86,167,22,LIME,500,MONO);
  fit('THINK.',80,405,890,176,WHITE,900);
  fit('BUILD.',80,572,850,176,LIME,900);
  fit('REPEAT.',80,739,930,176,WHITE,900);
  text('기획 → 화면 설계 → 3D 구현',89,883,36,WHITE,600,KOREAN);
 }else{
  rect(720,138,1120,796,'#080c09ed');rect(720,138,1120,58,'#20281f');
  text('src / AnatomyScene.tsx',751,177,22,LIME,500,MONO);text('REACT + THREE.JS',1790,177,19,MUTED,400,MONO,'right');
  const count=Math.min(17,Math.floor((p-1.5)*12)+6);
  ctx.save();ctx.beginPath();ctx.rect(746,212,1066,686);ctx.clip();
  code.slice(0,count).forEach((s,i)=>{text(String(i+1).padStart(2,'0'),747,244+i*37,19,'#68705f',400,MONO);text(s,798,244+i*37,20,i<5?'#d9ff62':'#c6d0c0',400,MONO);});ctx.restore();
  text('FROM',84,333,81,WHITE,800);text('CODE',80,457,135,LIME,900);text('TO LIFE.',82,564,91,WHITE,800);
  text('코드가 몸을 갖는 순간.',87,695,31,WHITE,600,KOREAN);
  text('실제 프로젝트 소스',87,744,21,MUTED,400,KOREAN);
 }
 chrome(t,'02 / DESIGN. CODE. ITERATE.','개발 과정 재구성');
}
function interview(t){
 const p=t-10;cover(images.get('assets/interview.png'),1+p*.012,.8,.35);shade(.65);
 text('03 / THE PEOPLE',88,168,22,LIME,500,MONO);text('WHY WE',84,328,99,WHITE,800);text('BUILT IT.',84,438,99,WHITE,800);
 rect(89,506,76,5,LIME);text('기획 · 개발 / 인터뷰 예시',88,568,27,WHITE,600,KOREAN);
 text('“',76,700,112,LIME,600);
 text('숫자로만 보던 건강을,',87,731,48,WHITE,700,KOREAN);
 text('입체적으로 보고 싶었어요.',87,800,48,WHITE,700,KOREAN);
 const envelope=p>.65&&p<3.85?1:.12;
 for(let i=0;i<38;i++){const h=6+envelope*(18+Math.sin(i*2.3+p*20)*15+Math.cos(i+p*8)*8);rect(91+i*9,885-h/2,3,h,LIME);}
 chrome(t,'03 / ONE QUESTION. ONE REASON.','가상 인물 · 예시 대사 · 합성 음성');
}
function food(t){
 const p=t-15;cover(images.get('assets/food.png'),1.02+p*.04,.8,.5);shade(.78);
 text('04 / THE FUEL',88,167,22,LIME,500,MONO);
 text('버그는 남고,',82,379,95,WHITE,800,KOREAN);
 if(p>.5){text('피자는',84,510,126,LIME,800,KOREAN);text('사라졌다.',84,646,126,LIME,800,KOREAN);}
 if(p>1.35){pill('PIZZA.LEFT = 0',91,747,256);text('다시 충전, 다시 개발.',91,850,34,WHITE,600,KOREAN);}
 chrome(t,'04 / EAT. LAUGH. KEEP GOING.','야식 에피소드 · 재연 샘플');
}
async function demo(t){
 const p=t-18,frame=Math.min(134,Math.floor(p*15));
 const img=await asset(`assets/demo/${String(frame).padStart(3,'0')}.jpg`);
 rect(0,0,W,H,BLACK);
 const phases=[['01 / OVERVIEW','건강을 한눈에'],['02 / INTERACTIVE 3D','돌려 보고, 들여다보고'],['03 / RECORD DETAIL','부위를 눌러 기록 확인'],['04 / 30-DAY REPORT','30일의 변화를 확인']];
 const n=frame<30?0:frame<75?1:frame<98?2:3;
 // Large legible browser capture: 1312 x 820, with a separate caption column.
 const x=570,y=133,w=1312,h=820;
 rect(x-1,y-38,w+2,39,'#293128');rect(x-1,y-1,w+2,h+2,'#576044');
 ctx.drawImage(img,x,y,w,h);
 for(let j=0;j<3;j++){ctx.fillStyle=['#e0e3d8','#8f9889',LIME][j];ctx.beginPath();ctx.arc(x+20+j*19,y-18,4,0,Math.PI*2);ctx.fill();}
 text('VITALIS / LIVE PRODUCT CAPTURE',x+88,y-12,15,'#bec6b8',500,MONO);
 text('05 / THE DEMO',70,181,22,LIME,500,MONO);
 text('IT’S',65,349,110,WHITE,900);text('ALIVE.',65,482,120,LIME,900);
 text(phases[n][0],72,606,19,LIME,500,MONO);
 const lines=[['건강을','한눈에.'],['돌려 보고,','들여다보고.'],['부위를 눌러','기록 확인.'],['30일의 변화를','확인.']][n];
 lines.forEach((s,i)=>text(s,69,682+i*58,42,WHITE,700,KOREAN));
 text('VITALIS',70,882,27,WHITE,800);text('3D 건강 기록 대시보드',70,923,23,MUTED,500,KOREAN);
 for(let i=0;i<4;i++)rect(73+i*91,796,73,4,i===n?LIME:'#3b4339');
 chrome(t,'05 / REAL APP. REAL INTERACTIONS.','실제 앱 조작 · 예시 건강 데이터');
}
function ending(t){
 const p=t-27;rect(0,0,W,H,BLACK);rings(p,1510,530);
 text('BUILT TOGETHER. BROUGHT TO LIFE.',88,183,23,LIME,500,MONO);
 const enter=ease(p/.5);ctx.save();ctx.translate(0,25*(1-enter));ctx.globalAlpha=enter;
 fit('VITALIS',69,624,1780,357,WHITE,900);ctx.restore();
 rect(92,687,1730,2,'#576044');
 text('기록을 넘어, 내 몸을 이해하다.',91,785,51,LIME,700,KOREAN);
 text('아이디어 → 함께 만든 과정 → 작동하는 결과물',94,881,29,WHITE,500,KOREAN);
 text('WE MADE IT.',1818,950,22,LIME,700,MONO,'right');
 chrome(t,'06 / END OF SPRINT. START OF SOMETHING.','VITALIS / 30s');
 if(p>2.7){rect(0,0,W,H,`rgba(0,0,0,${clamp((p-2.7)/.3)})`);}
}
window.drawFrame=async function(t){
 ctx.globalAlpha=1;ctx.setTransform(1,0,0,1,0,0);rect(0,0,W,H,BLACK);
 if(t<2)opening(t);else if(t<6)timeline(t);else if(t<10)build(t);else if(t<15)interview(t);else if(t<18)food(t);else if(t<27)await demo(t);else ending(t);
 noise(t);
 // One brief directional stripe at chapter cuts, never a repeated full-frame flash.
 const cuts=[2,6,10,15,18,27];for(const cut of cuts){const d=t-cut;if(d>=0&&d<.1)rect(W*(d/.1),64,42,H-126,LIME);}
 return true;
};
await window.drawFrame(0.8);window.filmReady=true;

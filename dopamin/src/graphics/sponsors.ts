import * as THREE from 'three';
import { box, cylinder } from './models';
import { paintSponsorPoster, type SponsorBusiness } from './sponsorArtwork';

export type Sponsor={name:string;caption:string;background:string;accent:string;business?:SponsorBusiness;tag?:string};
export const GS_SPONSORS:readonly Sponsor[]=[
  {name:'GS차지비',caption:'전기차 충전 서비스',tag:'EV CHARGING',business:'charging',background:'#006c70',accent:'#c6f354'},
  {name:'GS그룹',caption:'에너지 · 유통 · 건설',tag:'CONNECTING EVERYDAY',business:'group',background:'#12476b',accent:'#ffb455'},
  {name:'GS칼텍스',caption:'정유 · 석유화학 · 윤활유',tag:'ENERGY & CHEMICALS',business:'refining',background:'#075280',accent:'#ff9d49'},
  {name:'GS리테일',caption:'편의점 · 슈퍼 · 쇼핑',tag:'EVERYDAY SHOPPING',business:'retail',background:'#1278ab',accent:'#72e3ce'},
  {name:'GS건설',caption:'건축 · 주택 · 인프라',tag:'BUILDING TOMORROW',business:'construction',background:'#225866',accent:'#ffc75c'},
  {name:'GS에너지',caption:'전력 · 가스 · 에너지 솔루션',tag:'CONNECTED ENERGY',business:'energy',background:'#25477f',accent:'#8ee2e0'},
  {name:'GS EPS',caption:'LNG · 바이오매스 발전',tag:'POWER GENERATION',business:'generation',background:'#1c6358',accent:'#c1e978'},
  {name:'GS글로벌',caption:'철강 · 자원 · 글로벌 무역',tag:'GLOBAL TRADING',business:'trading',background:'#354a89',accent:'#91dbf1'},
];
export const EVENT_SPONSOR:Sponsor={name:'52G',caption:'2026 해커톤',background:'#103d48',accent:'#d9f26e'};

export function sponsorCanvas(sponsor:Sponsor,aspect=3.2){
  const canvas=document.createElement('canvas');canvas.width=sponsor.business?Math.round(320*aspect):1024;canvas.height=320;const ctx=canvas.getContext('2d')!;
  if(sponsor.business){paintSponsorPoster(ctx,sponsor,canvas.width);return canvas;}
  ctx.fillStyle=sponsor.background;ctx.fillRect(0,0,1024,320);
  ctx.fillStyle=sponsor.accent;ctx.fillRect(0,0,18,320);ctx.fillRect(1006,0,18,320);
  ctx.globalAlpha=.09;ctx.beginPath();ctx.arc(890,150,195,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 144px Arial';ctx.fillStyle='#fffef2';ctx.fillText(sponsor.name,512,135,900);
  ctx.font='700 42px Arial';ctx.fillStyle=sponsor.accent;ctx.fillText(sponsor.caption,512,258,900);
  return canvas;
}
export function sponsorTexture(sponsor:Sponsor,aspect=3.2){
  const texture=new THREE.CanvasTexture(sponsorCanvas(sponsor,aspect));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

export function sponsorBoard(sponsor:Sponsor,width=13,height=4,centerY=4.5){
  const group=new THREE.Group();group.name=`sponsor:${sponsor.name}`;group.userData.sponsor=sponsor.name;
  group.add(box(width+.25,height+.25,.18,'#eff7e8',0,centerY,0));
  for(const side of [-1,1])group.add(cylinder(.09,.13,centerY,'#b8cecb',side*width*.38,centerY/2,-.035));
  const material=new THREE.MeshBasicMaterial({map:sponsorTexture(sponsor,width/height)});
  for(const side of [-1,1]){const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);face.position.set(0,centerY,side*.101);if(side<0)face.rotation.y=Math.PI;group.add(face);}
  return group;
}

/** A full-width press wall, with an event header above repeating sponsor tiles. */
export function sponsorBackdrop(){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1120;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,2048,1120);ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#163e43';ctx.font='italic 900 118px Arial';ctx.fillText('52G',310,103);
  ctx.font='900 90px Arial';ctx.fillText('2026 해커톤',1530,104,850);
  ctx.font='700 29px Arial';ctx.fillStyle='#64827b';ctx.fillText('COFFEE GRAND PRIX   ·   WINNER CEREMONY',1024,194);
  const columns=8,rows=7,top=248,tileWidth=2048/columns,tileHeight=(1120-top)/rows;
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const dark=(row+col)%2===0,x=col*tileWidth,y=top+row*tileHeight;
    ctx.fillStyle=dark?'#15676b':'#fffdf7';ctx.fillRect(x,y,tileWidth,tileHeight);
    ctx.fillStyle=dark?'#fffdf7':'#1d575c';
    if((row+col)%4<2){ctx.font='italic 900 53px Arial';ctx.fillText('52G',x+tileWidth/2,y+tileHeight*.41);ctx.font='700 16px Arial';ctx.fillText('2026 HACKATHON',x+tileWidth/2,y+tileHeight*.79);}
    else{ctx.font='900 25px Arial';ctx.fillText('2026 해커톤',x+tileWidth/2,y+tileHeight*.45,tileWidth*.90);ctx.font='700 17px Arial';ctx.fillText('52G',x+tileWidth/2,y+tileHeight*.79);}
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const wall=new THREE.Group();wall.name='sponsor-press-wall';wall.userData.layout='step-and-repeat';wall.userData.sponsors=['52G','2026 해커톤'];
  wall.add(box(17.9,9.0,.25,'#e5ebe4',0,4.38,-.16));
  const print=new THREE.Mesh(new THREE.PlaneGeometry(17.6,8.8),new THREE.MeshBasicMaterial({map:texture}));print.position.set(0,4.38,0);wall.add(print);
  for(const side of [-1,1])wall.add(cylinder(.065,.065,9.15,'#879a96',side*8.96,4.4,-.12));
  wall.add(box(18.05,.10,.35,'#bdcbc2',0,8.92,-.12));return wall;
}

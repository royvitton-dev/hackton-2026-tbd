import type { Sponsor } from './sponsors';

export type SponsorBusiness='charging'|'group'|'refining'|'retail'|'construction'|'energy'|'generation'|'trading';

/** Large, simple illustrations remain identifiable on a moving kart's roadside signs. */
export function paintSponsorPoster(ctx:CanvasRenderingContext2D,sponsor:Sponsor,width=1024){
  const white='#fffdf1',ink=sponsor.background,accent=sponsor.accent,wide=width>1450,titleSize=Math.min(162,96+Math.max(0,width-1024)*.09);
  const rect=(x:number,y:number,w:number,h:number,color:string,r=0)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
  const circle=(x:number,y:number,r:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();};
  const line=(points:number[][],color=white,width=7)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
  const polygon=(points:number[][],color:string)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
  const bolt=(x:number,y:number,scale=1,color=accent)=>polygon([[x+18*scale,y],[x-15*scale,y+35*scale],[x+7*scale,y+35*scale],[x-11*scale,y+69*scale],[x+31*scale,y+23*scale],[x+7*scale,y+23*scale]],color);
  const label=(text:string,x:number,y:number,size:number,color:string)=>{ctx.fillStyle=color;ctx.font=`900 ${size}px Arial`;ctx.fillText(text,x,y);};
  const building=(x:number,y:number,w:number,h:number,color:string)=>{rect(x,y,w,h,color,3);for(let wx=x+10;wx<x+w-8;wx+=16)for(let wy=y+12;wy<y+h-10;wy+=21)rect(wx,wy,6,9,color===ink?white:ink);};

  const gradient=ctx.createLinearGradient(0,0,width,320);gradient.addColorStop(0,ink);gradient.addColorStop(1,'#102f46');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,320);
  ctx.save();ctx.globalAlpha=.13;polygon([[width-399,320],[width-275,0],[width,0],[width,320]],accent);ctx.restore();
  rect(0,0,13,320,accent);rect(54,wide?302:273,Math.min(740,width-420),5,accent,2);
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=accent;ctx.font='700 24px Arial';ctx.fillText(sponsor.tag||'',56,wide?35:43);
  ctx.fillStyle=white;ctx.font=`900 ${titleSize}px Arial`;ctx.fillText(sponsor.name,50,wide?145:126,width-410);
  ctx.font='700 42px Arial';ctx.fillStyle='#e6f3ef';ctx.fillText(sponsor.caption,56,wide?250:218,width-420);
  ctx.save();ctx.translate(width-340,30);circle(152,135,131,white);circle(152,135,116,'#e1eeeb');
  ctx.textAlign='center';
  switch(sponsor.business){
    case 'charging': {
      rect(46,61,72,152,ink,12);rect(56,75,52,49,accent,5);bolt(71,78,.53,ink);
      line([[116,104],[132,113],[132,181],[143,191],[162,191]],ink,9);rect(151,177,19,26,ink,4);
      polygon([[148,173],[169,128],[220,128],[250,173]],ink);rect(142,166,118,45,ink,12);
      polygon([[163,163],[176,138],[210,138],[230,163]],'#a4e6db');circle(167,210,15,ink);circle(237,210,15,ink);circle(167,210,7,white);circle(237,210,7,white);
      label('EV',192,188,23,accent);break;
    }
    case 'group': {
      line([[85,87],[224,89],[151,212],[85,87]],ink,8);
      for(const [x,y]of [[85,87],[224,89],[151,212]])circle(x,y,40,ink);
      bolt(76,59,.68,accent);rect(204,78,40,27,white,4);polygon([[201,78],[210,64],[238,64],[247,78]],accent);
      building(133,190,35,42,white);circle(151,126,21,accent);label('GS',151,127,24,ink);break;
    }
    case 'refining': {
      rect(61,85,74,136,ink,10);rect(70,97,55,47,white,4);rect(58,209,82,15,ink,3);
      line([[135,111],[152,129],[152,184],[163,197],[177,186],[177,140],[165,128]],ink,9);
      ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(213,55);ctx.bezierCurveTo(213,55,174,105,174,129);ctx.bezierCurveTo(174,176,252,176,252,129);ctx.bezierCurveTo(252,103,213,55,213,55);ctx.fill();
      label('FUEL',98,121,16,ink);line([[190,213],[219,193],[244,213]],ink,5);for(const [x,y]of [[190,213],[219,193],[244,213]])circle(x,y,9,ink);break;
    }
    case 'retail': {
      rect(48,99,154,118,ink,7);rect(61,139,73,78,'#9edccc',3);rect(145,139,43,78,white,3);
      rect(43,72,164,34,ink,5);label('GS25',125,91,24,white);
      for(let i=0;i<7;i++)rect(41+i*24,107,24,23,i%2?accent:white,4);
      for(let row=0;row<3;row++)for(let i=0;i<3;i++)rect(70+i*20,147+row*21,11,14,i%2?white:accent,2);
      rect(185,172,62,62,accent,8);ctx.strokeStyle=ink;ctx.lineWidth=6;ctx.beginPath();ctx.arc(216,172,16,Math.PI,Math.PI*2);ctx.stroke();label('+',216,207,29,ink);break;
    }
    case 'construction': {
      building(59,122,62,107,ink);building(135,158,68,71,ink);rect(72,112,36,10,accent);
      line([[216,222],[216,52],[82,52],[252,52]],ink,9);line([[150,51],[216,25],[248,51]],ink,5);
      line([[93,59],[93,98]],ink,4);rect(77,96,34,14,accent,2);line([[203,76],[229,99],[203,123],[229,147],[203,174],[227,198]],accent,4);
      rect(48,229,213,9,ink,3);break;
    }
    case 'energy': {
      // A connected power grid, storage and hydrogen represent the business portfolio.
      line([[87,89],[161,137],[235,86],[233,212],[161,137],[76,210]],ink,6);
      circle(161,137,39,ink);bolt(148,108,.8,accent);
      rect(58,56,61,66,ink,8);rect(68,46,40,11,ink,3);for(let i=0;i<3;i++)rect(71+i*13,71,8,34,accent,2);
      circle(235,82,36,ink);label('H₂',235,83,32,white);
      building(55,182,43,55,ink);building(210,187,43,49,ink);break;
    }
    case 'generation': {
      rect(49,161,160,63,ink,5);rect(65,112,31,57,ink,4);rect(117,96,31,73,ink,4);rect(157,131,30,42,ink,3);
      for(const x of [65,117,157])rect(x,124+(x===117?-16:x===157?16:0),31,7,accent);
      for(const x of [65,105,145,185])rect(x,181,15,18,white,2);
      ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(175,136);ctx.bezierCurveTo(165,72,208,52,250,52);ctx.bezierCurveTo(253,101,234,146,175,136);ctx.fill();line([[178,136],[224,88]],ink,5);
      circle(223,197,32,accent);bolt(213,174,.62,ink);label('LNG',97,204,17,white);break;
    }
    case 'trading': {
      ctx.strokeStyle=ink;ctx.lineWidth=5;ctx.beginPath();ctx.arc(159,102,62,0,Math.PI*2);ctx.stroke();
      for(const radius of [25,47]){ctx.beginPath();ctx.ellipse(159,102,radius,62,0,0,Math.PI*2);ctx.stroke();}
      line([[99,102],[219,102]],ink,4);line([[109,76],[209,76]],ink,3);
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){rect(69+col*48,157+row*28,43,25,(row+col)%2?ink:accent,2);for(let i=1;i<4;i++)line([[69+col*48+i*10,161+row*28],[69+col*48+i*10,178+row*28]],white,2);}
      polygon([[47,211],[262,211],[240,238],[69,238]],ink);line([[52,248],[88,253],[123,248],[159,253],[194,248],[229,253],[263,248]],ink,4);
      ctx.save();ctx.setLineDash([6,8]);line([[51,143],[38,98],[62,60],[96,42]],accent,5);ctx.restore();polygon([[90,32],[110,38],[98,55]],accent);break;
    }
  }
  ctx.restore();
}

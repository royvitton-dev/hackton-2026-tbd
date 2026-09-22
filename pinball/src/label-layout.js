// Stable ID order and previous offsets prevent overlap-based visibility flicker.
// A crowded view may still overlap; no on-screen participant is dropped.
export function placeLabels(candidates,width,height,previous=new Map(),obstacles=[]){
 const occupied=[...obstacles],result=[];const overlaps=b=>occupied.some(o=>b.l<o.r+3&&b.r>o.l-3&&b.t<o.b+2&&b.b>o.t-2);
 for(const c of [...candidates].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  const offsets=[previous.get(c.id)||[0,0],[0,0]];for(let n=1;n<=8;n++)for(const sign of [-1,1])offsets.push([0,sign*n*25]);for(const sign of [-1,1])for(let n=-4;n<=4;n++)offsets.push([sign*(c.width+6),n*25]);
  let chosen;for(const [dx,dy] of offsets){const x=Math.max(c.width/2+3,Math.min(width-c.width/2-3,c.x+dx)),y=Math.max(27,Math.min(height-5,c.y+dy));const box={l:x-c.width/2,r:x+c.width/2,t:y-24,b:y};chosen={...c,x,y,dx:x-c.x,dy:y-c.y,box};if(!overlaps(box))break;}
  occupied.push(chosen.box);previous.set(c.id,[chosen.dx,chosen.dy]);result.push(chosen);
 }return result;
}

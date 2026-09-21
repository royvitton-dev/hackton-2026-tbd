import * as THREE from 'three';
export const FINISHES={concrete:'노출 콘크리트',paint:'밝은 도장',brick:'적벽돌',tile:'회색 타일',epoxy:'녹색 에폭시',asphalt:'아스팔트'};
export function surfaceMaterial(finish='concrete',cache){
 if(cache?.has(finish))return cache.get(finish);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');
 const base={concrete:'#b6b5aa',paint:'#e3e1d3',brick:'#af715a',tile:'#b0b9b3',epoxy:'#719487',asphalt:'#525b59'}[finish]||'#b6b5aa';ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
 let seed=17;for(let i=0;i<7000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%256;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%256;ctx.fillStyle=`rgba(${i%2?'255,255,255':'0,0,0'},${finish==='paint'?.025:finish==='epoxy'?.035:.06})`;ctx.fillRect(x,y,i%3+1,i%2+1);}
 if(finish==='brick'||finish==='tile'){ctx.strokeStyle=finish==='brick'?'#d2c1a9':'#7c8780';ctx.lineWidth=finish==='brick'?4:2;const h=finish==='brick'?32:64,w=finish==='brick'?64:64;for(let y=0;y<=256;y+=h){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();for(let x=(finish==='brick'&&(y/h)%2?w/2:0);x<=256;x+=w){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+h);ctx.stroke();}}}
 if(finish==='concrete'){ctx.strokeStyle='#8e938c';ctx.lineWidth=.6;for(const y of [0,128,255]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();}for(const x of [20,128,236])for(const y of [20,108,148,236]){ctx.fillStyle='#969d92';ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();}}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:finish==='brick'?.045:finish==='paint'?.003:.015,roughness:finish==='epoxy'?.3:finish==='paint'?.7:.94,metalness:0,flatShading:true});material.userData.finish=finish;cache?.set(finish,material);return material;
}
export function worldUV(geometry){
 // Independent face vertices avoid a single UV seam stretched around walls.
 const g=geometry.index?geometry.toNonIndexed():geometry;g.computeVertexNormals();const p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=[];
 for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));uv.push((ax>ay&&ax>az?p.getZ(i):p.getX(i))/2,(ay>ax&&ay>az?p.getZ(i):p.getY(i))/2);}
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return g;
}

import * as THREE from 'three';
import {metricUV} from './materials.js';

export function box(root,w,h,d,mat,x=0,y=h/2,z=0) {
  const geo=new THREE.BoxGeometry(Math.max(w,.005),Math.max(h,.005),Math.max(d,.005));
  if(mat.userData.span)metricUV(geo,mat.userData.span,[x,y,z]);
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
export function slab(root,points,y,h,mat) {
  const shape=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
  const geo=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:1});geo.rotateX(-Math.PI/2);
  if(mat.userData.span)metricUV(geo,mat.userData.span,[0,y,0]);
  const mesh=new THREE.Mesh(geo,mat);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
export function rail(root,width,metal,{x=0,y=0,z=0,height=.85,depth=.3,glass=null}={}) {
  const g=new THREE.Group();g.position.set(x,y,z);root.add(g);g.userData.feature='balcony';
  box(g,width+.12,.04,depth+.09,metal,0,.015,depth/2);
  box(g,width+.12,.04,.04,metal,0,height,depth);
  for(const edge of [-width/2,width/2]){box(g,.035,height,.035,metal,edge,height/2,depth);box(g,.035,.04,depth,metal,edge,height,depth/2);}
  if(glass)box(g,width-.08,height-.1,.02,glass,0,height/2,depth);
  else for(let x=-width/2+.13;x<width/2;x+=.14)box(g,.018,height-.03,.024,metal,x,height/2,depth);
  return g;
}
export function roofRail(root,width,depth,y,metal) {
  for(const [x,z,length,rotation] of [[0,depth/2,width,0],[0,-depth/2,width,Math.PI],[width/2,0,depth,-Math.PI/2],[-width/2,0,depth,Math.PI/2]]) {
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;root.add(g);rail(g,length,metal,{height:.85,depth:0});
  }
}

export function windowOpening(root,o,mats) {
  const {x,y,w,h}=o, frame=o.frame||mats.frame, z=.025, t=.065;
  const g=new THREE.Group();g.position.set(x,y,0);g.userData.feature='window';root.add(g);
  // Recessed panes and jambs are actual geometry; the wall has a matching hole.
  box(g,w,h,.035,o.warm?mats.warm:mats.glass,0,h/2,-.2);
  box(g,w+.035,t,.26,frame,0,t/2,-.08);box(g,w+.035,t,.26,frame,0,h-t/2,-.08);
  for(const side of [-1,1])box(g,t,h,.26,frame,side*(w-t)/2,h/2,-.08);
  const panes=o.panes ?? (w>1.45?2:1);
  for(let i=1;i<panes;i++)box(g,.045,h,.065,frame,-w/2+w*i/panes,h/2,z);
  if(o.transom)box(g,w,.045,.065,frame,0,h*.7,z);
  box(g,w+.17,.06,.33,mats.sill||frame,0,-.025,-.02);
  if(o.balcony)rail(g,w+.16,mats.rail,{y:-.02,z:.02,height:Math.min(.9,h*.6),depth:o.balcony==='glass'?.3:.38,glass:o.balcony==='glass'?mats.frost:null});
}

// A facade is divided around openings, never covered by opaque window stickers.
export function wall(root,{w,h,x=0,y=0,z=0,rotation=0,thickness=.25,openings=[],mat,mats,bands=[]}) {
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;root.add(g);
  const holes=openings.filter(o=>o.y>=0&&o.y+o.h<=h+.01&&Math.abs(o.x)+o.w/2<w/2+.01);
  const rows=[...new Set([0,h,...holes.flatMap(o=>[o.y,o.y+o.h]),...bands.flatMap(b=>[b.y,b.y+b.h])].filter(v=>v>=0&&v<=h))].sort((a,b)=>a-b);
  for(let r=0;r<rows.length-1;r++) {
    const bottom=rows[r],top=rows[r+1],mid=(bottom+top)/2;
    const band=bands.find(b=>mid>=b.y&&mid<=b.y+b.h),material=band?.mat||mat;
    const cuts=holes.filter(o=>mid>o.y&&mid<o.y+o.h).sort((a,b)=>a.x-b.x);
    let left=-w/2;
    for(const o of cuts){const right=Math.max(left,o.x-o.w/2);if(right-left>.001)box(g,right-left,top-bottom,thickness,material,(left+right)/2,mid,-thickness/2);left=Math.max(left,o.x+o.w/2);}
    if(w/2-left>.001)box(g,w/2-left,top-bottom,thickness,material,(left+w/2)/2,mid,-thickness/2);
  }
  for(const o of holes)windowOpening(g,o,mats);
  return g;
}

export function label(root,text,w,h,mat,{x=0,y=0,z=0,rotation=0,color='#5a605b',background=null}={}) {
  const c=document.createElement('canvas');c.width=768;c.height=384;const ctx=c.getContext('2d');
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);}
  const lines=text.split('\n');ctx.fillStyle=color;ctx.font='600 115px "Apple SD Gothic Neo", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  lines.forEach((line,i)=>ctx.fillText(line,384,192+(i-(lines.length-1)/2)*135,740));
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;mat.textures.add(texture);
  const material=mat.plain('#ffffff',{map:texture,transparent:true,depthWrite:false,roughness:.9});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.position.set(x,y,z);mesh.rotation.y=rotation;root.add(mesh);
}

export function piloti(root,{w,d,h,mats,closed=.24}) {
  box(root,w,.16,d,mats.concrete,0,h-.08,0);
  box(root,w,.12,d,mats.paving,0,.01,0);
  box(root,w,h,d*closed,mats.concrete,0,h/2,-d/2+d*closed/2);
  for(const x of [-w/2+.3,0,w/2-.3])for(const z of [d/2-.3,-d*.17]) {
    const column=box(root,.42,h,.42,mats.concrete,x,h/2,z);column.userData.feature='piloti-column';
  }
  for(let x=-w/2+1;x<w/2;x+=2.5) {
    box(root,.055,.015,d*.55,mats.marking,x,.08,d*.12);
    box(root,1.5,.11,.18,mats.rubber,x+1,.11,-d*.1);
  }
  for(let z=-d/2;z<d/2;z+=2.1)box(root,w,.16,.18,mats.concrete,0,h-.14,z);
  box(root,1.1,2.25,.06,mats.dark,-w*.2,1.125,-d/2+d*closed+.03);
  box(root,.07,.38,.06,mats.frame,-w*.2+.36,1.2,-d/2+d*closed+.09);
}

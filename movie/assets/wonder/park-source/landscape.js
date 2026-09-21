import * as THREE from 'three';
import {box,rounded,sphere,cyl,cone,torus,group,material,texture,seeded,textSign} from './materials.js';

export function tree(parent,x,z,size=1,kind='green'){
 const g=group(parent,x,.3,z);g.scale.setScalar(size);
 cyl(g,.11,1.5,'#8e7855',0,.75,0);const rand=seeded(Math.abs(Math.round(x*200+z*153)));
 const colors=kind==='pink'?['#ddaba9','#e8c2b6','#cc939f']:['#50714e','#648156','#7f965e'];
 for(let i=0;i<12;i++){const a=rand()*Math.PI*2,r=rand()*.6;sphere(g,.45+rand()*.16,.5+rand()*.2,.45+rand()*.16,colors[i%3],Math.cos(a)*r,1.55+rand()*.8,Math.sin(a)*r);}
 return g;
}
function hedge(parent,x,z,w,d){rounded(parent,w,.52,d,.2,'#526f47',x,.54,z);rounded(parent,w-.12,.12,d-.12,.05,'#6e8854',x,.85,z);}
function lamp(parent,x,z){cyl(parent,.045,1.65,'#84734d',x,1.05,z);cyl(parent,.12,.13,'#d3c196',x,.31,z);sphere(parent,.19,.22,.19,material('#fff6d9',{emissive:'#eeb66d',emissiveIntensity:.17}),x,1.96,z);cone(parent,.25,.2,'#506758',x,2.2,z);}
export function createLandscape(parent){
 const root=group(parent);const animations=[];const rand=seeded(882);
 const grass=new THREE.MeshStandardMaterial({color:'#e7efce',map:texture('grass'),roughness:.95});
 const paving=new THREE.MeshStandardMaterial({color:'#fff4dc',map:texture('path'),roughness:.86});
 const base=cyl(root,23,1.1,'#c7b999',0,-.66,0);base.scale.z=.79;
 const rim=cyl(root,23.06,.16,'#e8d8b8',0,-.05,0);rim.scale.z=.79;
 const land=cyl(root,22.72,.35,grass,0,.13,0);land.scale.z=.79;
 // The pale promenade is an actual continuous ring, inset into the landscaped island.
 const promenade=new THREE.Mesh(new THREE.RingGeometry(18.5,20.6,128),paving);promenade.rotation.x=-Math.PI/2;promenade.scale.y=.77;promenade.position.y=.32;promenade.receiveShadow=true;root.add(promenade);
 const edging=torus(root,20.65,.075,'#eee1c3',0,.34,0);edging.rotation.x=-Math.PI/2;edging.scale.y=.77;
 rounded(root,4.1,.10,29,.08,paving,0,.34,.8);
 rounded(root,32,.1,3.25,.06,paving,0,.34,3.1);
 const frontPath=torus(root,6.2,.85,paving,0,.35,8.1);frontPath.rotation.x=-Math.PI/2;frontPath.scale.y=.78;frontPath.scale.z=.08;
 // A winding miniature river, with layered shore edges and a rippling physical surface.
 const riverCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-20,.34,-5),new THREE.Vector3(-19,.34,5),new THREE.Vector3(-14,.34,12),new THREE.Vector3(-3,.34,14.2),new THREE.Vector3(9,.34,13.8),new THREE.Vector3(18,.34,8),new THREE.Vector3(20,.34,-3)]);
 function riverStrip(width,color,height){const count=140,positions=[],uv=[],indices=[];for(let i=0;i<=count;i++){const t=i/count,p=riverCurve.getPoint(t),tan=riverCurve.getTangent(t),nx=-tan.z,nz=tan.x;for(const s of [-1,1]){positions.push(p.x+nx*width*s,height,p.z+nz*width*s);uv.push(s===-1?0:1,t*20);}if(i<count){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const m=new THREE.Mesh(geo,typeof color==='string'?material(color):color);m.receiveShadow=true;root.add(m);return m;}
 riverStrip(1.08,'#cbbb95',.36);
 const waterMat=new THREE.MeshPhysicalMaterial({color:'#63aeb0',roughness:.19,metalness:.2,clearcoat:1,clearcoatRoughness:.17,side:THREE.DoubleSide});
 const water=riverStrip(.91,waterMat,.405);water.userData.dynamic=true;
 waterMat.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};waterMat.userData.shader=shader;shader.vertexShader='uniform float uTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += sin(position.x*3.0+uTime)*0.018 + cos(position.z*3.3+uTime*.8)*0.012;');};
 animations.push(t=>{if(waterMat.userData.shader)waterMat.userData.shader.uniforms.uTime.value=t;});
 // Bridge and warm brass railings.
 rounded(root,3.2,.18,4.7,.08,paving,0,.65,13.8);
 for(const side of [-1,1]){box(root,.06,.07,4.7,'#c6aa71',side*1.48,1.2,13.8);for(let j=0;j<8;j++)cyl(root,.035,.52,'#b99c64',side*1.48,.94,11.7+j*.6);}
 // The signature three-lobed fountain, a subtle nod to Mickey's silhouette.
 const fountain=group(root,0,.38,7.7);
 for(const [x,z,r] of [[0,.4,2.5],[-2,-1.5,1.55],[2,-1.5,1.55]]){
  cyl(fountain,r,.32,'#eadfca',x,.22,z);cyl(fountain,r-.17,.08,'#98c6c0',x,.42,z);const border=torus(fountain,r-.05,.09,'#f5e9d1',x,.45,z);border.rotation.x=-Math.PI/2;
  cyl(fountain,.24,.33,'#e2d9bc',x,.59,z);sphere(fountain,.15,.23,.15,'#dadabf',x,.87,z);
  const jet=cone(fountain,.095,.93,material('#d4eded',{transparent:true,opacity:.7,roughness:.1}),x,1.27,z);jet.userData.dynamic=true;animations.push(t=>jet.scale.y=.92+Math.sin(t*2.5+x)*.06);
  for(let j=0;j<3;j++){const ripple=torus(fountain,.45+j*.36,.018,material('#e6f4e8',{transparent:true,opacity:.5}),x,.475,z);ripple.rotation.x=-Math.PI/2;}
 }
 // Formal gardens, tiny flower beds, hedges, and cherry trees around the main street.
 for(const side of [-1,1]){
  hedge(root,side*5.3,8.5,.48,6.3);hedge(root,side*3.5,11.4,3.8,.48);
  for(let row=0;row<3;row++)for(let col=0;col<15;col++){const x=side*(2.4+row*.64),z=8.1+col*.19; sphere(root,.1,.075,.105,['#be6c88','#dfc779','#e8b5ac'][row],x,.53,z);}
  for(const z of [-4,0,6,11])lamp(root,side*2.4,z);
  for(const z of [6.3,10.7]){rounded(root,1.25,.1,.43,.05,'#a88e63',side*6.2,.75,z);for(const x of [-.48,.48])box(root,.09,.4,.32,'#4e6453',side*6.2+x,.53,z);box(root,1.25,.32,.075,'#b29d77',side*6.2,1,z-.2);}
 }
 // Perimeter foliage is deliberately clustered, like a hand-built architectural miniature.
 for(let i=0;i<58;i++){
  const a=i/58*Math.PI*2,r=20.7+rand()*.9,x=Math.cos(a)*r,z=Math.sin(a)*r*.77;
  if(z>13&&Math.abs(x)<4)continue;tree(root,x,z,.6+rand()*.55,i%9===0?'pink':'green');
 }
 for(const [x,z,s] of [[-6,-9,1.05],[6,-9,.9],[-7,-3,.85],[6,-3,.83],[-16,-8,.9],[16,-7,1],[-15,7,.7],[16,6,.7],[-6,12,.8],[7,12,.8]])tree(root,x,z,s,Math.abs(x)%2===0?'pink':'green');
 for(let i=0;i<40;i++){
  const a=rand()*Math.PI*2,r=17.4+rand()*.4;sphere(root,.3,.22,.3,['#75925b','#648755','#8f9f63'][i%3],Math.cos(a)*r,.48,Math.sin(a)*r*.78);
 }
 // Main gate: ticket-like signage and striped turrets, deliberately readable from above.
 for(const side of [-1,1]){cyl(root,.6,2.3,'#e4d2ae',side*3.1,1.47,15.7);cone(root,.78,1.3,'#507b7b',side*3.1,3.15,15.7);cone(root,.07,.55,'#cdb277',side*3.1,4.02,15.7);}
 textSign(root,'TBD · WONDER PARK',5.55,.66,'#e8d6a3','#304f44',0,2.75,15.8);
 box(root,6.35,.1,.16,'#cdb277',0,3.15,15.75);
 // Decorative ferris wheel behind the castle, with rotating carriages kept upright.
 const wheel=group(root,11,.4,-9.7);wheel.rotation.y=-.1;
 for(const side of [-1,1]){const strut=box(wheel,.18,5.5,.2,'#e9d3ae',side*1.05,2.55,.3);strut.rotation.z=side*.4;}
 const spokes=group(wheel,0,5,0);spokes.userData.dynamic=true;
 for(const z of [-.25,.25])torus(spokes,3.5,.085,'#e6c28b',0,0,z);
 const seats=[];
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const spoke=box(spokes,.05,7,.06,'#ecdbb8');spoke.rotation.z=a;const seat=group(spokes,Math.sin(a)*3.5,Math.cos(a)*3.5,0);rounded(seat,.65,.7,.7,.1,['#cb8d79','#94aaa0','#ddb673','#a79bbc'][i%4],0,-.32,0);cone(seat,.51,.35,'#e9d4af',0,.18,0);seats.push(seat);}
 animations.push(t=>{spokes.rotation.z=t*.065;seats.forEach(s=>s.rotation.z=-t*.065);});
 return {root,animations};
}

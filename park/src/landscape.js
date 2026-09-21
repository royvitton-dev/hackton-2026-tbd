import * as THREE from 'three';
import {box,rounded,sphere,cyl,cone,torus,group,material,texture,seeded,textSign} from './materials.js';
import { createLandmark } from './landmark.js';

export function tree(parent,x,z,size=1,kind='green'){
 const g=group(parent,x,.3,z);g.scale.setScalar(size);
 cyl(g,.12,2.25,material('#796049',{roughness:.95}),0,1.12,0,.055);const rand=seeded(Math.abs(Math.round(x*200+z*153)));
 for(let i=0;i<5;i++){const branch=cyl(g,.045,.95,'#80674b',Math.cos(i*2.4)*.27,1.45+i*.12,Math.sin(i*2.4)*.27,.014);branch.rotation.z=Math.cos(i*2.4)*.65;branch.rotation.x=Math.sin(i*2.4)*.65;}
 const colors=kind==='pink'?['#dd81a3','#efa8b9','#c6668a']:['#416536','#547b39','#83a151'];
 g.userData.leaves=[];
 for(let i=0;i<180;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*1.12,y=1.8+rand()*1.7;const crown=Math.sqrt(Math.max(.05,1-((y-2.65)/1.2)**2));g.userData.leaves.push({x:Math.cos(a)*r*crown,y,z:Math.sin(a)*r*crown,s:.35+rand()*.4,rx:rand()*Math.PI,ry:rand()*Math.PI,rz:rand()*Math.PI,color:colors[i%3]});}
 return g;
}
function hedge(parent,x,z,w,d){rounded(parent,w,.52,d,.2,'#526f47',x,.54,z);rounded(parent,w-.12,.12,d-.12,.05,'#6e8854',x,.85,z);}
function lamp(parent,x,z){cyl(parent,.045,1.9,'#645638',x,1.2,z);cyl(parent,.12,.13,'#d3c196',x,.31,z);sphere(parent,.19,.24,.19,material('#fff1c2',{emissive:'#ffca73',emissiveIntensity:1.6}),x,2.23,z);cone(parent,.25,.2,'#395448',x,2.5,z);}
function foliage(root){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#fff';
 for(const [x,y,a] of [[64,30,0],[40,45,-.8],[85,49,.8],[43,79,-.65],[81,86,.65],[61,102,0]]){c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.ellipse(0,0,10,23,0,0,Math.PI*2);c.fill();c.restore();}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
 const leaves=[];root.updateMatrixWorld(true);root.traverse(o=>{for(const leaf of o.userData.leaves||[])leaves.push({leaf,matrix:o.matrixWorld});});
 const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map,alphaTest:.45,side:THREE.DoubleSide,roughness:.94}),leaves.length);
 const dummy=new THREE.Object3D(),matrix=new THREE.Matrix4(),color=new THREE.Color();
 leaves.forEach(({leaf,matrix:parent},i)=>{dummy.position.set(leaf.x,leaf.y,leaf.z);dummy.rotation.set(leaf.rx,leaf.ry,leaf.rz);dummy.scale.setScalar(leaf.s);dummy.updateMatrix();matrix.multiplyMatrices(parent,dummy.matrix);mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color.set(leaf.color));});
 mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.dynamic=true;mesh.name='Instanced botanical foliage';root.add(mesh);
}
function formalGardens(root){
 const rand=seeded(912),heads=[];
 for(const side of [-1,1]){
  for(const z of [-1.5,6,11.5]){
   const x=side*7.2;rounded(root,2.9,.2,3.3,.55,'#b4a07d',x,.39,z);rounded(root,2.65,.24,3.05,.5,'#354f30',x,.55,z);
   for(let i=0;i<85;i++)heads.push({x:x+(rand()-.5)*2.3,y:.78+rand()*.12,z:z+(rand()-.5)*2.6,color:['#dc4881','#ffb661','#eb6c67','#e8d7ec'][Math.floor(rand()*4)]});
  }
  for(const z of [-7,-2,3,8,13,17])lamp(root,side*21.7,z*.73);
  for(let i=0;i<4;i++){
   const g=group(root,side*(18.3+i*.95),.35,-7+i*3.3);g.rotation.y=side*-.65;
   const facade=['#e9b5a1','#d1dcc5','#c6d4dc','#e7ce95'][i];
   rounded(g,2.65,2.6,2.65,.05,facade,0,1.35,0);box(g,2.95,.2,2.95,'#eee0c3',0,2.72,0);
   const roof=cone(g,2.15,1.3,material('#426c78',{metalness:.16,roughness:.55}),0,3.44,0);roof.geometry=new THREE.ConeGeometry(2.15,1.3,4);roof.rotation.y=Math.PI/4;
   for(const x of [-.72,.72]){box(g,.63,1.05,.05,'#326477',x,1.83,1.35);box(g,.05,1.1,.07,'#f6e2b8',x,1.83,1.4);box(g,.68,.05,.07,'#f6e2b8',x,1.84,1.4);}
   box(g,.65,1.4,.08,'#34524d',0,.75,1.36);
   for(let stripe=0;stripe<9;stripe++){const awning=box(g,.3,.08,.8,stripe%2?'#f5e7c8':['#ad5766','#608b76','#63838d','#bd8f50'][i],-1.2+stripe*.3,1.45,1.7);awning.rotation.x=.2;}
   for(const x of [-1.27,1.27])cyl(g,.028,1.35,'#b99c62',x,.7,2.05);
  }
 }
 const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.085,1),new THREE.MeshStandardMaterial({roughness:.78}),heads.length);const dummy=new THREE.Object3D(),color=new THREE.Color();
 heads.forEach((h,i)=>{dummy.position.set(h.x,h.y,h.z);dummy.scale.set(1,.55,1);dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);flowers.setColorAt(i,color.set(h.color));});flowers.userData.dynamic=true;flowers.castShadow=true;root.add(flowers);
 // Festoon lights trace the approach to the castle, with sculpted stone pedestals.
 const glow=material('#fff1bf',{emissive:'#ffd591',emissiveIntensity:2.3,roughness:.3});
 for(const side of [-1,1]){
  for(const z of [-3,2,7,12]){
   cyl(root,.14,2.75,'#ab8e53',side*3.9,1.7,z);sphere(root,.17,.17,.17,glow,side*3.9,3.15,z);
   if(z<12){const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*3.9,3.1,z),new THREE.Vector3(side*3.9,2.55,z+2.5),new THREE.Vector3(side*3.9,3.1,z+5)]);const wire=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.018,4,false),material('#756541'));root.add(wire);for(let j=1;j<10;j++){const p=curve.getPoint(j/10);sphere(root,.055,.08,.055,glow,p.x,p.y-.07,p.z);}}
  }
 }
}
export function createLandscape(parent){
 const root=group(parent);const animations=[];const rand=seeded(882);
 const grass=new THREE.MeshStandardMaterial({color:'#a4b979',map:texture('grass'),bumpMap:texture('grass'),bumpScale:.1,roughness:.94});
 grass.name='park-lawn';
 const paving=new THREE.MeshStandardMaterial({color:'#f3dec0',map:texture('path'),bumpMap:texture('path'),bumpScale:.065,roughness:.86});
 const base=cyl(root,28,1.1,'#c7b999',0,-.66,0);base.scale.z*=.79;
 const rim=cyl(root,28.06,.16,'#e8d8b8',0,-.05,0);rim.scale.z*=.79;
 const land=cyl(root,27.72,.35,grass,0,.13,0);land.scale.z*=.79;
 for(const surface of [base,rim,land])surface.geometry=new THREE.CylinderGeometry(1,1,1,128);
 // The pale promenade is an actual continuous ring, inset into the landscaped island.
 const promenade=new THREE.Mesh(new THREE.RingGeometry(23.1,25.4,160),paving);promenade.rotation.x=-Math.PI/2;promenade.scale.y=.77;promenade.position.y=.32;promenade.receiveShadow=true;root.add(promenade);
 const edging=torus(root,25.45,.075,'#eee1c3',0,.34,0);edging.rotation.x=-Math.PI/2;edging.scale.y=.77;
 rounded(root,4.1,.10,37,.08,paving,0,.34,.8);
 rounded(root,44,.1,3.25,.06,paving,0,.34,3.1);
 const frontPath=torus(root,6.2,.85,paving,0,.35,11.1);frontPath.rotation.x=-Math.PI/2;frontPath.scale.y=.78;frontPath.scale.z=.08;
 // A winding miniature river, with layered shore edges and a rippling physical surface.
 const riverCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-25,.34,-7),new THREE.Vector3(-24,.34,6),new THREE.Vector3(-18,.34,15),new THREE.Vector3(-3,.34,18.2),new THREE.Vector3(11,.34,17.8),new THREE.Vector3(23,.34,9),new THREE.Vector3(25,.34,-5)]);
 function riverStrip(width,color,height){const count=140,positions=[],uv=[],indices=[];for(let i=0;i<=count;i++){const t=i/count,p=riverCurve.getPoint(t),tan=riverCurve.getTangent(t),nx=-tan.z,nz=tan.x;for(const s of [-1,1]){positions.push(p.x+nx*width*s,height,p.z+nz*width*s);uv.push(s===-1?0:1,t*20);}if(i<count){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();const m=new THREE.Mesh(geo,typeof color==='string'?material(color):color);m.receiveShadow=true;root.add(m);return m;}
 riverStrip(1.08,'#cbbb95',.36);
 const waterMat=new THREE.MeshPhysicalMaterial({color:'#63aeb0',roughness:.19,metalness:.2,clearcoat:1,clearcoatRoughness:.17,side:THREE.DoubleSide});
 const water=riverStrip(.91,waterMat,.405);water.userData.dynamic=true;
 waterMat.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};waterMat.userData.shader=shader;shader.vertexShader='uniform float uTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y += sin(position.x*3.0+uTime)*0.018 + cos(position.z*3.3+uTime*.8)*0.012;');};
 animations.push(t=>{if(waterMat.userData.shader)waterMat.userData.shader.uniforms.uTime.value=t;});
 // Bridge and warm brass railings.
 rounded(root,3.2,.18,4.7,.08,paving,0,.65,17.8);
 for(const side of [-1,1]){box(root,.06,.07,4.7,'#c6aa71',side*1.48,1.2,17.8);for(let j=0;j<8;j++)cyl(root,.035,.52,'#b99c64',side*1.48,.94,15.7+j*.6);}
 // The signature three-lobed fountain, a subtle nod to Mickey's silhouette.
 const fountain=group(root,0,.38,11.1);
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
 for(let i=0;i<82;i++){
  const a=i/82*Math.PI*2,r=25.7+rand()*.9,x=Math.cos(a)*r,z=Math.sin(a)*r*.77;
  if(z>17&&Math.abs(x)<4)continue;tree(root,x,z,.78+rand()*.62,i%9===0?'pink':'green');
 }
 for(const [x,z,s] of [[-6,-9,1.05],[6,-9,.9],[-7,-3,.85],[6,-3,.83],[-16,-8,.9],[16,-7,1],[-15,7,.7],[16,6,.7],[-6,12,.8],[7,12,.8]])tree(root,x,z,s,Math.abs(x)%2===0?'pink':'green');
 for(let i=0;i<40;i++){
  const a=rand()*Math.PI*2,r=23+rand()*.4;sphere(root,.3,.22,.3,['#75925b','#648755','#8f9f63'][i%3],Math.cos(a)*r,.48,Math.sin(a)*r*.78);
 }
 // Main gate: ticket-like signage and striped turrets, deliberately readable from above.
 for(const side of [-1,1]){cyl(root,.6,2.3,'#e4d2ae',side*3.1,1.47,19.7);cone(root,.78,1.3,'#507b7b',side*3.1,3.15,19.7);cone(root,.07,.55,'#cdb277',side*3.1,4.02,19.7);}
 textSign(root,'TBD · WONDER PARK',5.55,.66,'#e8d6a3','#304f44',0,2.75,19.8);
 box(root,6.35,.1,.16,'#cdb277',0,3.15,19.75);
 // Decorative ferris wheel behind the castle, with rotating carriages kept upright.
 const wheel=group(root,15.7,.4,-11.8);wheel.rotation.y=-.1;
 for(const side of [-1,1]){const strut=box(wheel,.18,5.5,.2,'#e9d3ae',side*1.05,2.55,.3);strut.rotation.z=side*.4;}
 const spokes=group(wheel,0,5,0);spokes.userData.dynamic=true;
 for(const z of [-.25,.25])torus(spokes,3.5,.085,'#e6c28b',0,0,z);
 const seats=[];
 for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const spoke=box(spokes,.05,7,.06,'#ecdbb8');spoke.rotation.z=a;const seat=group(spokes,Math.sin(a)*3.5,Math.cos(a)*3.5,0);rounded(seat,.65,.7,.7,.1,['#cb8d79','#94aaa0','#ddb673','#a79bbc'][i%4],0,-.32,0);cone(seat,.51,.35,'#e9d4af',0,.18,0);seats.push(seat);}
 animations.push(t=>{spokes.rotation.z=t*.065;seats.forEach(s=>s.rotation.z=-t*.065);});
 formalGardens(root);const landmark=createLandmark(root);
 foliage(root);
 return {root,animations,ready:landmark.userData.ready};
}

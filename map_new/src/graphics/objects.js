import * as THREE from 'three';
import {surfaceMaterial,worldUV} from './materials.js';
const box=(w,h,d,material,x=0,y=h/2,z=0)=>{const m=new THREE.Mesh(worldUV(new THREE.BoxGeometry(w,h,d)),material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m;};
export function parkedCar(space,index=0){
 const g=new THREE.Group(),colors=['#e3e5df','#53646b','#a7aba7','#53665e','#c6c2b7'],body=new THREE.MeshStandardMaterial({color:colors[index%colors.length],roughness:.35,metalness:.32}),glass=new THREE.MeshStandardMaterial({color:'#29404a',roughness:.18,metalness:.3}),rubber=new THREE.MeshStandardMaterial({color:'#252b29',roughness:.95});
 g.add(box(1.78,.65,4.25,body,0,.65),box(1.49,.58,2.22,glass,0,1.19,-.1),box(1.43,.09,1.8,body,0,1.51,-.1));
 for(const x of [-.9,.9])for(const z of [-1.32,1.29]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.16,12),rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.36,z);g.add(wheel);}
 const lamp=new THREE.MeshStandardMaterial({color:'#fff1cc',emissive:'#e5c990',emissiveIntensity:.12,roughness:.2});for(const x of [-.56,.56])g.add(box(.38,.13,.03,lamp,x,.76,2.14));
 const horizontal=space.width>space.depth;g.rotation.y=horizontal?Math.PI/2:0;const scale=Math.min(1,(Math.max(space.width,space.depth)-.5)/4.3,(Math.min(space.width,space.depth)-.35)/1.8);g.scale.setScalar(Math.max(.25,scale));g.position.set(space.x,.06,space.z);g.userData.kind='parked-car';g.userData.spaceId=space.id;g.userData.illustrative=true;return g;
}
export function accessibleMark(space){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#1464af';c.fillRect(0,0,256,256);c.strokeStyle='white';c.lineWidth=8;c.strokeRect(7,7,242,242);
 // Vector wheelchair mark remains legible regardless of installed emoji fonts.
 c.lineWidth=13;c.lineCap='round';c.beginPath();c.arc(102,163,48,.05,Math.PI*1.83);c.stroke();c.beginPath();c.arc(117,60,17,0,Math.PI*2);c.fillStyle='white';c.fill();c.beginPath();c.moveTo(116,91);c.lineTo(109,140);c.lineTo(164,141);c.lineTo(185,187);c.lineTo(212,177);c.moveTo(113,113);c.lineTo(162,113);c.stroke();
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(space.width,space.depth),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(space.x,.11,space.z);mesh.userData.kind='accessible-mark';return mesh;
}
export function semanticObject(data,{column='concrete',stairs='concrete'}={},materialCache){
 const g=new THREE.Group();g.position.set(data.x,data.y||0,data.z);g.userData.kind=data.kind;g.userData.objectId=data.id;g.userData.evidence=data.evidence;
 const surface=kind=>surfaceMaterial(kind==='column'?column:stairs,materialCache),steel=new THREE.MeshStandardMaterial({color:'#777f7c',roughness:.3,metalness:.75});
 if(data.kind==='column'){const main=box(data.width,data.height,data.depth,surface('column'));main.userData.surface='column';g.add(main);const stripe=box(data.width+.025,.22,data.depth+.025,new THREE.MeshStandardMaterial({color:'#d7ba53',roughness:.7}),0,1.1);g.add(stripe);}
 if(data.kind==='stairs'){
  const n=Math.ceil(data.steps/2),flight=data.width*.46,run=data.depth*.78,tread=run/n,rise=data.height/data.steps;
  for(let i=0;i<n;i++)for(const side of [-1,1]){const upper=side>0,h=rise*(upper?n+i+1:i+1),z=upper?run/2-(i+.5)*tread:-run/2+(i+.5)*tread,step=box(flight,h,tread,surface('stairs'),side*data.width*.25,h/2,z);step.userData.surface='stairs';g.add(step);}
  const landing=box(data.width,.15,data.depth*.22,surface('stairs'),0,data.height/2,data.depth*.39);landing.userData.surface='stairs';g.add(landing);
  for(const side of [-1,1]){const a=new THREE.Vector3(side*data.width*.48,.95,-run/2),b=new THREE.Vector3(side*data.width*.48,data.height/2+.95,run/2);if(side>0){a.y=data.height+.95;b.y=data.height/2+.95;}const curve=new THREE.LineCurve3(a,b),rail=new THREE.Mesh(new THREE.TubeGeometry(curve,1,.035,6,false),steel);g.add(rail);for(let i=0;i<=3;i++){const p=curve.getPoint(i/3);g.add(box(.045,.9,.045,steel,p.x,p.y-.45,p.z));}}
 }
 if(data.kind==='lift'){g.add(box(data.width,data.height,data.depth,new THREE.MeshStandardMaterial({color:'#afbab5',roughness:.7})));for(const x of [-.22,.22])g.add(box(data.width*.43,data.height*.8,.045,steel,x*data.width,data.height*.43,data.depth/2+.03));}
 if(data.kind==='door'){g.rotation.y=data.angle||0;g.add(box(data.width,data.height,.06,new THREE.MeshStandardMaterial({color:'#577a73',roughness:.55}),0,data.height/2));g.add(box(.1,.05,.09,steel,data.width*.3,1));}
 if(data.kind==='room'){g.add(box(data.width,.035,data.depth,new THREE.MeshStandardMaterial({color:'#c5c7b5',transparent:true,opacity:.35}),0,.02));}
 if(data.kind==='ramp'){
  const curve=new THREE.CatmullRomCurve3(data.path.map(p=>new THREE.Vector3(p.x-data.x,p.y,p.z-data.z))),positions=[],indices=[],left=[],right=[];
  for(let i=0;i<=32;i++){const t=i/32,p=curve.getPoint(t),d=curve.getTangent(t),l=Math.hypot(d.x,d.z),nx=-d.z/l*data.width/2,nz=d.x/l*data.width/2;positions.push(p.x+nx,p.y,p.z+nz,p.x-nx,p.y,p.z-nz);left.push(new THREE.Vector3(p.x+nx,p.y+.8,p.z+nz));right.push(new THREE.Vector3(p.x-nx,p.y+.8,p.z-nz));if(i<32){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const mat=surface('stairs').clone();mat.side=THREE.DoubleSide;const ramp=new THREE.Mesh(worldUV(geo),mat);ramp.userData.surface='stairs';ramp.userData.doubleSide=true;ramp.receiveShadow=true;g.add(ramp);for(const points of [left,right])g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.06,6,false),steel));
 }
 return g;
}

import * as THREE from 'three';
import {box,rounded,sphere,cyl,cone,torus,group,material,texture,arch,textSign,palette} from './materials.js';
export function createCastle(parent){
 const root=group(parent,0,0,-7);const stone=new THREE.MeshStandardMaterial({color:'#fff6df',map:texture('stone'),roughness:.84});
 const roof=new THREE.MeshStandardMaterial({color:'#d4eff1',map:texture('roof'),roughness:.48,metalness:.13});
 const ivory='#ecddc3',pink='#d89591',gold=material('#d8b562',{metalness:.6,roughness:.3}),dark='#355967';
 rounded(root,11,.55,7,.35,stone,0,.38,0);rounded(root,10,.28,6.4,.2,ivory,0,.78,0);
 // Layered central keep, rose-colored walls, and carved masonry buttresses.
 box(root,5.4,4.8,3.8,stone,0,3.05,0);box(root,3.7,3.7,2.7,pink,0,6.05,-.45);
 box(root,4,.25,3,ivory,0,7.85,-.45);box(root,4.4,.2,3.3,gold,0,7.98,-.45);
 const highRoof=cone(root,3.1,3.2,roof,0,9.55,-.45);highRoof.scale.z=.8;highRoof.rotation.y=Math.PI/4;
 box(root,6,.23,4.2,ivory,0,5.55,0);box(root,6.15,.12,4.32,gold,0,5.72,0);
 for(const x of [-2.5,-1.25,1.25,2.5]){box(root,.23,4.8,.45,ivory,x,3.15,2.03);cone(root,.25,1,gold,x,6,2.03);}
 for(const x of [-1.9,0,1.9]){
  arch(root,.75,1.5,.08,ivory,x,3.6,1.94);arch(root,.48,1.2,.05,dark,x,3.75,2.035);
  box(root,.045,1.15,.03,gold,x,4.31,2.10);box(root,.47,.05,.03,gold,x,4.3,2.10);
 }
 arch(root,2.2,2.85,.1,ivory,0,.75,2.0);arch(root,1.7,2.55,.06,dark,0,.75,2.13);
 for(const x of [-.62,-.31,0,.31,.62])box(root,.035,2.2,.04,gold,x,1.85,2.2);
 box(root,2.1,.09,.09,gold,0,2.35,2.2);
 // Small Gothic windows on the tall keep.
 for(const x of [-1.12,0,1.12]){arch(root,.58,1.3,.06,ivory,x,6.05,.94);arch(root,.35,1.06,.06,dark,x,6.15,1.015);}
 function tower(x,z,r,h,roofH,rose=false){
  const g=group(root,x,0,z);cyl(g,r*1.11,.32,stone,0,.9,0);cyl(g,r,h,rose?pink:stone,0,.85+h/2,0);
  for(const yy of [1.05,h*.56+.85,h+.8]){cyl(g,r*1.09,.15,ivory,0,yy,0);cyl(g,r*1.13,.075,gold,0,yy+.075,0);}
  cyl(g,r*1.18,.37,ivory,0,h+.9,0);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2;box(g,.16,.34,.18,ivory,Math.sin(a)*r*1.13,h+1.12,Math.cos(a)*r*1.13);}
  cone(g,r*1.38,roofH,roof,0,h+1.16+roofH/2,0);cyl(g,r*1.4,.10,gold,0,h+1.17,0);
  cone(g,.085,.85,gold,0,h+roofH+1.48,0);sphere(g,.09,.09,.09,gold,0,h+roofH+1.77,0);
  for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){const w=group(g,Math.sin(a)*(r+.012),h*.63+.7,Math.cos(a)*(r+.012));w.rotation.y=a;arch(w,r*.62,Math.min(1.3,h*.3),.06,ivory,0,0,0);arch(w,r*.40,Math.min(1.08,h*.23),.04,dark,0,.08,.068);}
  return g;
 }
 tower(-4.25,2.1,.91,3.9,2.4);tower(4.25,2.1,.91,4.2,2.55);tower(-4,-2.05,1.0,5.8,3.0,true);tower(4,-2,1,6.1,2.9,true);
 tower(-2.5,-1.9,.64,8.2,2.75,true);tower(2.3,-1.7,.64,8.9,2.9,true);tower(0,-1.2,.85,10.7,3.3,true);
 tower(-1.4,1.1,.42,6.7,2);tower(1.4,1.1,.42,6.6,2);tower(-3.35,.45,.4,5.25,1.8);tower(3.35,.45,.4,5.4,1.9);
 for(const side of [-1,1]){
  box(root,1.75,2.3,.55,stone,side*3.25,2,2.15);box(root,1.85,.13,.75,ivory,side*3.25,3.2,2.15);
  for(let i=0;i<5;i++)box(root,.24,.36,.74,ivory,side*3.25-.72+i*.36,3.42,2.15);
 }
 const clock=group(root,0,5.85,2.3);const ring=torus(clock,.41,.045,gold);cyl(clock,.37,.035,ivory).rotation.x=Math.PI/2;
 box(clock,.025,.25,.025,dark,0,.1,.04);const hand=box(clock,.18,.024,.025,dark,.08,0,.04);hand.rotation.z=.4;
 const bridge=rounded(root,3.2,.28,3.8,.12,ivory,0,.83,4);for(let i=0;i<4;i++)box(root,3.2,.13,.6,stone,0,.73-i*.13,5.5+i*.45);
 for(const side of [-1,1])for(let i=0;i<5;i++){cyl(root,.065,.55,gold,side*1.42,1.18,2.65+i*.58);sphere(root,.09,.09,.09,ivory,side*1.42,1.48,2.65+i*.58);}
 textSign(root,'WONDER CASTLE',3.1,.44,'#6b5940','#f4e9d0',0,3.33,2.26);
 // Tiny pennants at the highest spires.
 for(const [x,y,z] of [[0,15.2,-1.2],[-2.5,12.3,-1.9],[2.3,13.1,-1.7]]){
  cyl(root,.027,1.1,gold,x,y,z);const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.7,-.2);shape.lineTo(0,-.42);shape.closePath();meshFlag(shape,x,y+.5,z);
 }
 function meshFlag(shape,x,y,z){const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),material('#d57e82',{side:THREE.DoubleSide}));m.position.set(x,y,z);root.add(m);}
 return root;
}

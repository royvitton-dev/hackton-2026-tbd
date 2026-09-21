import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from '../core/race';
import type { Track } from '../core/types';
import { box, cylinder, mesh, sphere, textTexture } from './models';
import { createSponsorVenue, sponsorLots, VENUE_KINDS } from './sponsorVenues';

export const WORLD_SCALE = 2.8, ROAD_HALF_WIDTH = 8.8, LANE_SCALE = 3.1;
const palettes: Record<string, string[]> = {
  roastery: ['#5fbcf1','#d8f4ff','#58b843','#586778','#f1473d','#55a95b','#79bbaa'],
  coast: ['#38bdf1','#c6f5f5','#f3cd7b','#ad9c83','#20bad0','#79b784','#80c8c6'],
  forest: ['#6bb9d0','#c7e8c9','#32905b','#79886c','#ffcb3c','#287651','#76ada0'],
  city: ['#222a61','#877cc2','#3b4875','#35465d','#df5bfa','#525b97','#6e72a4'],
  snow: ['#69bce8','#eefaff','#ecf6fa','#b6d8ec','#5b9dd9','#cbdfea','#9abbd5'],
  volcano: ['#713d56','#efab77','#784b3e','#5e555b','#ff8c23','#623b3b','#976654'],
};
export function themeFor(track: Track) {
  const [sky,horizon,grass,road,curb,hill,mountain]=palettes[track.id] || palettes.roastery;
  return {sky,horizon,grass,road,curb,hill,mountain};
}

// Bake static scenery by material so a forest does not cost hundreds of draw calls.
export function bakeStatic(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const rootInverse=group.matrixWorld.clone().invert();
  const batches = new Map<string,{ material: THREE.Material; geometries: THREE.BufferGeometry[]; shadow: boolean }>();
  group.traverse(object=>{
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const key=object.material.uuid+Boolean(object.geometry.index)+Object.keys(object.geometry.attributes).sort().join();
    const batch=batches.get(key) || {material:object.material,geometries:[] as THREE.BufferGeometry[],shadow:false};
    batch.geometries.push(object.geometry.clone().applyMatrix4(rootInverse.clone().multiply(object.matrixWorld)));
    batch.shadow ||= object.castShadow; batches.set(key,batch); object.geometry.dispose();
  });
  group.clear();
  for (const batch of batches.values()) {
    const geometry=mergeGeometries(batch.geometries);batch.geometries.forEach(g=>g.dispose());
    if(geometry){const object=new THREE.Mesh(geometry,batch.material);object.castShadow=batch.shadow;object.receiveShadow=true;group.add(object);}
  }
}

export function createSky(track: Track) {
  const theme=themeFor(track);
  return new THREE.Mesh(new THREE.SphereGeometry(900,24,16),new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{zenith:{value:new THREE.Color(theme.sky)},horizon:{value:new THREE.Color(theme.horizon)}},
    vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec3 direction; uniform vec3 zenith; uniform vec3 horizon; void main(){float h=pow(max(0.0,normalize(direction).y),0.55);gl_FragColor=vec4(mix(horizon,zenith,h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  }));
}

export function roadTexture(track: Track) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d')!,random=seededRandom(track.level*679);ctx.fillStyle=themeFor(track).road;ctx.fillRect(0,0,256,256);
  for(let i=0;i<15000;i++){ctx.fillStyle=i%2?'rgba(255,255,255,.08)':'rgba(0,0,0,.10)';ctx.fillRect(random()*256,random()*256,1+random()*2,1+random()*2);}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;return texture;
}

function tree(track: Track,x:number,z:number,size:number) {
  const group=new THREE.Group();group.position.set(x,0,z);group.scale.setScalar(size);
  group.add(cylinder(.4,.65,4,'#94664a',0,2,0));
  if(track.id==='forest'||track.id==='snow')for(let i=0;i<3;i++)group.add(mesh(new THREE.ConeGeometry(3-i*.6,4.8,9),track.id==='snow'?'#f5fbff':['#287849','#398e51','#61ab5d'][i],0,4+i*1.7,0));
  else if(track.id==='coast')for(let i=0;i<7;i++){const leaf=sphere(2,'#4eab57',Math.sin(i)*2,5.5,Math.cos(i)*2);leaf.scale.set(.55,.18,1.8);leaf.rotation.y=i;group.add(leaf);}
  else {group.add(mesh(new THREE.IcosahedronGeometry(3.5,2),'#54ad40',0,5.2,0));group.add(mesh(new THREE.IcosahedronGeometry(2.6,2),'#78c64d',2,4.9,1));}
  return group;
}

export function sign(text: string,accent: string,width=13,height=3) {
  const group=new THREE.Group();for(const side of [-1,1])group.add(cylinder(.15,.2,4,'#ecf0df',side*(width/2-1),2,0));
  group.add(box(width+.3,height+.3,.35,'#ffffff',0,4,0));
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map:textTexture(text,accent,'#fffdf1'),side:THREE.DoubleSide}));face.position.set(0,4,.19);group.add(face);return group;
}

export function addLandscape(group:THREE.Group,track:Track,curve:THREE.CatmullRomCurve3) {
  const theme=themeFor(track),random=seededRandom(track.level*413);
  const terrain=mesh(new THREE.PlaneGeometry(1800,1800),theme.grass,0,-.4,0);terrain.rotation.x=-Math.PI/2;terrain.castShadow=false;group.add(terrain);
  for(let i=0;i<34;i++){
    const angle=i/34*Math.PI*2,radius=175+random()*120,h=25+random()*70;
    const hill=mesh(new THREE.SphereGeometry(1,16,12),i%2?theme.hill:theme.mountain,Math.sin(angle)*radius,h*.15-5,Math.cos(angle)*radius);hill.scale.set(40+random()*45,h,40+random()*35);group.add(hill);
    if(track.id==='snow'){const cap=mesh(new THREE.ConeGeometry(19,h*.6,10),'#f8fcff',hill.position.x,h*.9,hill.position.z);group.add(cap);}
  }
  for(let i=0;i<24;i++){
    const a=random()*Math.PI*2,r=260+random()*200,y=65+random()*55;
    for(let j=0;j<4;j++){const cloud=mesh(new THREE.SphereGeometry(1,12,8),track.id==='city'?'#acb6d7':'#ffffff',Math.sin(a)*r+j*9,y+(j%2)*4,Math.cos(a)*r);cloud.scale.set(12,6+random()*5,8);cloud.castShadow=false;group.add(cloud);}
  }
  const points=curve.getSpacedPoints(220),lots=sponsorLots(curve);
  for(let i=0;i<300;i++){
    const x=(random()-.5)*320,z=(random()-.5)*260;
    if(Math.hypot(x,z)<29||points.some(p=>Math.hypot(x-p.x,z-p.z)<15)||lots.some(lot=>Math.hypot(x-lot.position.x,z-lot.position.z)<16))continue;
    if(track.id==='city'){
      const h=12+random()*45;group.add(box(8,h,8,['#49568a','#6571aa','#806ca7'][i%3],x,h/2,z));
      for(let y=3;y<h;y+=4)for(const offset of [-2,2])group.add(box(1.3,1.6,.05,i%2?'#ffe093':'#79e6f6',x+offset,y,z+4.03));
    }else if(track.id==='volcano'){const rock=mesh(new THREE.DodecahedronGeometry(2+random()*5,1),'#61434b',x,2,z);rock.scale.y=1.8;group.add(rock);}
    else group.add(tree(track,x,z,.8+random()*1.5));
  }
  if(!['city','snow','volcano'].includes(track.id))for(let i=0;i<180;i++){
    const p=curve.getPointAt(random()),t=curve.getTangentAt(i/180),n=new THREE.Vector3(-t.z,0,t.x);p.addScaledVector(n,(13+random()*7)*(i%2?1:-1));
    group.add(mesh(new THREE.IcosahedronGeometry(.3,0),['#ffdc45','#fff9ee','#ff92a1'][i%3],p.x,.4,p.z));
  }
  if(track.id==='coast'||track.id==='volcano'){
    const water=mesh(new THREE.PlaneGeometry(600,1800),track.id==='coast'?'#21bfd7':'#ff762f',-450,-.15,0);water.rotation.x=-Math.PI/2;water.castShadow=false;group.add(water);
  }
  const venueKind=VENUE_KINDS[track.id];
  lots.forEach(lot=>{
    const venue=createSponsorVenue(venueKind,lot.sponsor,lot.index);venue.position.copy(lot.position);venue.rotation.y=lot.rotation;group.add(venue);
  });
  group.userData.sponsors=lots.map(lot=>lot.sponsor.name);
  group.userData.sponsorVenue=venueKind;
  const cafe=new THREE.Group();cafe.position.set(-6,0,-2);
  cafe.add(box(24,13,15,'#ffedbb',0,6.5,0));cafe.add(box(25,1,16,'#e2664a',0,13,0));
  for(const x of [-9,9]){
    cafe.add(cylinder(4,4.3,19,'#ffe8b7',x,9.5,-4));cafe.add(mesh(new THREE.ConeGeometry(5,8,16),'#ea6948',x,23,-4));cafe.add(cylinder(.1,.1,4,'#fff2d3',x,28,-4));cafe.add(box(2.5,1.6,.03,theme.curb,x+1.2,29,-4));
  }
  for(const x of [-8,0,8])cafe.add(box(5,6,.12,'#3e888c',x,5,7.6));
  for(let i=0;i<16;i++){const awning=box(1.55,.3,4,i%2?'#fffce3':theme.curb,-11.6+i*1.55,9.5,8.5);awning.rotation.x=.12;cafe.add(awning);}
  const title=sign('BREW COFFEE',theme.curb,19,2.8);title.position.set(0,7.5,7.9);cafe.add(title);group.add(cafe);
  const cup=new THREE.Group();cup.position.set(23,0,-1);cup.rotation.z=-.12;cup.add(cylinder(4,3.2,10,'#fff2cf',0,5.5,0));cup.add(cylinder(4.3,4.3,.9,'#3f6150',0,11,0));cup.add(cylinder(3.75,3.6,3.6,'#f38540',0,6,0));
  const label=new THREE.Mesh(new THREE.PlaneGeometry(5,2),new THREE.MeshStandardMaterial({map:textTexture('BREW','#f38540','#fff4d6')}));label.position.set(0,6,3.85);cup.add(label);group.add(cup);
}

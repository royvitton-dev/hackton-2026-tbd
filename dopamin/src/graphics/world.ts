import * as THREE from 'three';
import type { Track } from '../core/types';
import { box, cylinder, textTexture } from './models';
import { addLandscape, bakeStatic, roadTexture, sign, themeFor, ROAD_HALF_WIDTH as W, WORLD_SCALE } from './scenery';

export function trackCurve(track: Track) { return new THREE.CatmullRomCurve3(track.points.map(p=>new THREE.Vector3(p[0]*WORLD_SCALE,p[1]*1.7+.12,p[2]*WORLD_SCALE)),true,'catmullrom',.35); }
function ribbon(curve:THREE.CatmullRomCurve3,inside:number,outside:number,segments=420){
  const positions:number[]=[],indices:number[]=[],uv:number[]=[];
  for(let i=0;i<=segments;i++){
    const p=curve.getPointAt(i/segments),t=curve.getTangentAt(i/segments),n=new THREE.Vector3(-t.z,0,t.x).normalize();
    for(const [j,offset]of [inside,outside].entries()){positions.push(p.x+n.x*offset,p.y+.05,p.z+n.z*offset);uv.push(j*3,i/segments*65);}
    if(i<segments){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createWorld(track:Track){
  const world=new THREE.Group(),curve=trackCurve(track),theme=themeFor(track);addLandscape(world,track,curve);
  const road=new THREE.Mesh(ribbon(curve,-W,W),new THREE.MeshStandardMaterial({map:roadTexture(track),roughness:.9,side:THREE.DoubleSide}));road.receiveShadow=true;world.add(road);
  for(const side of [-1,1]){
    const geom=ribbon(curve,side*W,side*(W+.8));const colors:number[]=[];
    for(let i=0;i<=420;i++){const color=new THREE.Color(Math.floor(i/4)%2?'#fff9e8':theme.curb);for(let j=0;j<2;j++)colors.push(color.r,color.g,color.b);}
    geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));const curb=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide}));curb.position.y=.045;world.add(curb);
    const line=new THREE.Mesh(ribbon(curve,side*(W-.48),side*(W-.30)),new THREE.MeshStandardMaterial({color:'#fff8db',side:THREE.DoubleSide}));line.position.y=.035;world.add(line);
    for(let i=0;i<120;i++){
      const t=i/120,p=curve.getPointAt(t),tan=curve.getTangentAt(t),n=new THREE.Vector3(-tan.z,0,tan.x).normalize();p.addScaledVector(n,side*(W+2));
      const rail=new THREE.Group();rail.position.copy(p);rail.rotation.y=Math.atan2(tan.x,tan.z);rail.add(cylinder(.12,.16,1.9,'#e1e8e2',0,.9,0));rail.add(box(.20,.38,curve.getLength()/120+1,i%3===0?theme.curb:'#e6f2eb',0,1.5,0));world.add(rail);
      if(i%12===0){rail.add(cylinder(.08,.12,6,'#fffdf0',0,3,0));rail.add(box(1.6,2.4,.035,theme.curb,side*.75,5,0));}
      if(i%18===5){const arrow=sign('>>>',theme.curb,4,1.3);arrow.position.copy(p).addScaledVector(n,side*1.5);arrow.rotation.y=rail.rotation.y+Math.PI/2;world.add(arrow);}
    }
  }
  for(let i=0;i<100;i++){const p=curve.getPointAt(i/100),tan=curve.getTangentAt(i/100),dash=box(.16,.025,2,'#e6e7d9',p.x,p.y+.085,p.z);dash.rotation.y=Math.atan2(tan.x,tan.z);world.add(dash);}
  const gate=new THREE.Group(),p=curve.getPointAt(0),tan=curve.getTangentAt(0);gate.position.copy(p);gate.rotation.y=Math.atan2(tan.x,tan.z);
  for(const side of [-1,1]){gate.add(cylinder(.28,.45,10.5,'#f9edd0',side*(W+1),5.2,0));gate.add(box(1.2,2,1.2,theme.curb,side*(W+1),.9,0));}
  gate.add(box(W*2+3,2.2,.7,theme.curb,0,10.5,0));
  for(const z of [-.36,.36]){const face=new THREE.Mesh(new THREE.PlaneGeometry(W*2+1,1.6),new THREE.MeshStandardMaterial({map:textTexture('BREW GRAND PRIX',theme.curb,'#fff9dc')}));face.position.set(0,10.5,z);if(z<0)face.rotation.y=Math.PI;gate.add(face);}
  for(const z of [-.37,.37]){const partner=new THREE.Mesh(new THREE.PlaneGeometry(W*2+1,.9),new THREE.MeshBasicMaterial({map:textTexture('52G  ·  2026 해커톤','#103d48','#e7fa91',1024,128)}));partner.position.set(0,9.05,z);if(z<0)partner.rotation.y=Math.PI;gate.add(partner);}
  for(let i=0;i<24;i++)for(let j=0;j<3;j++)gate.add(box(W*2/24,.04,.7,(i+j)%2?'#fffdf1':'#263443',-W+(i+.5)*W*2/24,.12,j*.7));world.add(gate);
  bakeStatic(world);
  const pickups:THREE.Group[]=[],coinGroups:THREE.Group[]=[];
  const cubeMat=new THREE.MeshStandardMaterial({color:'#56d8ff',emissive:'#1493cf',emissiveIntensity:.45,metalness:.25,roughness:.15,transparent:true,opacity:.78});
  const question=new THREE.MeshBasicMaterial({map:textTexture('?','#38bfe7','#ffffff',128,128),transparent:true,opacity:.9});
  for(const t of [.16,.39,.64,.85])for(const lane of [-5,0,5]){
    const p=curve.getPointAt(t),tan=curve.getTangentAt(t),group=new THREE.Group();group.position.copy(p).addScaledVector(new THREE.Vector3(-tan.z,0,tan.x),lane);group.position.y+=2;group.userData.baseY=group.position.y;
    const cube=new THREE.Mesh(new THREE.BoxGeometry(1.55,1.55,1.55),cubeMat);cube.castShadow=true;group.add(cube);
    for(let i=0;i<4;i++){const face=new THREE.Mesh(new THREE.PlaneGeometry(1.16,1.16),question);face.rotation.y=i*Math.PI/2;face.position.set(Math.sin(face.rotation.y)*.784,0,Math.cos(face.rotation.y)*.784);group.add(face);}
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry),new THREE.LineBasicMaterial({color:'#c4ffff'}));group.add(edges);world.add(group);pickups.push(group);
  }
  for(let i=0;i<22;i++){
    const p=curve.getPointAt((i+.5)/22),coin=new THREE.Group();coin.position.copy(p);coin.position.y+=1.3;
    const disk=cylinder(.55,.55,.16,'#ffcf31');disk.rotation.x=Math.PI/2;coin.add(disk);const inset=cylinder(.39,.39,.18,'#ffe876');inset.rotation.x=Math.PI/2;coin.add(inset);coin.userData.baseY=coin.position.y;world.add(coin);coinGroups.push(coin);
  }
  return {world,curve,pickups,coinGroups};
}

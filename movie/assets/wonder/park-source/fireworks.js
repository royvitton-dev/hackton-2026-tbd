import * as THREE from 'three';
import {fireworkPhase} from '../lib/globe.mjs';
import {group,seeded} from './materials.js';

export function createFireworks(parent){
 const root=group(parent,0,0,-1);root.name='Castle fireworks';root.userData.dynamic=true;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d');
 const glow=ctx.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'#fff');glow.addColorStop(.18,'#fff');glow.addColorStop(.5,'#ffffff88');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(0,0,32,32);
 const texture=new THREE.CanvasTexture(canvas),rand=seeded(1908),count=100,trails=5;
 const colors=['#ffd28c','#ed96ce','#86dbff','#b6eea5','#c9b0ff'];
 const bursts=colors.map((color,index)=>{
  const positions=new Float32Array(count*trails*3),tints=new Float32Array(count*trails*3),directions=[];
  const c=new THREE.Color(color).multiplyScalar(1.35);
  for(let i=0;i<count;i++){
   const y=1-2*(i+.5)/count,a=i*2.3999632297,r=Math.sqrt(1-y*y),speed=3.3+rand()*.85;
   directions.push(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r).multiplyScalar(speed));
   for(let j=0;j<trails;j++)c.clone().multiplyScalar(1-j/trails*.84).toArray(tints,(i*trails+j)*3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(tints,3));
  const material=new THREE.PointsMaterial({map:texture,vertexColors:true,size:.6,transparent:true,opacity:1,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;root.add(points);
  return {points,positions,directions,center:new THREE.Vector3((index-2)*3.4,14.8+(index%2)*2.1,(index%3-1)*2.3)};
 });
 function animate(time){
  root.userData.time=time;let visible=0;
  bursts.forEach((burst,index)=>{
   const phase=fireworkPhase(time,index);burst.points.visible=phase.stage!=='rest';burst.points.material.opacity=phase.opacity;
   if(!burst.points.visible)return;visible++;
   for(let i=0;i<count;i++)for(let trail=0;trail<trails;trail++){
    const n=(i*trails+trail)*3;
    if(phase.stage==='launch'){
     const t=Math.max(0,phase.progress-trail*.04-i*.0005);
     burst.positions[n]=burst.center.x*.35+(burst.center.x*.65)*t;
     burst.positions[n+1]=7+(burst.center.y-7)*t;
     burst.positions[n+2]=burst.center.z;
    }else{
     const t=Math.max(0,phase.progress*2.1-trail*.065),d=burst.directions[i],spread=1-Math.exp(-t*1.5);
     burst.positions[n]=burst.center.x+d.x*spread;
     burst.positions[n+1]=burst.center.y+d.y*spread-t*t*.72;
     burst.positions[n+2]=burst.center.z+d.z*spread;
    }
   }
   burst.points.geometry.attributes.position.needsUpdate=true;
  });root.userData.activeBursts=visible;
 }
 animate(6);return {root,animate};
}

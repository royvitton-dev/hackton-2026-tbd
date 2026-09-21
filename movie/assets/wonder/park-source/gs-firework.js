import * as THREE from 'three';
import {gsFireworkPhase} from '../lib/globe.mjs';
import {seeded} from './materials.js';

export function createGSFirework(texture){
 // Sample the letter strokes once. Only glowing particles are rendered, never a text plane.
 const mask=document.createElement('canvas');mask.width=512;mask.height=256;
 const ctx=mask.getContext('2d');ctx.fillStyle='#fff';ctx.font='900 220px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('GS',256,137);
 const pixels=ctx.getImageData(0,0,512,256).data,rand=seeded(712),sparks=[],trails=4;
 for(let y=14;y<242;y+=7)for(let x=14;x<498;x+=7){
  if(pixels[(y*512+x)*4+3]<180)continue;
  sparks.push({x:(x-256)*.032+(rand()-.5)*.12,y:(128-y)*.032+(rand()-.5)*.12,z:(rand()-.5)*.13,
   dx:(rand()-.5)*2.8,dy:rand()*.5,dz:(rand()-.5)*2,phase:rand()*Math.PI*2,
   color:new THREE.Color(x<255?'#ffd38a':'#83dcff').multiplyScalar(1.45)});
 }
 const positions=new Float32Array(sparks.length*trails*3),colors=new Float32Array(positions.length);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
 const material=new THREE.PointsMaterial({map:texture,vertexColors:true,size:.34,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 const points=new THREE.Points(geometry,material);points.name='GS spark firework';points.frustumCulled=false;points.position.set(0,19.1,0);points.userData.pattern='GS';
 const parentRotation=new THREE.Quaternion(),cameraRotation=new THREE.Quaternion();
 function faceCamera(camera){
  if(!camera||!points.parent)return;
  points.parent.getWorldQuaternion(parentRotation).invert();camera.getWorldQuaternion(cameraRotation);
  points.quaternion.copy(parentRotation).multiply(cameraRotation);
 }
 function animate(time){
  const phase=gsFireworkPhase(time);points.userData.stage=phase.stage;points.userData.progress=phase.progress;
  points.visible=phase.stage!=='rest';material.opacity=phase.opacity;
  if(!points.visible)return;
  const form=phase.stage==='form'?1-Math.pow(1-phase.progress,3):1,fall=phase.stage==='fade'?phase.progress:0;
  points.position.y=phase.stage==='launch'?7+12.1*(1-Math.pow(1-phase.progress,2)):19.1;
  material.size=phase.stage==='launch'?.24:.34;
  for(let i=0;i<sparks.length;i++){
   const spark=sparks[i],flicker=.82+.18*Math.sin(time*12+spark.phase);
   for(let trail=0;trail<trails;trail++){
    const n=(i*trails+trail)*3,tail=trail*.065;
    if(phase.stage==='launch'){
     positions[n]=spark.dx*.035;positions[n+1]=-tail*3-(i%8)*.055;positions[n+2]=spark.dz*.035;
    }else{
     const spread=phase.stage==='form'?Math.sin(phase.progress*Math.PI)*(1-form):0;
     positions[n]=spark.x*form+spark.dx*(spread+fall*.8)-spark.dx*tail*fall;
     positions[n+1]=spark.y*form+spark.dy*spread+Math.sin(time*4+spark.phase)*.012-fall*fall*2.4-tail*(.45+fall*2);
     positions[n+2]=spark.z+spark.dz*(spread+fall*.65);
    }
    const brightness=flicker*(1-trail/trails*.9);
    colors[n]=spark.color.r*brightness;colors[n+1]=spark.color.g*brightness;colors[n+2]=spark.color.b*brightness;
   }
  }
  geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
 }
 return {pattern:'GS',points,animate,faceCamera};
}

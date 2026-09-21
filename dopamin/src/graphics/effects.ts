import * as THREE from 'three';
import { sampleRace } from '../core/race';
import { burstParticle, EFFECT_COLORS, FLIGHT_TIME, visualEvents } from '../core/presentation';
import type { CarState, RaceLog } from '../core/types';
import { LANE_SCALE } from './scenery';

export function carPosition(curve:THREE.CatmullRomCurve3,car:CarState){
  const t=((car.progress%1)+1)%1,p=curve.getPointAt(t),v=curve.getTangentAt(t);
  return p.addScaledVector(new THREE.Vector3(-v.z,0,v.x).normalize(),car.lane*LANE_SCALE);
}
const dummy=new THREE.Object3D(), color=new THREE.Color();
export class RaceEffects {
  group=new THREE.Group();
  private particles:THREE.InstancedMesh;
  private rings:THREE.Mesh[]=[];
  private cores:THREE.Mesh[]=[];
  private bolts:THREE.Mesh[]=[];
  count=0;
  constructor(){
    this.particles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}),1000);
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particles.frustumCulled=false;this.group.add(this.particles);
    for(let i=0;i<12;i++){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.07,6,56),new THREE.MeshBasicMaterial({color:'#ffdd55',transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));this.rings.push(ring);this.group.add(ring);
      const core=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:'#fff5b4',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));this.cores.push(core);this.group.add(core);
    }
    for(let i=0;i<48;i++){const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1,6),new THREE.MeshBasicMaterial({color:'#d8aaff',toneMapped:false}));this.bolts.push(bolt);this.group.add(bolt);}
  }
  private particle(position:THREE.Vector3,size:number,tint:string,stretch=1,rotation=0){
    if(this.count>=1000||size<=0)return;
    dummy.position.copy(position);dummy.scale.set(size,size*stretch,size);dummy.rotation.set(rotation,rotation*.6,rotation*.3);dummy.updateMatrix();
    this.particles.setMatrixAt(this.count,dummy.matrix);this.particles.setColorAt(this.count,color.set(tint));this.count++;
  }
  update(log:RaceLog|null,time:number,curve:THREE.CatmullRomCurve3){
    this.count=0;this.rings.forEach(m=>m.visible=false);this.cores.forEach(m=>m.visible=false);this.bolts.forEach(m=>m.visible=false);
    if(!log){this.particles.count=0;return;}
    const events=visualEvents(log),snapshot=sampleRace(log,time);let slot=0,boltSlot=0;
    const at=(id:string,t:number)=>{const car=sampleRace(log,Math.min(log.duration,Math.max(0,t))).cars.find(c=>c.id===id)!;return carPosition(curve,car).add(new THREE.Vector3(0,1.15,0));};
    for(const event of events){
      const age=time-event.time;if(age<0||age>1.65||!event.item)continue;
      const tint=EFFECT_COLORS[event.item];
      if(event.type==='launch'&&event.target){
        const flight=FLIGHT_TIME[event.item as keyof typeof FLIGHT_TIME];if(age>flight)continue;
        const start=at(event.actor,event.time),end=at(event.target,event.time+flight),u=Math.min(1,age/flight);
        const point=(v:number)=>start.clone().lerp(end,v).add(new THREE.Vector3(0,Math.sin(v*Math.PI)*(event.item==='storm'?12:2.8),0));
        this.particle(point(u),event.item==='ice'?.65:.5,tint,1.5,time*18);
        this.particle(point(u),.23,'#ffffff',1.6,time*9);
        for(let j=1;j<25;j++){const v=Math.max(0,u-j*.012),p=point(v),size=(1-j/26)*.26;this.particle(p,size,j%3===0?'#ffffff':tint,1.25,time+j);}
        // Muzzle flash and recoil sparks at the firing kart.
        if(age<.28)for(let j=0;j<18;j++){const b=burstParticle(event.time*100,j,age);this.particle(start.clone().add(new THREE.Vector3(b.x,b.y,b.z)),.15*b.scale,tint,2,b.rotation);}
      }
      if((event.type==='hit'||event.type==='blocked')&&event.target){
        // Carry the impact cloud with the kart so shards remain visible in its cockpit view.
        const victim=snapshot.cars.find(c=>c.id===event.target)!;
        const p=at(event.target,time).addScaledVector(curve.getTangentAt((victim.progress%1+1)%1),2.4),blocked=event.type==='blocked',shade=blocked?'#8dffff':tint;
        if(slot<12){
          const ring=this.rings[slot],core=this.cores[slot];ring.visible=true;ring.position.copy(p);ring.rotation.set(Math.PI/2,0,event.time);ring.scale.setScalar(1+age*10);(ring.material as THREE.MeshBasicMaterial).color.set(shade);(ring.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.9-age*.75);
          core.visible=age<.32;core.position.copy(p);core.scale.setScalar(.7+age*9);(core.material as THREE.MeshBasicMaterial).color.set(shade);(core.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.7-age*2.2);slot++;
        }
        for(let j=0;j<(blocked?35:90);j++){
          const b=burstParticle(event.time*100,j,age),size=b.scale*(event.item==='ice'?.26:.17);
          this.particle(p.clone().add(new THREE.Vector3(b.x,b.y,b.z)),size,j%6===0?'#ffffff':shade,event.item==='ice'?2.5:1.5,b.rotation);
        }
        if(event.item==='storm'&&age<.65)for(let branch=0;branch<3;branch++)for(let j=0;j<8&&boltSlot<48;j++){
          const flicker=Math.floor(age*15),a=p.clone().add(new THREE.Vector3(Math.sin(j*17+flicker+branch)*1.6,20-j*2.5,Math.cos(j*11+branch)*1.3));
          const b=p.clone().add(new THREE.Vector3(Math.sin((j+1)*17+flicker+branch)*1.6,20-(j+1)*2.5,Math.cos((j+1)*11+branch)*1.3));
          const bolt=this.bolts[boltSlot++],direction=b.clone().sub(a);bolt.visible=true;bolt.position.copy(a).add(b).multiplyScalar(.5);bolt.scale.set(1,direction.length(),1);bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
        }
      }
    }
    for(const car of snapshot.cars){
      if(car.finish!==null)continue;
      const t=(car.progress%1+1)%1,p=carPosition(curve,car),tan=curve.getTangentAt(t),n=new THREE.Vector3(-tan.z,0,tan.x);
      const next=curve.getTangentAt((t+.007)%1),bend=tan.clone().cross(next).y;
      // Twin exhaust flames, wheel sparks, and road dust stay attached to moving cars.
      for(const side of [-1,1]){
        if(car.effect==='boost')for(let i=0;i<20;i++){
          const trail=p.clone().addScaledVector(tan,-1.8-i*.24).addScaledVector(n,side*.58);trail.y+=.55+Math.sin(time*20+i)*.1;
          this.particle(trail,(1-i/22)*.28,i<5?'#fff8c8':i<12?'#ffdc43':'#ff742b',1.1,time+i);
        }
        if(Math.abs(bend)>.035&&car.speed>12)for(let i=0;i<12;i++){
          const a=((time*3+i/12)%1),q=p.clone().addScaledVector(tan,-1-a*3).addScaledVector(n,side*(1+a*.6));q.y+=.12+Math.sin(a*Math.PI)*.5;
          this.particle(q,(1-a)*.09,Math.abs(bend)>.1?'#ffbb27':'#6eeaff',2,time*8+i);
        }
        for(let i=0;i<4;i++){const a=(time*1.5+i/4)%1,q=p.clone().addScaledVector(tan,-1.5-a*2.5).addScaledVector(n,side*1.05);q.y+=a*.55;this.particle(q,(1-a)*.15,'#c6c3b2',.6,time+i);}
      }
    }
    this.particles.count=this.count;this.particles.instanceMatrix.needsUpdate=true;if(this.particles.instanceColor)this.particles.instanceColor.needsUpdate=true;
  }
}

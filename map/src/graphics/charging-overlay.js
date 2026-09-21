import * as THREE from 'three';
import {signalAt,signalColor} from '../core/charging.js';

export class ChargingOverlay {
 constructor(scene){this.scene=scene;this.root=new THREE.Group();scene.scene.add(this.root);}
 clear(){this.root.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});this.root.clear();}
 draw(plan,survey,result,{signal=true,wiring=true,selectedId,operator}={}){
  this.clear();
  const mesh=(geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);this.root.add(m);return m;};
  const physical=color=>new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.25});
  const tube=(points,color,radius)=>{if(points.length<2)return;const curve=new THREE.CurvePath();for(let i=1;i<points.length;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(points[i-1].x,.3,points[i-1].z),new THREE.Vector3(points[i].x,.3,points[i].z)));mesh(new THREE.TubeGeometry(curve,points.length*8,radius,8,false),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.25}),0,0,0);};
  if(signal){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;const c=canvas.getContext('2d');for(let y=0;y<192;y+=3)for(let x=0;x<256;x+=3){const s=signalAt({x:(x/256-.5)*plan.width,z:(y/192-.5)*plan.depth},survey.signals,{operator});c.fillStyle=signalColor(s?.dbm);c.globalAlpha=s ? .62 : .17;c.fillRect(x,y,3,3);}const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;const heat=mesh(new THREE.PlaneGeometry(plan.width,plan.depth),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,side:THREE.DoubleSide}),0,.08,0);heat.rotation.x=-Math.PI/2;heat.name='signal-heatmap';}
  const nodes=new Map(survey.nodes.map(n=>[n.id,n]));
  if(wiring){for(const e of survey.cables)tube([nodes.get(e.from),nodes.get(e.to)],e.blocked?'#a4abb1':'#f2af51',.075);
   for(const p of survey.powerSources){const n=nodes.get(p.nodeId),outlet=p.kind==='outlet';mesh(new THREE.BoxGeometry(outlet?.35:1.1,outlet?.45:1.65,.45),physical(outlet?'#dedede':'#42627e'),n.x,outlet?.8:.85,n.z);const lamp=mesh(new THREE.BoxGeometry(.14,.08,.03),new THREE.MeshBasicMaterial({color:p.verified?'#75f2b1':'#ffb954'}),n.x,1.35,n.z+.24);lamp.name=p.id;}
  }
  const current=result.ranked.find(p=>p.id===selectedId)||result.selected[0];if(wiring&&current?.cable)tube(current.cable.points,'#4ddfe8',.13);
  for(const [i,c]of result.ranked.entries()){
   const color=c.selected?'#4cb789':c.score!==null?'#c7ba78':'#939ea6';
   const pad=mesh(new THREE.BoxGeometry(2.8,.04,5.3),new THREE.MeshStandardMaterial({color,transparent:true,opacity:.42}),c.x,.12,c.z);
   pad.name=c.id;
   if(c.selected){mesh(new THREE.BoxGeometry(.62,1.55,.36),physical('#f1f5f4'),c.x,1,c.z-2);mesh(new THREE.BoxGeometry(.43,.65,.04),physical('#172d35'),c.x,1.25,c.z-1.8);mesh(new THREE.BoxGeometry(.44,.06,.045),new THREE.MeshBasicMaterial({color:'#79edb1'}),c.x,1.63,c.z-1.78);const cord=new THREE.CatmullRomCurve3([new THREE.Vector3(c.x+.32,1.45,c.z-2),new THREE.Vector3(c.x+.62,.35,c.z-1.9),new THREE.Vector3(c.x+.8,1.1,c.z-1.85)]);mesh(new THREE.TubeGeometry(cord,24,.035,8,false),physical('#192a2e'),0,0,0);}
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=90;const context=canvas.getContext('2d');context.fillStyle=c.id===current?.id?'#123c39':'#f4faf7';context.beginPath();context.roundRect(0,0,256,90,16);context.fill();context.fillStyle=c.id===current?.id?'#e6fff3':'#24413e';context.font='bold 30px sans-serif';context.textAlign='center';context.fillText(`${c.id}  ${c.score??'—'}`,128,55);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));tag.position.set(c.x,4.3,c.z);tag.scale.set(5.2,1.83,1);this.root.add(tag);
  }
 }
 dispose(){this.clear();this.root.removeFromParent();}
}

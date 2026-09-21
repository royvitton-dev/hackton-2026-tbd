import * as THREE from 'three';
import {box,rounded,sphere,cyl,torus,group,material,mesh,textSign,staticBatch} from './materials.js';

const red='#cc3934',carbon='#222b2d',white='#f1e9d9',yellow='#e6bd49',steel='#849190';

function bar(parent,from,to,radius,color){
 const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),direction=b.clone().sub(a);
 const part=cyl(parent,radius,direction.length(),color,...a.add(b).multiplyScalar(.5).toArray());
 part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());return part;
}

function hose(parent,points,color=carbon,radius=.028){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
 return mesh(parent,new THREE.TubeGeometry(curve,28,radius,6,false),color);
}

function slick(parent){
 const root=group(parent);root.name='Slick racing tyre';
 const tread=cyl(root,.36,.34,material('#202527',{roughness:.91}));tread.rotation.z=Math.PI/2;
 for(const side of [-1,1]){
  const hub=cyl(root,.205,.018,material('#525c60',{metalness:.65,roughness:.4}),side*.18,0,0);hub.rotation.z=Math.PI/2;
  const stripe=torus(root,.292,.012,yellow,side*.177,0,0);stripe.rotation.y=Math.PI/2;
  const nut=cyl(root,.063,.026,'#b5bcba',side*.193,0,0);nut.rotation.z=Math.PI/2;
  for(let i=0;i<6;i++){
   const angle=i/6*Math.PI*2;
   bar(root,[side*.19,Math.cos(angle)*.07,Math.sin(angle)*.07],[side*.19,Math.cos(angle)*.18,Math.sin(angle)*.18],.015,carbon);
  }
 }
 return root;
}

function taperedNose(parent){
 const geometry=new THREE.BoxGeometry(1,.18,1),positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  const z=positions.getZ(i),width=THREE.MathUtils.lerp(.58,.17,z+.5);
  positions.setXYZ(i,positions.getX(i)*width,positions.getY(i)+(z+.5)*-.12,z*1.65);
 }
 geometry.computeVertexNormals();mesh(parent,geometry,material(red,{metalness:.25,roughness:.34}),0,.49,1.26);
}

function formulaCar(parent){
 const root=group(parent),wheels=[];root.name='Open-wheel formula race car';root.userData.dynamic=true;
 const paint=material(red,{metalness:.25,roughness:.34});
 rounded(root,1.52,.1,3.35,.1,carbon,0,.18,-.3);
 sphere(root,.43,.29,1.37,paint,0,.45,-.5);taperedNose(root);
 for(const side of [-1,1]){
  rounded(root,.44,.29,1.44,.12,paint,side*.54,.4,-.43);
  rounded(root,.34,.13,.05,.025,carbon,side*.54,.45,.3);
  box(root,.045,.07,1.04,white,side*.77,.3,-.47);
  for(const z of [-1.42,1.43]){
   bar(root,[side*.31,.38,z-.32],[side*.95,.36,z],.027,carbon);
   bar(root,[side*.31,.38,z+.3],[side*.95,.36,z],.027,carbon);
   const wheel=slick(root);wheel.userData.dynamic=true;wheel.position.set(side*.98,.36,z);wheel.userData.side=side;staticBatch(wheel);wheels.push(wheel);
  }
 }
 // Exposed cockpit, helmet, halo and air intake make the silhouette read as a single-seater.
 sphere(root,.295,.09,.43,carbon,0,.7,-.35);
 sphere(root,.19,.21,.19,'#edd071',0,.81,-.48);
 sphere(root,.17,.067,.045,'#233540',0,.83,-.299);
 hose(root,[[-.32,.74,-.74],[-.37,.86,-.3],[0,.84,.27],[.37,.86,-.3],[.32,.74,-.74]],carbon,.035);
 bar(root,[0,.83,.25],[0,.52,.51],.03,carbon);
 sphere(root,.22,.3,.7,paint,0,.62,-1.13);
 const intake=torus(root,.095,.035,carbon,0,.98,-.92);intake.scale.y=1.15;
 box(root,.04,.34,.77,red,0,.81,-1.49);
 // Front wing, rear wing and end plates sit clear of the four large slicks.
 for(let i=0;i<3;i++)rounded(root,2.02-i*.09,.045,.18,.022,carbon,0,.22+i*.056,2.12-i*.13);
 for(const side of [-1,1]){
  box(root,.07,.28,.57,red,side*.98,.31,1.98);
  box(root,.065,.48,.47,red,side*.89,.91,-1.99);
  box(root,.07,.58,.12,carbon,side*.24,.6,-1.96);
 }
 rounded(root,1.83,.09,.44,.025,carbon,0,1.14,-1.99);
 rounded(root,1.7,.08,.28,.025,carbon,0,.87,-1.98);
 const brand=textSign(root,'EVISION',1.51,.27,white,carbon,0,1.19,-1.99);brand.rotation.x=-Math.PI/2;
 const number=textSign(root,'09',.37,.46,white,red,0,.604,1.13,500);number.rotation.x=-Math.PI/2;
 staticBatch(root);return {root,wheels};
}

function mechanic(parent,{x,z,angle,role,phase=0}){
 const root=group(parent,x,.46,z);root.rotation.y=angle;root.userData.dynamic=true;root.userData.pitCrew=role;root.name=`Pit crew: ${role}`;
 const kneeling=role==='wheel gun',hip=kneeling?.48:.69;
 for(const side of [-1,1]){
  const knee=[side*.17,kneeling?.2:.35,kneeling?.19:.1];
  bar(root,[side*.12,hip,0],knee,.085,red);
  bar(root,knee,[side*.18,.1,-.14],.073,red);
  rounded(root,.18,.13,.3,.055,carbon,side*.18,.075,-.09);
 }
 rounded(root,.34,.19,.25,.06,carbon,0,hip,0);
 const torso=group(root,0,hip+.07,0);torso.userData.dynamic=true;
 rounded(torso,.38,.4,.26,.075,red,0,.18,0);
 rounded(torso,.4,.1,.28,.035,carbon,0,.35,0);
 box(torso,.24,.045,.015,white,0,.25,-.142);
 sphere(torso,.225,.245,.22,red,0,.6,.025);
 sphere(torso,.194,.081,.069,material('#182b35',{metalness:.35,roughness:.25}),0,.6,.216);
 box(torso,.055,.025,.34,carbon,0,.841,.02);
 for(const side of [-1,1]){
  bar(torso,[side*.22,.33,0],[side*.27,.09,.2],.072,red);
  bar(torso,[side*.27,.09,.2],[side*.15,.035,.43],.066,red);
  sphere(torso,.078,.07,.085,yellow,side*.15,.035,.46);
 }
 if(role==='wheel gun'){
  const gun=cyl(torso,.068,.28,steel,0,.045,.55);gun.rotation.x=Math.PI/2;
  box(torso,.095,.17,.09,carbon,0,-.02,.47);
  const socket=cyl(torso,.04,.19,yellow,0,.045,.75);socket.rotation.x=Math.PI/2;
 }else if(role==='tyre carrier'){
  const tyre=slick(torso);tyre.position.set(0,-.015,.58);tyre.rotation.y=Math.PI/2;tyre.scale.setScalar(.9);
 }
 staticBatch(torso);staticBatch(root);
 return {root,animate:time=>{torso.rotation.x=(kneeling?.34:.16)+Math.sin(time*1.7+phase)*.045;}};
}

function jack(parent,side){
 const root=group(parent,side*2.43,.48,0);root.name=side>0?'Front racing jack':'Rear racing jack';
 bar(root,[0,.03,0],[side*.63,.04,0],.045,yellow);
 bar(root,[side*.58,.04,0],[side*.94,.62,0],.036,steel);
 bar(root,[side*.94,.62,-.2],[side*.94,.62,.2],.041,carbon);
 box(root,.28,.09,.23,carbon,0,.04,0);
 for(const z of [-.2,.2]){const wheel=cyl(root,.095,.075,carbon,side*.48,.02,z);wheel.rotation.x=Math.PI/2;}
}

export function buildPitStop(parent,color='#43dfb3'){
 const root=group(parent),animation=[];root.name='EVision racing pit stop';
 const concrete=material('#9c9e94',{roughness:.97}),garage='#354345';
 rounded(root,8.7,.3,7.2,.2,white,0,.2,0);
 rounded(root,8.35,.08,6.86,.1,concrete,0,.4,0);
 // The pit box is open to the sky, with the garage and equipment behind the crew.
 rounded(root,8.04,2.37,.3,.04,garage,0,1.62,-3.14);
 for(const x of [-3.84,-1.84,1.84,3.84])box(root,.14,2.45,.57,white,x,1.64,-2.97);
 box(root,3.5,1.87,.04,'#233034',0,1.36,-2.977);
 for(let i=0;i<8;i++)box(root,3.43,.025,.03,'#485457',0,1.75+i*.1,-2.94);
 rounded(root,8.25,.16,.83,.04,carbon,0,2.93,-2.97);
 box(root,8.26,.12,.85,red,0,3.06,-2.97);
 textSign(root,'EVISION · PIT STOP',6.75,.51,white,garage,0,2.62,-2.804);
 box(root,8.0,.045,.05,color,0,2.28,-2.795);
 textSign(root,'BOX 09',1.44,.33,white,garage,-2.84,1.99,-2.96);
 textSign(root,'02.4',1.35,.7,yellow,carbon,-2.84,1.39,-2.959,260);
 textSign(root,'RACE ENGINEERING',1.38,.26,white,garage,2.84,1.99,-2.96);
 for(const x of [-2.85,2.85]){
  rounded(root,1.26,.78,.52,.035,red,x,.85,-2.53);
  box(root,1.32,.075,.6,carbon,x,1.27,-2.53);
  for(let i=0;i<3;i++)box(root,1.11,.025,.035,steel,x,.65+i*.2,-2.25);
 }
 for(const x of [-2.6,2.6]){
  box(root,.12,.017,2.48,yellow,x,.452,0);
  box(root,.37,.021,.12,yellow,x,.454,1.19);
 }
 for(const z of [-1.21,1.21])box(root,5.32,.017,.09,yellow,0,.452,z);
 box(root,8.15,.018,.065,white,0,.453,1.96);
 box(root,8.14,.018,1.1,'#697475',0,.452,2.7);
 const lane=textSign(root,'PIT LANE  →',3.6,.4,white,'#697475',0,.467,2.71);lane.rotation.x=-Math.PI/2;
 for(let i=0;i<8;i++)box(root,.49,.02,.055,white,-3.6+i*.95,.468,3.2);

 const vehicle=formulaCar(root);vehicle.root.rotation.y=Math.PI/2;vehicle.root.position.y=.46;
 animation.push(time=>{
  const working=(1-Math.cos(time*1.2))*.5;
  vehicle.root.position.y=.46+working*.07;
  for(const wheel of vehicle.wheels){wheel.position.x=wheel.userData.side*(.98+working*.12);wheel.rotation.x=Math.sin(time*5)*.16;}
 });
 let phase=0;
 const addCrew=(x,z,role,target=[x,0])=>{
  const crew=mechanic(root,{x,z,role,angle:Math.atan2(target[0]-x,target[1]-z),phase:phase++});animation.push(crew.animate);
 };
 for(const x of [-1.43,1.43])for(const side of [-1,1]){
  addCrew(x,side*1.74,'wheel gun');
  addCrew(x+Math.sign(x)*.63,side*2.09,'tyre carrier',[x,side*.98]);
  hose(root,[[x,1.04,side*1.55],[x+.24,.58,side*1.77],[x+.43,.47,side*1.95],[x+Math.sign(x)*.57,.47,side*2.4]],carbon,.023);
 }
 for(const side of [-1,1]){
  addCrew(side*3.51,.1,'jack operator',[0,0]);jack(root,side);
  addCrew(side*.16,side*1.42,'car stabiliser',[0,0]);
 }
 // Slim overhead booms and trailing air hoses leave the race car readable from above.
 for(const x of [-3.66,3.66]){
  box(root,.095,2.45,.11,steel,x,1.67,-2.63);
  box(root,.13,.12,2.45,carbon,x,2.87,-1.47);
  hose(root,[[x,2.84,-.25],[x,2.2,-.33],[x*.83,1.41,-.85],[x*.64,.49,-1.45]],yellow,.021);
 }
 const spare=group(root,-3.37,.46,-1.3);spare.name='Spare tyre rack';
 for(let i=0;i<2;i++){const tyre=slick(spare);tyre.rotation.z=Math.PI/2;tyre.position.y=.19+i*.35;}
 return {root,animation};
}

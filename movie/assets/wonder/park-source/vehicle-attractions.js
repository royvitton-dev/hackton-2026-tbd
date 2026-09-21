import * as THREE from 'three';
import {box,rounded,cyl,torus,group,material,mesh,textSign} from './materials.js';

const cream='#eee2c9',ink='#29473f',rubber='#303936',mint='#73bea3';

function car(parent,color){
 const root=group(parent);
 rounded(root,1.3,.3,2.35,.13,material(color,{metalness:.35,roughness:.32}),0,.47,0);
 rounded(root,1.12,.12,2.22,.05,ink,0,.29,0);
 rounded(root,1.03,.4,1.03,.14,material('#527677',{metalness:.3,roughness:.22}),0,.79,-.18);
 rounded(root,1.07,.09,.8,.06,color,0,1.01,-.23);
 for(const x of [-.65,.65])for(const z of [-.73,.73]){
  const wheel=cyl(root,.25,.16,rubber,x,.3,z);wheel.rotation.z=Math.PI/2;
  const hub=cyl(root,.13,.175,'#bac3b6',x,.3,z);hub.rotation.z=Math.PI/2;
 }
 for(const x of [-.43,.43]){
  box(root,.22,.075,.04,material('#fff1c9',{emissive:'#ffe6a5',emissiveIntensity:.35}),x,.5,1.18);
  box(root,.25,.065,.04,'#b9604e',x,.48,-1.18);
 }
 box(root,.18,.015,.66,cream,0,.63,.73);
 return root;
}

function cable(parent,points,color=ink,radius=.035){
 const curve=new THREE.CatmullRomCurve3(points.map(point=>new THREE.Vector3(...point)));
 return mesh(parent,new THREE.TubeGeometry(curve,24,radius,6,false),color);
}

function charger(parent,x,z){
 const root=group(parent,x,.46,z);root.name='EV charging station';
 rounded(root,.74,1.72,.55,.1,cream,0,.87,0);
 rounded(root,.8,.16,.61,.05,mint,0,1.69,0);
 box(root,.48,.61,.025,ink,0,1.16,.29);
 textSign(root,'EV',.4,.32,'#b8efd1',ink,0,1.26,.31);
 for(let i=0;i<3;i++)box(root,.075,.12,.03,mint,-.12+i*.12,.98,.31);
 cable(root,[[.37,1.28,.06],[.7,1.01,.13],[.72,.35,.24],[.47,.3,.36],[.4,.99,.33]]);
 const plug=box(root,.13,.31,.14,ink,.4,1.05,.34);plug.rotation.z=-.25;
}

function checkeredFlag(parent,x,z,reverse=false){
 cyl(parent,.038,2.1,'#c7b888',x,4.28,z);
 const flag=group(parent,x,4.75,z);flag.rotation.y=reverse?-.2:.2;
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){
  box(flag,.22,.22,.035,(row+col)%2?ink:cream,(col+.5)*.22*(reverse?-1:1),-row*.22,0);
 }
}

export function buildPitStop(parent,color=mint){
 const root=group(parent),animation=[];root.name='EVision service garage';
 const floor=material('#6e807a',{roughness:.94});
 rounded(root,8.6,.34,7,.24,cream,0,.2,0);
 rounded(root,8.12,.1,6.55,.12,floor,0,.42,0);
 // An open service bay keeps the lift, vehicle and workshop visible from above.
 rounded(root,7.3,3.1,.35,.06,cream,-.25,2.02,-2.55);
 box(root,3.55,2.5,.05,ink,-1.65,1.94,-2.35);
 for(const x of [-3.65,.45,3.15]){
  box(root,.25,3.2,1.85,cream,x,2.05,-1.8);
  box(root,.27,.48,1.88,color,x,.76,-1.8);
 }
 rounded(root,7.65,.26,2.15,.09,ink,-.25,3.69,-1.69);
 box(root,7.65,.11,2.18,color,-.25,3.86,-1.69);
 box(root,7.65,.56,.2,ink,-.25,3.46,-.58);
 textSign(root,'EVISION · PIT STOP',6.2,.48,cream,ink,-.25,3.49,-.465);
 textSign(root,'01 / SERVICE',2.35,.32,cream,ink,-1.65,2.98,-2.31);
 textSign(root,'CHARGE & GO',1.98,.3,ink,cream,1.8,2.8,-2.34);
 for(const x of [-2.95,-.35])box(root,.055,.015,3.85,cream,x,.48,.15);
 box(root,2.65,.015,.055,cream,-1.65,.48,2.05);

 for(const x of [-2.9,-.4]){
  rounded(root,.24,2.35,.37,.04,color,x,1.64,-.25);
  box(root,.38,.1,.6,ink,x,.53,-.25);
 }
 const lift=group(root,-1.65,.65,.1);lift.name='Vehicle service lift';lift.userData.dynamic=true;
 for(const x of [-.56,.56])box(lift,.24,.14,2.75,'#b2b7a5',x,0,0);
 box(lift,2.6,.12,.25,ink,0,-.08,-.35);
 const vehicle=car(lift,'#ece7d7');vehicle.position.y=.08;
 animation.push(time=>{lift.position.y=.76+Math.sin(time*.55)*.2;});

 const tools=group(root,1.05,.47,-.45);tools.name='Workshop tool trolley';
 rounded(tools,.94,.76,.62,.05,color,0,.48,0);
 box(tools,1.05,.08,.72,ink,0,.91,0);
 for(let i=0;i<3;i++){box(tools,.79,.035,.025,cream,0,.32+i*.2,.32);box(tools,.32,.035,.04,ink,0,.38+i*.2,.34);}
 for(const x of [-.34,.34])for(const z of [-.2,.2]){const wheel=cyl(tools,.09,.09,rubber,x,.09,z);wheel.rotation.z=Math.PI/2;}
 for(let i=0;i<3;i++){const tire=torus(root,.29,.12,rubber,-3.36,.61+i*.25,.85);tire.rotation.x=Math.PI/2;}
 charger(root,2.77,.6);
 rounded(root,1.3,.06,1.7,.04,color,2.7,.5,1.05);
 for(const x of [-3.6,3.6]){
  box(root,.38,.06,.38,ink,x,.5,2.65);
  mesh(root,new THREE.ConeGeometry(.15,.4,12),'#c89954',x,.72,2.65);
  cyl(root,.085,.07,cream,x,.75,2.65);
 }
 for(let i=0;i<20;i++)box(root,.37,.018,.18,i%2?ink:cream,-3.51+i*.37,.49,2.68);
 const lane=textSign(root,'PIT LANE',2.1,.45,cream,'#6e807a',-.2,.485,2.98);lane.rotation.x=-Math.PI/2;
 checkeredFlag(root,-3.5,-1.85);checkeredFlag(root,3,-1.85,true);
 return {root,animation};
}

export function buildParking(parent,color='#659c88'){
 const root=group(parent),animation=[];root.name='ATLAS parking navigation';
 const road='#71877b';
 rounded(root,8.6,.34,7.2,.25,cream,0,.2,0);
 rounded(root,8.18,.09,6.8,.12,road,0,.42,0);
 // Two open parking levels with an actual sloped approach on the right.
 for(const x of [-3.55,1.1])for(const z of [-2.75,.6])box(root,.24,1.95,.25,cream,x,1.46,z);
 box(root,4.9,.25,3.9,cream,-1.22,2.48,-1.12);
 box(root,4.64,.035,3.65,road,-1.22,2.63,-1.12);
 for(const x of [-3.62,1.18])box(root,.12,.39,3.9,color,x,2.8,-1.12);
 box(root,4.95,.39,.12,color,-1.22,2.8,-3.02);
 box(root,4.95,.25,.13,cream,-1.22,2.9,.8);
 for(const x of [-3.5,-2.3,-1.1,.1,1.1])box(root,.065,.02,1.83,cream,x,2.655,-1.98);
 box(root,4.62,.02,.055,cream,-1.22,2.655,-1.07);
 for(const [x,paint] of [[-2.91,'#deb26a'],[-.5,'#d5e4d7']]){
  const parked=car(root,paint);parked.scale.setScalar(.7);parked.position.set(x,2.68,-2.02);
 }
 const lower=car(root,'#acbdce');lower.scale.setScalar(.66);lower.position.set(-2.95,.47,-1.78);
 const rise=2.18,run=3.5,slope=Math.atan2(rise,run),length=Math.hypot(rise,run);
 const ramp=group(root,2.32,1.53,-1.08);ramp.rotation.x=slope;
 box(ramp,1.62,.14,length,cream);
 box(ramp,1.4,.02,length,road,0,.08,0);
 for(const x of [-.78,.78])box(ramp,.095,.27,length,color,x,.2,0);
 for(let i=0;i<7;i++)box(ramp,.055,.02,.29,cream,0,.097,-1.72+i*.56);
 box(root,1.2,.2,.7,cream,1.32,2.48,-2.85);

 const tower=group(root,-3.65,.46,-2.9);tower.name='Parking sign tower';
 rounded(tower,.88,4.5,.86,.07,color,0,2.25,0);
 rounded(tower,1.26,1.26,.2,.08,ink,0,3.9,.49);
 textSign(tower,'P',1.08,1.08,cream,ink,0,3.9,.602,600);
 textSign(tower,'02',.6,.4,cream,ink,0,2.83,.44);
 textSign(tower,'01',.6,.4,cream,ink,0,1.06,.44);
 box(tower,1.11,.14,1.09,cream,0,4.58,0);
 for(const x of [-3.7,1.02])cyl(root,.065,1.22,ink,x,1.08,1.65);
 box(root,4.86,.61,.24,color,-1.34,1.95,1.65);
 textSign(root,'ATLAS · PARKING',4.57,.48,cream,ink,-1.34,1.96,1.782);
 const gate=group(root,.3,.47,1.6);
 rounded(gate,.3,.87,.32,.035,ink,0,.44,0);
 box(gate,1.9,.11,.1,cream,-.77,.85,0);
 for(let i=0;i<5;i++)box(gate,.15,.115,.11,color,-1.57+i*.35,.85,0);
 charger(root,-3.25,.35);
 // Mint route dots lead from the entry to the ramp without obscuring the parking bays.
 for(let i=0;i<9;i++)cyl(root,.055,.025,'#bce3bb',-1.5+i*.45,.49,2.55);
 const routeCar=car(root,'#d4ac6d');routeCar.name='Parking approach vehicle';routeCar.userData.dynamic=true;routeCar.scale.setScalar(.57);routeCar.rotation.y=Math.PI/2;
 animation.push(time=>{routeCar.position.set(Math.sin(time*.3)*1.15,.49,2.46);});
 const entry=textSign(root,'IN  →',1,.4,cream,road,-2.7,.49,2.5);entry.rotation.x=-Math.PI/2;
 return {root,animation};
}

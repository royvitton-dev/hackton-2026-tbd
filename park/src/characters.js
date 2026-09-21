import * as THREE from 'three';
import { box, sphere, cone, cyl, group, torus, material, staticBatch } from './materials.js';
export function disneyCharacter(parent,kind='mickey',scale=1){
 const root=group(parent);root.scale.setScalar(scale);root.userData.dynamic=true;
 const black='#26282b',white='#fff7e7',skin='#f2d1aa',yellow='#e5b440',red=kind==='minnie'?'#d95979':'#cb4640';
 const body=group(root);const arms=[];
 if(kind==='olaf'){
  sphere(body,.37,.46,.32,white,0,.55,0);sphere(body,.27,.27,.26,white,0,1.04,0);sphere(body,.29,.4,.27,white,0,1.54,0);
  for(let i=0;i<3;i++)sphere(body,.045,.045,.035,black,0,.4+i*.24,.3);
  for(const x of [-.095,.095]){sphere(body,.072,.08,.03,white,x,1.66,.25);sphere(body,.033,.038,.02,black,x,1.66,.278);}
  const nose=cone(body,.068,.36,'#df8941',0,1.5,.39);nose.rotation.x=Math.PI/2;
  sphere(body,.2,.1,.25,white,-.2,.1,.08);sphere(body,.2,.1,.25,white,.2,.1,.08);
  for(const side of [-1,1]){const a=group(body,side*.23,1.05,0);const stick=cyl(a,.035,.55,'#70503a',side*.21,.08,0);stick.rotation.z=-side*1.1;arms.push(a);}
 }else if(kind==='donald'){
  sphere(body,.29,.39,.25,'#416d9b',0,.75,0);sphere(body,.31,.34,.28,white,0,1.29,0);
  sphere(body,.26,.085,.25,yellow,0,1.15,.3);sphere(body,.22,.038,.19,'#dca340',0,1.08,.3);
  for(const x of [-.1,.1]){sphere(body,.085,.14,.04,white,x,1.37,.253);sphere(body,.033,.06,.022,'#355271',x,1.39,.29);}
  cyl(body,.23,.08,'#326591',0,1.59,0);sphere(body,.22,.075,.2,'#5787b0',0,1.66,0);
  for(const side of [-1,1]){sphere(body,.15,.065,.24,yellow,side*.16,.12,.1);cyl(body,.065,.25,yellow,side*.13,.3,0);const a=group(body,side*.26,.95,0);sphere(a,.085,.22,.085,white,side*.08,-.1,0);arms.push(a);}
  for(const side of [-1,1]){const b=cone(body,.14,.18,'#c94c47',side*.1,.96,.26);b.rotation.z=side*Math.PI/2;}
 }else{
  sphere(body,.26,.38,.22,black,0,.84,0);sphere(body,.34,.36,.29,black,0,1.43,0);
  for(const side of [-1,1]){sphere(body,.215,.22,.095,black,side*.285,1.75,0);sphere(body,.14,.235,.063,skin,side*.105,1.43,.252);}
  sphere(body,.245,.135,.13,skin,0,1.24,.265);sphere(body,.09,.068,.07,black,0,1.32,.394);
  for(const side of [-1,1]){sphere(body,.058,.12,.025,white,side*.092,1.46,.31);sphere(body,.025,.063,.016,black,side*.083,1.44,.333);}
  const smile=torus(body,.11,.014,'#5a372e',0,1.24,.373);smile.scale.y=.43;
  if(kind==='minnie'){
   cyl(body,.38,.31,red,0,.53,0,.2);
   for(let i=0;i<10;i++){const a=i*Math.PI/5;sphere(body,.025,.025,.025,white,Math.cos(a)*.30,.51,Math.sin(a)*.30);}
   for(const side of [-1,1]){sphere(body,.155,.11,.06,red,side*.12,1.78,.16);sphere(body,.025,.025,.014,white,side*.15,1.81,.21);}
   sphere(body,.06,.065,.055,red,0,1.78,.21);
  }else{sphere(body,.28,.22,.24,red,0,.56,0);for(const side of [-1,1])sphere(body,.045,.065,.026,white,side*.12,.58,.235);}
  for(const side of [-1,1]){
   cyl(body,.069,.32,black,side*.145,.28,0);sphere(body,.16,.115,.25,kind==='minnie'?red:yellow,side*.18,.115,.085);
   const arm=group(body,side*.235,1.03,0);arm.rotation.z=side*.35;sphere(arm,.075,.21,.075,black,side*.03,-.15,0);const glove=group(arm,side*.05,-.36,0);
   sphere(glove,.115,.13,.078,white);for(let i=0;i<3;i++)sphere(glove,.025,.062,.035,white,-.07+i*.055,-.075,.02);sphere(glove,.06,.055,.06,white,side*-.085,0,.04);arms.push(arm);
  }
 }
 const base=group(root);cyl(base,.54,.055,'#d8c4a0',0,.015,0);
 for(const arm of arms){arm.userData.dynamic=true;staticBatch(arm);}staticBatch(body);staticBatch(base);
 root.userData.animate=(time,motion='wave')=>{
  if(motion==='drive'){body.rotation.z=Math.sin(time*2)*.09;arms.forEach((a,i)=>a.rotation.x=-1.2+Math.sin(time*3+i)*.08);}
  else if(motion==='dance'){body.position.y=Math.max(0,Math.sin(time*3))*.09;body.rotation.y=Math.sin(time*1.5)*.25;arms.forEach((a,i)=>a.rotation.z=(i?1:-1)*(.7+Math.sin(time*3+i)*.3));}
  else {body.rotation.y=Math.sin(time*.8)*.12;if(arms[1])arms[1].rotation.z=2.1+Math.sin(time*3)*.25;}
 };
 return root;
}

import {box,sphere,cyl,cone,torus,group} from './materials.js';

const ink='#26282b',cream='#fff7e7';
function eyes(body,y,z,spacing=.12,white=true){
 for(const side of [-1,1]){
  if(white)sphere(body,.082,.12,.043,cream,side*spacing,y,z);
  sphere(body,.035,.054,.026,ink,side*spacing,y-.015,z+(white?.036:0));
 }
}
function arm(body,side,y,color,arms,length=.25){
 const pivot=group(body,side*.32,y,0);pivot.rotation.z=side*.15;
 sphere(pivot,.12,length,.12,color,side*.055,-length*.55,0);
 sphere(pivot,.13,.13,.12,color,side*.08,-length*1.35,.025);arms.push(pivot);
 return pivot;
}
function smile(body,r,y,z,color=ink){
 const curve=torus(body,r,.016,color,0,y,z);curve.scale.y=.35;
 // Hide the upper half inside the muzzle so the mouth reads as a smile.
 sphere(body,r*1.05,.045,.035,color===ink?'#e4b746':'#8cb8d2',0,y+.03,z+.008);
}

export function buildFriend(body,kind,arms,details){
 if(kind==='goofy'){
  const orange='#db864b',blue='#436883',skin='#e6cba0',green='#9fb26d';
  sphere(body,.25,.4,.21,orange,0,1.15,0);
  for(const side of [-1,1]){
   const vest=box(body,.115,.43,.27,ink,side*.21,1.24,.06);vest.rotation.z=side*-.13;
   const leg=cyl(body,.085,.57,blue,side*.14,.57,0);leg.rotation.z=side*.08;
   sphere(body,.18,.115,.3,'#886443',side*.18,.16,.12);
   const a=arm(body,side,1.4,orange,arms,.29);sphere(a,.13,.15,.11,cream,side*.08,-.49,.02);
  }
  sphere(body,.27,.32,.22,ink,0,1.82,0);
  for(const side of [-1,1]){
   sphere(body,.125,.215,.08,cream,side*.1,1.98,.18);
   sphere(body,.035,.075,.026,ink,side*.085,1.98,.26);
   const ear=sphere(body,.068,.35,.08,ink,side*.29,1.68,-.035);ear.rotation.z=side*.13;
  }
  sphere(body,.29,.13,.22,skin,0,1.76,.25);sphere(body,.11,.074,.09,ink,0,1.8,.46);
  sphere(body,.17,.065,.065,ink,0,1.63,.29);
  for(const side of [-1,1])box(body,.07,.08,.035,cream,side*.042,1.66,.344);
  const hat=group(body,0,2.2,0);hat.rotation.z=-.16;
  cyl(hat,.27,.055,green);cyl(hat,.16,.27,green,0,.14,0,.2);cyl(hat,.177,.055,ink,0,.08,0);
 }else if(kind==='pluto'){
  const gold='#dfae45';
  sphere(body,.29,.36,.48,gold,0,.63,-.03);
  for(const side of [-1,1])for(const z of [-.31,.3]){
   sphere(body,.09,.23,.1,gold,side*.23,.3,z);sphere(body,.135,.08,.2,gold,side*.24,.11,z+.07);
   for(const offset of [-.045,.045])box(body,.01,.016,.085,'#bb8536',side*.24+offset,.17,z+.18);
  }
  sphere(body,.24,.25,.24,gold,0,.99,.31);
  const collar=torus(body,.218,.04,'#497952',0,.87,.3);collar.rotation.x=Math.PI/2;
  sphere(body,.05,.065,.02,'#e6c36c',0,.84,.52);
  eyes(body,1.08,.515,.085);sphere(body,.205,.13,.28,gold,0,.87,.55);sphere(body,.11,.085,.08,ink,0,.94,.8);
  sphere(body,.15,.036,.13,ink,0,.78,.64);sphere(body,.075,.026,.14,'#d98788',0,.75,.69);
  for(const side of [-1,1]){const ear=sphere(body,.07,.33,.065,ink,side*.225,.85,.22);ear.rotation.z=side*.22;}
  const tail=group(body,0,.69,-.45);const tip=cone(tail,.043,.52,ink,0,.2,-.12);tip.rotation.x=-.5;
  details.push({part:tail,animate:t=>tail.rotation.z=Math.sin(t*5)*.5});
 }else if(kind==='pooh'){
  const honey='#e4b746',shirt='#c94c42';
  sphere(body,.39,.45,.3,honey,0,.63,0);sphere(body,.35,.23,.285,shirt,0,.96,0);
  sphere(body,.35,.32,.29,honey,0,1.38,.02);
  for(const side of [-1,1]){
   sphere(body,.12,.135,.075,honey,side*.255,1.64,.02);sphere(body,.067,.075,.025,'#ce9438',side*.255,1.65,.085);
   sphere(body,.145,.11,.21,honey,side*.19,.13,.09);
   const a=arm(body,side,1.03,honey,arms,.23);sphere(a,.135,.14,.14,shirt,side*.03,-.02,0);
   const brow=sphere(body,.065,.015,.02,'#855d2f',side*.12,1.53,.263);brow.rotation.z=side*-.12;
  }
  eyes(body,1.43,.293,.12,false);sphere(body,.23,.12,.1,honey,0,1.25,.28);sphere(body,.065,.043,.037,ink,0,1.33,.374);
  smile(body,.105,1.245,.374);
  // A honey pot at his feet makes the silhouette readable from the map, too.
  const pot=group(body,-.42,.21,.42);pot.rotation.z=.14;
  sphere(pot,.16,.19,.15,'#a881b0');cyl(pot,.14,.07,'#976fa3',0,.16,0);cyl(pot,.105,.015,'#e6b64e',0,.201,0);
  sphere(pot,.033,.07,.025,'#e6b64e',.07,.13,.13);
 }else if(kind==='stitch'){
  const blue='#568fbd',pale='#8cb8d2',dark='#30567f',pink='#c396bd';
  sphere(body,.29,.33,.25,blue,0,.52,0);sphere(body,.19,.24,.06,pale,0,.5,.225);
  sphere(body,.43,.3,.3,blue,0,1.03,0);
  for(const side of [-1,1]){
   sphere(body,.15,.105,.22,blue,side*.24,.14,.1);
   const a=arm(body,side,.7,blue,arms,.2);
   for(let i=0;i<3;i++)sphere(a,.022,.033,.04,cream,side*.08+(i-1)*.058,-.32,.07);
   sphere(body,.17,.195,.05,pale,side*.215,1.055,.248);
   const eye=sphere(body,.104,.133,.036,ink,side*.22,1.06,.287);eye.rotation.z=side*-.12;
   sphere(body,.027,.034,.013,cream,side*.205,1.108,.32);
   const ear=group(body,side*.35,1.19,-.02);ear.rotation.z=-side*.63;
   sphere(ear,.16,.44,.085,blue,0,.3,0);sphere(ear,.112,.34,.021,pink,0,.3,.079);
   // Small blue notches along the ears echo his unmistakable profile.
   sphere(ear,.055,.038,.027,blue,side*.107,.37,.08);
   details.push({part:ear,animate:t=>ear.rotation.z=-side*(.63+Math.sin(t*1.7)*.065)});
  }
  sphere(body,.145,.095,.093,dark,0,1.045,.303);sphere(body,.23,.085,.08,pale,0,.88,.253);
  smile(body,.15,.875,.328,dark);
  for(const side of [-1,1]){const tooth=cone(body,.03,.075,cream,side*.095,.863,.343);tooth.rotation.z=Math.PI;}
  const tuft=cone(body,.07,.19,dark,0,1.36,-.035);tuft.rotation.z=.25;
 }else if(kind==='baymax'){
  const white='#f4f2e9',seam='#d8dfdc';
  sphere(body,.48,.6,.35,white,0,.88,0);sphere(body,.32,.34,.27,white,0,1.32,0);
  sphere(body,.315,.215,.235,white,0,1.74,0);
  for(const side of [-1,1]){
   sphere(body,.17,.29,.19,white,side*.21,.32,0);sphere(body,.18,.095,.22,white,side*.21,.105,.045);
   const a=arm(body,side,1.3,white,arms,.36);a.position.x=side*.37;
   for(let i=0;i<3;i++)sphere(a,.032,.085,.04,white,side*.08+(i-1)*.064,-.51,.025);
   sphere(body,.035,.035,.015,ink,side*.135,1.77,.23);
  }
  box(body,.27,.018,.017,ink,0,1.77,.238);
  const badge=torus(body,.055,.011,seam,-.14,1.31,.245);badge.scale.y=.9;
  for(const side of [-1,1]){const seamLine=torus(body,.15,.009,seam,side*.215,.34,.145);seamLine.scale.y=1.1;}
 }
}

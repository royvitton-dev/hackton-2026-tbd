import * as THREE from 'three';
import {box,rounded,sphere,cyl,cone,torus,group,material,textSign,arch} from './materials.js';
import {disneyCharacter} from './characters.js';

export function bumperCar(parent,color='#cf654c'){
 const g=group(parent);g.userData.dynamic=true;
 rounded(g,1.35,.32,1.75,.16,'#2f3439',0,.25,0);rounded(g,1.15,.42,1.5,.2,material(color,{metalness:.35,roughness:.3}),0,.49,0);
 rounded(g,.8,.34,.7,.14,'#322f36',0,.75,-.22);rounded(g,.82,.3,.18,.06,'#e8bf80',0,.86,-.55);
 for(const x of [-.43,.43])sphere(g,.105,.055,.045,material('#fff1b0',{emissive:'#ffcd6a',emissiveIntensity:.5}),x,.57,.765);
 cyl(g,.025,2.7,'#b7b0a0',0,1.75,-.65);sphere(g,.085,.085,.085,'#edc981',0,3.08,-.65);
 const steering=torus(g,.17,.027,'#ead5b0',0,.78,.13);steering.rotation.x=-.55;
 return g;
}
export function buildBumper(parent){
 const root=group(parent);const animation=[];const cream='#ecdcc1',red='#bc6051',gold='#d4b477';
 rounded(root,8.5,.42,6.8,.3,cream,0,.22,0);rounded(root,7.8,.08,5.9,.12,material('#7f9ca0',{metalness:.35,roughness:.3}),0,.48,0);
 // Inlaid track lanes, striped posts, and an open-sided pavilion.
 for(let i=0;i<5;i++){const ring=torus(root,1.0+i*.38,.025,'#d9dfcc',0,.54,0);ring.rotation.x=-Math.PI/2;ring.scale.x=1.42;}
 for(const x of [-3.7,3.7])for(const z of [-2.7,2.7]){
  cyl(root,.14,3.4,cream,x,2.1,z);for(let j=0;j<5;j++)cyl(root,.147,.2,red,x,.8+j*.57,z);cyl(root,.25,.15,gold,x,3.74,z);
 }
 // Open canopy: detailed back roof leaves the moving cars visible from the park camera.
 rounded(root,8.4,.22,2.5,.12,red,0,3.95,-1.75);box(root,8.5,.18,.22,gold,0,3.76,-.48);
 for(let i=0;i<18;i++)box(root,.22,.05,2.5,cream,-4+i*.47,4.08,-1.75);
 box(root,8.6,.48,.38,red,0,3.66,2.86);textSign(root,'DOPAMIN SPEEDWAY',6.7,.58,'#fff1cd','#ad4e43',0,3.67,3.06);
 for(let i=0;i<22;i++)sphere(root,.065,.065,.065,material('#fff0bb',{emissive:'#ffd78a',emissiveIntensity:.7}),-4.02+i*.383,3.31,3.08);
 for(const x of [-3.7,3.7])box(root,.12,.5,5.5,cream,x,.83,0);
 for(let i=0;i<4;i++){
  const car=bumperCar(root,['#dc765b','#e4bf57','#588f92','#a98bb8'][i]);car.scale.setScalar(.8);
  animation.push(t=>{const a=t*.38+i*Math.PI/2;car.position.set(Math.cos(a)*2.35,.48,Math.sin(a)*1.55);car.rotation.y=-a+Math.PI;});
  if(i===0){const driver=disneyCharacter(car,'mickey',.37);driver.position.set(0,.55,-.15);animation.push(t=>driver.userData.animate(t,'drive'));}
 }
 return {root,animation};
}
export function buildTheater(parent){
 const root=group(parent);const cream='#efdebf',rose='#cc9790',dark='#3b5553',gold=material('#d2b16c',{metalness:.5,roughness:.35});
 rounded(root,8.1,.42,6.3,.3,cream,0,.22,0);rounded(root,7.3,4.8,5.2,.14,rose,0,2.75,-.3);
 box(root,7.6,.3,5.5,cream,0,5.24,-.3);box(root,7.7,.12,5.6,gold,0,5.45,-.3);
 box(root,3.2,1.75,.35,cream,0,5.25,2.46);box(root,2.8,1.6,.22,'#7b9a9b',0,5.39,2.7);
 for(const x of [-3.35,-2.8,2.8,3.35]){box(root,.2,4.75,.38,cream,x,2.8,2.45);box(root,.1,4.8,.12,gold,x,2.8,2.68);}
 for(const x of [-1.45,0,1.45]){arch(root,1.22,2.8,.08,cream,x,.55,2.4);arch(root,.97,2.5,.06,dark,x,.6,2.51);box(root,.025,2,.035,gold,x,1.6,2.6);sphere(root,.055,.055,.025,gold,x+.15,1.7,2.64);}
 rounded(root,7.9,.65,1.8,.12,gold,0,3.6,3.02);box(root,7.55,.41,.035,'#f5eacb',0,3.6,3.95);
 textSign(root,'STARLIGHT CINEMA',6.85,.55,'#fff0ca','#406561',0,4.52,2.79);
 textSign(root,'NOW SHOWING · VITALIS',6.6,.38,'#635646','#f8edce',0,3.59,3.98);
 for(let i=0;i<24;i++)sphere(root,.063,.063,.063,material('#ffefb0',{emissive:'#f2bb6b',emissiveIntensity:.8}),-3.65+i*.317,3.23,3.82);
 // Art-deco crown and star.
 for(let i=-2;i<=2;i++)box(root,.14,.9-Math.abs(i)*.16,.2,gold,i*.33,6.25,2.52);
 const star=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.21:.48;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
 const m=new THREE.Mesh(new THREE.ExtrudeGeometry(star,{depth:.08,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:2}),gold);m.position.set(0,6.2,2.75);root.add(m);
 for(const x of [-3.1,3.1]){box(root,.75,1.35,.04,'#45606b',x,2,2.73);textSign(root,'VITALIS',.67,.27,'#f5e4be','#45606b',x,1.98,2.765);}
 return {root,animation:[]};
}
export function buildMusic(parent){
 const root=group(parent);const teal='#62928c',cream='#eadbbd',gold='#d3b06b';
 cyl(root,3.7,.42,cream,0,.22,0);cyl(root,3.35,.18,'#aa9a7b',0,.53,0);cyl(root,3.23,.08,'#d8bba1',0,.66,0);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const x=Math.cos(a)*2.85,z=Math.sin(a)*2.85;
  cyl(root,.11,3.6,cream,x,2.4,z);cyl(root,.21,.15,gold,x,4.16,z);cyl(root,.21,.12,gold,x,.78,z);
 }
 cyl(root,3.3,.35,teal,0,4.17,0);cone(root,3.7,1.65,teal,0,5.05,0);cone(root,.16,1.0,gold,0,6.34,0);
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const bar=cyl(root,.037,3.72,cream,Math.sin(a)*1.74,5.12,Math.cos(a)*1.74);bar.rotation.set(Math.cos(a)*1.16,0,-Math.sin(a)*1.16);}
 textSign(root,'MAGIC VOICE',4.3,.58,'#fbe8bc','#406c63',0,3.8,3.05);
 for(let i=0;i<4;i++)box(root,2.5,.15,.6,cream,0,.65-i*.14,3.1+i*.48);
 const mic=group(root,0,.66,.4);cyl(mic,.035,1.5,gold,0,.78,0);cyl(mic,.34,.07,'#505453',0,.07,0);sphere(mic,.11,.23,.11,material('#a8b2ad',{metalness:.85,roughness:.3}),0,1.6,0);
 for(const x of [-2.2,2.2]){rounded(root,.62,1.2,.55,.05,'#435b53',x,1.3,0);for(const y of [1.06,1.6]){const r=torus(root,.18,.03,'#8fa896',x,y,.29);sphere(root,.15,.15,.025,'#233e34',x,y,.3);}}
 return {root,animation:[]};
}
export function buildGeneric(parent,theme,color){
 const root=group(parent);const animation=[];const cream='#e9dcc1',gold='#ceb176';
 cyl(root,3.6,.4,cream,0,.24,0);
 if(theme==='construction'){
  box(root,7.2,.15,5.8,'#bbaa82',0,.55,0);
  for(const x of [-2,0,2])for(const z of [-1.7,1.7]){box(root,.23,3.8,.23,'#c9c6b5',x,2.5,z);box(root,2.2,.25,.35,'#d3cfba',x,4.2,z);}
  box(root,4.6,.2,3.8,'#d6cfb7',0,2.4,0);box(root,2.2,1.5,.13,'#a0b5b2',-1.1,3.27,1.77);
  for(const x of [-2.3,2.3])box(root,.16,1.8,3.8,'#c8bd9d',x,1.45,0);
  const crane=group(root,-2.8,.5,-1.6);for(const x of [-.26,.26])for(const z of [-.26,.26])box(crane,.08,7,.08,'#c89640',x,3.5,z);
  for(let i=0;i<11;i++){box(crane,.59,.055,.59,'#e0b15d',0,.45+i*.58,0);const cross=box(crane,.055,.83,.06,'#e0b15d',0,.68+i*.58,.27);cross.rotation.z=i%2?.65:-.65;}
  const jib=group(crane,0,6.85,0);jib.userData.dynamic=true;box(jib,6.5,.15,.42,'#d6a144',1.7,0,0);box(jib,6.5,.12,.42,'#d6a144',1.7,.62,0);
  for(let i=0;i<12;i++){const beam=box(jib,.065,.79,.08,'#e4bd73',-1.3+i*.54,.31,.2);beam.rotation.z=i%2?.7:-.7;}
  box(jib,.7,.75,.85,'#899693',-1.4,-.2,0);box(jib,.7,.7,.65,'#d9b05c',.7,-.2,0);box(jib,.03,2.6,.03,'#7f7e70',4.1,-1.33,0);const hook=torus(jib,.15,.036,'#717971',4.1,-2.7,0);
  animation.push(t=>jib.rotation.y=Math.sin(t*.2)*.22);
  for(let i=0;i<8;i++){const x=-3.2+i*.9;box(root,.78,.8,.13,i%2?'#d2a34d':'#f0ddb2',x,.96,3.05);box(root,.09,1.1,.14,'#756c55',x,.85,3);}
  textSign(root,'ATLAS · COMING TO LIFE',5.8,.58,'#4d5643','#f0dbab',0,1.0,3.14);
  for(let i=0;i<4;i++){const x=2.7+(i%2)*.43,z=-1+Math.floor(i/2)*.6;cone(root,.18,.45,'#cf8d4f',x,.79,z);box(root,.43,.05,.43,'#55574c',x,.57,z);}
 }else if(theme==='pinball'){
  rounded(root,6.6,1,5.5,.28,color,0,.9,0);rounded(root,6.2,.15,5.1,.18,'#314e60',0,1.48,0);
  for(const x of [-3,3])box(root,.16,1.4,5.1,cream,x,2.1,0);box(root,6.2,1.4,.16,cream,0,2.1,-2.5);
  for(let i=0;i<6;i++){const x=(i%3-1)*1.5,z=Math.floor(i/3)*1.7-.8;cyl(root,.45,.25,'#e0ae64',x,1.7,z);cyl(root,.34,.22,i%2?'#c77572':'#8fb3a5',x,1.91,z);}
  for(const side of [-1,1]){const flipper=rounded(root,1.5,.16,.32,.1,'#e8d5a0',side*.82,1.8,1.78);flipper.userData.dynamic=true;animation.push(t=>flipper.rotation.y=side*(.25+Math.sin(t*2)*.3));}
  const ball=sphere(root,.2,.2,.2,material('#e6e9e5',{metalness:.9,roughness:.18}),0,1.9,0);ball.userData.dynamic=true;animation.push(t=>ball.position.set(Math.sin(t*.85)*2.3,1.9,Math.cos(t*1.1)*1.8));
  for(const x of [-2.8,2.8])cyl(root,.1,3.5,gold,x,3.0,-2.45);
  textSign(root,'LUCKY PINBALL',5.8,1,'#f3e4b2','#496c7c',0,4.5,-2.43);
  for(let i=0;i<10;i++)sphere(root,.06,.06,.06,material('#f6cf7b',{emissive:'#ebba59',emissiveIntensity:.4}),-2.6+i*.58,5.08,-2.35);
 }else if(theme==='space'){
  const rocket=group(root,0,.4,0);rocket.userData.dynamic=true;cyl(rocket,.85,3.4,'#e6e1d2',0,2.2,0);cone(rocket,.85,1.5,color,0,4.65,0);cyl(rocket,.87,.5,color,0,1.3,0);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2;const fin=box(rocket,.13,1.6,1.3,color,Math.sin(a)*.87,.95,Math.cos(a)*.87);fin.rotation.y=a;}
  sphere(rocket,.32,.32,.08,'#598b9c',0,2.9,.81);const orbit=torus(root,2.8,.065,gold,0,3,0);orbit.rotation.set(.6,.3,.3);animation.push(t=>{rocket.position.y=.4+Math.sin(t)*.16;});
 }else if(theme==='ocean'){
  sphere(root,2.7,2.3,2.7,material('#6ba9ae',{transparent:true,opacity:.52,roughness:.15,metalness:.2}),0,1.4,0);
  for(let i=0;i<5;i++){const fish=group(root);fish.userData.dynamic=true;sphere(fish,.3,.17,.12,['#e2bb59','#e69b77'][i%2]);const tail=cone(fish,.19,.25,'#e5c173',-.32,0,0);tail.rotation.z=Math.PI/2;animation.push(t=>{const a=t*.35+i;fish.position.set(Math.cos(a)*1.8,1.3+i*.25,Math.sin(a)*1.8);fish.rotation.y=-a;});}
 }else if(theme==='garden'){
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;cyl(root,.065,2.5,'#65835a',Math.cos(a)*2,1.6,Math.sin(a)*2);for(let j=0;j<5;j++){const b=j/5*Math.PI*2;sphere(root,.45,.18,.45,i%2?'#c78194':'#e1c57c',Math.cos(a)*2+Math.cos(b)*.3,2.85,Math.sin(a)*2+Math.sin(b)*.3);}sphere(root,.22,.18,.22,'#e8c160',Math.cos(a)*2,2.95,Math.sin(a)*2);}
 }else if(theme==='laboratory'){
  cyl(root,2.6,2.8,'#d9e2da',0,1.8,0);sphere(root,2.6,1.6,2.6,color,0,3.2,0);for(let i=0;i<3;i++){const ring=torus(root,1.1,.055,gold,0,5.15,0);ring.rotation.set(i*.8,.7+i,.6);}
 }else{
  // A complete rotating carousel for playful or as-yet unclassified projects.
  cyl(root,3,.24,color,0,.6,0);cyl(root,.22,4,cream,0,2.6,0);cone(root,3.55,1.5,color,0,4.55,0);
  const carousel=group(root);carousel.userData.dynamic=true;for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const g=group(carousel,Math.cos(a)*2.35,0,Math.sin(a)*2.35);cyl(g,.055,3.5,gold,0,2.35,0);sphere(g,.5,.23,.22,cream,0,1.35,0);sphere(g,.2,.37,.19,cream,.32,1.65,0);for(const x of [-.25,.25])cyl(g,.07,.5,gold,x,1,0);g.rotation.y=-a;}
  animation.push(t=>carousel.rotation.y=t*.13);
 }
 return {root,animation};
}
export function createAttraction(parent,item,position,index){
 const outer=group(parent,...position);const built=item.theme==='bumper'?buildBumper(outer):item.theme==='theater'?buildTheater(outer):item.theme==='music'?buildMusic(outer):buildGeneric(outer,item.theme,item.color);
 const character=disneyCharacter(outer,item.character,1.05);character.position.set(item.theme==='theater'?-3.5:3.7,.55,4.35);
 const motion=item.theme==='music'?'dance':item.theme==='bumper'?'drive':'wave';built.animation.push(t=>character.userData.animate(t+index,motion));
 const pick= new THREE.Mesh(new THREE.BoxGeometry(9,7,8),new THREE.MeshBasicMaterial({visible:false}));pick.position.y=3;pick.userData.attraction=item.id;outer.add(pick);
 return {root:outer,animation:built.animation,pick,label:new THREE.Vector3(position[0],position[1]+.6,position[2]+5.5),character};
}
export function buildCinema(parent,video){
 const root=group(parent);root.userData.dynamic=true;
 const carpet=material('#332d38',{roughness:1}),wall=material('#2c3441',{roughness:.88}),gold=material('#d3ae68',{metalness:.5,roughness:.4});
 box(root,23,.4,31,carpet,0,-.3,-2);box(root,23,13,.5,wall,0,6,-16);box(root,.4,13,31,wall,-11.5,6,-1);box(root,.4,13,31,wall,11.5,6,-1);
 box(root,17.5,10,.4,'#11151d',0,6,-15.6);box(root,18,.14,.55,gold,0,11.1,-15.3);box(root,18,.14,.55,gold,0,1,-15.3);
 for(const x of [-8.95,8.95])box(root,.14,10.2,.55,gold,x,6.05,-15.3);
 const videoMap=new THREE.VideoTexture(video);videoMap.colorSpace=THREE.SRGBColorSpace;
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(16.8,9.45),new THREE.MeshBasicMaterial({map:videoMap,toneMapped:false}));screen.position.set(0,6,-15.25);root.add(screen);
 // Pleated velvet curtains frame the actual video screen.
 for(const side of [-1,1])for(let i=0;i<8;i++)cyl(root,.28,11,'#673443',side*(9.1+i*.27),6,-15.15);
 for(let row=0;row<5;row++)for(let col=-5;col<=5;col++){
  if(col===0)continue;const x=col*1.72,z=-7+row*3.5,y=row*.37;
  box(root,1.5,.18,1.5,'#292c34',x,y,z);rounded(root,1.25,1.3,.36,.17,'#804956',x,y+.9,z+.4);rounded(root,1.18,.22,.92,.1,'#986070',x,y+.42,z-.08);
  for(const side of [-1,1])rounded(root,.12,.2,1.03,.045,gold,x+side*.68,y+.7,z);
 }
 for(const side of [-1,1])for(let z=-11;z<15;z+=4){sphere(root,.12,.12,.12,material('#ffd886',{emissive:'#ffbd66',emissiveIntensity:1}),side*10.7,3,z);box(root,.06,.4,.26,gold,side*11.2,3,z);}
 const light=new THREE.PointLight('#bbd8e7',85,28,2);light.position.set(0,6,-10);root.add(light);
 const usher=disneyCharacter(root,'minnie',1.1);usher.position.set(8.6,.15,-11.4);
 return {root,screen,videoMap,animate:t=>usher.userData.animate(t,'wave')};
}

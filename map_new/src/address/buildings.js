import * as THREE from 'three';
import {facadeFor} from './facades.js';
import {PhotoMaterials} from './materials.js';
import {box,slab,wall,rail,roofRail,label,piloti} from './architecture.js';

const rectangle=(w,d)=>[{x:-w/2,z:-d/2},{x:w/2,z:-d/2},{x:w/2,z:d/2},{x:-w/2,z:d/2}];
const window=(x,y,w=1.65,h=1.5,extra={})=>({x,y,w,h,...extra});

function palette(photo,settings,base,renderer) {
  const p=new PhotoMaterials(base,renderer),options={usePhotos:settings.photoTexture!==false,color:settings.color};
  const surface=(key,fallback)=>p.surface(photo.materials[key]||fallback,options);
  const mats={
    upper:surface('upper',{kind:'plaster',color:photo.color,span:[1,1]}),
    lower:surface('lower',{kind:'panel',color:'#949696',span:[1.8,.6]}),
    brick:surface('brick',{kind:'brick',color:photo.color,span:[1.3,.6]}),
    base:surface('base',{kind:'brick',color:photo.baseColor,span:[1.3,.6]}),
    concrete:p.surface({kind:'plaster',color:'#c5c2b6',span:[1,1]},{tintable:false}),
    roof:p.surface({kind:'stone',color:'#92968e',span:[.6,.6]},{tintable:false}),
    paving:p.surface({kind:'stone',color:'#a5a69e',span:[.6,.6]},{tintable:false}),
    frame:p.plain('#30383b',{metalness:.55,roughness:.36}),
    white:p.plain('#d5d6cc',{metalness:.15,roughness:.45}),
    rail:p.plain('#293335',{metalness:.65,roughness:.32}),
    sill:p.plain('#9b9c96',{metalness:.2,roughness:.56}),
    dark:p.plain('#363c3c'),
    accent:p.surface({kind:'panel',color:'#d7b833',span:[1.8,.6]}),
    marking:p.plain('#e7e6d4'),rubber:p.plain('#393c36'),
    glass:p.glass(),warm:p.glass(true),
    frost:p.plain('#adb7ba',{roughness:.34,metalness:.14,transparent:true,opacity:.86}),
  };
  return {p,mats};
}

function floors(root,w,d,p,m,{roof=true}={}) {
  for(let level=1;level<p.floors;level++)box(root,w-.45,.16,d-.45,m.concrete,0,p.baseHeight+(level-1)*p.floorHeight,0);
  if(roof)box(root,w+.08,.18,d+.08,m.roof,0,p.height,0);
}
function parapet(root,w,d,y,m,height=.55) {
  for(const z of [-d/2,d/2])box(root,w,height,.18,m,0,y+height/2,z);
  for(const x of [-w/2,w/2])box(root,.18,height,d,m,x,y+height/2,0);
}
function outlineRail(root,points,y,m) {
  for(let i=0;i<points.length;i++) {
    const a=points[i],b=points[(i+1)%points.length],len=Math.hypot(b.x-a.x,b.z-a.z);
    const g=new THREE.Group();g.position.set((a.x+b.x)/2,y,(a.z+b.z)/2);g.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);root.add(g);
    rail(g,len,m,{height:.72,depth:0});
  }
}
function steps(root,x,z,m) {for(let i=0;i<4;i++)box(root,1.8,.15*(i+1),1.2-i*.23,m,x,.075*(i+1),z-i*.12);}
function pipe(root,points,mat,radius=.035) {
  for(let i=1;i<points.length;i++) {
    const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),delta=b.clone().sub(a);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),8),mat);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.castShadow=true;root.add(mesh);
  }
}
function gable(root,x,z,width,height,y,mat,cap) {
  const shape=new THREE.Shape([new THREE.Vector2(-width/2,0),new THREE.Vector2(0,height),new THREE.Vector2(width/2,0)]);
  const g=new THREE.ExtrudeGeometry(shape,{depth:.23,bevelEnabled:false});
  const mesh=new THREE.Mesh(g,mat);mesh.position.set(x,y,z-.23);mesh.castShadow=true;root.add(mesh);
  pipe(root,[[x-width/2,y,z+.015],[x,y+height,z+.015],[x+width/2,y,z+.015]],cap,.055);
}

function neonadeuli(root,p,m,materials) {
  // Align an architectural working frame to the published OSM long edge, then
  // rotate the completed geometry back to that edge's geographic orientation.
  const raw=p.footprint;let longest=0,edge=0;
  for(let i=0;i<raw.length;i++){const a=raw[i],b=raw[(i+1)%raw.length],len=Math.hypot(a.x-b.x,a.z-b.z);if(len>longest){longest=len;edge=i;}}
  const a=raw[(edge+1)%raw.length],b=raw[edge],ux=(b.x-a.x)/longest,uz=(b.z-a.z)/longest;
  const local=raw.map(v=>({x:(v.x-a.x)*ux+(v.z-a.z)*uz-longest/2,z:-(v.x-a.x)*uz+(v.z-a.z)*ux}));
  const depth=-Math.min(...local.map(v=>v.z));local.forEach(v=>v.z+=depth/2);
  const w=longest,d=depth,g=new THREE.Group();root.add(g);g.rotation.y=-Math.atan2(uz,ux);
  const rotation=g.rotation.y;
  const baseWidth=Math.min(18,w*.29),baseX=-w/2+baseWidth/2;
  const baseFront=[-5.4,-1.8,2.8,6.2].map(x=>window(x,.9,2.1,1.3,{frame:m.dark}));
  // Only a thin backing volume: facade openings have a recessed dark interior.
  box(g,baseWidth,p.baseHeight,d-.6,m.dark,baseX,p.baseHeight/2,-.35);
  wall(g,{w:baseWidth,h:p.baseHeight,x:baseX,z:d/2+.02,mat:m.base,mats:m,openings:baseFront});
  const open=new THREE.Group();open.position.x=baseWidth/2;g.add(open);
  piloti(open,{w:w-baseWidth,d,h:p.baseHeight,mats:m,closed:.32});
  for(let x=-w/2+baseWidth+2.5;x<w/2-1;x+=5.7){const column=box(g,.46,p.baseHeight,.5,m.white,x,p.baseHeight/2,d/2-.22);column.userData.feature='piloti-column';}
  const endWindows=[];for(let i=0;i<3;i++)endWindows.push(window(-2.8+i*2.6,1.1,1.5,1.3));
  wall(g,{w:d,h:p.baseHeight,x:-w/2-.015,rotation:-Math.PI/2,mat:m.base,mats:m,openings:endWindows});
  for(let floor=1;floor<p.floors;floor++) {
    const y=p.baseHeight+(floor-1)*p.floorHeight,mat=floor<=2?m.lower:m.upper;
    slab(g,local.map(v=>({x:v.x*.98,z:v.z*.98})),y,.13,m.concrete);
    for(let i=0;i<local.length;i++) {
      if(i===edge)continue;
      const a=local[i],b=local[(i+1)%local.length],len=Math.hypot(b.x-a.x,b.z-a.z);
      const holes=[];
      if(i===0)holes.push(window(-.7,.95,.7,.58,{frame:m.white}));
      else for(let x=-len/2+1.8;x<len/2-1.1;x+=4)holes.push(window(x,.85,1.5,1.35,{frame:m.white}));
      wall(g,{w:len,h:p.floorHeight,x:(a.x+b.x)/2,y,z:(a.z+b.z)/2,rotation:Math.PI-Math.atan2(b.z-a.z,b.x-a.x),mat,mats:m,openings:holes});
    }
    const bay=w/10;
    for(let i=0;i<10;i++) {
      const offset=[0,0,-.32,-.32,.1,-.32,0,-.18,0,-.2][i];
      const accent=(i===7&&(floor===1||floor===2))||(i===8&&floor===2);
      const windows=[-.255,.255].map((t,j)=>window(bay*t,.72,(i%3===1&&j===0)?1.18:1.87,1.54,{frame:m.white,balcony:i%3===1?'':true}));
      const facade=wall(g,{w:bay,h:p.floorHeight,x:-w/2+bay*(i+.5),y,z:d/2+offset,mat:accent?m.accent:mat,mats:m,openings:windows});
      // Horizontal reveals continue through the panel surfaces, excluding glass.
      for(const seamY of [.37,2.5])box(facade,bay,.012,.012,m.sill,0,seamY,.008);
    }
  }
  slab(g,local,p.height,.2,m.upper);outlineRail(g,local,p.height+.22,m.white);
  for(const x of [-w*.15,w*.39]){box(g,3.7,1.35,3,m.upper,x,p.height+.675,-d*.14);box(g,3.8,.08,3.1,m.sill,x,p.height+1.4,-d*.14);}
  label(g,'신내\n소행주',3.7,2.1,materials,{x:-w/2-.16,y:p.height-1.4,z:-.7,rotation:-Math.PI/2,color:'#747970'});
  return {width:w,depth:d,rotation,azimuth:-1.02+rotation};
}

function onum(root,p,m,materials) {
  const w=p.width,d=p.depth;
  piloti(root,{w,d,h:p.baseHeight,mats:m});floors(root,w,d,p,m);
  const rows=[
    [window(-4.6,.8,1.45,1.65),window(-1.9,1.2,1.0,.9),window(1.8,.7,2.55,1.7,{balcony:'glass'})],
    [window(-4.6,1.2,.85,1),window(-1.7,.42,.8,2.0),window(1.9,.65,2.8,1.6,{balcony:'glass'})],
    [window(-4.7,.8,.8,1.2),window(-1.8,.75,2.55,1.7),window(2.6,.7,1.75,1.6)],
    [window(-4.4,.65,1.75,1.8),window(-.8,.95,1.0,1.1),window(1.9,1.45,.65,.55),window(1.9,.6,.65,.55)],
  ];
  for(let level=1;level<p.floors;level++) {
    const y=p.baseHeight+(level-1)*p.floorHeight,openings=rows[(level-1)%rows.length].map(o=>({...o,h:Math.min(o.h,p.floorHeight-o.y-.12)}));
    openings.push(window(w/2-.85,.55,1.6,1.7));
    wall(root,{w,h:p.floorHeight,y,z:d/2,mat:m.brick,mats:m,openings});
    const sideWindows=[window(-d*.32,.85,1.05,1.35),window(-d*.08,.7,1.8,1.65,{balcony:level===1?'glass':false}),window(d*.17,1.35,1.0,.7),window(d/2-.9,.55,1.7,1.7)];
    wall(root,{w:d,h:p.floorHeight,x:w/2,y,rotation:Math.PI/2,mat:m.brick,mats:m,openings:sideWindows});
    wall(root,{w:d,h:p.floorHeight,x:-w/2,y,rotation:-Math.PI/2,mat:m.brick,mats:m,openings:[window(-d*.2,.85,1.5,1.35),window(d*.22,.85,1.3,1.35)]});
    wall(root,{w,h:p.floorHeight,y,z:-d/2,rotation:Math.PI,mat:m.brick,mats:m,openings:[window(-3,.8,1.5,1.5),window(2.5,.8,1.5,1.5)]});
    // Black corner bay surrounds wrap onto the adjacent elevation.
    for(const z of [d/2+.07]){box(root,1.84,.095,.38,m.frame,w/2-.9,y+.52,z);box(root,.095,1.86,.38,m.frame,w/2-.04,y+1.4,z);}
  }
  parapet(root,w,d,p.height,m.brick,.45);roofRail(root,w-.25,d-.25,p.height+.45,m.rail);
  gable(root,-w*.28,d/2,4.4,1.5,p.height+.45,m.brick,m.frame);
  const service=new THREE.Group();service.position.set(-1.7,p.height,-d*.23);root.add(service);
  box(service,3.8,3.4,4.6,m.dark,0,1.7,0);box(service,3.4,3.4,.1,m.brick,0,1.7,2.34);
  box(service,3.95,.12,4.75,m.frame,0,3.46,0);
  for(let x=-1.75;x<=1.75;x+=.45)box(service,.025,3.4,.025,m.sill,x,1.7,-2.34);
  box(service,.95,2.1,.06,m.frame,.7,1.05,2.42);
  for(let i=0;i<10;i++)box(service,.75,.032,.032,m.sill,-1.25,.35+i*.3,2.46);
  pipe(root,[[w/2+.12,.15,d/2-.2],[w/2+.12,p.height-3.8,d/2-.2],[w/2+.12,p.height-3.8,d/2-1.5],[w/2+.12,p.height+.3,d/2-1.5]],m.frame);
  pipe(root,[[-w*.28,.2,d/2+.1],[-w*.28,p.height*.65,d/2+.1],[-w*.4,p.height*.85,d/2+.1],[-w*.4,p.height+.2,d/2+.1]],m.frame);
  box(root,1.7,2.8,.4,m.frame,-3.3,1.4,d/2+.12);box(root,1.15,2.2,.45,m.dark,-3.3,1.25,d/2+.16);steps(root,-3.3,d/2+.75,m.concrete);
  label(root,'15',.22,.2,materials,{x:-2.77,y:1.9,z:d/2+.39,color:'#d5dbd8'});
  return {width:w,depth:d,rotation:0,azimuth:.65};
}

function urban(root,p,m) {
  const w=p.width,d=p.depth,split=w*.26;
  piloti(root,{w,d,h:p.baseHeight,mats:m});
  for(let level=1;level<p.floors;level++) {
    const shortened=level>=p.floors-2,fw=shortened?w-split:w,x=shortened?-split/2:0,y=p.baseHeight+(level-1)*p.floorHeight;
    box(root,fw-.45,.15,d-.45,m.concrete,x,y,0);
    const holes=[-w*.31,-w*.02,w*.23,w*.4].filter(v=>v<x+fw/2-.7).map((v,i)=>window(v-x,.62,i===0?2.25:1.45,1.77));
    wall(root,{w:fw,h:p.floorHeight,x,y,z:d/2,mat:m.brick,mats:m,openings:holes});
    for(const side of [-1,1])wall(root,{w:d,h:p.floorHeight,x:x+side*fw/2,y,rotation:side*Math.PI/2,mat:m.brick,mats:m,openings:[window(-2.65,.62,1.9,1.77),window(.2,.62,2.15,1.77),window(3,.7,1.4,1.65)]});
    wall(root,{w:fw,h:p.floorHeight,x,y,z:-d/2,rotation:Math.PI,mat:m.brick,mats:m,openings:[window(-fw*.25,.8,1.5,1.5),window(fw*.25,.8,1.5,1.5)]});
  }
  const topW=w-split,upperRoof=new THREE.Group();upperRoof.position.x=-split/2;root.add(upperRoof);
  box(upperRoof,topW,.18,d,m.roof,0,p.height,0);parapet(upperRoof,topW,d,p.height,m.brick,.35);
  const terrace=new THREE.Group();terrace.position.x=w/2-split/2;root.add(terrace);
  const ty=p.baseHeight+Math.max(0,p.floors-3)*p.floorHeight;box(terrace,split,.16,d,m.roof,0,ty,0);roofRail(terrace,split,d,ty,m.rail);
  for(const x of [-4,-2]) {box(root,.65,1.1,.65,m.white,x,p.height+.55,-d*.2);box(root,.82,.1,.8,m.sill,x,p.height+1.15,-d*.2);}
  return {width:w,depth:d,rotation:0,azimuth:-.58};
}

function saneunjari(root,p,m) {
  const w=p.width,d=p.depth;
  piloti(root,{w,d,h:p.baseHeight,mats:m,closed:.45});floors(root,w,d,p,m);
  for(let level=1;level<p.floors;level++) {
    const y=p.baseHeight+(level-1)*p.floorHeight;
    wall(root,{w,h:p.floorHeight,y,z:d/2,mat:m.upper,mats:m,openings:[window(-3.1,.95,.62,.95),window(-1.45,.8,level===2?.75:1.5,1.3),window(1.3,.8,1.65,1.3),window(4,.8,1.65,1.3)]});
    for(const side of [-1,1])wall(root,{w:d,h:p.floorHeight,x:side*w/2,y,rotation:side*Math.PI/2,mat:m.upper,mats:m,openings:[window(-d*.28,.55,2.25,1.7,{balcony:true}),window(d*.18,.55,2.25,1.7,{balcony:true})]});
    wall(root,{w,h:p.floorHeight,y,z:-d/2,rotation:Math.PI,mat:m.upper,mats:m,openings:[window(-2,.8,1.5,1.4),window(2,.8,1.5,1.4)]});
  }
  parapet(root,w,d,p.height,m.upper,.65);
  gable(root,-w*.28,d/2,w*.43,.7,p.height+.65,m.upper,m.frame);gable(root,w*.26,d/2,w*.46,.8,p.height+.65,m.upper,m.frame);
  pipe(root,[[-3.9,.2,d/2+.1],[-3.9,p.height+.15,d/2+.1]],m.white,.045);
  return {width:w,depth:d,rotation:0,azimuth:.58};
}

function amsa(root,p,m,materials) {
  const w=p.width,d=p.depth;
  piloti(root,{w,d,h:p.baseHeight,mats:m,closed:.23});floors(root,w,d,p,m);
  for(let level=1;level<p.floors;level++) {
    const y=p.baseHeight+(level-1)*p.floorHeight;
    const split=-.85,leftW=w/2+split,rightW=w/2-split;
    wall(root,{w:leftW,h:p.floorHeight,x:-w/2+leftW/2,y,z:d/2,mat:m.upper,mats:m,openings:[window(-2.45-(-w/2+leftW/2),.62,2.3,1.78,{balcony:true})]});
    wall(root,{w:rightW,h:p.floorHeight,x:split+rightW/2,y,z:d/2,mat:m.upper,mats:m,bands:[{y:.62,h:1.78,mat:m.lower}],openings:[window(.6-(split+rightW/2),.62,1.12,1.78,{transom:true}),window(3.4-(split+rightW/2),1.17,2.1,1.23)]});
    for(const side of [-1,1])wall(root,{w:d,h:p.floorHeight,x:side*w/2,y,rotation:side*Math.PI/2,mat:m.upper,mats:m,openings:[window(-d*.23,.8,1.65,1.5),window(d*.23,.8,1.65,1.5)]});
    wall(root,{w,h:p.floorHeight,y,z:-d/2,rotation:Math.PI,mat:m.upper,mats:m,openings:[window(-2.4,.8,1.6,1.5),window(2.4,.8,1.6,1.5)]});
  }
  parapet(root,w,d,p.height,m.upper,.45);
  for(const x of [1.55,1.68,1.81])pipe(root,[[x,.2,d/2+.1],[x,p.height-1,d/2+.1]],m.sill,.022);
  label(root,'암사예家',2.7,.55,materials,{x:-1.65,y:p.baseHeight-.2,z:d/2+.16,color:'#26568f',background:'#c0c2c0'});
  return {width:w,depth:d,rotation:0,azimuth:.27};
}

function koinonia(root,p,m) {
  const w=p.width,d=p.depth,bw=w+3.5,bd=d+2;
  box(root,bw,.16,bd,m.paving,0,.02,.8);
  wall(root,{w:bw,h:p.baseHeight,z:bd/2+.8,mat:m.brick,mats:m,openings:[window(-6.6,.1,2.9,2.65,{warm:true}),window(-3.6,.1,2.9,2.65,{warm:true}),window(-.6,.1,2.9,2.65,{warm:true}),window(2.4,.1,2.9,2.65,{warm:true}),window(6.5,0,1.5,2.8)]});
  for(const side of [-1,1])wall(root,{w:bd,h:p.baseHeight,x:side*bw/2,z:.8,rotation:side*Math.PI/2,mat:m.brick,mats:m,openings:[-6,-2.5,1,4.5,7.6].map(x=>window(x,.1,2.7,2.65,{warm:true}))});
  const curves=[];const r=4,left=-bw/2+r,right=bw/2,front=bd/2+.8;
  // Rounded street corner, sampled into real fins oriented along its tangent.
  for(let x=left;x<=right;x+=.23)curves.push({x,z:front,nx:0,nz:1});
  for(let angle=0;angle<=Math.PI/2;angle+=.23/r)curves.push({x:left-r*Math.sin(angle),z:front-r+r*Math.cos(angle),nx:-Math.sin(angle),nz:Math.cos(angle)});
  for(let z=front-r;z>-bd/2;z-=.23)curves.push({x:-bw/2,z,nx:-1,nz:0});
  const lowerFloors=Math.min(2,p.floors-1);
  for(let level=1;level<=lowerFloors;level++) {
    const y=p.baseHeight+(level-1)*p.floorHeight;
    box(root,bw,.25,bd,m.dark,0,y,.8);
    for(const side of [-1,1])wall(root,{w:bd-1.6,h:p.floorHeight,x:side*(bw/2-.8),y,z:.7,rotation:side*Math.PI/2,mat:m.brick,mats:m,openings:[-5,-1.5,2,5.5].map(x=>window(x,.3,2.8,2.3,{warm:true}))});
    wall(root,{w:bw-1.6,h:p.floorHeight,y,z:front-.8,mat:m.brick,mats:m,openings:[-6.3,-2.1,2.1,6.3].map(x=>window(x,.3,3.2,2.3,{warm:true}))});
    for(const v of curves) {const fin=box(root,.045,p.floorHeight-.18,.25,m.white,v.x,y+p.floorHeight/2,v.z);fin.rotation.y=Math.atan2(v.nx,v.nz);fin.userData.feature='louver';}
  }
  box(root,bw,.35,bd,m.dark,0,p.baseHeight+lowerFloors*p.floorHeight,.8);
  for(let level=3;level<p.floors;level++) {
    const y=p.baseHeight+(level-1)*p.floorHeight;
    box(root,w-.45,.16,d-.45,m.concrete,0,y,0);
    const holes=Array.from({length:8},(_,i)=>window(-w/2+1.25+i*(w-2.5)/7,.28,1.05,2.15,{warm:true,transom:true}));
    wall(root,{w,h:p.floorHeight,y,z:d/2,mat:m.brick,mats:m,bands:[{y:2.5,h:.5,mat:m.dark}],openings:holes});
    for(const side of [-1,1])wall(root,{w:d,h:p.floorHeight,x:side*w/2,y,rotation:side*Math.PI/2,mat:m.brick,mats:m,bands:[{y:2.5,h:.5,mat:m.dark}],openings:[window(-5,.3,1.15,2.1,{warm:true}),window(-1.6,.3,2.9,2.1,{balcony:'glass',warm:true}),window(4,.3,3.2,2.1,{balcony:'glass',warm:true})]});
    wall(root,{w,h:p.floorHeight,y,z:-d/2,rotation:Math.PI,mat:m.brick,mats:m,openings:[-5,-1.6,1.6,5].map(x=>window(x,.4,1.4,1.9,{warm:true}))});
  }
  box(root,w,.2,d,m.roof,0,p.height,0);parapet(root,w,d,p.height,m.dark,.7);roofRail(root,w-.2,d-.2,p.height+.7,m.white);
  const roofRoom=new THREE.Group();roofRoom.position.set(-2,0,-2);root.add(roofRoom);
  box(roofRoom,w*.58,1.65,d*.5,m.brick,0,p.height+.825,0);roofRail(roofRoom,w*.6,d*.52,p.height+1.7,m.rail);
  return {width:bw,depth:bd,rotation:0,azimuth:-.32};
}

export function buildReviewedExterior(root,profile,site,settings,base,renderer) {
  const photo=facadeFor(site);if(!photo)return null;
  const {p,mats}=palette(photo,settings,base,renderer);
  const build={neonadeuli,onum,urban,saneunjari,amsa,koinonia}[photo.type];
  const framing=build(root,profile,mats,p);
  const counts={};root.traverse(o=>{if(o.userData.feature)counts[o.userData.feature]=(counts[o.userData.feature]||0)+1;});
  return {palette:p,framing,features:photo.features,counts};
}

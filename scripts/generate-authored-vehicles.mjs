// Project-authored exterior approximations, not manufacturer CAD or downloaded models.
// X = length (front negative), Y = up, Z = width. No photographs or image planes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from '@gltf-transform/extensions';
import { dedup, prune, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const profiles = [
  {id:'bmw_i5_edrive40_2026',kind:'bmw',length:5.060,width:1.900,height:1.515,wheelbase:2.995,frontOverhang:.90,wheelRadius:.365,belt:1.04,paint:'#365a88',roof:'#365a88',cabin:[-.99,-.30,.94,1.57],reference:'https://www.bmw.co.uk/en/all-models/bmw-i/i5/bmw-i5-technical-data.html'},
  {id:'audi_q4_45_etron_2026',kind:'q4',length:4.588,width:1.865,height:1.632,wheelbase:2.764,frontOverhang:.854,wheelRadius:.375,belt:1.10,paint:'#4b5d7e',roof:'#4b5d7e',cabin:[-.91,-.35,1.43,2.04],reference:'https://www.audi.com/en/electric-suvs-in-the-premium-compact-segment-the-audi-q4-e-tron-and-the-q4-sportback-e-tron-until-2026-13887/everyday-usability-13893'},
  {id:'audi_q6_etron_quattro_2025',kind:'q6',length:4.771,width:1.939,height:1.648,wheelbase:2.889,frontOverhang:.906,wheelRadius:.385,belt:1.13,paint:'#9aaeb9',roof:'#9aaeb9',cabin:[-1.02,-.42,1.51,2.11],reference:'https://www.audi.com/en/press-releases/experience-vorsprung-durch-technik-the-new-audi-q6-e-tron-15923'},
  {id:'mini_electric_cooper_2026',kind:'mini',length:3.858,width:1.756,height:1.460,wheelbase:2.526,frontOverhang:.746,wheelRadius:.335,belt:.96,paint:'#dca029',roof:'#101820',cabin:[-.82,-.47,1.11,1.66],reference:'https://www.mini-egypt.com/content/dam/MINI/marketUV4/mini-egypt_com/brochures/The_All-New_MINI_Cooper_Brochure.pdf'},
];
const V = p => new THREE.Vector3(...p);
const lerp = THREE.MathUtils.lerp;
const materials = {
  paint:{color:'#879faf',metal:.38,rough:.32,coat:1},roof:{color:'#879faf',metal:.45,rough:.25,coat:1},
  glass:{color:'#112636',metal:.75,rough:.30,alpha:1},glassTrim:{color:'#11171d',metal:.15,rough:.3},
  trim:{color:'#202730',metal:.3,rough:.38},chrome:{color:'#aabcc7',metal:.95,rough:.22},
  grille:{color:'#121b26',metal:.45,rough:.3},interior:{color:'#2d343c',metal:0,rough:.9},
  wheel_tire:{color:'#161a21',metal:0,rough:.91},wheel_rim:{color:'#a9b9c6',metal:.92,rough:.24},
  wheel_dark:{color:'#1c2632',metal:.6,rough:.3},wheel_brake:{color:'#6a737b',metal:.7,rough:.45},
  wheel_caliper:{color:'#b64735',metal:.35,rough:.4},whiteLight:{color:'#bfe7ff',metal:.1,rough:.18,emissive:[.55,.75,1]},
  redLight:{color:'#bb1e35',metal:.15,rough:.25,emissive:[.45,.005,.009]},badgeBlue:{color:'#3974ab',metal:.5,rough:.3},
};

export function buildVehicle(p) {
  const buckets = new Map();
  function add(material, geometry) {
    geometry.deleteAttribute('uv');
    geometry.deleteAttribute('uv1');
    if(!geometry.index){const n=geometry.getAttribute('position').count;geometry.setIndex(Array.from({length:n},(_,i)=>i));}
    if(!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    const list=buckets.get(material)??[];list.push(geometry);buckets.set(material,list);
  }
  function box(mat, size, at, radius=.015, rotation=[0,0,0]) {
    const g=new RoundedBoxGeometry(...size,3,Math.min(radius,...size.map(v=>v/3)));
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));g.translate(...at);add(mat,g);
  }
  function ball(mat,size,at){const g=new THREE.SphereGeometry(1,24,12);g.scale(...size).translate(...at);add(mat,g);}
  function line(mat, points, radius=.005, closed=false) {
    const curve=new THREE.CatmullRomCurve3(points.map(V),closed,'centripetal');
    add(mat,new THREE.TubeGeometry(curve,Math.max(24,points.length*6),radius,6,closed));
  }
  function patch(mat, nu, nv, fn) {
    const vertices=[],indices=[];
    for(let u=0;u<=nu;u++)for(let v=0;v<=nv;v++)vertices.push(...fn(u/nu,v/nv));
    for(let u=0;u<nu;u++)for(let v=0;v<nv;v++){const a=u*(nv+1)+v,b=a+nv+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)).setIndex(indices);g.computeVertexNormals();add(mat,g);
  }
  function panel(mat, points, front=true, offset=0, bevel=.009) {
    const shape=new THREE.Shape(points.map(([z,y])=>new THREE.Vector2(z,y)));
    const g=new THREE.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:24});
    g.rotateY(front?-Math.PI/2:Math.PI/2).translate((front?-1:1)*(p.length/2-.025+offset),0,0);add(mat,g);
  }
  const half=p.width/2,front=-p.length/2,rear=p.length/2;
  const wheels=[front+p.frontOverhang,front+p.frontOverhang+p.wheelbase];
  const bodyHalf=x=>half*(1-.12*Math.pow(Math.abs(x)/(p.length/2),6));
  const belt=x=>p.belt-.12*Math.pow(Math.abs(x)/(p.length/2),5)+.025*(x/p.length);
  const lower=x=>Math.max(.22,...wheels.map(w=>Math.abs(x-w)<p.wheelRadius+.055?p.wheelRadius+Math.sqrt((p.wheelRadius+.055)**2-(x-w)**2):.22));
  const sideZ=(x,y)=>bodyHalf(x)*(.88+.115*Math.sin(THREE.MathUtils.clamp((y-.22)/(belt(x)-.22),0,1)*Math.PI*.8));
  const [a,b,c,d]=p.cabin, roofHalf=half*(p.kind==='mini'?.80:.76);
  // Wheel arches are cut into the side surface instead of hidden behind flat slabs.
  for(const s of [-1,1]) {
    patch('paint',144,16,(u,v)=>{const x=lerp(front,rear,u),y=lerp(lower(x),belt(x),v);return [x,y,s*sideZ(x,y)];});
    for(const wx of wheels){
      const arch=Array.from({length:41},(_,i)=>{const t=Math.PI*i/40,x=wx+(p.wheelRadius+.057)*Math.cos(t),y=p.wheelRadius+(p.wheelRadius+.057)*Math.sin(t);return[x,y,s*(sideZ(x,y)+.004)];});
      line(p.kind==='bmw'?'paint':'trim',arch,p.kind==='bmw'?.017:.026);
      line('trim',[[wheels[0]+.46,.225,s*half*.955],[0,.22,s*half*.96],[wheels[1]-.46,.225,s*half*.955]],.032);
      // Shoulder crease and lower sculpted sill.
      line('paint',Array.from({length:32},(_,i)=>{const x=lerp(front+.20,rear-.16,i/31),y=belt(x)-.085;return[x,y,s*(sideZ(x,y)+.001)];}),.008);
    }
  }
  const top=(x,z)=>belt(x)+.05*(1-(z/bodyHalf(x))**2);
  for(const [x0,x1] of [[front,a],[d,rear]])patch('paint',36,30,(u,v)=>{const x=lerp(x0,x1,u),z=(v*2-1)*bodyHalf(x);return[x,top(x,z),z];});
  for(const s of [-1,1])patch('paint',40,5,(u,v)=>{const x=lerp(a,d,u),z=s*lerp(bodyHalf(x)*.9,bodyHalf(x),v);return[x,top(x,z),z];});
  // Rounded nose and rear bumper, with grille and lamp assemblies added below.
  for(const s of [-1,1])patch('paint',40,16,(u,v)=>{const z=(u*2-1)*bodyHalf(s*p.length/2),x=s*(p.length/2-.02*Math.sin(Math.PI*v));return[x,lerp(.23,top(s*p.length/2,z),v),z];});
  box('trim',[p.length-.3,.10,p.width*.78],[0,.245,0],.04);
  box('interior',[d-a-.12,.10,p.width*.83],[(a+d)/2,.51,0],.04);
  // Cabin glass follows the sloping pillars; each pane has actual depth and curvature.
  const footZ=x=>bodyHalf(x)*.90;
  const glassPoint=(x,y,s)=>[x,y,s*lerp(footZ(x),roofHalf,THREE.MathUtils.clamp((y-p.belt)/(p.height-p.belt),0,1))];
  for(const s of [-1,1]) {
    patch('glass',44,14,(u,v)=>{const left=lerp(a+.045,b+.04,v),right=lerp(d-.06,c-.035,v),x=lerp(left,right,u);return glassPoint(x,lerp(p.belt+.018,p.height-.055,v),s);});
    const perimeter=[glassPoint(a,p.belt,s),glassPoint(b,p.height-.03,s),glassPoint(c,p.height-.03,s),glassPoint(d,p.belt,s)];
    line('glassTrim',perimeter,.013,true);
    line(p.kind==='mini'?'chrome':'paint',[perimeter[0],perimeter[1]],.025);
    line('paint',[perimeter[2],perimeter[3]],p.kind==='mini'?.04:.030);
    line(p.kind==='mini'?'chrome':'paint',[perimeter[0],perimeter[3]],.016);
    const pillar=p.kind==='mini'?.50:.28;
    const edges=[pillar,...(p.kind==='mini'?[]:[c+.24])];
    for(const x of edges){const roofY=x<=c?p.height-.05:lerp(p.height-.05,p.belt,(x-c)/(d-c));line('glassTrim',[glassPoint(x,p.belt+.02,s),glassPoint(Math.min(x,c-.03),roofY,s)],.035);}
    // Door shut lines, handles and charging door.
    for(const dx of [a+.07,pillar,...(p.kind==='mini'?[]:[d-.18])]){
      const endY=lower(dx)+.025;
      line('grille',[[dx,p.belt-.015,s*sideZ(dx,p.belt)],[dx+.035,.76,s*(sideZ(dx,.76)+.004)],[dx+.02,Math.max(endY,.35),s*(sideZ(dx,Math.max(endY,.35))+.004)]],.003);
    }
    for(const dx of p.kind==='mini'?[.29]:[.06,1.10])box('chrome',[.15,.027,.025],[dx,p.belt-.115,s*(sideZ(dx,p.belt-.115)+.014)],.011);
    const chargerX=p.kind==='bmw'?wheels[1]+.05:wheels[1]-.11,chargerY=p.belt-.14;
    line('grille',[[chargerX-.055,chargerY-.06,s*(sideZ(chargerX,chargerY)+.004)],[chargerX-.055,chargerY+.06,s*(sideZ(chargerX,chargerY)+.004)],[chargerX+.07,chargerY+.06,s*(sideZ(chargerX,chargerY)+.004)],[chargerX+.07,chargerY-.06,s*(sideZ(chargerX,chargerY)+.004)]],.0025,true);
    line('trim',[[a+.18,p.belt+.03,s*footZ(a)],[a+.14,p.belt+.045,s*(half+.06)]],.022);
    ball(p.kind==='mini'?'roof':'paint',[.145,.065,.105],[a+.15,p.belt+.09,s*(half+.095)]);
    box('glass',[.015,.088,.15],[a+.26,p.belt+.09,s*(half+.095)],.015);
    if(p.kind.startsWith('q'))line('chrome',[[b-.06,p.height+.008,s*roofHalf*.84],[0,p.height+.03,s*roofHalf*.91],[c+.09,p.height+.006,s*roofHalf*.84]],.015);
  }
  patch('roof',36,22,(u,v)=>{const x=lerp(b,c,u),z=(2*v-1)*roofHalf;return[x,p.height-.032*(z/roofHalf)**2-.012*Math.cos(u*Math.PI*2),z];});
  // Curved front and rear windscreens, plus rubber seals and wipers.
  for(const [foot,tip,sign] of [[a,b,-1],[d,c,1]]){
    patch('glass',24,28,(u,v)=>{const z=(2*v-1)*lerp(footZ(foot),roofHalf,u);return[lerp(foot,tip,u)-sign*.045*Math.sin(v*Math.PI)*Math.sin(u*Math.PI),lerp(p.belt+.035,p.height-.033,u)+.018*Math.sin(v*Math.PI),z];});
    for(const u of [0,1])line('glassTrim',Array.from({length:16},(_,i)=>{const v=i/15;return[lerp(foot,tip,u),(u?p.height-.03:p.belt+.025)+.018*Math.sin(v*Math.PI),(2*v-1)*lerp(footZ(foot),roofHalf,u)];}),.012);
  }
  for(const s of [-1,1])line('trim',[[a+.1,p.belt+.075,s*.11],[a+.13,p.belt+.083,s*.35],[a+.16,p.belt+.09,s*.64]],.008);
  // Hood character lines are physical curves, not painted stripes.
  for(const s of [-1,1])line('paint',Array.from({length:22},(_,i)=>{const x=lerp(front+.16,a-.03,i/21),z=s*lerp(half*.38,half*.64,i/21);return[x,top(x,z)+.003,z];}),.006);
  // Seats, headrests, dashboard and steering wheel are visible behind the glass.
  for(const sx of [a+.62,c-.06])for(const sz of [-.41,.41]){
    box('interior',[.38,.12,.40],[sx,.64,sz],.045);
    box('interior',[.12,.44,.40],[sx+.17,.89,sz],.055,[0,0,-.10]);
    box('interior',[.105,.16,.25],[sx+.16,1.16,sz],.04);
  }
  box('interior',[.28,.20,p.width*.77],[a+.10,p.belt-.08,0],.04);
  const steering=new THREE.TorusGeometry(.14,.018,8,40);steering.rotateY(Math.PI/2).rotateZ(.35).translate(a+.32,p.belt-.03,.40);add('interior',steering);
  box('glassTrim',[.03,.17,.52],[a+.24,p.belt+.05,-.07],.018,[0,0,-.12]);

  // Four independent wheel assemblies: curved tyre, rim barrel, disc, caliper and split spokes.
  for(const wx of wheels)for(const s of [-1,1]){
    const wr=p.wheelRadius,track=half-.10,wz=s*track,face=s*(track+.123);
    const profile=[[wr*.68,-.104],[wr-.027,-.126],[wr-.006,-.09],[wr,-.055],[wr,.055],[wr-.006,.09],[wr-.027,.126],[wr*.68,.104],[wr*.68,-.104]].map(q=>new THREE.Vector2(...q));
    add('wheel_tire',new THREE.LatheGeometry(profile,72).rotateX(Math.PI/2).translate(wx,wr,wz));
    for(const offset of [-.066,0,.066])add('wheel_dark',new THREE.TorusGeometry(wr-.001,.002,4,72).translate(wx,wr,wz+offset));
    const cyl=(mat,r,depth,z)=>add(mat,new THREE.CylinderGeometry(r,r,depth,64).rotateX(Math.PI/2).translate(wx,wr,z));
    cyl('wheel_dark',wr*.725,.22,wz);cyl('wheel_brake',wr*.60,.012,face-s*.041);
    for(const r of [wr*.707,wr*.664])add('wheel_rim',new THREE.TorusGeometry(r,.008,6,72).translate(wx,wr,face));
    for(let i=0;i<5;i++){
      const angle=i*Math.PI*2/5;
      for(const split of [-1,1]){
        const shape=new THREE.Shape([new THREE.Vector2(-.023,.047),new THREE.Vector2(.023,.052),new THREE.Vector2(.068+split*.016,wr*.64),new THREE.Vector2(.016+split*.030,wr*.66)]);
        const g=new THREE.ExtrudeGeometry(shape,{depth:.017,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2,steps:1});
        g.rotateZ(angle+(p.kind==='mini'?.12:0));if(s<0)g.rotateY(Math.PI);g.translate(wx,wr,face);add('wheel_rim',g);
      }
      const x=wx+Math.sin(angle)*.052,y=wr+Math.cos(angle)*.052;
      add('wheel_rim',new THREE.CylinderGeometry(.008,.008,.015,8).rotateX(Math.PI/2).translate(x,y,face+s*.02));
      for(let j=0;j<5;j++){const t=angle+j*.10;ball('wheel_dark',[.004,.004,.002],[wx+Math.cos(t)*wr*.49,wr+Math.sin(t)*wr*.49,face-s*.032]);}
    }
    cyl('wheel_dark',.041,.025,face+s*.01);
    box('wheel_caliper',[.075,.17,.045],[wx+wr*.43,wr,face-s*.047],.02);
  }

  exteriorDetails({p,add,box,ball,line,panel,front,rear,half});
  // Round both ends continuously across panels and lamp/grille assemblies.
  // Preserve wheel geometry; all other surfaces share the same deformation.
  for(const [name,geometries] of buckets)if(!name.startsWith('wheel_'))for(const geometry of geometries){
    const position=geometry.getAttribute('position');
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
      const end=Math.pow(THREE.MathUtils.clamp(Math.abs(x)/(p.length/2),0,1),7);
      const corner=.26*Math.pow(Math.abs(z)/half,4);
      const noseLean=x<0?.09*THREE.MathUtils.clamp((y-.4)/.6,0,1):.03;
      position.setX(i,x-Math.sign(x)*end*(corner+noseLean));
    }
    geometry.computeVertexNormals();
  }
  return {profile:p,materials:{...materials,paint:{...materials.paint,color:p.paint},roof:{...materials.roof,color:p.roof}},geometries:[...buckets].map(([name,geometries])=>({name,geometry:mergeGeometries(geometries,false)}))};
}

function exteriorDetails(ctx) {
  const {p,add,box,line,panel,front,rear,half}=ctx;
  const frontX=front-.004;
  const ring=(mat,r,tube,at,scale=[1,1,1],rotation=[0,0,0])=>{
    const g=new THREE.TorusGeometry(r,tube,8,64);g.scale(...scale).applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation))).translate(...at);add(mat,g);
  };
  const octagon=(z,y,w,h)=>[[z-w*.36,y-h*.5],[z+w*.36,y-h*.5],[z+w*.5,y-h*.27],[z+w*.5,y+h*.28],[z+w*.36,y+h*.5],[z-w*.36,y+h*.5],[z-w*.5,y+h*.28],[z-w*.5,y-h*.27]];
  const badgeY=p.kind==='mini'?.94:p.kind==='bmw'?.94:1.0;
  if(p.kind==='bmw'){
    for(const s of [-1,1]){
      const shape=octagon(s*.20,.66,.35,.34);panel('chrome',shape,true,.014,.012);
      panel('grille',octagon(s*.20,.66,.313,.306),true,.030,.006);
      for(let i=0;i<7;i++)box('chrome',[.018,.26,.008],[frontX-.052,.665,s*.20+(i-3)*.036],.003);
      panel('glassTrim',[[s*.43,.86],[s*.84,.94],[s*.85,.80],[s*.51,.775]],true,.003);
      for(const z of [.55,.70])line('whiteLight',[[frontX-.032,.871,s*(z+.06)],[frontX-.035,.806,s*(z+.043)],[frontX-.035,.81,s*(z-.028)]],.009);
    }
    ring('chrome',.037,.005,[front+.10,badgeY,0],[1,1,1],[Math.PI/2,0,0]);
    box('badgeBlue',[.048,.005,.049],[front+.10,badgeY+.002,0],.008);
  }else if(p.kind==='mini'){
    panel('chrome',octagon(0,.59,1.02,.51),true,.015,.02);
    panel('paint',octagon(0,.59,.94,.435),true,.035,.018);
    panel('grille',[[-.35,.40],[.35,.40],[.29,.36],[-.29,.36]],true,.051,.008);
    for(const s of [-1,1]){
      const at=[frontX+.08,.93,s*.61];
      ring('chrome',.152,.013,at,[1,.9,1],[0,Math.PI/2,0]);
      add('glassTrim',new THREE.SphereGeometry(1,32,16).scale(.035,.13,.14).translate(...at));
      ring('whiteLight',.131,.009,[at[0]-.039,at[1],at[2]],[1,.9,1],[0,Math.PI/2,0]);
      line('whiteLight',[[at[0]-.043,.93,s*.61-.105],[at[0]-.044,.93,s*.61+.105]],.008);
    }
    line('chrome',[[front-.025,.93,-.15],[front-.03,.93,-.05],[front-.031,.913,0],[front-.03,.93,.05],[front-.025,.93,.15]],.011);
  }else{
    const wide=p.kind==='q6'?1.24:1.15;
    panel('chrome',octagon(0,.68,wide,.56),true,.008,.015);
    panel(p.kind==='q6'?'paint':'grille',octagon(0,.68,wide-.065,.50),true,.029,.012);
    for(let row=0;row<5;row++)for(let col=0;col<8;col++){
      const z=(col-3.5)*.117+(row%2)*.022;if(Math.abs(z)>.44&&row===0)continue;
      box(p.kind==='q4'?'chrome':'trim',[.012,.013,.065],[frontX-.044,.51+row*.075,z],.004);
    }
    for(let i=0;i<4;i++)ring('chrome',.052,.008,[frontX-.065,.865,(i-1.5)*.083],[1,1,1],[0,Math.PI/2,0]);
    for(const s of [-1,1]){
      const y=p.kind==='q6'?1.03:.982;
      panel('glassTrim',[[s*.48,y],[s*.87,y+.035],[s*.88,y-.087],[s*.59,y-.105]],true,.001,.012);
      line('whiteLight',[[frontX-.029,y-.01,s*.50],[frontX-.03,y+.009,s*.84]],.009);
      for(let i=0;i<6;i++)box('whiteLight',[.017,.014,.023],[frontX-.034,y-.037,s*(.59+i*.042)],.002,[s*.18,0,0]);
      if(p.kind==='q6')panel('glassTrim',[[s*.67,.65],[s*.85,.69],[s*.85,.82],[s*.67,.80]],true,.008,.018);
    }
  }
  // Front air curtains and lower splitter.
  for(const s of [-1,1])panel('grille',[[s*.64,.29],[s*.80,.31],[s*.81,.64],[s*.71,.63]],true,.002,.02);
  panel('grille',[[-.45,.28],[.45,.28],[.36,.41],[-.36,.41]],true,.013,.012);
  line('chrome',[[front+.07,.255,-half*.82],[front-.027,.255,0],[front+.07,.255,half*.82]],.012);
  // Rear light signatures and diffuser. No exhausts on electric cars.
  for(const s of [-1,1]){
    const y=p.belt-.09;
    if(p.kind==='mini')panel('redLight',[[s*.50,y+.03],[s*.76,y+.03],[s*.64,y-.20]],false,.01,.018);
    else{panel('glassTrim',[[s*.20,y+.04],[s*.83,y+.07],[s*.83,y-.11],[s*.59,y-.07]],false,.01,.015);line('redLight',[[rear+.02,y,s*.25],[rear+.025,y+.018,s*.77],[rear+.02,y-.06,s*.79]],.012);}
  }
  if(p.kind.startsWith('q'))line('redLight',[[rear+.025,p.belt-.09,-.70],[rear+.025,p.belt-.10,0],[rear+.025,p.belt-.09,.70]],.008);
  panel('trim',[[-half*.78,.23],[half*.78,.23],[half*.73,.43],[-half*.73,.43]],false,0,.03);
  for(const z of [-.42,-.21,0,.21,.42])box('trim',[.20,.085,.015],[rear-.045,.24,z],.006);
  // Small inset plates have geometry only; no photo billboard is hidden here.
  for(const s of [-1,1])box('glassTrim',[.022,.105,.38],[s*(p.length/2+.045),.49,0],.01);
}

async function exportVehicle(vehicle,outputDirectory) {
  const {profile,geometries,materials:specs}=vehicle;
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(profile.id);
  const clearcoat=doc.createExtension(KHRMaterialsClearcoat);
  let triangles=0;
  for(const {name,geometry} of geometries){
    const spec=specs[name],color=new THREE.Color(spec.color);
    const material=doc.createMaterial(`authored_${name}`).setBaseColorFactor([...color.toArray(),spec.alpha??1]).setMetallicFactor(spec.metal).setRoughnessFactor(spec.rough).setDoubleSided(true);
    if(spec.alpha)material.setAlphaMode('BLEND');
    if(spec.emissive)material.setEmissiveFactor(spec.emissive);
    if(spec.coat)material.setExtension('KHR_materials_clearcoat',clearcoat.createClearcoat().setClearcoatFactor(spec.coat).setClearcoatRoughnessFactor(.18));
    const prim=doc.createPrimitive().setMaterial(material);
    for(const [attribute,type,semantic] of [['position','VEC3','POSITION'],['normal','VEC3','NORMAL']])prim.setAttribute(semantic,doc.createAccessor().setType(type).setArray(new Float32Array(geometry.getAttribute(attribute).array)).setBuffer(buffer));
    const index=geometry.index.array;triangles+=index.length/3;
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(index)).setBuffer(buffer));
    const mesh=doc.createMesh(name).addPrimitive(prim);scene.addChild(doc.createNode(name).setMesh(mesh));
  }
  doc.getRoot().setDefaultScene(scene);
  doc.getRoot().setExtras({authored:true,manufacturerCad:false,vehicleId:profile.id,dimensionsReference:profile.reference,description:'Project-authored approximate vehicle exterior. No photograph planes. Battery is a separate schematic.'});
  await doc.transform(dedup(),prune(),draco());
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.encoder':await draco3d.createEncoderModule()});
  const fileName=`${profile.id}_authored.glb`;
  await io.write(path.join(outputDirectory,fileName),doc);
  return {vehicleId:profile.id,fileName,triangles,materialGroups:geometries.length,dimensions:[profile.length,profile.width,profile.height],referenceUrl:profile.reference};
}

const outputDirectory=process.argv[2]??'.cache/authored-models';
await mkdir(outputDirectory,{recursive:true});
const report=[];
for(const profile of profiles){const entry=await exportVehicle(buildVehicle(profile),outputDirectory);report.push(entry);console.log(JSON.stringify(entry));}
await writeFile(path.join(outputDirectory,'authored-models.json'),JSON.stringify(report,null,2)+'\n');

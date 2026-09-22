import * as THREE from '../wonder/vendor/three.module.js';
import {RoundedBoxGeometry} from '../wonder/vendor/addons/geometries/RoundedBoxGeometry.js';

// Original modeled characters and deterministic skeletal animation.
// Each shot reuses the same three rigs, cloth, ocean, props and lighting.
const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const rand=n=>{const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);};
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const geometry=new Map(),materials=new Map();
function mat(color,roughness=.7,metalness=0){
  const key=[color,roughness,metalness].join('|');
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));
  return materials.get(key);
}
const ink=mat('#182a34'),skin=mat('#d5a076',.85),sole=mat('#ddd4b9'),gold=mat('#d5ae62',.35,.65);
function mesh(parent,g,m,x=0,y=0,z=0){
  const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function rounded(parent,w,h,d,m,x=0,y=0,z=0,r=.08){
  const key=[w,h,d,r].join(',');
  if(!geometry.has(key))geometry.set(key,new RoundedBoxGeometry(w,h,d,2,r));
  return mesh(parent,geometry.get(key),m,x,y,z);
}
const sphereG=new THREE.SphereGeometry(1,24,16),cylinderG=new THREE.CylinderGeometry(1,1,1,16),icosaG=new THREE.IcosahedronGeometry(1,1);
function sphere(parent,x,y,z,sx,sy,sz,m){const o=mesh(parent,sphereG,m,x,y,z);o.scale.set(sx,sy,sz);return o;}
function cylinder(parent,r,h,m,x=0,y=0,z=0){const o=mesh(parent,cylinderG,m,x,y,z);o.scale.set(r,h,r);return o;}
function group(parent,x=0,y=0,z=0){const o=new THREE.Group();o.position.set(x,y,z);parent.add(o);return o;}
function torus(parent,r,tube,m,x=0,y=0,z=0){
  const o=mesh(parent,new THREE.TorusGeometry(r,tube,8,48),m,x,y,z);return o;
}
function lineMesh(parent,points,r,m){
  return mesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>V(...p))),20,r,6,false),m);
}
function texture(width,height,paint){
  const c=document.createElement('canvas');c.width=width;c.height=height;
  paint(c.getContext('2d'),width,height);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function labelMap(lines,{bg='#10272d',color='#b5f4df',size=54}={}){
  return texture(1024,512,(c,w,h)=>{
    c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle=color;c.lineWidth=3;c.strokeRect(18,18,w-36,h-36);
    c.textAlign='center';c.textBaseline='middle';
    lines.forEach((s,i)=>{c.font=(i===0?'bold ':'')+(i===0?size:size*.6)+'px Menlo, "Apple SD Gothic Neo", sans-serif';c.fillStyle=i===0?color:'#86a7a7';c.fillText(s,w/2,h/2+(i-(lines.length-1)/2)*100);});
  });
}
function placard(parent,lines,w,h,x,y,z,options={}){
  const m=new THREE.MeshBasicMaterial({map:labelMap(lines,options),transparent:true,opacity:.93,side:THREE.DoubleSide});
  const o=mesh(parent,new THREE.PlaneGeometry(w,h),m,x,y,z);o.castShadow=false;return o;
}
function beam(parent,r,m){
  const o=mesh(parent,cylinderG,m);o.scale.set(r,1,r);o.castShadow=true;
  return (a,b)=>{o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=a.distanceTo(b);o.quaternion.setFromUnitVectors(V(0,1,0),V().subVectors(b,a).normalize());};
}
function limb(parent,a,b,c,r,upper,lower){
  const top=beam(parent,r,upper),bottom=beam(parent,r*.87,lower);
  const joint=sphere(parent,0,0,0,r,r,r,upper);
  const update=(aa,bb,cc)=>{top(aa,bb);bottom(bb,cc);joint.position.copy(bb);};
  update(a,b,c);return update;
}
function bend(a,c,len1,len2,pole){
  const delta=V().subVectors(c,a),d=Math.max(.01,Math.min(delta.length(),len1+len2-.001)),dir=delta.normalize();
  const along=(len1*len1-len2*len2+d*d)/(2*d);
  const normal=pole.clone().addScaledVector(dir,-pole.dot(dir)).normalize();
  return a.clone().addScaledVector(dir,along).addScaledVector(normal,Math.sqrt(Math.max(.005,len1*len1-along*along)));
}

function developer(parent,index){
  const root=group(parent),body=group(root,0,1.02,0);
  const palette=[['#327d7b','#bd9255'],['#b66340','#5a3c42'],['#536899','#dbc486']][index];
  const shirt=mat(palette[0],.88),cloak=new THREE.MeshStandardMaterial({color:palette[1],roughness:.95,side:THREE.DoubleSide});
  rounded(body,.84,.81,.5,shirt,0,.17,0,.19);
  // Small cloth seams and a stitched code patch.
  rounded(body,.3,.25,.035,mat('#d8c3a2'),.16,.28,.27,.025);
  const badge=placard(body,['</>'],.25,.16,.16,.28,.296,{bg:'#d8c3a2',color:'#254e52',size:170});
  const hood=sphere(body,0,.55,-.2,.44,.3,.32,shirt);
  for(const side of [-1,1])lineMesh(body,[[side*.14,.55,.29],[side*.15,.34,.32],[side*.12,.12,.30]],.012,sole);
  const capeG=new THREE.PlaneGeometry(1.12,1.25,8,12),cape=mesh(body,capeG,cloak,0,0,-.31);
  const capeBase=new Float32Array(capeG.attributes.position.array);
  const buckle=torus(body,.075,.027,gold,.27,.50,.31);
  const head=group(body,0,.78,0),face=sphere(head,0,.13,.02,.49,.54,.46,skin);
  sphere(head,-.49,.11,.025,.105,.14,.08,skin);sphere(head,.49,.11,.025,.105,.14,.08,skin);
  sphere(head,0,.04,.47,.092,.075,.085,skin);
  const hair=mat(index===1?'#372522':'#222a31',.9);
  const cap=mesh(head,new THREE.SphereGeometry(.507,24,16,0,TAU,0,1.5),hair,0,.19,-.015);
  cap.scale.set(1,1,1.015);
  for(let i=0;i<4;i++){const h=sphere(head,-.32+i*.17,.43,.34,.17,.15,.16,hair);h.rotation.z=-.3+i*.13;}
  if(index===1){
    sphere(head,0,.58,-.035,.52,.29,.49,mat('#b87247'));
    const rim=torus(head,.46,.06,mat('#704c39'),0,.55,0);rim.rotation.x=Math.PI/2;
  }
  if(index===2)sphere(head,.32,.5,-.31,.27,.26,.25,hair);
  const eyes=[],brows=[];
  for(const side of [-1,1]){
    const eye=group(head,side*.18,.16,.427);
    sphere(eye,0,0,0,.136,.155,.066,mat('#fff4df'));
    const pupil=sphere(eye,0,-.005,.052,.065,.085,.033,ink);
    sphere(eye,-.023,.029,.08,.019,.024,.01,mat('#ffffff',.2));
    eyes.push({eye,pupil});
    const brow=rounded(head,.22,.052,.045,hair,side*.18,.35,.449,.024);
    brow.rotation.z=side*.06;brows.push(brow);
    if(index===0){
      const lens=torus(head,.157,.019,gold,side*.184,.16,.515);lens.scale.set(1.09,.94,1);
      lineMesh(head,[[side*.35,.19,.50],[side*.46,.21,.28],[side*.50,.19,.04]],.017,gold);
    }
  }
  if(index===0)rounded(head,.09,.025,.027,gold,0,.17,.514,.01);
  const smile=lineMesh(head,[[-.11,-.105,.449],[0,-.135,.47],[.11,-.105,.449]],.019,mat('#6f3d30'));
  const open=sphere(head,0,-.12,.455,.068,.071,.015,mat('#552f2c'));open.visible=false;
  const arms=[],hands=[];
  for(const side of [-1,1]){
    const a=V(side*.45,.43,0),c=V(side*.60,-.23,.15);
    arms.push(limb(body,a,bend(a,c,.46,.43,V(side,0,-1)),c,.125,shirt,shirt));
    const hand=group(body,c.x,c.y,c.z);sphere(hand,0,0,0,.125,.14,.12,skin);hands.push(hand);
  }
  const legs=[],feet=[];
  for(const side of [-1,1]){
    const a=V(side*.23,.90,0),c=V(side*.24,.17,.06);
    legs.push(limb(root,a,bend(a,c,.44,.43,V(0,0,1)),c,.145,ink,ink));
    const shoe=group(root,side*.24,.125,.12);
    rounded(shoe,.34,.22,.58,ink,0,.045,.05,.1);
    rounded(shoe,.36,.09,.61,sole,0,-.062,.065,.04);
    for(let i=0;i<3;i++)rounded(shoe,.18,.016,.022,sole,0,.156,.10+i*.06,.005);
    feet.push(shoe);
  }
  const leftTarget=V(),rightTarget=V();
  function pose(t,options={}){
    const {walk=0,stomp=0,crouch=0,lean=0,headTilt=0,emotion='calm',left,right,wind=1}=options;
    const phase=t*7+index*.8;
    body.position.y=1.02-crouch+(walk?Math.abs(Math.sin(phase))*.045:Math.sin(t*2.1+index)*.013);
    body.rotation.set(lean,0,Math.sin(t*1.6+index)*.018);
    head.rotation.set(headTilt,Math.sin(t*.55+index)*.045,Math.sin(t*.8)*.02);
    leftTarget.copy(left||V(-.57,-.25,walk?Math.sin(phase)*.26:.11));
    rightTarget.copy(right||V(.57,-.25,walk?-Math.sin(phase)*.26:.11));
    [leftTarget,rightTarget].forEach((target,i)=>{
      const side=i===0?-1:1,a=V(side*.45,.43,0),c=target;
      arms[i](a,bend(a,c,.46,.43,V(side*.75,0,-1)),c);hands[i].position.copy(c);
    });
    feet.forEach((shoe,i)=>{
      const side=i===0?-1:1,cycle=phase+i*Math.PI;
      shoe.position.set(side*.24,.13+walk*Math.max(0,Math.sin(cycle))*.22,.12+walk*Math.cos(cycle)*.29);
      if(i===1&&stomp>0){shoe.position.y=.13+Math.sin(stomp*Math.PI)*.45;shoe.position.z=.12+ease(stomp/.55)*.50;}
      shoe.rotation.x=walk*Math.sin(cycle)*.12;
      const a=V(side*.23,body.position.y-.16,0),c=shoe.position.clone().add(V(0,.06,-.08));
      legs[i](a,bend(a,c,.44,.43,V(0,0,1)),c);
    });
    const blinking=((t+index*.83)%4.3)>4.12;
    const sleepy=emotion==='sleepy';
    eyes.forEach(({eye,pupil})=>{eye.scale.y=blinking?.08:sleepy?.44:1;pupil.position.x=Math.sin(t*.7)*.012;});
    brows.forEach((b,i)=>{const side=i===0?-1:1;b.rotation.z=side*(emotion==='strain'?-.33:emotion==='shock'?.24:.08);b.position.y=emotion==='shock'?.41:.35;});
    smile.visible=emotion!=='shock'&&emotion!=='strain';open.visible=!smile.visible;
    open.scale.y=.071*(emotion==='strain'?.33:1);
    const pos=capeG.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=capeBase[i*3],y=capeBase[i*3+1],drop=(.625-y)/1.25;
      pos.setXYZ(i,x*(.6+drop*.5),y+.07,-.06-drop*.16+Math.sin(t*4.2+x*4+drop*3+index)*drop*.12*wind);
    }
    pos.needsUpdate=true;capeG.computeVertexNormals();
  }
  pose(0);
  return {root,body,head,pose,hands,eyes,cape};
}

function macMini(parent){
  const root=group(parent);
  rounded(root,.96,.30,.96,mat('#cbd2d5',.27,.72),0,0,0,.095);
  rounded(root,.82,.07,.82,mat('#292f34',.37,.35),0,-.16,0,.085);
  for(const x of [-.23,.02])rounded(root,.113,.042,.014,ink,x,-.025,.482,.017);
  sphere(root,.27,-.025,.481,.026,.026,.012,ink);
  sphere(root,.355,-.024,.491,.008,.008,.005,mat('#f3fff0',.1));
  const apple=texture(256,256,c=>{
    c.fillStyle='#263139';c.beginPath();c.moveTo(129,80);
    c.bezierCurveTo(70,48,49,95,57,139);c.bezierCurveTo(64,184,92,213,112,195);
    c.bezierCurveTo(134,182,143,204,161,195);c.bezierCurveTo(184,181,192,157,194,145);
    c.bezierCurveTo(158,138,155,99,188,89);c.bezierCurveTo(170,59,145,63,129,80);c.fill();
    c.beginPath();c.ellipse(139,45,13,28,.65,0,TAU);c.fill();
  });
  const logo=mesh(root,new THREE.PlaneGeometry(.30,.30),new THREE.MeshBasicMaterial({map:apple,transparent:true}),0,.152,0);
  logo.rotation.x=-Math.PI/2;logo.castShadow=false;
  return root;
}
function mug(parent){
  const root=group(parent),cream=mat('#e5c89c');
  cylinder(root,.16,.30,cream,0,.12,0);
  cylinder(root,.135,.007,mat('#39281e'),0,.275,0);
  const handle=torus(root,.105,.033,cream,.17,.15,0);handle.scale.x=.75;
  placard(root,['99%'],.19,.13,0,.12,.161,{bg:'#e5c89c',color:'#3b6766',size:180});
  return root;
}
function bug(parent,i){
  const root=group(parent),shell=mat(i%3===0?'#923953':i%3===1?'#714763':'#96543e',.37,.18);
  sphere(root,0,.30,0,.39,.29,.43,shell);
  const seam=rounded(root,.023,.016,.68,gold,0,.56,0,.006);
  sphere(root,0,.24,.37,.29,.24,.24,ink);
  for(const x of [-.115,.115]){
    sphere(root,x,.29,.565,.10,.11,.055,mat('#ffe8b0',.15));
    sphere(root,x,.30,.609,.05,.06,.013,ink);
    lineMesh(root,[[x,.42,.47],[x*1.4,.65,.49],[x*2,.69,.48]],.018,gold);
  }
  const legs=[];
  for(const side of [-1,1])for(let j=0;j<3;j++){
    const joint=group(root,side*.22,.25,-.24+j*.24);
    const upper=beam(joint,.035,ink),lower=beam(joint,.027,ink);
    legs.push({joint,upper,lower,side,j});
  }
  function animate(t){
    legs.forEach(({upper,lower,side,j})=>{
      const v=Math.sin(t*15+j*1.8+side)*.13;
      const a=V(),b=V(side*.29,.05,v),c=V(side*.45,-.24,-v*.55);
      upper(a,b);lower(b,c);
    });
    root.rotation.z=Math.sin(t*13)*.035;
  }
  return {root,animate};
}

export async function createOdyssey3D(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);renderer.setSize(1600,672,false);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1920/806,.1,180);
  scene.fog=new THREE.FogExp2('#315567',.018);
  const skyUniforms={top:{value:new THREE.Color('#163442')},bottom:{value:new THREE.Color('#947459')}};
  const sky=mesh(scene,new THREE.SphereGeometry(90,24,12),new THREE.ShaderMaterial({
    uniforms:skyUniforms,side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 top;uniform vec3 bottom;varying vec3 vWorld;void main(){float h=smoothstep(-0.05,0.65,normalize(vWorld).y);gl_FragColor=vec4(mix(bottom,top,h),1.0);}',
  }));sky.castShadow=false;sky.receiveShadow=false;
  const hemi=new THREE.HemisphereLight('#b4dce8','#48433c',2.5);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#ffdfae',4.4);sun.position.set(-5,9,6);
  sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.normalBias=.028;sun.shadow.bias=-.00015;scene.add(sun);
  const rim=new THREE.DirectionalLight('#68bed4',2.6);rim.position.set(2,6,-7);scene.add(rim);
  const fill=new THREE.DirectionalLight('#fbe5cd',.65);fill.position.set(0,3,8);scene.add(fill);
  const haloMat=new THREE.MeshBasicMaterial({color:'#ffe2a6'});
  const sunDisc=sphere(scene,-10,11,-36,3.1,3.1,3.1,haloMat);sunDisc.castShadow=false;
  // Broad invisible emissive panels create reflections on the prize.
  const envScene=new THREE.Scene();envScene.background=new THREE.Color('#718c99');
  for(const [x,y,z,w,h,color]of [[-4,5,2,5,7,'#ffe6bb'],[4,3,0,3,6,'#b3e0ef'],[0,7,-5,7,5,'#ffffff']]){
    const p=mesh(envScene,new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color}),x,y,z);p.lookAt(0,0,0);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(envScene,.06).texture;pmrem.dispose();

  const waterG=new THREE.PlaneGeometry(150,120,70,50),water=mesh(scene,waterG,mat('#215a69',.28,.46),0,-.83,0);
  water.rotation.x=-Math.PI/2;water.castShadow=false;water.receiveShadow=false;
  const waterBase=new Float32Array(waterG.attributes.position.array);
  // Sea reflections and foam, with no static photograph textures.
  const foamRoot=group(scene),foam=[];
  for(let i=0;i<24;i++){
    const wave=lineMesh(foamRoot,[[-1,0,0],[-.4,.012,.04],[.4,0,.04],[1,.01,0]],.011,new THREE.MeshBasicMaterial({color:i%2?'#66939c':'#afc3bb',transparent:true,opacity:.35}));
    wave.position.set((rand(i)-.5)*42,-.55,(rand(i+70)-.5)*36);
    wave.scale.x=1+rand(i+90)*2;wave.userData.base=wave.position.clone();wave.castShadow=false;foam.push(wave);
  }
  const island=group(scene),stone=mat('#8e9286',.95),pale=mat('#c2bda5',.9),darkStone=mat('#515f60',.97);
  cylinder(island,8.8,.6,darkStone,0,-.36,0);
  cylinder(island,8.45,.12,stone,0,-.02,0);
  for(let i=0;i<34;i++){
    const a=i/34*TAU,r=8.3+(rand(i+55)-.5)*.6,o=mesh(island,icosaG,darkStone,Math.cos(a)*r,-.39,Math.sin(a)*r);
    o.scale.set(.7+rand(i),.65+rand(i+100)*.3,.65);o.rotation.set(rand(i)*2,rand(i+1)*4,rand(i+2));
  }
  for(let i=0;i<28;i++){
    const x=(i%7-3)*1.65,z=(Math.floor(i/7)-2)*1.65;
    rounded(island,1.61,.028,1.61,i%4?stone:mat('#a3a18e'),x,.05,z,.028);
  }
  const temple=group(scene);
  function column(parent,x,z,h=4.8){
    cylinder(parent,.6,.20,pale,x,.17,z);cylinder(parent,.48,.22,pale,x,.37,z);
    cylinder(parent,.33,h,stone,x,h/2+.45,z);
    for(let k=0;k<10;k++){
      const a=k/10*TAU;cylinder(parent,.025,h-.14,pale,x+Math.sin(a)*.332,h/2+.45,z+Math.cos(a)*.332);
    }
    cylinder(parent,.48,.2,pale,x,h+.5,z);rounded(parent,1.04,.25,1.04,pale,x,h+.7,z,.03);
  }
  for(const x of [-4.7,4.7])for(const z of [-1.7,-5.3])column(temple,x,z,z<-3?4.0:3.1);
  for(const x of [-1.8,1.8])column(temple,x,-5.6,4.8);
  rounded(temple,4.9,.46,1.12,pale,0,5.68,-5.6,.05);
  const roofShape=new THREE.Shape();roofShape.moveTo(-2.65,0);roofShape.lineTo(2.65,0);roofShape.lineTo(0,1.1);roofShape.closePath();
  mesh(temple,new THREE.ExtrudeGeometry(roofShape,{depth:.55,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:1,steps:1}),pale,0,5.93,-5.9);
  const doorway=placard(temple,['GS HACKATHON','21 — 22 SEPTEMBER'],2.6,1.3,0,4.05,-5.48,{bg:'#25464b',color:'#e5c887',size:72});
  // Distant broken islands keep shot backgrounds connected.
  const distant=group(scene);
  for(let i=0;i<16;i++){
    const o=mesh(distant,icosaG,mat('#355966'),(rand(i+410)-.5)*95,-2-rand(i)*2,-15-rand(i+620)*35);
    o.scale.set(4+rand(i+250)*7,4+rand(i+380)*5,3+rand(i+780)*4);
  }
  const characters=group(scene),team=[0,1,2].map(i=>developer(characters,i));

  const boat=group(scene);
  const hullShape=new THREE.Shape();hullShape.moveTo(-3,.3);hullShape.lineTo(-2.4,-.6);hullShape.quadraticCurveTo(0,-1.1,2.4,-.6);hullShape.lineTo(3.1,.3);hullShape.closePath();
  const hull=mesh(boat,new THREE.ExtrudeGeometry(hullShape,{depth:1.7,bevelEnabled:true,bevelSegments:2,bevelSize:.16,bevelThickness:.15,steps:1}),mat('#5b4232'),0,0,-.85);
  rounded(boat,5.25,.15,1.75,mat('#967657'),0,.27,0,.08);
  for(let i=0;i<11;i++)rounded(boat,.038,.03,1.67,mat('#4c3f35'),-2.4+i*.48,.36,0,.006);
  for(const z of [-.83,.83])rounded(boat,5.62,.15,.15,gold,0,.37,z,.055);
  cylinder(boat,.065,4.4,mat('#7b5e40'),-.65,2.5,-.63);
  const sailMap=texture(512,512,c=>{c.fillStyle='#e5d2ad';c.fillRect(0,0,512,512);c.textAlign='center';c.fillStyle='#316d6b';c.font='bold 170px Menlo';c.fillText('</>',256,286);c.font='bold 36px Menlo';c.fillText('NO WAY HOME',256,375);});
  const sailG=new THREE.PlaneGeometry(2.3,2.05,12,12),sail=mesh(boat,sailG,new THREE.MeshStandardMaterial({map:sailMap,side:THREE.DoubleSide,roughness:1}),-.65,3.25,-.69);
  const sailBase=new Float32Array(sailG.attributes.position.array);
  const oars=[];
  for(const side of [-1,1]){
    const pivot=group(boat,side*1.6,.48,.65),shaft=cylinder(pivot,.037,2.8,mat('#a58755'),0,-.8,0);
    rounded(pivot,.22,.65,.06,mat('#af936d'),0,-2,0,.07);pivot.rotation.z=side*.9;oars.push(pivot);
  }

  const oracle=group(scene),orb=group(oracle);
  const robotBody=rounded(orb,1.16,.88,.74,mat('#d7c6a0',.34,.38),0,0,0,.25);
  rounded(orb,.91,.49,.046,ink,0,.018,.37,.14);
  const eyeGlow=new THREE.MeshBasicMaterial({color:'#9df4e4'});
  const robotEyes=[-.23,.23].map(x=>rounded(orb,.14,.23,.026,eyeGlow,x,.045,.403,.05));
  const robotMouth=rounded(orb,.23,.026,.022,eyeGlow,0,-.135,.404,.009);
  for(const x of [-.69,.69])sphere(orb,x,0,0,.11,.2,.13,gold);
  cylinder(orb,.027,.27,gold,0,.53,0);sphere(orb,0,.71,0,.075,.075,.075,eyeGlow);
  const rings=[];
  for(let i=0;i<3;i++){
    const ring=torus(oracle,1.05+i*.12,.012,new THREE.MeshBasicMaterial({color:i%2?'#cfb47c':'#7bc4c5',transparent:true,opacity:.7}));rings.push(ring);
  }
  const oracleGlow=new THREE.PointLight('#72dccf',10,6,1.8);oracle.add(oracleGlow);
  const oraclePanel=placard(scene,['BUILD SUCCEEDED','CONFIDENCE: 100%'],3.1,1.07,1.7,4.2,-.4,{color:'#aeefcf',size:88});
  const errorPanel=placard(scene,['404 · BRIDGE NOT FOUND','@olympus/go-home'],3.85,1.02,0,3.9,-.7,{color:'#efb0a0',size:72});
  const contextPanel=placard(scene,['CONTEXT WINDOW EXCEEDED','MEMORY: 0%'],4.15,1.12,0,4.2,-.8,{color:'#e8c58b',size:63});
  const bridge=group(scene),boards=[];
  for(const x of [-4.2,4.2]){
    rounded(bridge,3.3,.65,3.5,stone,x,-.10,0,.15);
    rounded(bridge,3.5,.13,3.7,pale,x,.29,0,.07);
  }
  for(let i=0;i<8;i++){
    const board=rounded(bridge,.71,.13,1.48,mat('#63a8a3',.36,.2),-2.48+i*.71,.28,0,.04);
    board.userData.x=board.position.x;boards.push(board);
  }
  const bugsRoot=group(scene),bugs=Array.from({length:12},(_,i)=>bug(bugsRoot,i));
  const checkRing=torus(scene,.5,.04,new THREE.MeshBasicMaterial({color:'#a4f0ba'}));checkRing.rotation.x=-Math.PI/2;

  const camp=group(scene);
  rounded(camp,3.55,.18,1.34,mat('#685747'),0,1.04,.65,.08);
  for(const x of [-1.4,1.4])for(const z of [.17,1.13])rounded(camp,.15,1,.15,gold,x,.5,z,.03);
  const laptop=group(camp,0,1.17,.52);
  rounded(laptop,1.15,.066,.72,mat('#a8b7bc',.32,.6),0,0,0,.04);
  const lid=group(laptop,0,.025,-.34);
  rounded(lid,1.15,.73,.045,mat('#abb9bd',.32,.6),0,.34,0,.035);
  placard(lid,['> npm run build','...just one more fix'],1.04,.61,0,.35,.027,{size:67,color:'#9bebcc'});
  for(let j=0;j<3;j++)for(let k=0;k<9;k++)rounded(laptop,.085,.012,.062,ink,(k-4)*.112,.04,-.12+j*.086,.006);
  rounded(laptop,.3,.008,.14,mat('#74858d'),0,.04,.23,.02);
  const fixPanel=placard(camp,['LAST FIX #23','23:58 → 03:17'],2.7,.83,0,3.42,-.72,{color:'#dfc08d',size:82});
  for(let i=0;i<6;i++){const m=mug(camp);m.position.set(-1.2+(i%2)*.3,1.15+Math.floor(i/2)*.28,.57);m.scale.setScalar(.73);}
  const coffee=mug(team[0].hands[1]);
  const steam=group(coffee),steamLines=[];
  for(let i=0;i<3;i++){
    const s=lineMesh(steam,[[0,0,0],[.04,.12,.01],[-.02,.23,0],[.04,.32,.01]],.008,new THREE.MeshBasicMaterial({color:'#d6e0d8',transparent:true,opacity:.38}));
    s.position.set((i-1)*.055,.34,0);steamLines.push(s);
  }

  const stairs=group(scene);
  for(let i=0;i<11;i++)rounded(stairs,.72,.24*(i+1),2.8,pale,-3.65+i*.70,.12*(i+1),-.1,.045);
  const keyStand=group(scene);
  cylinder(keyStand,.34,1.1,pale,-1.10,.55,.9);cylinder(keyStand,.47,.15,gold,-1.10,1.15,.9);
  const keyring=group(scene);
  torus(keyring,.17,.027,gold,0,.17,0);
  rounded(keyring,.22,.30,.085,mat('#c4cecb',.3,.65),0,-.16,0,.03);
  placard(keyring,['GS'],.17,.15,0,-.15,.047,{bg:'#c4cecb',color:'#2f6668',size:200});

  const altar=group(scene),prize=macMini(scene);
  cylinder(altar,.70,.56,stone,0,.28,.77);
  cylinder(altar,.83,.10,pale,0,.61,.77);
  for(let i=0;i<5;i++){
    const ring=torus(altar,.8+i*.24,.014,new THREE.MeshBasicMaterial({color:'#e9bf7c',transparent:true,opacity:.55-i*.075}),0,.038,.77);ring.rotation.x=-Math.PI/2;
  }
  const seal=group(scene),seals=[];
  for(let i=0;i<4;i++){
    const s=torus(seal,.72,.017,new THREE.MeshBasicMaterial({color:'#8ad3d0',transparent:true,opacity:.6}));s.rotation.x=Math.PI/2;s.rotation.y=i*Math.PI/4;seals.push(s);
  }
  const prizeGlow=new THREE.PointLight('#ffcf79',6,8,1.5);scene.add(prizeGlow);
  const dustG=new THREE.BufferGeometry(),dustPositions=new Float32Array(100*3);
  dustG.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
  const dust=new THREE.Points(dustG,new THREE.PointsMaterial({color:'#ffe0a6',size:.024,transparent:true,opacity:.72,depthWrite:false}));scene.add(dust);
  const activeObjects=[boat,oracle,oraclePanel,errorPanel,contextPanel,bridge,bugsRoot,checkRing,camp,coffee,stairs,keyStand,keyring,altar,prize,seal];

  function cameraAt(from,to,target,p){
    const q=ease(p);camera.position.set(mix(from[0],to[0],q),mix(from[1],to[1],q),mix(from[2],to[2],q));camera.lookAt(...target);
  }
  function place(i,x,y,z,rotation=0){team[i].root.position.set(x,y,z);team[i].root.rotation.set(0,rotation,0);team[i].root.scale.setScalar(i===0?1:i===1?.92:.97);team[i].root.visible=true;}
  function render(s,p,t){
    const progress=p/(s.end-s.start),finale=s.start>=60;
    activeObjects.forEach(o=>o.visible=false);island.visible=true;temple.visible=true;characters.position.set(0,0,0);characters.rotation.set(0,0,0);
    team.forEach((c,i)=>{place(i,(i===0?0:i===1?-1.5:1.5),0,i===0?.25:-.35);c.pose(t);});
    const dawn=finale?1:s.id==='climb'?.65:.12;
    skyUniforms.top.value.set(finale?'#426c7c':'#173e52');skyUniforms.bottom.value.set(finale?'#bea088':'#607b83');
    scene.fog.color.set(finale?'#acaa93':'#315567');scene.fog.density=finale?.013:.018;
    sun.color.set(finale?'#ffe2ab':'#ffe5c4');sun.intensity=finale?5.1:4.1;rim.intensity=finale?2.4:2.8;
    hemi.intensity=finale?2.5:2.0;prizeGlow.intensity=finale?6:0;
    sunDisc.position.y=finale?8:12;
    const wp=waterG.attributes.position;
    for(let i=0;i<wp.count;i++){
      const x=waterBase[i*3],y=waterBase[i*3+1];wp.setZ(i,Math.sin(x*.5+t*1.5)*.12+Math.sin(y*.7+x*.15-t*1.7)*.11);
    }
    wp.needsUpdate=true;waterG.computeVertexNormals();
    foam.forEach((o,i)=>{o.position.x=o.userData.base.x+Math.sin(t*.3+i)*.5;o.position.y=-.57+Math.sin(t*1.5+i)*.04;o.scale.z=1+Math.sin(t+i)*.2;});
    for(let i=0;i<100;i++){dustPositions[i*3]=(rand(i+5100)-.5)*15;dustPositions[i*3+1]=(rand(i+5200)*7+t*.14)%7;dustPositions[i*3+2]=(rand(i+5300)-.5)*12;}
    dustG.attributes.position.needsUpdate=true;
    rings.forEach((o,i)=>o.rotation.set(t*.28+i,Math.sin(t*.6+i)*.6,t*.34+i));
    robotEyes.forEach((o,i)=>{o.scale.y=(t%3.7)>3.55?.15:1;o.rotation.z=0;});
    eyeGlow.color.set('#a3f4df');
    robotMouth.scale.x=1;orb.rotation.set(Math.sin(t)*.045,Math.sin(t*.7)*.18,Math.sin(t*1.4)*.035);
    seals.forEach((o,i)=>{o.material.opacity=.6;o.rotation.set(Math.PI/2,i*Math.PI/4,t*.3+i);});
    coffee.position.set(0,-.10,.04);coffee.rotation.set(0,0,0);prize.rotation.set(0,0,0);
    keyring.rotation.set(0,0,0);keyring.scale.setScalar(1);
    altar.position.set(0,0,0);
    if(s.set==='boat'){
      island.visible=false;temple.visible=false;boat.visible=true;
      boat.position.y=.1+Math.sin(t*1.8)*.1;boat.rotation.set(Math.sin(t*.9)*.045,0,Math.sin(t*1.8)*.035);
      characters.position.copy(boat.position);characters.rotation.copy(boat.rotation);
      place(0,.75,.38,.18,.1);place(1,-1.5,.38,.28,.15);place(2,1.95,.38,-.18,-.2);
      team[0].pose(t,{left:V(-.62,.32,.38),right:V(.62,.1,.5),wind:1.5});
      team[1].pose(t,{left:V(-.67,-.1,.32),right:V(.6,.1,.52),wind:1.7});
      team[2].pose(t,{left:V(-.6,.1,.36),right:V(.64,.25,.33),wind:1.5});
      oars.forEach((o,i)=>{o.rotation.x=.4+Math.sin(t*2.4+i*Math.PI)*.35;o.rotation.z=(i===0?-1:1)*1.0;});
      const pos=sailG.attributes.position;
      for(let i=0;i<pos.count;i++){const x=sailBase[i*3],y=sailBase[i*3+1];pos.setZ(i,Math.sin((x+1.15)/2.3*Math.PI)*.28+Math.sin(t*3+y*3+x)*.07);}
      pos.needsUpdate=true;sailG.computeVertexNormals();
      cameraAt([6,3.8,9],[3.6,3.3,8.7],[0,1.8,0],progress);
    }else if(s.set==='oracle'){
      oracle.visible=oraclePanel.visible=true;oracle.position.set(1.7,2.65+Math.sin(t*1.8)*.13,-.15);
      place(0,-.3,0,.75,.35);place(1,-2.55,0,-1,.5);place(2,-2.9,0,1.1,.4);
      team[0].pose(t,{headTilt:-.08,right:V(.69,.21,.45)});
      cameraAt([5,3.1,8.9],[3.1,2.8,8.0],[0,2.05,0],progress);
    }else if(s.set==='bridge'){
      island.visible=false;temple.visible=false;bridge.visible=oracle.visible=true;
      oracle.position.set(4.0,2.7+Math.sin(t*1.8)*.11,0);
      const collapse=ease((p-1.1)/1.4),reach=Math.sin(Math.min(1,p/1.6)*Math.PI);
      place(0,-2.25+reach*.65,.39+Math.sin(clamp(p/1.7)*Math.PI)*.26,.3,.1);
      place(1,-4.15,.38,-.80,.2);place(2,-4.45,.38,.85,.2);
      team[0].pose(t,{emotion:p>1.2?'shock':'calm',lean:-.14*collapse,left:V(-.88,.3+Math.sin(t*11)*.17,.12),right:V(.82,.6+Math.cos(t*9)*.1,.1),walk:p<1.5?.8:0,wind:1.6});
      team[1].pose(t,{headTilt:-.08,emotion:'shock'});team[2].pose(t,{left:V(-.65,.3,.35),emotion:'shock'});
      boards.forEach((o,i)=>{const fall=ease((p-1.05-i*.11)/.85);o.position.set(o.userData.x,.28-fall*(2.8+i*.07),0);o.rotation.set(fall*(i%2?1.1:-1.1),0,fall*.3);o.visible=fall<.97;});
      errorPanel.visible=p>1.35;
      cameraAt([1.5,3.6,10.8],[.1,3.25,10.3],[-.5,1.35,0],progress);
    }else if(s.set==='bugs'){
      bugsRoot.visible=checkRing.visible=true;
      if(s.id==='onebug'){
        place(0,.1,0,.2,0);place(1,-1.55,0,-.6,.2);place(2,1.55,0,-.6,-.2);
        const stomp=clamp((p-.25)/.85)*(1-ease((p-1.3)/.5));
        team[0].pose(t,{stomp,right:V(.72,.35,.1),emotion:p<1.3?'strain':'calm'});
        bugs.forEach((b,i)=>{b.root.visible=i===0&&p<1.6;b.root.position.set(.32,.08,.80);b.root.rotation.y=0;b.root.scale.setScalar(i===0?1:0);if(p>1.05)b.root.scale.y=Math.max(.05,1-(p-1.05)*2);b.animate(t);});
        checkRing.position.set(.32,.11,.80);checkRing.scale.setScalar(.2+ease((p-1.3)/1)*2);checkRing.material.opacity=p>1.3?(1-ease((p-1.3)/1.3))*.8:0;
        cameraAt([3.7,2.6,7.2],[2.4,2.7,7.0],[0,1.12,.3],progress);
      }else{
        place(0,0,0,0,Math.sin(p*1.3)*.15);place(1,-1.05,0,-.7,.7);place(2,1.1,0,-.6,-.7);
        team.forEach((c,i)=>c.pose(t,{emotion:'shock',left:V(-.78,.45+Math.sin(t*7+i)*.15,.1),right:V(.78,.4+Math.cos(t*6+i)*.15,.1),walk:.3}));
        bugs.forEach((b,i)=>{b.root.visible=true;const a=i/12*TAU+p*.65,r=2.25+Math.sin(p*1.7+i)*.3;b.root.position.set(Math.cos(a)*r,.06,Math.sin(a)*r);b.root.rotation.y=-a;b.root.scale.setScalar(.66+ease(p/.7)*.10);b.animate(t+i);});
        checkRing.visible=false;
        cameraAt([4,5.8,9.2],[-1.4,5.0,9.0],[0,1.0,0],progress);
      }
    }else if(s.set==='camp'||s.set==='coffee'){
      camp.visible=true;
      place(0,0,0,-.12,0);place(1,-2.1,0,-.1,.3);place(2,2.1,0,-.2,-.3);
      team[1].pose(t,{headTilt:.23,emotion:'sleepy'});team[2].pose(t,{headTilt:.13,emotion:'sleepy',left:V(-.45,.75,.15)});
      lid.rotation.x=-.1+Math.sin(t*3)*.015;
      if(s.set==='camp'){
        team[0].pose(t,{lean:.04,headTilt:.12,left:V(-.32,.21+Math.sin(t*23)*.03,.67),right:V(.33,.21+Math.cos(t*21)*.03,.66)});
        cameraAt([3.4,2.9,7.4],[2.1,2.65,6.8],[0,1.65,.2],progress);
      }else{
        coffee.visible=true;camp.children.forEach(o=>o.visible=true);fixPanel.visible=false;
        const sip=ease((p-.5)/1.1)*(1-ease((p-2.7)/1.0));
        team[0].pose(t,{headTilt:.18-sip*.24,emotion:'sleepy',left:V(-.47,-.02,.5),right:V(.30-sip*.15,.10+sip*.39,.65-sip*.05)});
        coffee.rotation.x=-sip*.25;steamLines.forEach((o,i)=>{o.rotation.y=t*.8+i;o.scale.y=.85+Math.sin(t*2+i)*.2;});
        cameraAt([2.5,2.4,5.9],[1.1,2.4,5.5],[0,1.73,.10],progress);
      }
    }else if(s.set==='context'){
      oracle.visible=contextPanel.visible=true;oracle.position.set(0,2.94+Math.sin(t)*.10,-.8);
      place(0,0,0,.8,0);place(1,-1.65,0,.25,.1);place(2,1.65,0,.25,-.1);
      team[0].pose(t,{headTilt:.05,left:V(-.65,.38,.4),right:V(.65,.38,.4)});
      team[1].pose(t,{right:V(.15,.9,.3),emotion:'strain'});
      team[2].pose(t,{left:V(-.15,.92,.30),headTilt:.12});
      eyeGlow.color.set(p>.7?'#e6a17f':'#a3f4df');robotEyes.forEach((o,i)=>{o.rotation.z=(i?1:-1)*.48;o.scale.y=.7;});robotMouth.scale.x=.25;
      oracle.rotation.z=Math.sin(t*5)*.06;
      cameraAt([2.2,3.0,8.5],[.2,2.8,7.7],[0,2.05,0],progress);
    }else if(s.set==='climb'){
      stairs.visible=true;
      [0,1,2].forEach(i=>{
        const x=-1.35+p*.61-i*.93,y=(x+3.85)/.7*.24+.08;
        place(i,x,y,i===0?-.35:i===1?.65:-.7,1.1);
        team[i].pose(t,{walk:.65,lean:.10,headTilt:-.10,wind:1.3});
      });
      cameraAt([5.5,4.9,10.2],[3.9,4.6,9.5],[.3,2.2,0],progress);
    }else if(s.set==='resolve'){
      place(0,0,0,.35,0);place(1,-1.30,0,-.25,.1);place(2,1.30,0,-.25,-.1);
      team[0].pose(t,{headTilt:-.04,emotion:'strain',wind:1.4});
      team[1].pose(t,{headTilt:-.03,wind:1.3});team[2].pose(t,{headTilt:-.04,wind:1.4});
      cameraAt([1.5,2.35,6.2],[.55,2.22,5.2],[0,1.70,.2],progress);
    }else if(s.set==='keyring'){
      keyStand.visible=keyring.visible=true;
      place(0,0,0,0,-.05);place(1,-2.0,0,-.5,.1);place(2,1.5,0,-.5,-.1);
      const pick=ease((p-.55)/1.2),aside=ease((p-2.2)/1.5);
      keyring.position.set(-1.10+pick*.52-aside*.60,1.39+pick*.25-aside*.22,.86);
      keyring.rotation.set(.05,Math.sin(t)*.16,-aside*.28);
      const hand=V(-.64-aside*.23,.33+pick*.10-aside*.18,.68);
      team[0].pose(t,{left:hand,headTilt:.10,emotion:'strain'});
      cameraAt([1.8,2.45,6.5],[.6,2.3,5.8],[-.35,1.57,.3],progress);
    }else if(['reveal','lift','victory'].includes(s.set)){
      altar.visible=prize.visible=true;seal.visible=s.set!=='victory';
      place(0,0,0,-.22,0);place(1,-1.8,0,-.25,.2);place(2,1.8,0,-.25,-.2);
      prize.position.set(0,.86,.77);prizeGlow.position.set(0,2.3,.9);
      if(s.set==='reveal'){
        seal.position.copy(prize.position);seal.scale.setScalar(.85);
        team[0].pose(t,{headTilt:.10,wind:1.15});
        cameraAt([2.4,2.25,4.1],[1.35,2.1,3.8],[0,1.12,.67],progress);
      }else{
        const lift=s.set==='victory'?1:ease((p-2.7)/2.55),straining=s.set==='lift'&&p<3.1;
        const shake=straining?Math.sin(t*33)*.014:Math.sin(t*2.5)*.007;
        prize.position.set(shake,.86+lift*.52,.77-lift*.05);
        prize.rotation.z=shake*.7;
        const reach=ease(p/.7);
        const crouch=(1-lift)*.40;
        place(0,0,0,-.04,0);
        team[0].pose(t,{crouch,headTilt:straining?.17:-.04,emotion:straining?'strain':'calm',left:V(-.55,prize.position.y-(1.02-crouch),.71),right:V(.55,prize.position.y-(1.02-crouch),.71),wind:1.35});
        team[0].body.position.x=shake*.6;
        const join=s.set==='victory'?1:ease((p-1.2)/1.9);
        place(1,-1.8+join*.68,0,-.02,.03);place(2,1.8-join*.68,0,-.02,-.03);
        team[1].pose(t,{crouch:crouch*.55,headTilt:-.03,right:V(.54,.25+lift*.13,.62),left:V(-.42,-.13,.32),emotion:straining?'strain':'calm',walk:join>0&&join<1?.3:0});
        team[2].pose(t,{crouch:crouch*.55,headTilt:-.03,left:V(-.54,.25+lift*.13,.62),right:V(.42,-.13,.32),emotion:straining?'strain':'calm',walk:join>0&&join<1?.3:0});
        seal.position.copy(prize.position);seal.scale.setScalar(.8+lift*1.8);seal.visible=lift<.72;
        seals.forEach(o=>{o.material.opacity=(1-lift)*.6;o.rotation.z=t;});
        if(s.set==='lift')cameraAt([2.7,2.2,6.0],[1.1,2.55,6.8],[0,1.45,.5],progress);
        else cameraAt([1.1,2.55,6.8],[-.45,2.65,7.15],[0,1.50,.35],progress);
      }
    }
    // Explicit resets make scrubbing and out-of-order still rendering identical.
    if(s.set!=='context')oracle.rotation.set(0,0,0);
    if(s.set!=='coffee')fixPanel.visible=true;
    if(s.set!=='lift'&&s.set!=='victory')team[0].body.position.x=0;
    renderer.render(scene,camera);
    const gl=renderer.getContext();
    return {canvas:renderer.domElement,probe:{
      set:s.set,time:Number(t.toFixed(4)),characters:team.map(c=>({position:c.root.position.toArray(),head:c.head.rotation.toArray().slice(0,3),left:c.hands[0].position.toArray(),right:c.hands[1].position.toArray(),bodyY:c.body.position.y})),
      prize:prize.visible?prize.position.toArray():null,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,renderer:gl.getParameter(gl.RENDERER),
    }};
  }
  camera.position.set(3,3,9);camera.lookAt(0,1.8,0);
  await renderer.compileAsync(scene,camera);
  return {render,renderer};
}

import * as THREE from 'three';
import { characterFor } from '../core/characters';

const materials=new Map<string,THREE.MeshStandardMaterial>();
function material(color:string){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.56}));return materials.get(color)!;}
function ball(group:THREE.Group,color:string,x:number,y:number,z:number,sx:number,sy=sx,sz=sx){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),material(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function cone(group:THREE.Group,color:string,x:number,y:number,z:number,radius:number,height:number,tilt=0){
  const mesh=new THREE.Mesh(new THREE.ConeGeometry(radius,height,16),material(color));mesh.position.set(x,y,z);mesh.rotation.z=tilt;mesh.castShadow=true;group.add(mesh);return mesh;
}
function line(group:THREE.Group,color:string,points:number[][],radius=.035){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p as [number,number,number])));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,16,radius,8,false),material(color));mesh.castShadow=true;group.add(mesh);return mesh;
}
function eyes(group:THREE.Group,y:number,z:number,spread=.25,iris='#2487cf',size=.19){
  for(const side of [-1,1]){
    ball(group,'#fffef4',side*spread,y,z,size*.73,size,size*.48);
    ball(group,iris,side*spread,y,z+size*.44,size*.39,size*.65,size*.18);
    ball(group,'#13202a',side*spread,y-.015,z+size*.58,size*.22,size*.47,size*.11);
    ball(group,'#ffffff',side*spread-.025,y+.05,z+size*.68,.022);
  }
}
function smile(group:THREE.Group,y:number,z:number,width=.21){line(group,'#7c392b',[[-width,y+.045,z],[0,y-.04,z+.025],[width,y+.045,z]],.025).name='mouth';}
function emblem(group:THREE.Group,letter:string,color:string){
  ball(group,'#fff9e9',0,.62,.67,.24,.235,.05);
  // Geometry lettering stays crisp without textures or browser-only canvas work.
  const paths=letter==='M'?[[[-.135,.49,.727],[-.11,.74,.727],[0,.57,.75],[.11,.74,.727],[.135,.49,.727]]]:[[[-.085,.74,.727],[-.085,.49,.727],[.12,.49,.727]]];
  paths.forEach(points=>line(group,color,points,.028));
}
function plumber(group:THREE.Group,luigi:boolean){
  const skin='#f4c59a',hair='#64351d',hat=luigi?'#28a53a':'#e52327';
  ball(group,hair,0,.02,-.17,.68,.72,.63);ball(group,skin,0,-.06,.15,luigi?.59:.65,luigi?.70:.61,.59);
  for(const side of [-1,1]){ball(group,skin,side*.64,-.04,.02,.17,.24,.14);ball(group,hair,side*.52,.03,.30,.095,.27,.1);}
  ball(group,hat,0,.52,-.035,.78,luigi?.50:.42,.69);ball(group,hat,0,.36,.61,.71,.085,.35);emblem(group,luigi?'L':'M',hat);
  eyes(group,.04,.668,luigi?.23:.255,'#2386d0',.20);
  for(const side of [-1,1]){
    line(group,'#41291d',[[side*.12,.29,.65],[side*.27,.32,.64],[side*.38,.27,.61]],.043);
    ball(group,'#32231b',side*.20,-.29,.728,.26,.095,.09);
    if(!luigi)for(let i=0;i<3;i++)ball(group,'#32231b',side*(.085+i*.115),-.335+Math.abs(i-1)*.025,.735,.082,.09,.074);
  }
  ball(group,skin,0,-.10,.85,luigi?.20:.24,luigi?.25:.20,.235);smile(group,-.47,.61,.18);
}
function crown(group:THREE.Group,silver=false){
  const gold=silver?'#dadce1':'#ffcc38';
  const ring=new THREE.Mesh(new THREE.CylinderGeometry(.28,.30,.21,16),material(gold));ring.position.set(0,.83,0);group.add(ring);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cone(group,gold,Math.sin(a)*.25,1.04,Math.cos(a)*.25,.10,.35);ball(group,gold,Math.sin(a)*.25,1.23,Math.cos(a)*.25,.045);}
  ball(group,silver?'#74ddff':'#e8478a',0,.87,.295,.09,.10,.035);for(const side of [-1,1])ball(group,'#338fdf',side*.22,.87,.15,.065);
}
function princess(group:THREE.Group,rosalina:boolean){
  const hair=rosalina?'#f8e4a3':'#ffdb54',skin='#ffe0bc';
  ball(group,hair,0,0,-.19,.73,.85,.58);ball(group,skin,0,-.06,.15,.51,.68,.51);
  for(const side of [-1,1]){
    ball(group,hair,side*.57,-.40,-.12,.23,.59,.32);
    const lock=ball(group,hair,side*.49,.25,.24,.29,.41,.20);lock.rotation.z=-side*.28;
    ball(group,'#39b9e1',side*.55,-.29,.25,.08,.13,.075);
  }
  eyes(group,.015,.63,.21,rosalina?'#3daecc':'#3385de',.18);
  for(const side of [-1,1]){line(group,'#49362b',[[side*.13,.20,.66],[side*.25,.21,.65],[side*.32,.24,.61]],.021);ball(group,'#f2a1a3',side*.34,-.21,.555,.105,.047,.023);}
  ball(group,skin,0,-.14,.67,.075,.105,.10);ball(group,'#dc6691',0,-.38,.60,.10,.040,.032).name='mouth';
  if(rosalina){const fringe=ball(group,hair,.20,.29,.63,.32,.43,.16);fringe.rotation.z=-.56;}
  else{const bang=ball(group,hair,0,.43,.48,.35,.27,.23);bang.rotation.z=.2;}
  crown(group,rosalina);
}
function yoshi(group:THREE.Group){
  ball(group,'#42ac39',0,.05,-.14,.65,.69,.61);ball(group,'#f8fae7',0,-.32,.35,.52,.28,.55);
  for(const side of [-1,1]){ball(group,'#42ac39',side*.245,.48,.16,.26,.39,.29);ball(group,'#fffef6',side*.245,.46,.375,.18,.30,.09);ball(group,'#192329',side*.245,.46,.467,.075,.16,.036);ball(group,'#ffffff',side*.27,.52,.502,.025);}
  ball(group,'#50b83a',0,-.035,.55,.63,.43,.66);
  for(const side of [-1,1])ball(group,'#267929',side*.235,.20,1.085,.038,.025,.02);
  line(group,'#33762a',[[-.43,-.29,.90],[0,-.36,1.12],[.43,-.29,.90]],.023).name='mouth';
  for(let i=0;i<3;i++)cone(group,'#f36e29',0,.59-i*.24,-.61,.16,.30,0).rotation.x=-Math.PI/2;
}
function bowser(group:THREE.Group){
  ball(group,'#e89d2c',0,0,0,.77,.67,.63);ball(group,'#77a541',0,.37,-.12,.64,.40,.52);
  for(const side of [-1,1]){
    ball(group,'#ffc65e',side*.35,-.23,.45,.42,.34,.38);
    cone(group,'#fff1d0',side*.67,.57,-.035,.15,.61,-side*.40);
    ball(group,'#e9c986',side*.66,.31,-.03,.19,.11,.18);
  }
  eyes(group,.17,.56,.30,'#da3525',.19);
  for(const side of [-1,1]){const brow=ball(group,'#d84528',side*.28,.40,.61,.30,.105,.11);brow.rotation.z=side*.24;}
  ball(group,'#f7c269',0,-.025,.75,.56,.27,.36);for(const side of [-1,1])ball(group,'#a46c29',side*.25,.12,1.05,.055,.033,.024);
  line(group,'#8c4421',[[-.53,-.30,.76],[0,-.43,.82],[.53,-.30,.76]],.045).name='mouth';
  for(const side of [-1,1])cone(group,'#fffae4',side*.42,-.39,.85,.075,.23,Math.PI);
  for(let i=-2;i<=2;i++){const tuft=cone(group,'#e74527',i*.18,.76+(.16-Math.abs(i)*.04),-.21,.15,.50,-i*.13);tuft.rotation.x=-.3;}
}
function toad(group:THREE.Group){
  ball(group,'#ffe1b0',0,-.32,.08,.53,.47,.47);ball(group,'#fffaf0',0,.39,-.05,.91,.66,.72);
  ball(group,'#ee3034',0,.47,.642,.32,.32,.065);
  for(const side of [-1,1]){const spot=ball(group,'#ee3034',side*.75,.38,.09,.10,.28,.30);spot.rotation.z=side*.2;}
  ball(group,'#ee3034',0,.96,-.14,.30,.063,.27);ball(group,'#ee3034',0,.43,-.713,.30,.29,.065);
  for(const side of [-1,1]){ball(group,'#272626',side*.18,-.30,.527,.065,.13,.035);ball(group,'#ffffff',side*.197,-.255,.56,.014);}
  smile(group,-.53,.50,.13);
}
function donkey(group:THREE.Group){
  const fur='#864720',skin='#e9b879';ball(group,fur,0,0,-.10,.78,.78,.60);
  for(const side of [-1,1]){ball(group,fur,side*.72,-.03,-.03,.20,.26,.17);ball(group,skin,side*.72,-.02,.11,.13,.16,.055);ball(group,skin,side*.25,.17,.43,.30,.33,.20);}
  eyes(group,.13,.61,.24,'#71331e',.155);
  for(const side of [-1,1]){const brow=ball(group,fur,side*.25,.40,.54,.30,.12,.16);brow.rotation.z=side*.1;}
  ball(group,skin,0,-.34,.42,.59,.35,.44);ball(group,fur,0,-.055,.69,.27,.15,.13);
  for(const side of [-1,1])ball(group,'#4a2b18',side*.09,-.06,.80,.047,.029,.025);
  ball(group,'#fff7d9',0,-.47,.815,.29,.072,.025);smile(group,-.50,.834,.28);
  for(let i=-1;i<=1;i++)cone(group,fur,i*.18,.78,-.08,.16,.37,-i*.18);
}
export function createNintendoHead(variant:number,happy=false):THREE.Group{
  const character=characterFor(variant),group=new THREE.Group();group.userData.character=character.name;group.userData.characterId=character.id;
  switch(character.id){case 0:plumber(group,false);break;case 1:plumber(group,true);break;case 2:princess(group,false);break;case 3:yoshi(group);break;case 4:bowser(group);break;case 5:toad(group);break;case 6:donkey(group);break;case 7:princess(group,true);break;}
  if(happy){
    const mouth=group.getObjectByName('mouth');if(mouth){group.remove(mouth);(mouth as THREE.Mesh).geometry.dispose();}
    const positions=[[-.47,.65,.19],[-.47,.65,.18],[-.38,.63,.13],[-.34,1.13,.24],[-.39,.85,.29],[-.53,.53,.14],[-.50,.85,.28],[-.38,.63,.13]];
    const [y,z,width]=positions[character.id];
    ball(group,'#71372c',0,y,z,width,.09,.036).name='happy-smile';
    ball(group,'#fffbea',0,y+.032,z+.032,width*.82,.031,.014);
    ball(group,'#ef9b98',0,y-.038,z+.031,width*.48,.025,.013);
  }
  group.userData.expression=happy?'smile':'neutral';
  // All eight silhouettes share one head-sized envelope for kart and portrait framing.
  group.scale.setScalar(.83);group.position.y=-.04;return group;
}

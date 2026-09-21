import * as THREE from 'three';
import { box, cylinder, mesh, textTexture } from './models';
import { GS_SPONSORS, sponsorTexture, type Sponsor } from './sponsors';

export type VenueKind='cafe'|'beach-shop'|'forest-lodge'|'city-building'|'ski-chalet'|'energy-station';
export const VENUE_KINDS:Record<string,VenueKind>={roastery:'cafe',coast:'beach-shop',forest:'forest-lodge',city:'city-building',snow:'ski-chalet',volcano:'energy-station'};
export const VENUE_CLEARANCE=24;

/** Reserve a clear lot outside every part of the road, not just the closest corner. */
export function sponsorLots(curve:THREE.CatmullRomCurve3){
  const road=curve.getSpacedPoints(440),center=road.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/road.length);
  const occupied:THREE.Vector3[]=[];
  return GS_SPONSORS.map((sponsor,index)=>{
    const point=curve.getPointAt(.035+index*.12),tangent=curve.getTangentAt(.035+index*.12),outward=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
    if(outward.dot(point.clone().sub(center))<0)outward.negate();
    let position=point.clone();
    for(let distance=25;distance<=201;distance+=4){position=point.clone().addScaledVector(outward,distance);if(road.every(p=>Math.hypot(position.x-p.x,position.z-p.z)>=VENUE_CLEARANCE)&&occupied.every(p=>Math.hypot(position.x-p.x,position.z-p.z)>=24))break;}
    position.y=-.25;occupied.push(position);return {sponsor,index,position,rotation:Math.atan2(-outward.x,-outward.z)};
  });
}

function mountedPanel(sponsor:Sponsor,width:number,height:number,lit=false){
  const panel=new THREE.Group();panel.name='mounted-advert';panel.userData.sponsor=sponsor.name;panel.userData.mount=lit?'building-led':'wall-sign';
  panel.add(box(width+.3,height+.3,.20,lit?'#263345':'#615849'));
  const texture=sponsorTexture(sponsor,width/height),material=lit?new THREE.MeshBasicMaterial({map:texture}):new THREE.MeshStandardMaterial({map:texture,roughness:.82});
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);face.position.z=.111;panel.add(face);
  if(lit){for(const side of [-1,1])panel.add(box(.07,height+.1,.06,sponsor.accent,side*(width/2+.09),0,.14));}
  return panel;
}
function pitchedRoof(group:THREE.Group,width:number,depth:number,y:number,color:string){
  for(const side of [-1,1]){const roof=box(width*.58,.30,depth+1,color,side*width*.245,y,0);roof.rotation.z=-side*.46;group.add(roof);}
}
function wallWindows(group:THREE.Group,width:number,height:number,depth:number,lit=false){
  for(let x=-width/2+1.1;x<width/2-1;x+=1.9)for(let y=2;y<height-1;y+=2.6){group.add(box(1.05,1.35,.075,lit?'#c3d7e7':'#719f9d',x,y,depth/2+.05));}
}

function parkedCar(color:string){
  const car=new THREE.Group();car.add(box(2.2,.65,3.8,color,0,.72,0),box(1.85,.72,1.95,'#a7d3d5',0,1.33,-.25),box(1.92,.16,2.0,color,0,1.73,-.25));
  for(const x of [-1.10,1.10])for(const z of [-1.2,1.2]){const wheel=cylinder(.42,.42,.22,'#293a44',x,.49,z);wheel.rotation.z=Math.PI/2;car.add(wheel);}
  for(const x of [-.70,.70])car.add(box(.45,.20,.05,'#fff5c6',x,.80,1.93));return car;
}
function charger(){
  const group=new THREE.Group();group.add(box(.9,2.2,.65,'#ecf1e8',0,1.2,0),box(.62,.75,.08,'#16495d',0,1.72,.37),box(.8,.45,.07,'#8eca5e',0,.56,.37));
  const cable=mesh(new THREE.TorusGeometry(.45,.055,6,16,Math.PI*1.6),'#263c42',.55,1.1,.38);group.add(cable,box(.15,.35,.15,'#263c42',.81,1.48,.40));return group;
}
function containerBox(color:string){
  const group=new THREE.Group();group.add(box(3.4,2.4,4.4,color,0,1.2,0));
  for(let x=-1.5;x<=1.5;x+=.45)group.add(box(.055,2.15,.05,'#c4d2c6',x,1.2,2.23));
  group.add(box(3.4,.10,.10,'#d6dece',0,2.35,2.23),box(3.4,.10,.10,'#d6dece',0,.09,2.23));return group;
}

export function createSponsorVenue(kind:VenueKind,sponsor:Sponsor,_index:number){
  const venue=new THREE.Group();venue.name=`${kind}:${sponsor.name}`;venue.userData.kind=kind;venue.userData.sponsor=sponsor.name;venue.userData.business=sponsor.business;
  const city=kind==='city-building',snow=kind==='ski-chalet',wood=kind==='forest-lodge'||snow;
  const wall=wood?'#a08b69':kind==='beach-shop'?'#e3d3aa':kind==='energy-station'?'#84918a':'#d8ddd4';
  const roof=snow?'#f4fafb':wood?'#607c66':'#617883',glass=city?'#8ccbdc':'#83b7be',trim=sponsor.background;
  const feature=(object:THREE.Object3D,name:string)=>{object.name=name;venue.add(object);return object;};
  const panel=(width:number,height:number,x:number,y:number,z:number)=>{const ad=mountedPanel(sponsor,width,height,city);ad.position.set(x,y,z);venue.add(ad);};
  const cap=(width:number,depth:number,x:number,y:number,z:number)=>venue.add(box(width,.28,depth,roof,x,y,z));
  const window=(w:number,h:number,x:number,y:number,z:number)=>{venue.add(box(w+.18,h+.18,.15,'#445a61',x,y,z),box(w,h,.08,glass,x,y,z+.10));};
  const door=(x:number,z:number)=>{window(1.75,2.7,x,1.58,z);venue.add(box(.07,2.7,.09,'#e7eee3',x,1.58,z+.17));};
  venue.add(box(16.6,.26,14.4,'#a4aba3',0,.12,0),box(16.8,.10,.35,'#d4d9c9',0,.29,7.02));
  for(const x of [-6.8,6.8])venue.add(box(.45,.12,13.2,'#cbd2c3',x,.31,0));
  switch(sponsor.business){
    case 'charging': {
      // A drive-in charging plaza: bays, real cables and parked electric cars.
      venue.add(box(4.8,3.8,3.3,wall,0,2.05,-4.2));cap(5.2,3.7,0,4.0,-4.2);door(0,-2.50);
      for(const x of [-6.9,6.9])venue.add(box(.23,5.8,.23,'#a3bcb9',x,3.05,2));
      cap(15.5,8.8,0,6.10,.5);venue.add(box(15.5,.45,8.8,trim,0,5.76,.5));panel(13.8,1.7,0,5.64,4.96);
      for(const [i,x]of [-4.3,0,4.3].entries()){
        const unit=charger();unit.position.set(x,.25,-.8);feature(unit,'ev-charger');
        for(const dx of [-1.6,1.6])venue.add(box(.11,.03,5.6,'#eff5d5',x+dx,.29,3.0));
        venue.add(box(3.2,.035,.11,'#eff5d5',x,.29,5.75));
        if(i!==1){const car=parkedCar(i?'#7dc5a3':'#f1efe3');car.position.set(x,.28,3.2);feature(car,'electric-car');}
      }break;
    }
    case 'refining': {
      venue.add(box(13,4.5,3.4,wall,0,2.5,-4.1));cap(13.5,3.8,0,4.9,-4.1);
      for(const x of [-4,0,4])window(3.3,2.4,x,2.3,-2.34);
      for(const x of [-7,7])for(const z of [-2.6,3.9])venue.add(cylinder(.15,.18,6.5,'#dce7df',x,3.5,z));
      venue.add(box(15.9,.75,8.4,trim,0,6.70,.4));cap(16.1,8.6,0,7.19,.4);panel(13.7,1.65,0,6.56,4.66);
      for(const x of [-4.4,4.4]){
        const pump=new THREE.Group();pump.position.set(x,.3,.8);pump.add(box(1.35,2.25,.8,'#eef0e6',0,1.14,0),box(1.12,.60,.08,'#214551',0,1.67,.45),box(1.1,.5,.09,sponsor.accent,0,.70,.45));
        for(const side of [-1,1]){const hose=mesh(new THREE.TorusGeometry(.48,.055,6,16,Math.PI*1.6),'#273a3d',side*.87,1.0,.35);pump.add(hose,box(.15,.37,.15,'#263c42',side*1.02,1.42,.43));}
        feature(pump,'fuel-pump');venue.add(box(2.1,.30,3,'#c7d2c5',x,.35,.8));
      }break;
    }
    case 'retail': {
      venue.add(box(14,5.0,8,wall,0,2.77,-1.3));cap(14.8,8.8,0,5.40,-1.3);
      for(const x of [-4.6,-1.7,4.6]){window(2.6,2.65,x,2.4,2.80);for(let row=0;row<3;row++)for(let col=0;col<4;col++)venue.add(box(.37,.39,.12,['#ecb666','#d1dfac','#f3efe3'][row],x-1+col*.64,1.55+row*.72,2.96));}
      door(1.45,2.82);venue.add(box(15.0,.42,2.1,trim,0,4.6,3.5));
      for(let i=0;i<15;i++)venue.add(box(.99,.17,2.15,i%2?'#ecf3df':sponsor.accent,-6.93+i*.99,4.87,3.5));
      panel(12.8,1.9,0,5.85,3.02);
      const storefront=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.76),new THREE.MeshBasicMaterial({map:textTexture('GS25',trim,'#fff7d9',512,128)}));storefront.position.set(1.45,3.92,3.04);feature(storefront,'gs25-storefront');
      for(const x of [-4.8,4.8]){venue.add(cylinder(.75,.75,.12,'#e8dfbd',x,1.40,5.25),cylinder(.07,.10,1.1,'#8b9e93',x,.80,5.25));for(const dx of [-.85,.85])venue.add(box(.55,.65,.55,'#dfecdf',x+dx,.6,5.25));}
      break;
    }
    case 'construction': {
      const height=city?20:13;
      for(let y=.4;y<=height;y+=3.1){venue.add(box(9.3,.28,8.2,'#adb3a8',-2,y,-1));for(const x of [-6,-2,2])for(const z of [-4.5,2.5])venue.add(box(.32,3.05,.32,'#c5cabd',x,y+1.55,z));}
      venue.add(box(3.0,height*.73,7.8,wall,-4.5,height*.365,-1));
      for(let y=1.4;y<height*.65;y+=2.8)window(2.1,1.7,-4.5,y,2.97);
      const crane=new THREE.Group(),top=height+5;
      for(const x of [4.8,5.6])for(const z of [-1.4,-.6])crane.add(box(.13,top,.13,'#e5b75e',x,top/2,z));
      for(let y=1;y<top;y+=2){crane.add(box(1.1,.10,1.1,'#e5b75e',5.2,y,-1));const brace=box(.10,2.18,.10,'#e5b75e',5.2,y,-.58);brace.rotation.z=.38;crane.add(brace);}
      crane.add(box(14,.35,.65,'#e5b75e',.5,top,-1),box(2,1.2,1.2,'#687c78',6.8,top-.75,-1),box(1.2,1.0,1.1,glass,4.3,top-.3,-1));
      crane.add(cylinder(.025,.025,6,'#415653',-5.5,top-3, -1),box(.22,.45,.22,'#415653',-5.5,top-6,-1));feature(crane,'tower-crane');
      venue.add(box(15.3,2.6,.18,wall,0,1.6,5.8));panel(13.6,2.15,0,1.7,5.97);
      for(const x of [-7.0,7.0])venue.add(mesh(new THREE.ConeGeometry(.31,.8,8),'#e69a4c',x,.7,6.1));break;
    }
    case 'energy': {
      venue.add(box(12.7,6.0,7.6,wall,-.5,3.27,-1.4));cap(13.2,8.0,-.5,6.4,-1.4);door(-3.8,2.47);panel(10.8,2.1,-.5,4.56,2.57);
      const solar=new THREE.Group();for(let x=0;x<4;x++)for(let z=0;z<3;z++){solar.add(box(1.35,.10,1.0,'#29496c',-5+x*1.52,0,-3.7+z*1.18));for(const dx of [-.38,0,.38])solar.add(box(.015,.02,.93,'#9ed5cf',-5+x*1.52+dx,.065,-3.7+z*1.18));}solar.position.y=7;solar.rotation.x=.13;feature(solar,'solar-array');
      for(const x of [3.8,5.7]){venue.add(cylinder(.67,.67,4.2,'#dae3db',x,8.3,-2.8),cylinder(.36,.55,.4,trim,x,10.55,-2.8));}
      for(const x of [-5.5,-2.7]){const battery=new THREE.Group();battery.position.set(x,.30,4.7);battery.add(box(1.7,2.9,1.1,'#e5eadf',0,1.45,0));for(let y=.7;y<2.6;y+=.35)battery.add(box(1.35,.08,.05,trim,0,y,.58));feature(battery,'energy-storage');}
      const pipe=cylinder(.12,.12,7,'#a3bdb7',2.4,7.1,-3.1);pipe.rotation.z=Math.PI/2;venue.add(pipe);break;
    }
    case 'generation': {
      venue.add(box(9.4,7.7,8,wall,-2,4.1,-1.1));cap(10,8.6,-2,8.1,-1.1);panel(8.2,2.5,-2,6.0,3.03);
      for(const [i,x]of [-5,-2].entries()){feature(cylinder(.6,.82,12+i*2,'#b8c6c0',x,6.3+i,-4.0),'generation-stack');for(const y of [10,11.3])venue.add(cylinder(.65,.65,.50,trim,x,y+i*2,-4));}
      for(const z of [-3.4,1.2]){feature(cylinder(1.35,1.35,6.0,'#d7e0d6',5,3.32,z),'lng-tank');venue.add(cylinder(1.4,1.4,.15,sponsor.accent,5,4.2,z),cylinder(.20,.20,.7,'#809b92',5,6.68,z));}
      const turbine=cylinder(1.05,1.05,6,'#86aaa0',-1,1.65,4.6);turbine.rotation.z=Math.PI/2;feature(turbine,'gas-turbine');
      for(const x of [-3,0,2])venue.add(box(.40,1.0,2.3,trim,x,.75,4.6));
      const pipe=cylinder(.20,.20,7,'#97afa6',.6,7.0,-2.7);pipe.rotation.z=Math.PI/2;venue.add(pipe);break;
    }
    case 'trading': {
      venue.add(box(9.5,6.2,9.4,wall,-2.9,3.35,-1.9));pitchedRoof(venue,10.2,9.8,7.1,roof);
      // Shift this roof onto the warehouse rather than the adjacent container yard.
      for(const child of venue.children.slice(-2))child.position.add(new THREE.Vector3(-2.9,0,-1.9));
      venue.add(box(4.3,3.6,.16,'#859795',-3.8,2.05,2.89));for(let y=.6;y<3.6;y+=.36)venue.add(box(4.3,.055,.07,'#c8d3c8',-3.8,y,3.02));
      panel(8.6,1.9,-2.9,5.7,2.98);
      for(const [i,z]of [-3.8,1.2].entries()){const cargo=containerBox(i?'#ddaa65':trim);cargo.position.set(4.6,.27,z);feature(cargo,'shipping-container');if(i===0){const stacked=containerBox('#7bad9c');stacked.position.set(4.6,2.70,z);feature(stacked,'shipping-container');}}
      const truck=new THREE.Group();truck.position.set(-3.8,.30,5.0);truck.add(box(2.3,2.3,2.4,'#e9eddf',0,1.55,-.4),box(2.2,1.5,1.2,trim,0,1.1,1.0),box(1.8,.6,.04,glass,0,1.58,1.62));for(const x of [-1.2,1.2])for(const z of [-.9,1.0]){const wheel=cylinder(.43,.43,.2,'#30454a',x,.48,z);wheel.rotation.z=Math.PI/2;truck.add(wheel);}feature(truck,'delivery-truck');break;
    }
    default: {
      const height=city?24:11.5;
      venue.add(box(8.3,height,7.8,wall,-2.5,height/2+.27,-1.5),box(5.6,height*.73,8.8,trim,4.0,height*.365+.27,-2));
      const front=new THREE.Group();front.position.set(-2.5,.27,-1.5);wallWindows(front,8.3,height,7.8,true);venue.add(front);
      for(const x of [-6,-4,-2,0,5.3])venue.add(box(.09,height-.5,.09,'#e4ecdf',x,height/2,2.48));
      cap(8.9,8.4,-2.5,height+.43,-1.5);cap(6.1,9.4,4,height*.73+.43,-2);
      venue.add(box(13,3.3,3.6,'#aec6c2',0,1.92,3.1));for(const x of [-3.8,0,3.8])window(2.9,2.5,x,1.98,4.96);
      venue.add(box(14,.25,2.3,trim,0,3.7,4.5));panel(7.7,2.6,-2.5,city?12:8.0,2.66);
      const atrium=venue.children.at(-1)!;atrium.name='headquarters-facade';
      for(const x of [-6.2,6.2]){venue.add(box(1.6,.6,1.5,'#d2d8c6',x,.60,5.5),mesh(new THREE.IcosahedronGeometry(.75,1),'#72a77d',x,1.45,5.5));}break;
    }
  }
  // Theme details apply to every business, so each facility belongs to its map.
  if(snow)for(const x of [-7.5,7.5])venue.add(mesh(new THREE.SphereGeometry(.7,10,6),'#f3f9fa',x,.40,5.8));
  if(wood)for(const x of [-7.3,7.3])venue.add(box(.22,1.0,4.5,'#947b57',x,.8,-2));
  if(kind==='beach-shop')venue.add(box(1.6,.65,1.6,'#e3c99d',7,.5,5.7));
  venue.userData.features=venue.children.filter(child=>child.name).map(child=>child.name);
  return venue;
}

import * as THREE from 'three';
export const buildingTypes={apartment:{label:'아파트·공동주택',color:'#4f9272'},office:{label:'빌딩',color:'#4d83a5'},large:{label:'대형건물',color:'#bc8a50'},house:{label:'주택',color:'#a48175'}};
export function buildingType(site){return site.buildingType||(/박물관|도서관|주차장|교회/.test(site.name)?'large':/스튜디오|녹틸럭스|카페|포뮬리에/.test(site.name)?'office':site.kind==='public-residential-plan'||/공동|복합|다가구|다세대|하늘집/.test(site.name)?'apartment':'house');}
// Geographic markers communicate building use, not surveyed facade or height.
export function buildingModel(type){
 const root=new THREE.Group();root.userData.buildingType=type;
 const m={wall:new THREE.MeshStandardMaterial({color:buildingTypes[type].color,roughness:.55}),glass:new THREE.MeshStandardMaterial({color:'#b8d8df',metalness:.45,roughness:.2}),roof:new THREE.MeshStandardMaterial({color:'#344e50',roughness:.7}),base:new THREE.MeshStandardMaterial({color:'#ece9dc'})};
 const box=(w,h,d,x,y,z,material=m.wall)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);o.position.set(x,y,z);root.add(o);return o;};
 box(31,1,24,0,.5,0,m.base);
 if(type==='apartment'){
  for(const x of [-8,8]){box(11,30,12,x,16,0);box(12,1,13,x,31.5,0,m.roof);for(let y=5;y<30;y+=4){box(11.4,.5,12.4,x,y,0,m.base);for(const dx of [-3,0,3])for(const z of [-6.1,6.1])box(1.8,2.2,.15,x+dx,y+1.5,z,m.glass);}}
 }else if(type==='office'){
  box(20,38,16,0,20,0,m.glass);for(let y=3;y<39;y+=4)box(20.4,.7,16.4,0,y,0,m.wall);for(const x of [-10,-5,0,5,10])for(const z of [-8.2,8.2])box(.5,38,.5,x,20,z,m.roof);box(14,3,10,0,40,0,m.roof);
 }else if(type==='large'){
  box(29,13,21,0,7.5,0);box(30,1,22,0,14.5,0,m.roof);box(15,2,13,3,16,0,m.glass);for(let x=-12;x<=12;x+=4){box(2.8,7,.2,x,7,10.6,m.glass);box(.6,9,1,x,5,11,m.base);}box(10,.8,5,0,1.5,13,m.base);
 }else{
  box(19,11,15,0,6.5,0);box(20,1,16,0,12.5,0,m.roof);box(8,4,.2,-4,7,7.6,m.glass);box(4,7,.2,5,4.5,7.6,m.roof);box(10,1,6,-3,1.5,10,m.base);
 }
 return root;
}

// Pixel rectangles reviewed against the archived original, never inferred
// from the building type. Dimensions remain estimated until site calibration.
export function annotateParking(plan,site){
 const definitions=[];let width,height;
 const row=(prefix,count,x,y,w,h,dx,dz,extra={})=>{for(let i=0;i<count;i++)definitions.push({id:`${prefix}-${i+1}`,x:x+i*dx,z:y+i*dz,width:w,depth:h,...extra});};
 if(site.id==='parking-131601-0'){
  width=700;height=530;
  row('north',18,188,51,23,45,24,0);row('front',21,115,155,23,44,24,0);
  row('west',8,76,202,43,23,0,24);
  row('accessible',2,636,155,28,44,33,0,{accessible:true,label:'장애인 전용 주차'});
 }else if(site.id==='parking-168780-0'){
  width=905;height=484;
  for(const [i,y] of [148,163,263,281,297,312].entries())row('west-compact-'+i,1,189,y,26,14,0,0);
  for(const [i,y] of [186,205,225,244].entries())row('west-outer-'+i,1,182,y,36,17,0,0);
  for(const [i,y] of [168,186,205,225,245,264,285,305].entries())row('west-inner-'+(i+1),1,270,y,36,17,0,0);
  for(const [i,y] of [175,199,235,259,285,309].entries())row('east-inner-'+(i+1),1,693,y,36,19,0,0,{accessible:true,label:'장애인 전용 주차'});
  for(const [i,y] of [155,181,205,240,263,291,314].entries())row('east-outer-'+i,1,779,y,36,19,0,0,{accessible:true,label:'장애인 전용 주차'});
  // The last inner bay has no wheelchair symbol. Hatched walkways are gaps.
  definitions.find(s=>s.id==='east-inner-6-1').accessible=false;definitions.find(s=>s.id==='east-inner-6-1').label='일반 주차';
  // Western circular equipment symbols differ from the eastern wheelchair
  // marks. Preserve the dedicated area without asserting its current use.
  for(const s of definitions.filter(s=>s.id.startsWith('west-inner')&&Number(s.id.split('-')[2])<=6)){s.reserved=true;s.label='도면의 전용 주차 표시 · 용도 현장 확인';}
 }
 if(!definitions.length)return plan;
 const scale=plan.width/width;
 const spaces=definitions.map(s=>({...s,kind:'parking',x:(s.x-width/2)*scale,z:(s.z-height/2)*scale,width:s.width*scale,depth:s.depth*scale,accessibilityEvidence:s.accessible?{source:site.source,asset:site.sourceAsset.file,method:'wheelchair-symbol-visual-review',status:'source-confirmed-not-surveyed'}:null}));
 // Parking markings are not walls. The raster extractor otherwise extrudes
 // the bay linework; suppress that known semantic region.
 const walls=plan.walls.filter(w=>!spaces.some(s=>Math.abs((w.x1+w.x2)/2-s.x)<s.width/2+.25&&Math.abs((w.z1+w.z2)/2-s.z)<s.depth/2+.25));
 return {...plan,spaces,walls,parkingAnnotation:{method:'source-reviewed-pixel-rectangles',source:site.source,scale:'estimated',vehicleDisplay:'illustrative-not-live-occupancy'},warnings:[...plan.warnings,'주차면은 공개 원본에 수동 주석했습니다. 차량은 구획 이해를 위한 예시이며 실시간 점유가 아닙니다.']};
}

// The public B2 drawing is traced in its original 1800 x 1350 pixel frame.
// Horizontal dimensions follow its existing estimated scale; object heights,
// stair risers, door leaves and finishes are presentation assumptions.
export function enrichObjects(plan,site){
 const objects=[];
 if(site.id==='changdong-b2'){
  const at=(x,z)=>({x:(x-1065)*.09,z:(z-745)*.09});
  const add=(kind,id,x,z,w,d,label,extra={})=>objects.push({kind,id,...at(x,z),width:w*.09,depth:d*.09,height:kind==='column'?3.3:kind==='stairs'?3.3:kind==='lift'?2.8:.04,label,...extra,evidence:{source:site.source,asset:site.sourceAsset.file,location:'source-traced',height:'assumed'}});
  const columns=[...[[619,455],[765,455],[856,481],[945,502],[1036,526],[1339,582],[1446,582],[1519,582]],...[712,765,855,945,1036,1098,1160,1250,1340,1446,1519].map(x=>[x,641]),...[632,854,945,1036,1098,1160,1250,1446,1519].map(x=>[x,726]),...[632,765,854,945,1036,1098,1160,1250,1340,1446,1519].map(x=>[x,820]),...[711,765,855,945,1036,1098,1160,1250,1340,1430,1519].map(x=>[x,916]),...[711,765,855,945,1036,1098,1160,1250,1340,1430,1519].map(x=>[x,1011]),...[711,855,945,1036,1098,1160,1250,1340,1519].map(x=>[x,1095])];
  columns.forEach(([x,z],i)=>add('column','column-'+i,x,z,8,8,'기둥 '+(i+1)));
  for(const [id,x,z,w,d,label] of [['electric',686,451,202,137,'전기실'],['mechanical',684,669,216,64,'기계실'],['management',938,518,159,62,'관리실'],['hvac',1400,567,289,65,'공조실'],['water',691,942,129,110,'저수조 · 소화수조'],['rainwater',719,1051,139,58,'우수조점검층'],['purification',737,1114,109,51,'정화조점검층']])add('room',id,x,z,w,d,label);
  for(const [id,x,z,w,d] of [['stairs-a',738,563,20,33],['stairs-b',705,767,20,35],['stairs-c',1340,777,19,35]])add('stairs',id,x,z,w,d,'계단',{steps:20});
  for(const [id,x,z] of [['lift-a',762,564],['lift-b',740,757],['lift-c',1383,781]])add('lift',id,x,z,25,27,'승강기');
  for(const [id,x,z,angle] of [['door-a',791,579,0],['door-b',752,811,Math.PI/2],['door-c',1322,812,Math.PI/2]])add('door',id,x,z,13,3,'코어 출입문',{height:2.2,angle,openAngle:Math.PI/2});
  const rampPath=[[1022,488,3.3],[1116,510,2.2],[1192,535,1.1],[1210,579,0]].map(([x,z,y])=>({...at(x,z),y}));
  objects.push({kind:'ramp',id:'vehicle-ramp',...at(1130,530),width:5.2,depth:12,height:3.3,label:'차량 램프',path:rampPath,evidence:{source:site.source,location:'source-traced',height:'assumed'}});
  const extra=[];const bay=(id,x,z,w=27,d=53,flags={})=>extra.push({id,kind:'parking',...at(x,z),width:w*.09,depth:d*.09,label:id,...flags});
  // The legacy annotation mistook the southern bay divider for a wall and
  // placed cars in the service area / cross-hatched gap. Re-check against the
  // original 1800 x 1350 source instead of treating the old count as a target.
  const divider=at(770,1090);
  plan.walls=plan.walls.filter(w=>!(Math.abs(w.x1-divider.x)<.01&&Math.abs(w.z1-divider.z)<.01&&Math.abs(w.z2-divider.z)<.01&&Math.abs(w.x2-w.x1)>70));
  plan.spaces=plan.spaces.filter(s=>!/^p(?:4[4-9]|5[0-9]|6[0-6])$/.test(s.id));
  for(const [i,x] of [872,900,928,1052,1082,1113,1142,1175,1204,1233,1264,1294,1324,1355,1384,1415,1444,1473,1501].entries())bay('south-reviewed-'+(i+1),x,1118,25,55);
  plan.reviewCorrections=[{source:site.source,asset:site.sourceAsset.file,kind:'parking-line-not-wall',region:'south-row',note:'남측 주차 구획선의 벽체 오분류 제거. 설비 공간·빗금 영역을 제외하고 19면을 원본에서 다시 주석.'}];
  bay('north-disabled',900,628,33,53,{accessible:true,label:'장애인 전용'});
  for(const [i,x] of [930,961,991].entries())bay('north-reserved-'+i,x,628,27,53,{reserved:true,label:'전용 주차 표기'});
  for(const [i,x] of [1067,1109].entries())bay('north-general-'+i,x,629,27,53);
  for(const [i,x] of [1300,1393,1487].entries())bay('east-upper-'+i,x,641,55,24);
  bay('island-upper-end',1294,754,27,53);
  for(const z of [938.5,997.5])for(let i=0;i<5;i++)bay(`island-extension-${z}-${i}`,1295.5+i*30,z,27,53,z<950?{reserved:true,label:'전용 주차 표기'}:{});
  bay('west-disabled-1',835,748,51,33,{accessible:true,label:'장애인 전용'});bay('west-disabled-2',835,786,51,33,{accessible:true,label:'장애인 전용'});
  for(let i=0;i<5;i++)bay('west-general-'+i,835,933+i*30,51,27);
  plan.spaces.find(s=>s.id==='p21').accessible=true;plan.spaces.find(s=>s.id==='p21').label='장애인 전용';
  for(const id of ['p0','p1','p11','p12','p32']){const space=plan.spaces.find(s=>s.id===id);space.reserved=true;space.label='전용 주차 표기';}
  plan.spaces.push(...extra);
  for(const s of plan.spaces.filter(s=>s.accessible))s.accessibilityEvidence={source:site.source,asset:site.sourceAsset.file,method:'wheelchair-symbol-visual-review',status:'source-confirmed-not-surveyed'};
  plan.semanticCoverage={drawingDeclaredParking:121,modeledParking:plan.spaces.filter(s=>s.kind==='parking').length,method:'source-reviewed-annotations',unresolved:['소형 글자·사선 구획 일부는 원본 겹치기로 제공','기둥 높이·계단 단수·난간·마감재는 미리보기 가정','도면 기재 주차면 수와 모델링 구획 수를 구분']};
 }
 if(site.siteId==='10000901'){
  const at=(x,z)=>({x:(x-500)*.0777777777778,z:(z-170)*.0777777777778});
  for(const [i,p] of [[592,136],[663,136],[592,187],[663,187],[592,244],[663,302]].entries())objects.push({kind:'column',id:'neon-column-'+i,...at(...p),width:.35,depth:.35,height:2.8,label:'기둥 후보',evidence:{source:site.source,location:'source-traced-estimate',height:'assumed'}});
 }
 if(site.id==='parking-131601-0'){
  // Positions and numbered room names re-read from the publisher's 2000 px
  // original. The inspection view was 1818 px wide; retain source-pixel
  // coordinates as well as local geometry for another visual review.
  const frameWidth=1818,frameHeight=frameWidth*1513/2000,scale=plan.width/frameWidth;
  plan.reviewCorrections=[...(plan.reviewCorrections||[]),{source:site.source,asset:site.sourceAsset.file,kind:'source-reviewed-walls-and-bays',note:'도로 경계·차양 점선을 벽에서 제외하고 실제 벽·유리면·문 개구부를 원본에 주석. 북측 20면·건물 앞 21면·서측 9면·장애인 2면을 재검토.'}];
  const add=(kind,id,x,z,w,d,label,extra={})=>objects.push({kind,id:'daecheon-'+id,x:(x-frameWidth/2)*scale,z:(z-frameHeight/2)*scale,width:w*scale,depth:d*scale,height:kind==='room'?.04:2.8,label,...extra,evidence:{source:site.source,asset:site.sourceAsset.file,sourcePixel:{x:x*2000/frameWidth,y:z*2000/frameWidth},location:'source-traced-estimate',height:'assumed',label:'publisher-numbered-floor-plan-legend'}});
  const columns=[...[275,480,684,888,1092,1296].map(x=>[x,489]),...[596,698,800,902,991].map(z=>[275,z]),...[378,480,582,684,786,888,990,1092,1194,1296,1398,1500].map(x=>[x,991]),[480,901],[888,739],[888,901],[1092,901],[1296,901]];
  columns.forEach(([x,z],i)=>add('column','column-'+(i+1),x,z,13,13,'기둥 '+(i+1)));
  for(const [id,x,z,w,d,label] of [
   ['lobby',1288,835,392,154,'① 로비·라운지'],['duty',1505,742,114,80,'② 당직실'],['meeting',1505,621,114,140,'③ 회의실'],
   ['women',1411,659,51,83,'④ 여자 화장실'],['men',1337,659,80,82,'⑤ 남자 화장실'],
   ['accessible-wc-a',1170,665,48,50,'⑦ 장애인 화장실'],['accessible-wc-b',1170,720,48,51,'⑦ 장애인 화장실'],
   ['locker-a',1041,592,82,85,'⑧ 탈의실'],['locker-b',1041,700,82,92,'⑧ 탈의실'],
   ['shower-a',1112,598,42,98,'⑨ 샤워실'],['shower-b',1112,699,42,94,'⑨ 샤워실'],
   ['multipurpose',888,645,196,195,'⑩ 다목적실'],['storage',627,645,108,183,'⑪ 창고'],
   ['office',507,853,329,112,'⑫ 사무실 1'],['annex-a',520,604,86,114,'⑬ 부속실'],['annex-b',520,713,86,45,'⑬ 부속실'],
  ])add('room',id,x,z,w,d,label);
  add('lift','lift',1169,602,45,51,'⑥ 승강기');
  add('stairs','stairs-west',758,706,43,74,'서측 계단',{steps:20});add('stairs','stairs-east',1267,706,43,74,'동측 계단',{steps:20});
 }
 if(site.id==='parking-168780-0'){
  const scale=plan.width/1536;
  const add=(kind,id,x,z,w,d,label,extra={})=>objects.push({kind,id,x:(x-768)*scale,z:(z-411)*scale,width:w*scale,depth:d*scale,height:kind==='room'?.04:2.8,label,...extra,evidence:{source:site.source,asset:site.sourceAsset.file,sourcePixel:{x,y:z},location:'source-traced-estimate',height:'assumed'}});
  for(const [i,[x,z]] of [[269,259],[269,495],[1368,259],[1368,495]].entries())add('stairs','dongtan-stairs-'+i,x,z,26,36,'계단',{steps:20});
  add('lift','dongtan-lift-0',269,585.5,26,25,'서측 승강기');add('lift','dongtan-lift-1',1368,583.5,26,27,'동측 승강기');
  for(const [i,[x,z]] of [[269,283],[269,515],[1368,283],[1368,515]].entries())add('door','dongtan-door-'+i,x,z,18,1,'계단 출입문',{height:2.2,openAngle:Math.PI/2});
  add('room','dongtan-ps-west',262,434.5,20,59,'서측 PS · 설비 샤프트');add('room','dongtan-ps-east',1374.5,434.5,21,59,'동측 PS · 설비 샤프트');
  for(const [i,[x,z]] of [370,467].flatMap(z=>[254,340,502,1084,1206,1295,1383].map(x=>[x,z])).entries())add('column','dongtan-column-'+i,x,z,6,6,'기둥 '+(i+1));
  add('room','dongtan-open',760,421,490,265,'OPEN · 하부 공간 (통행 차로 아님)');
 }else if(site.siteId==='parking-168780'){
  const h=site.id.endsWith('-1')?441:438,scale=plan.width/905;
  const add=(kind,id,x,z,w,d,label,extra={})=>objects.push({kind,id,x:(x-452.5)*scale,z:(z-h/2)*scale,width:w*scale,depth:d*scale,height:kind==='room'?.04:3,label,...extra,evidence:{source:site.source,asset:site.sourceAsset.file,location:'source-traced-estimate',height:'assumed'}});
  for(const [i,[x,z]] of [[158,151],[158,290],[805,151],[805,290]].entries())add('stairs','dongtan-stairs-'+i,x,z,14,26,'계단',{steps:20});
  for(const [i,x] of [156,807].entries())add('lift','dongtan-lift-'+i,x,254,12,32,'승강기');
  if(site.id.endsWith('-1')){
   add('room','dongtan-west-terrace',246,223,95,112,'퍼블릭 라운지');add('room','dongtan-east-terrace',721,227,94,112,'퍼블릭 라운지');
  }else{
   for(const [i,x,z,w,d,label] of [[0,313,344,100,44,'주차장 운영 사무실'],[1,400,344,89,44,'기계실'],[2,508,344,38,44,'발전기실'],[3,568,344,77,44,'전기실'],[4,658,344,97,44,'매표·대기 공간'],[5,513,165,249,60,'다목적 야외광장']])add('room','dongtan-room-'+i,x,z,w,d,label);
  }
 }
 return {...plan,objects,objectEvidence:'source-traced-plan-positions; heights and finishes are preview assumptions'};
}

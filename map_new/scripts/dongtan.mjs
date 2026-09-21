// Source review: publisher's 1536 × 822 1F drawing. X1–X12 spans
// 7 + 9 × 8.75 + 7 = 92.75 m between pixels 253 and 1383.
// Geometry is drawing-calibrated, not surveyed. Ramp elevations prevent
// joining the east and west decks without a reviewed inter-floor route.
export const DONGTAN_SCALE=92.75/1130;
export const DONGTAN_WALLS=[
 [252,234,286,234,4,2.8],[252,234,252,283,4,2.8],[286,234,286,283,3,2.8],
 [252,283,260,283,3,2.8],[278,283,286,283,3,2.8],
 [286,234,500,234,4,1.1],[252,283,252,405,4,1.1],
 [252,405,272,405,3,2.8],[252,405,252,464,3,2.8],[272,405,272,464,3,2.8],[252,464,272,464,3,2.8],
 [252,464,252,475,4,1.1],
 [252,475,286,475,3,2.8],[252,475,252,515,4,2.8],[286,475,286,515,3,2.8],
 [252,515,260,515,3,2.8],[278,515,286,515,3,2.8],
 [252,515,252,570,4,1.1],[252,570,286,570,3,2.8],[252,570,252,601,4,2.8],[286,570,286,601,3,2.8],
 [252,601,362,601,4,1.1],[418,601,503,601,4,1.1],[503,274,503,601,4,1.1],
 [1017,234,1351,234,4,1.1],[1017,234,1017,601,4,1.1],[1083,277,1083,575,3,1.1],
 [1351,234,1385,234,4,2.8],[1351,234,1351,283,3,2.8],[1385,234,1385,283,4,2.8],
 [1351,283,1359,283,3,2.8],[1377,283,1385,283,3,2.8],
 [1385,283,1385,405,4,1.1],
 [1364,405,1385,405,3,2.8],[1364,405,1364,464,3,2.8],[1385,405,1385,464,4,2.8],[1364,464,1385,464,3,2.8],
 [1385,464,1385,475,4,1.1],
 [1351,475,1385,475,3,2.8],[1351,475,1351,515,3,2.8],[1385,475,1385,515,4,2.8],
 [1351,515,1359,515,3,2.8],[1377,515,1385,515,3,2.8],
 [1385,515,1385,566,4,1.1],[1351,566,1385,566,3,2.8],[1351,566,1351,601,3,2.8],[1385,566,1385,601,4,2.8],
 [1206,601,1385,601,4,1.1],
];
export function dongtanBays(){
 const spaces=[],add=(id,x,z,width,depth,label,flags={})=>spaces.push({id,x,z,width,depth,label,...flags});
 for(const [i,[z,depth]] of [[247.5,23],[271,24],[450,30],[483.5,25],[508,24],[530.5,23]].entries())add(`west-compact-${i}-1`,319.5,z,43,depth,`서측 경차 ${i+1}`,{vehicleClass:'compact'});
 for(const [i,z] of [317.5,350,386,418].entries())add(`west-outer-${i}-1`,309.5,z,63,32,`서측 바깥 ${i+1}`);
 for(const [i,z] of [289,319.5,350,386,416.5,446,484,515.5].entries())add(`west-inner-${i+1}-1`,457.5,z,63,30,`서측 안쪽 ${i+1}${i<6?' · 전용 표시':''}`,{reserved:i<6});
 for(const [i,[z,depth]] of [[300,34],[342,41],[400,42],[442,38],[492,30],[525,32]].entries())add(`east-inner-${i+1}-1`,1176,z,64,depth,i<5?`동측 안쪽 장애인 ${i+1}`:'동측 안쪽 일반', {accessible:i<5});
 for(const [i,[z,depth]] of [[264,44],[307.5,41],[347,36],[401,42],[444,40],[491.5,33],[529,40]].entries())add(`east-outer-${i}-1`,1321.5,z,61,depth,`동측 바깥 장애인 ${i+1}`,{accessible:true});
 return spaces;
}
export function dongtanSvg(){
 const tags=DONGTAN_WALLS.map(([x1,y1,x2,y2,w,h])=>`<line data-kind="wall" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w}" data-height="${h}"/>`);
 tags.push('<line id="west-deck" data-kind="lane" data-oneway="true" x1="390" y1="268" x2="390" y2="554" data-width="5.8"/>',
  '<line id="west-exit" data-kind="lane" data-oneway="true" x1="390" y1="554" x2="390" y2="704" data-width="3.8"/>',
  '<line id="east-deck" data-kind="lane" data-oneway="true" x1="1245" y1="252" x2="1245" y2="550" data-width="5.4"/>',
  '<circle id="west-deck-start" data-kind="target" data-role="entrance" data-label="서측 1층 차로 · 출구 방향" cx="390" cy="268"/>',
  '<circle id="west-vehicle-exit" data-kind="target" data-role="vehicle-exit" data-label="서측 차량 출구 앞" cx="390" cy="678"/>',
  '<circle id="east-deck-start" data-kind="target" data-role="entrance" data-label="동측 1층 차로 · 진입 램프 이후" cx="1245" cy="282"/>');
 for(const s of dongtanBays()){
  tags.push(`<rect id="${s.id}" data-kind="space" data-role="parking" data-label="${s.label}" data-accessible="${!!s.accessible}" data-reserved="${!!s.reserved}" x="${s.x-s.width/2}" y="${s.z-s.depth/2}" width="${s.width}" height="${s.depth}"/>`);
  tags.push(`<circle id="approach-${s.id}" data-kind="target" data-role="junction" data-label="${s.label} 앞 차로" cx="${s.id.startsWith('west')?390:1245}" cy="${Math.max(s.id.startsWith('west')?280:286,s.z)}"/>`);
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 822" data-meters-per-unit="${DONGTAN_SCALE}" data-source-kind="source-traced" data-name="동탄 1층 · 구역별 일방통행 차로와 벽체">${tags.join('\n')}</svg>\n`;
}
export function applyDongtanReview(plan,site){
 const point=(x,z)=>({x:(x-768)*DONGTAN_SCALE,z:(z-411)*DONGTAN_SCALE}),source=site.source,asset=site.sourceAsset.file;
 plan.parkingAccess=dongtanBays().map(s=>{
  const p=point(s.id.startsWith('west')?390:1245,Math.max(s.id.startsWith('west')?280:286,s.z));
  return {spaceId:s.id,nodeId:plan.nodes.find(n=>Math.hypot(n.x-p.x,n.z-p.z)<.0001)?.id,startNodeId:s.id.startsWith('west')?'west-deck-start':'east-deck-start',source,method:'source-reviewed-adjacent-lane',arrival:'aisle',surveyed:false};
 });
 for(const s of plan.spaces){
  if(s.accessible)s.accessibilityEvidence={source,asset,method:'wheelchair-symbol-visual-review',status:'source-confirmed-not-surveyed'};
  if(s.id.startsWith('west-compact'))s.vehicleClass='compact';
 }
 plan.defaultStart='west-deck-start';plan.defaultDestination='approach:west-inner-8-1';
 plan.scaleEvidence={method:'printed-grid-dimensions',pixelLength:1130,meters:92.75,metersPerPixel:DONGTAN_SCALE,sourcePixels:[{x:253,y:227},{x:1383,y:227}],label:'X1–X12: 7m + 9 × 8.75m + 7m',surveyed:false};
 plan.wallEvidence={method:'source-reviewed-core-walls-and-parapets',source,sourcePixels:{width:1536,height:822},solid:plan.walls.length,glazing:0,doorOpenings:'preserved',surveyed:false,note:'계단·PS·승강기 코어와 외곽 벽·난간을 대조했습니다. 벽 높이 2.8m·난간 1.1m는 표현 가정입니다.'};
 plan.routingEvidence={method:'source-reviewed-one-way-arrows',source,starts:['west-deck-start','east-deck-start'],note:'서측·동측 1층 차로의 화살표 방향을 따릅니다. 중앙 OPEN 공간을 가로지르지 않으며 높이가 다른 진입 램프·층간 연결은 아직 안내하지 않습니다.'};
 plan.parkingAnnotation={method:'source-reviewed-native-pixel-rectangles',source,scale:'printed-grid-dimensions',vehicleDisplay:'illustrative-not-live-occupancy'};
 plan.semanticCoverage={drawingDeclaredParking:87,modeledParking:31,method:'source-reviewed-annotations',unresolved:['원본 표기 87대와 이 평면에서 확인한 31구획을 구분','전용 원형 표시 6면의 현재 용도 미확인','상층 차량 도면 미확보·게이트 운영 미확인']};
 plan.reviewCorrections=[{source,asset,kind:'source-reviewed-one-way-aisles-and-core-walls',note:'치수선·주차선·중앙 OPEN 공간의 투영선을 벽에서 제외했습니다. PS는 설비 샤프트로, 남측 승강기 2곳은 실제 코어 위치로 수정했습니다.'}];
 plan.warnings=['도면의 치수선으로 축척을 보정했습니다. 현장 실측·통행 허용·게이트 운영은 미확인입니다.','주차 방식에서 전진·후진 입차를 선택할 수 있습니다. 상층 차량 도면이 없어 동탄 층간 연결은 제공하지 않습니다.'];
 return plan;
}

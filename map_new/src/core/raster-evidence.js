// Python artifacts use original image pixels; scene geometry uses cropped metres.
// Keep that transform in one place, including lines crossing a crop boundary.
function clipLine(a,b,bounds){
  let start=0,end=1;const dx=b.x-a.x,dy=b.y-a.y;
  for(const [p,q] of [[-dx,a.x-bounds.x],[dx,bounds.x+bounds.width-a.x],[-dy,a.y-bounds.y],[dy,bounds.y+bounds.height-a.y]]){
    if(p===0){if(q<0)return null;continue;}
    const t=q/p;if(p<0)start=Math.max(start,t);else end=Math.min(end,t);if(start>=end)return null;
  }
  return [{x:a.x+start*dx,y:a.y+start*dy},{x:a.x+end*dx,y:a.y+end*dy}];
}

export function applyRasterEvidence(plan,analysis,{preserveWalls=false}={}){
  const {width,height}=analysis.sourcePixels||{};
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||analysis.resizeScale!==1||!Array.isArray(analysis.candidates)||analysis.candidates.length>10000||!Array.isArray(analysis.tiles)||!analysis.tiles.length)throw Error('원본 해상도 분석 자료가 올바르지 않습니다.');
  const crop=plan.sourceCrop||{x:0,y:0,width:1,height:1};
  if(![crop.x,crop.y,crop.width,crop.height,plan.width,plan.depth].every(Number.isFinite)||Math.min(crop.width,crop.height,plan.width,plan.depth)<=0||crop.x<0||crop.y<0||crop.x+crop.width>1.000001||crop.y+crop.height>1.000001)throw Error('원본 도면의 분석 영역이 올바르지 않습니다.');
  const bounds={x:crop.x*width,y:crop.y*height,width:crop.width*width,height:crop.height*height};
  const sx=plan.width/bounds.width,sz=plan.depth/bounds.height,ids=new Set();
  const walls=[];
  for(const candidate of analysis.candidates){
    if(!candidate.id||ids.has(candidate.id)||![candidate.x1,candidate.y1,candidate.x2,candidate.y2,candidate.thickness,candidate.patternScore].every(Number.isFinite)||candidate.thickness<=0||candidate.patternScore<0||candidate.patternScore>100||candidate.status!=='review-required'||typeof candidate.structuralStroke!=='boolean')throw Error('검출 구조선의 좌표와 검토 상태를 확인하세요.');
    ids.add(candidate.id);
    const clipped=clipLine({x:candidate.x1,y:candidate.y1},{x:candidate.x2,y:candidate.y2},bounds);
    if(!clipped)continue;
    const [a,b]=clipped;
    const wall={id:candidate.id,x1:(a.x-bounds.x)*sx-plan.width/2,z1:(a.y-bounds.y)*sz-plan.depth/2,x2:(b.x-bounds.x)*sx-plan.width/2,z2:(b.y-bounds.y)*sz-plan.depth/2,thickness:Math.max(.06,candidate.thickness*(sx+sz)/2),height:2.8,status:'review-required',patternScore:candidate.patternScore,structuralStroke:candidate.structuralStroke,pixelSegment:{x1:candidate.x1,y1:candidate.y1,x2:candidate.x2,y2:candidate.y2,thickness:candidate.thickness},tileIds:candidate.tileIds};
    // Source-confirmed parking marks must not be extruded as concrete walls.
    wall.parkingMark=plan.spaces.some(s=>['parking','ev'].includes(s.kind)&&Math.abs((wall.x1+wall.x2)/2-s.x)<=s.width/2+.15&&Math.abs((wall.z1+wall.z2)/2-s.z)<=s.depth/2+.15);
    walls.push(wall);
  }
  const policy=analysis.contextMap?'context-map':analysis.planarDrawing===false?'non-plan-drawing':preserveWalls?'reviewed-preserved':'automatic-structural-strokes';
  const previousWallCount=plan.walls.length;
  if(['context-map','non-plan-drawing'].includes(policy))plan.walls=[];
  else if(!preserveWalls)plan.walls=walls.filter(w=>w.structuralStroke&&!w.parkingMark);
  if(!preserveWalls){
    if(plan.analysis)plan.legacyRasterAnalysis=plan.analysis;
    plan.analysis={method:analysis.method,wallCount:plan.walls.length,pixels:width*height,metersPerPixel:sx,metersPerPixelZ:sz};
    plan.warnings=plan.warnings.filter(w=>!w.startsWith('직교 구조선 추정:'));
  }
  plan.wallDetection={method:analysis.method,sourceSha256:analysis.sourceSha256,status:'review-required',walls};
  plan.rasterAnalysis={file:`analysis/${analysis.id}/analysis.json`,sourceSha256:analysis.sourceSha256,signature:analysis.signature,method:analysis.method,sourcePixels:analysis.sourcePixels,resizeScale:1,tileCount:analysis.tiles.length,tileSize:analysis.tileSize,overlap:analysis.overlap,excludedTextBoxes:analysis.excludedTextBoxes,candidateCount:analysis.candidates.length,structuralStrokeCount:analysis.structuralStrokeCount,modelPolicy:policy,previousWallCount,appliedWallCount:plan.walls.length,assets:{grayscale:`analysis/${analysis.id}/grayscale.webp`,binary:`analysis/${analysis.id}/binary.png`,overlay:`analysis/${analysis.id}/overlay.webp`}};
  plan.rasterAnalysis.drawingKind=analysis.drawingKind;plan.rasterAnalysis.sourceReview=analysis.sourceReview;
  if(policy==='non-plan-drawing')plan.warnings.push(analysis.sourceReview.note);
  if(policy==='automatic-structural-strokes')plan.warnings.push('원본 해상도를 유지해 흑백 보정·겹침 분할로 구조선을 추출했습니다. 벽체 의미·높이·축척과 문 개구부는 원본 검토가 필요합니다.');
  return plan;
}

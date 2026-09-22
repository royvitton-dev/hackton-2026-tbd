const finite = n => typeof n === 'number' && Number.isFinite(n);
export function validatePlan(plan) {
  if (!plan || plan.version !== 1 || !finite(plan.width) || !finite(plan.depth) || plan.width <= 0 || plan.depth <= 0 || plan.width > 2000 || plan.depth > 2000) throw new Error('도면의 크기와 버전을 확인하세요.');
  for(const key of ['walls','nodes','edges','spaces'])if(!Array.isArray(plan[key])||plan[key].length>10000)throw new Error('도면 요소 목록이 없거나 너무 큽니다.');
  for (const wall of plan.walls || []) {
    if (![wall.x1, wall.z1, wall.x2, wall.z2, wall.height, wall.thickness].every(finite) || wall.height <= 0 || wall.thickness <= 0) throw new Error('벽체 좌표가 올바르지 않습니다.');
  }
  const ids = new Set();
  for (const node of plan.nodes || []) {
    if (!node.id || ids.has(node.id) || !finite(node.x) || !finite(node.z)) throw new Error('중복되거나 잘못된 동선 지점입니다.');
    ids.add(node.id);
  }
  for (const edge of plan.edges || []) if (!ids.has(edge.from) || !ids.has(edge.to) || !finite(edge.width) || edge.width <= 0 || !Array.isArray(edge.modes) || !edge.modes.length || edge.modes.some(mode=>!['car','person'].includes(mode))) throw new Error('동선 연결이 올바르지 않습니다.');
  return plan;
}

// Portable raster SDK: detect long, thick orthogonal structural lines. It does
// not claim to infer doors, exits, semantic rooms or a physical scale from pixels.
export function analyzeRaster({ data, width, height }, { metersPerPixel = 0.05, threshold = 85, minLength = 24, minThickness = 2, wallHeight = 2.8, calibrated = false } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 4_000_000 || data?.length !== width * height * 4 || !finite(metersPerPixel) || metersPerPixel <= 0 || metersPerPixel > 10) throw new Error('이미지 크기 또는 축척이 올바르지 않습니다.');
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i*4+3] > 100 && Math.max(data[i*4], data[i*4+1], data[i*4+2]) < threshold ? 1 : 0;
  const walls = [];
  for (const vertical of [false, true]) {
    const major = vertical ? height : width, minor = vertical ? width : height;
    const runs = [];
    for (let line = 0; line < minor; line++) {
      let start = -1;
      for (let p = 0; p <= major; p++) {
        const black = p < major && mask[vertical ? p*width+line : line*width+p];
        if (black && start < 0) start = p;
        if (!black && start >= 0) {
          if (p - start >= minLength) {
            const previous = runs.findLast(r => r.last === line-1 && Math.abs(r.start-start) <= 3 && Math.abs(r.end-p) <= 3);
            if (previous) { previous.last = line; previous.start = Math.min(previous.start,start); previous.end = Math.max(previous.end,p); }
            else runs.push({ start, end:p, first:line, last:line });
          }
          start = -1;
        }
      }
    }
    for (const r of runs) {
      const thick = r.last-r.first+1;
      if (thick < minThickness || thick > (r.end-r.start)*0.4) continue;
      const cross = (r.first+r.last)/2;
      const x1 = vertical ? cross : r.start, z1 = vertical ? r.start : cross, x2 = vertical ? cross : r.end, z2 = vertical ? r.end : cross;
      walls.push({ x1:(x1-width/2)*metersPerPixel, z1:(z1-height/2)*metersPerPixel, x2:(x2-width/2)*metersPerPixel, z2:(z2-height/2)*metersPerPixel, thickness:Math.max(.08,thick*metersPerPixel), height:wallHeight });
    }
  }
  return validatePlan({ version:1, name:'도면 구조선 분석', width:width*metersPerPixel, depth:height*metersPerPixel, walls, nodes:[], edges:[], spaces:[], sourceType:'raster', scaleStatus:calibrated?'user-calibrated':'estimated', routingReady:false, warnings:['직교 구조선 추정: 글자·치수선이 포함될 수 있습니다.', '문·출입구·실측 축척 검토 후 동선을 지정하세요.'], analysis:{ wallCount:walls.length, pixels:width*height, metersPerPixel } });
}

export function analyzeBlueprint(pixels,options={}) {
  let plan=analyzeRaster(pixels,options);
  if(plan.walls.length<4){
    plan=analyzeRaster(pixels,{...options,threshold:185,minThickness:1});
    // Low contrast architectural scans often use one-pixel grey linework.
    // Exclude sheet frames at the image boundary; dimension lines still require review.
    const margin=.04;
    plan.walls=plan.walls.filter(w=>!((w.x1*w.x2>0&&Math.abs(w.x1)>plan.width*(.5-margin)&&Math.abs(w.x2)>plan.width*(.5-margin))||(w.z1*w.z2>0&&Math.abs(w.z1)>plan.depth*(.5-margin)&&Math.abs(w.z2)>plan.depth*(.5-margin))));
    plan.analysis.wallCount=plan.walls.length;plan.analysis.adaptiveContrast=true;
    plan.warnings.push('옅은 스캔의 선을 추가 추출했습니다. 치수선과 벽체를 대조하세요.');
  }
  return plan;
}

// Annotated SVG is an exchange format: explicit geometry, units, clearances,
// movement modes and egress semantics are preserved rather than guessed.
export function analyzeSvg(text) {
  if (typeof text !== 'string' || text.length > 2_000_000 || /<!ENTITY|<!DOCTYPE|<script|<foreignObject/i.test(text)) throw new Error('지원하지 않는 SVG입니다.');
  const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const root = attrs(text.match(/<svg\b[^>]*>/i)?.[0] || '');
  const scale = Number(root['data-meters-per-unit']);
  const view = root.viewBox?.split(/[ ,]+/).map(Number);
  if (!view || view.length !== 4 || !view.every(finite) || !finite(scale) || scale <= 0 || view[0] !== 0 || view[1] !== 0) throw new Error('SVG에 viewBox와 data-meters-per-unit 축척이 필요합니다.');
  const plan = { version:1, name:root['data-name'] || '가져온 SVG 도면', width:view[2]*scale, depth:view[3]*scale, walls:[], nodes:[], edges:[], spaces:[], sourceType:'annotated-svg', scaleStatus:'declared', routingReady:false, warnings:[] };
  if(root['data-source-kind']==='source-traced'){plan.layoutType='source-traced';plan.scaleStatus='estimated';plan.warnings.push('공개 도면의 좌표를 분석가가 주석 처리한 모델입니다. 축척·현재 시설 상태·출입구는 현장 검증 전입니다.');}
  const x = v => Number(v)*scale-plan.width/2, z = v => Number(v)*scale-plan.depth/2;
  for (const match of text.matchAll(/<(line|rect|circle)\b[^>]*>/g)) {
    const a = attrs(match[0]);
    if (a['data-kind']==='wall') plan.walls.push({x1:x(a.x1),z1:z(a.y1),x2:x(a.x2),z2:z(a.y2),height:Number(a['data-height']||3),thickness:Number(a['stroke-width']||.3)*scale});
    if (a['data-kind']==='node') plan.nodes.push({id:a.id,x:x(a.cx),z:z(a.cy),kind:a['data-role']||'junction',label:a['data-label']||a.id, safe:a['data-safe']==='true',heading:Number(a['data-heading']||Math.PI)});
    if (a['data-kind']==='edge') plan.edges.push({id:a.id,from:a['data-from'],to:a['data-to'],width:Number(a['data-width']||6),modes:(a['data-modes']||'car,person').split(','),oneWay:a['data-oneway']==='true'});
    if (a['data-kind']==='space') plan.spaces.push({id:a.id,kind:a['data-role']||'parking',x:x(a.x)+Number(a.width)*scale/2,z:z(a.y)+Number(a.height)*scale/2,width:Number(a.width)*scale,depth:Number(a.height)*scale,label:a['data-label']||''});
  }
  plan.routingReady=plan.nodes.length>0&&plan.edges.length>0;
  return validatePlan(plan);
}

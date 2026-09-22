import {facadeFor} from './facades.js';

export function buildingProfile(site, plan, settings = {}) {
  const reviewed=facadeFor(site);
  const supplied = site.footprint;
  const measured = Array.isArray(supplied) && supplied.length >= 3 && supplied.length < 2000
    && supplied.every(p => [p.x,p.z].every(Number.isFinite) && Math.max(Math.abs(p.x),Math.abs(p.z)) < 10000);
  const points = (plan?.walls || []).flatMap(w => [{x:w.x1,z:w.z1},{x:w.x2,z:w.z2}]).filter(p => [p.x,p.z].every(Number.isFinite));
  const bounds = points.length ? {
    minX:Math.min(...points.map(p=>p.x)), maxX:Math.max(...points.map(p=>p.x)),
    minZ:Math.min(...points.map(p=>p.z)), maxZ:Math.max(...points.map(p=>p.z)),
  } : {minX:-10,maxX:10,minZ:-6,maxZ:6};
  const footprint = measured ? supplied : reviewed ? [
    {x:-reviewed.width/2,z:-reviewed.depth/2},{x:reviewed.width/2,z:-reviewed.depth/2},
    {x:reviewed.width/2,z:reviewed.depth/2},{x:-reviewed.width/2,z:reviewed.depth/2},
  ] : [
    {x:bounds.minX,z:bounds.minZ}, {x:bounds.maxX,z:bounds.minZ},
    {x:bounds.maxX,z:bounds.maxZ}, {x:bounds.minX,z:bounds.maxZ},
  ];
  const facade = site.photo?.facade || {};
  const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== '' ? Math.max(min,Math.min(max,Number(value))) : fallback;
  const floors = Math.round(bounded(settings.floors, reviewed?.floors || (facade.residentialFloors ? facade.residentialFloors+1 : 3), 1, 20));
  const floorHeight = bounded(settings.floorHeight, reviewed?.floorHeight || facade.floorHeight || 3, 2, 5);
  const baseHeight = reviewed?.baseHeight || facade.baseHeight || floorHeight;
  return {footprint, floors, floorHeight, baseHeight, height:baseHeight+(floors-1)*floorHeight,
    color:/^#[\da-f]{6}$/i.test(settings.color || '') ? settings.color : reviewed?.color || facade.upper || '#d8d8ca',
    baseColor:reviewed?.baseColor || facade.base || '#8e968c', glass:'#617d80',
    width:reviewed?.width,depth:reviewed?.depth,facadeType:reviewed?.type,features:reviewed?.features,
    photoFiles:reviewed?.photoFiles,photoTexture:!!reviewed && settings.photoTexture!==false && !settings.color,
    footprintKind:measured ? 'published-footprint' : reviewed ? 'photo-study' : points.length ? 'drawing-bounds' : 'reference-mass',
    floorEvidence:settings.floors!==undefined ? '사용자 조정 가능한 가정 층수' : facade.residentialFloors ? '공개 입주표를 참고한 층수' : reviewed ? '외관 사진에서 확인한 층 구성 · 높이 추정' : '사용자 조정 가능한 가정 층수',
  };
}

export function modelDescription(profile, view) {
  if (view === 'drawing') return '수집 도면의 구조선 · 축척·높이 추정';
  if(profile.facadeType)return profile.footprintKind==='published-footprint'
    ? '공개 윤곽 + 사진 기반 외관 · 세부 치수 추정'
    : '사진 기반 외관 · 치수 추정 · 실제 외곽선 미확인';
  return profile.footprintKind === 'published-footprint'
    ? '공개 건물 윤곽 + 외관 사진 참고 · 높이·창 배치 추정'
    : profile.footprintKind === 'drawing-bounds'
      ? '도면 범위를 바탕으로 만든 외관 가정 · 실제 외곽선 미확인'
      : '도면 연결 전의 참고 매스 · 실제 건물 형상이 아닙니다';
}

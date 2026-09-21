import {writeFile} from 'node:fs/promises';
// Analyst annotations in pixels of the original 1800x1350 PDF raster, page 16.
// Scale is an explicit approximation (parking-bay visual reference), not a survey.
const crop={x:550,y:330,width:1030,height:830},unit=.09;
const lines=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${crop.width} ${crop.height}" data-meters-per-unit="${unit}" data-name="동북권 복합시설 · B2 주차장" data-source-kind="source-traced" data-scale-status="estimated">`];
const points=[[558,345],[612,345],[612,330],[674,330],[674,375],[770,375],[1575,578],[1575,1158],[685,1158],[664,1136],[558,570],[558,345]];
const wall=(a,b)=>lines.push(`<line data-kind="wall" x1="${a[0]-crop.x}" y1="${a[1]-crop.y}" x2="${b[0]-crop.x}" y2="${b[1]-crop.y}" data-height="3.3" stroke-width="4"/>`);
for(let i=1;i<points.length;i++)wall(points[i-1],points[i]);
for(const [a,b] of [[[560,533],[710,533]],[[560,533],[610,877]],[[610,877],[770,877]],[[770,877],[770,1090]],[[770,1090],[1574,1090]],[[770,1090],[796,1155]],[[770,375],[770,494]],[[770,494],[850,519]],[[850,395],[850,535]],[[850,535],[1010,574]],[[1010,435],[1010,574]],[[1247,503],[1247,625]],[[1247,625],[1570,625]]])wall(a,b);
const nodes=[['entrance',1212,648,'차량 램프 입구','entrance'],['top',1212,684,'북측 차로','junction'],['tl',894,684,'서북 차로','junction'],['tr',1474,684,'동북 차로','junction'],['ml',894,870,'서측 차로','junction'],['mr',1474,870,'동측 차로','junction'],['bl',894,1053,'서남 차로','junction'],['br',1474,1053,'동남 차로','junction'],['A',874,684,'서측 상부 코어 접근','building'],['B',894,844,'서측 하부 코어 접근','building'],['C',1474,844,'동측 코어 접근','building']];
for(const [id,x,y,label,kind] of nodes)lines.push(`<circle id="${id}" data-kind="node" data-role="${kind}" data-label="${label}" data-heading="0" cx="${x-crop.x}" cy="${y-crop.y}"/>`);
for(const [a,b] of [['entrance','top'],['top','tl'],['top','tr'],['tl','B'],['B','ml'],['tr','C'],['C','mr'],['ml','mr'],['ml','bl'],['mr','br'],['bl','br'],['tl','A']])lines.push(`<line id="${a}-${b}" data-kind="edge" data-from="${a}" data-to="${b}" data-width="5" data-modes="car,person"/>`);
function space(id,x,y,width,height,kind,label=''){lines.push(`<rect id="${id}" data-kind="space" data-role="${kind}" data-label="${label}" x="${x-crop.x}" y="${y-crop.y}" width="${width}" height="${height}"/>`);}
space('core-a',710,533,110,82,'core','상부 코어');space('core-b',654,714,115,108,'core','서측 코어');space('core-c',1320,725,114,112,'core','동측 코어');
let index=0;
for(const y of [728,785,912,971])for(let x=952;x<1280;x+=30)space(`p${index++}`,x,y,27,53,'parking');
for(let x=820;x<1490;x+=30)space(`p${index++}`,x,1095,27,53,'parking');
for(let y=735;y<1045;y+=30)space(`p${index++}`,1518,y,48,27,'parking');
lines.push('</svg>');await writeFile(new URL('../public/plans/changdong-parking-annotated.svg',import.meta.url),lines.join('\n'));

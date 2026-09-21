// Reviewed against the publisher's 2000 × 1513 original. The 0–10 m
// scale bar spans 274 px; this is drawing calibration, not a site survey.
export const DAE_SCALE=10/274;
export const DAE_WALLS=[
 [366,598,472,598,14],[366,598,366,886,14],[523,598,576,598,14],[523,598,523,705,4],
 [627,598,756,598,14],[627,598,627,814,4],[523,737,627,737,4],[523,737,523,769,4],
 [523,814,756,814,4],[756,598,756,615,5],[756,647,756,817,5],[756,852,756,1006,21],
 [810,598,860,598,14],[810,639,810,744,5],[860,598,860,825,5],
 [1039,598,1255,598,14],[1039,598,1039,625,5],[1039,658,1095,658,5],
 [1095,598,1095,676,5],[1095,741,1095,824,5],[1095,709,1255,709,5],
 [1149,658,1149,761,5],[1197,598,1197,676,5],[1197,741,1197,824,5],
 [1095,824,1320,824,5],[1255,598,1255,824,5],[1255,629,1320,629,5],
 [1255,699,1320,699,5],[1255,760,1320,760,5],
 [1318,595,1318,645,5],[1318,675,1318,701,5],[1318,731,1318,761,5],[1318,792,1318,824,5],
 [1373,598,1473,598,14],[1370,639,1370,746,5],[1421,598,1421,824,6],
 [1421,654,1468,654,5],[1468,654,1468,676,5],[1421,676,1585,676,6],
 [1506,598,1550,598,14],[1510,600,1510,677,6],[1518,677,1518,772,6],
 [1421,780,1442,780,5],[1476,772,1553,772,6],[1500,772,1500,792,5],
 [1421,824,1541,824,5],[1585,598,1585,824,5],[1585,598,1723,598,14],
 [1723,598,1723,663,14],[1648,765,1723,765,7],[1723,765,1723,800,14],
 [1645,805,1645,867,5],[1645,867,1723,867,14],[1723,835,1723,867,14],
 [1645,934,1684,934,14],[1645,934,1645,1004,6],[1645,983,1723,983,14],[1723,928,1723,983,14],
 [1443,530,1658,530,14],[1443,530,1443,545,14],[1650,530,1650,544,14],[1723,529,1723,544,14],
];
export const DAE_GLAZING=[
 [472,599,521,599],[576,599,625,599],[865,599,1036,599],
 [366,887,366,1006],[366,1006,744,1006],[766,875,1099,875],
 [1099,875,1130,921],[1163,965,1192,1006],[1192,1006,1641,1006],
 [1725,664,1725,754],
];
export function daecheonBays(){
 const spaces=[],add=(id,x,z,w,d,accessible=false)=>spaces.push({id,x,z,width:w,depth:d,accessible,label:accessible?'장애인 전용':id.startsWith('north')?'북측 '+id.split('-')[1]:id.startsWith('front')?'건물 앞 '+id.split('-')[1]:'서측 '+id.split('-')[1]});
 const north=[509.5,580.5,652,723,794.5,865.5,936.5,1007.5,1078.5,1149.5,1221,1292.5,1363.5,1434.5,1505.5,1576.5,1647.5,1719,1789.5,1861.5,1932];
 for(let i=1;i<north.length;i++)add('north-'+i,(north[i-1]+north[i])/2,145.5,north[i]-north[i-1],143);
 const front=[290.5,359.5,427.5,496,564.5,632.5,701.5,769.5,812.5,880.5,949,1017.5,1085.5,1154.5,1222.5,1291,1359.5,1427.5,1496.5,1564.5,1632.5,1701.5,1770];let n=0;
 for(let i=1;i<front.length;i++){if(front[i]-front[i-1]<60)continue;add('front-'+(++n),(front[i-1]+front[i])/2,449.5,front[i]-front[i-1],137);}
 const west=[481,549.5,617.5,685.5,754.5,822.5,891,959.5,1027.5,1096];
 for(let i=1;i<west.length;i++)add('west-'+i,222,(west[i-1]+west[i])/2,137,west[i]-west[i-1]);
 add('accessible-1',1803,449.5,62,137,true);add('accessible-2',1894,449.5,62,137,true);
 return spaces;
}
export function daecheonSvg(){
 const tags=DAE_WALLS.map(([x1,y1,x2,y2,w])=>`<line data-kind="wall" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${w}" data-height="2.8"/>`);
 for(const [x1,y1,x2,y2] of DAE_GLAZING)tags.push(`<line data-kind="wall" data-material="glazing" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="3" data-height="2.8"/>`);
 tags.push('<line id="north-aisle" data-kind="lane" x1="70" y1="298.5" x2="1920" y2="298.5" data-width="5.94"/>','<line id="west-aisle" data-kind="lane" x1="70" y1="298.5" x2="70" y2="1150" data-width="5.10"/>');
 tags.push('<circle id="entry-east" data-kind="target" data-role="entrance" data-label="동측 주차 차로 진입" cx="1920" cy="298.5"/>','<circle id="entry-west" data-kind="target" data-role="entrance" data-label="서측 주차 차로 진입" cx="70" cy="298.5"/>');
 for(const s of daecheonBays()){
  tags.push(`<rect id="${s.id}" data-kind="space" data-role="parking" data-label="${s.label}" data-accessible="${s.accessible}" x="${s.x-s.width/2}" y="${s.z-s.depth/2}" width="${s.width}" height="${s.depth}"/>`);
  if(!s.accessible)tags.push(`<circle id="approach-${s.id}" data-kind="target" data-role="junction" data-label="${s.label} 앞 차로" cx="${s.id.startsWith('west')?70:s.x}" cy="${s.id.startsWith('west')?s.z:298.5}"/>`);
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1513" data-meters-per-unit="${DAE_SCALE}" data-source-kind="source-traced" data-name="대천항 · 벽체와 주차 차로 분석">${tags.join('\n')}</svg>\n`;
}

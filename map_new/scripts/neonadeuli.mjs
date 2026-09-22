// Analyst-traced layers from the public 1000x600 image; no invented EV or exit.
// Graph connectivity is derived by graphFromLayers, not entered as node pairs.
export function neonadeuliSvg(){
  const walls=[[[60,145],[174,145]],[[174,145],[174,104]],[[174,104],[232,104]],[[232,104],[232,109]],[[232,109],[437,109]],[[437,158],[437,290]],[[60,145],[60,287]],[[60,287],[437,287]],[[696,141],[789,141]],[[789,141],[789,146]],[[789,146],[889,146]],[[889,146],[889,178]],[[889,178],[915,178]],[[915,178],[915,286]],[[915,286],[695,286]],[[695,286],[695,141]]];
  const lines=walls.map(([a,b])=>`<line data-kind="wall" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="3" data-height="3.2"/>`);
  for(const [id,a,b,width,kind] of [['street',[330,40],[900,40],6,'road'],['entry',[545,40],[545,273],7,'entrance']])lines.push(`<line id="${id}" data-kind="lane" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" data-width="${width}" data-connection="${kind}" stroke="#9bad9d" stroke-width="${width/.0777777777778}"/>`);
  for(const [id,x,y,kind,label] of [['road-start',330,40,'road','도면에 표기된 6m 도로'],['entrance',545,140,'entrance','차량 진입 표시'],['P2',545,208,'parking','주차 구역 2 앞 차로'],['P3',545,271,'parking','주차 구역 3 앞 차로']])lines.push(`<circle id="${id}" data-kind="target" cx="${x}" cy="${y}" data-role="${kind}" data-label="${label}" r="3" fill="#4f8569"/>`);
  for(const [id,x,y] of [['P1',628,155],['P2',628,208],['P3',628,271]])lines.push(`<rect id="bay-${id}" data-kind="space" data-role="parking" data-label="주차 ${id}" x="${x-35}" y="${y-17}" width="70" height="34" fill="none" stroke="#809783"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 340" data-meters-per-unit="0.0777777777778" data-name="너나들이 · 1층 주차 레이어" data-source-kind="source-traced">${lines.join('\n')}</svg>\n`;
}

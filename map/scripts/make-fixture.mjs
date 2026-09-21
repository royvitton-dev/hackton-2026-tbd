import { writeFile } from 'node:fs/promises';
const lines=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 56" data-meters-per-unit="1" data-name="ATLAS 주차장 동선 시험장">','<rect width="84" height="56" fill="#e8ebe5"/>'];
const nodes=[];
for(let row=0;row<3;row++)for(let col=0;col<5;col++)nodes.push({id:`n${row}${col}`,x:12+col*15,y:10+row*18,role:'junction'});
for(const [id,x,y,label,role] of [['entrance',42,55,'차량 입구','entrance'],['A',12,7.5,'101동','building'],['B',72,7.5,'102동','building'],['C',12,48.5,'103동','building'],['D',72,48.5,'104동','building'],['exit-west',2,28,'서측 외부 집결지','exit'],['exit-east',82,28,'동측 외부 집결지','exit']])nodes.push({id,x,y,label,role});
const edge=(a,b,modes='car,person',width=6)=>lines.push(`<line id="${a}-${b}" data-kind="edge" data-from="${a}" data-to="${b}" data-modes="${modes}" data-width="${width}" x1="${nodes.find(n=>n.id===a).x}" y1="${nodes.find(n=>n.id===a).y}" x2="${nodes.find(n=>n.id===b).x}" y2="${nodes.find(n=>n.id===b).y}" stroke="#b4c5b8" stroke-width="${width}"/>`);
for(let r=0;r<3;r++)for(let c=0;c<5;c++){if(c<4)edge(`n${r}${c}`,`n${r}${c+1}`);if(r<2)edge(`n${r}${c}`,`n${r+1}${c}`);}
edge('entrance','n22');edge('n00','A');edge('n04','B');edge('n20','C');edge('n24','D');edge('n10','exit-west','person',2.4);edge('n14','exit-east','person',2.4);
for(const n of nodes)lines.push(`<circle id="${n.id}" data-kind="node" data-role="${n.role}" data-label="${n.label||n.id}" data-safe="${n.role==='exit'}" cx="${n.x}" cy="${n.y}" r=".65" fill="${n.role==='exit'?'#49aa79':'#315e4f'}"/>`);
for(const [x1,y1,x2,y2] of [[1,1,83,1],[1,1,1,25],[1,31,1,55],[83,1,83,25],[83,31,83,55],[1,55,38,55],[46,55,83,55]])lines.push(`<line data-kind="wall" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#596f65" stroke-width=".4" data-height="3.3"/>`);
for(const y of [17,35])for(const x of [16.5,31.5,46.5,61.5])for(let i=0;i<3;i++)lines.push(`<rect id="p-${x}-${y}-${i}" data-kind="space" data-role="parking" x="${x+i*2.6}" y="${y}" width="2.5" height="4.8" fill="none" stroke="#8b9c92" stroke-width=".15"/>`);
for(const [x,y,label] of [[7,.5,'101'],[67,.5,'102'],[7,51.5,'103'],[67,51.5,'104']])lines.push(`<rect id="core-${label}" data-kind="space" data-role="core" data-label="${label}동" x="${x}" y="${y}" width="10" height="4" fill="#709b87"/>`);
lines.push('</svg>');await writeFile(new URL('../public/plans/parking-lab.svg',import.meta.url),lines.join('\n'));

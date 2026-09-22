import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {analyzeSvg} from '../../src/core/analysis.js';
import {fitTwoPoints,alignNeonadeuliRoad} from '../../src/core/georeference.js';
import {graphFromLayers} from '../../src/core/layers.js';
import {neonadeuliSvg} from '../../scripts/neonadeuli.mjs';
import {route} from '../../src/core/navigation.js';
const wrap=s=>`<svg viewBox="0 0 100 100" data-meters-per-unit="1">${s}</svg>`;
const lane=(id,x1,y1,x2,y2)=>`<line id="${id}" data-kind="lane" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" data-width="6"/>`;
it('automatically splits intersecting lane layers and attaches semantic targets',()=>{
  const s=wrap(lane('a',0,50,100,50)+lane('b',50,0,50,100)+'<circle id="P1" data-kind="target" cx="80" cy="50" data-role="parking" data-label="P-01"/>'),p=analyzeSvg(s);
  expect(p.nodes).toHaveLength(6);expect(p.edges).toHaveLength(5);expect(p.nodes.filter(n=>n.x===0&&n.z===0)).toHaveLength(1);expect(route(p,'auto-0','P1',{mode:'person'}).destination.label).toBe('P-01');expect(p.graphAnalysis.sourceLaneCount).toBe(2);
});
it('handles overlapping endpoints and parallel lanes without inventing connections',()=>{
  const p=analyzeSvg(wrap(lane('a',0,50,50,50)+lane('b',50,50,100,50)+lane('c',0,90,100,90)));
  expect(p.nodes).toHaveLength(5);expect(p.edges).toHaveLength(3);expect(route(p,p.nodes[0].id,p.nodes.at(-1).id)).toBeNull();expect(graphFromLayers(wrap(''))).toBeNull();
});
it('rejects corrupt lanes, off-lane goals and mixed explicit/implicit graphs',()=>{
  expect(()=>analyzeSvg(wrap(lane('a',0,0,0,0)))).toThrow();
  expect(()=>analyzeSvg(wrap(lane('a',0,0,0,90)+'<circle id="P1" data-kind="target" cx="80" cy="50"/>'))).toThrow();
  expect(()=>analyzeSvg(wrap(lane('a',0,0,0,90)+'<circle id="x" data-kind="node" cx="0" cy="0"/>'))).toThrow();
});
it('connects acquired OSM roads to the same building’s source-plan entrance and parking approach',()=>{
  const context=JSON.parse(readFileSync(new URL('../../public/generated/neonadeuli-context.json',import.meta.url))),p=alignNeonadeuliRoad(analyzeSvg(neonadeuliSvg()),context),r=route(p,'road-start','P2');
  expect(r.ids).toEqual(['road-start','road-portal','entrance','P2']);expect(r.edges[0]).toBe('osm-road');expect(p.roadAlignment.accuracy).toBe('estimated-not-surveyed');expect(p.nodes.some(n=>n.kind==='ev'||n.safe)).toBe(false);expect(p.roadAlignment.osmMetersPerPixel).toBeCloseTo(.073699,5);
  expect(()=>alignNeonadeuliRoad(p,{ways:[]})).toThrow();expect(()=>alignNeonadeuliRoad({...p,nodes:[]},context)).toThrow();
});
it('fits rotated georeferenced control points and rejects coincident anchors',()=>{
  const a={pixel:{x:0,z:0},coordinate:{lat:37,lng:127}},b={pixel:{x:100,z:0},coordinate:{lat:37,lng:127.001}},f=fitTwoPoints(a,b);
  expect(f.geoToPixel(b.coordinate).x).toBeCloseTo(100);expect(f.geoToPixel(a.coordinate).z).toBe(0);expect(f.pixelToWorld({x:0,z:10}).z).toBeCloseTo(f.scale*10);expect(()=>fitTwoPoints(a,a)).toThrow();
});

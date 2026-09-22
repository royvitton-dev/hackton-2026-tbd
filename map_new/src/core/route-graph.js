import {distance} from './geometry.js';

// Bay markers split a straight aisle into short pieces. They must not consume
// a vehicle's turning radius; only real changes of direction do that.
export function straightGraph(plan,startId,endId,mode,blocked=[]){
 const nodes=new Map(plan.nodes.map(n=>[n.id,n]));
 let edges=plan.edges.filter(e=>e.modes.includes(mode)&&!blocked.includes(e.id)).map(e=>({...e,chain:[e.from,e.to],segments:[e.id]}));
 for(const n of plan.nodes){
  if(n.id===startId||n.id===endId)continue;
  const pair=edges.filter(e=>e.from===n.id||e.to===n.id);if(pair.length!==2)continue;
  const [a,b]=pair,aid=a.from===n.id?a.to:a.from,bid=b.from===n.id?b.to:b.from;
  if(aid===bid||!!a.oneWay!==!!b.oneWay||a.oneWay&&(a.to!==n.id||b.from!==n.id))continue;
  const p=nodes.get(aid),q=nodes.get(bid),ab=distance(p,n),bc=distance(n,q);
  if(!ab||!bc||Math.abs(distance(p,q)-ab-bc)>1e-7)continue;
  if(a.width!==b.width||(a.height??Infinity)!==(b.height??Infinity)||a.kind!==b.kind)continue;
  const ca=a.to===n.id?a.chain:[...a.chain].reverse(),cb=b.from===n.id?b.chain:[...b.chain].reverse();
  const sa=a.to===n.id?a.segments:[...a.segments].reverse(),sb=b.from===n.id?b.segments:[...b.segments].reverse();
  edges=edges.filter(e=>e!==a&&e!==b);
  edges.push({...a,id:sa.concat(sb).join('|'),from:aid,to:bid,chain:ca.concat(cb.slice(1)),segments:sa.concat(sb)});
 }
 return {...plan,edges};
}

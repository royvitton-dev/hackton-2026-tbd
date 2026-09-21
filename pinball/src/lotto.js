import {makeConfig} from './physics.js';
export function makeLottoConfig(order='first'){
 if(!['first','last'].includes(order))throw new Error('로또 규칙을 선택해 주세요.');
 const config=makeConfig(Array.from({length:45},(_,i)=>String(i+1)).join(','),1,order==='first'?'nth':'last',7);
 const palette=['#ffc65a','#80cafa','#f299ba','#c5bcd5','#95d3ad'];
 config.people.forEach((p,i)=>{p.color=palette[Math.floor(i/10)];});
 return {...config,mode:'lotto',lottoOrder:order,finishMode:'winner'};
}
// Select only from completed physical arrivals; the last bonus remains unarrived.
export function lottoResult(config,state){
 if(config?.mode!=='lotto'||state?.state!=='complete'||!state.winner)return null;
 const last=config.lottoOrder==='last';
 const main=last?state.finishOrder.slice(-6):state.finishOrder.slice(0,6);
 const bonus=last?state.winner:state.finishOrder[6];
 if(main.length!==6||!bonus)return null;
 return {numbers:main.map(r=>Number(r.name??r.label)).sort((a,b)=>a-b),bonus:Number(bonus.name??bonus.label),bonusArrived:!last,mainRanks:main.map(r=>r.rank),bonusRank:last?null:7,order:config.lottoOrder};
}

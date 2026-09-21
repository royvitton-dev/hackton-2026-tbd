import { Coffee, Play, Trophy } from 'lucide-react';
import type { RaceLog } from '../core/types';
import { characterFor } from '../core/characters';
import PodiumScene from '../graphics/PodiumScene';
import type { Playback } from '../graphics/RaceScene';

export default function ResultsPodium({log,playback,onComplete}:{log:RaceLog;playback:React.RefObject<Playback>;onComplete:()=>void}){
  const champion=log.drivers.find(d=>d.id===log.order[0])!,coffeeHero=log.drivers.find(d=>d.id===log.order.at(-1))!;
  return <div className="podium-ceremony" aria-label="우승 시상식">
    <PodiumScene log={log} playback={playback} onComplete={onComplete}/>
    <div className="podium-heading"><span><Trophy size={15}/> GRAND PRIX CHAMPION</span><h2>{champion.nickname}<em>우승!</em></h2><p>{characterFor(champion.avatar).name}와 함께한 가장 빠른 두 바퀴</p></div>
    <ol className="podium-places" aria-label="시상대 순위">{[1,0,2].filter(rank=>rank<log.order.length).map(rank=>{const driver=log.drivers.find(d=>d.id===log.order[rank])!;return <li key={driver.id} data-rank={rank+1} className={rank===0?'champion':''}><span>{['1ST','2ND','3RD'][rank]}</span><strong>{driver.nickname}</strong><small>{characterFor(driver.avatar).name}</small></li>;})}</ol>
    <div className="podium-footer"><p><Coffee size={15}/>오늘의 커피 히어로는 <strong>{coffeeHero.nickname}</strong> 님!</p><button className="button podium-next" onClick={onComplete}><Play size={15}/>커피차로 가기</button><span>시상식 후 커피 히어로의 커피차가 찾아옵니다.</span></div>
  </div>;
}

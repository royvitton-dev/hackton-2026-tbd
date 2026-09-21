import { Coffee, Play } from 'lucide-react';
import { coffeeCast } from '../core/coffee';
import type { RaceLog } from '../core/types';
import type { Playback } from '../graphics/RaceScene';
import CoffeeScene from '../graphics/CoffeeScene';

export default function CoffeeCelebration({log,playback,onComplete}:{log:RaceLog;playback:React.RefObject<Playback>;onComplete:()=>void}){
  const {barista,guests}=coffeeCast(log);
  return <div className="coffee-celebration" aria-label="커피차 축하 장면">
    <CoffeeScene log={log} playback={playback} onComplete={onComplete}/>
    <div className="coffee-heading"><span><Coffee size={16}/> TODAY'S COFFEE HERO</span><h2>달다 달아 <em>이썩겠네.</em></h2><p><strong>{barista.nickname}</strong> 바리스타의 커피차 OPEN!</p></div>
    <div className="coffee-orders"><span>웃으며 기다리는 오늘의 손님들</span><ul>{guests.map(guest=><li key={guest.id} data-guest={guest.id}><i style={{background:guest.color}}/><strong>{guest.nickname}</strong><span>{guest.drink}</span></li>)}</ul></div>
    <div className="coffee-footer"><p>커피는 제가 쏩니다. 맛있게 드세요! <span>☕</span></p><button className="button primary" onClick={onComplete}><Play size={15}/>하이라이트 보기</button><small>커피를 나눈 뒤, 오늘의 명장면이 이어집니다.</small></div>
  </div>;
}

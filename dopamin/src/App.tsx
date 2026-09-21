import { useEffect, useRef, useState } from 'react';
import { ArrowRight, AudioLines, Check, ChevronRight, CircleHelp, Coffee, Download, Flag, History, Leaf, Maximize2, Mic, Minimize2, Mountain, Pause, Play, Plus, Radio, RotateCcw, Route, ShieldCheck, Sparkles, Timer, Trash2, Trophy, Upload, Volume2, VolumeX, Waves, X, Zap, Building2, Flame } from 'lucide-react';
import { characterFor } from './core/characters';
import { raceMoment } from './core/presentation';
import { COLORS, demoDrivers, ITEMS, TRACKS } from './core/catalog';
import { getHighlights, getStandings, parseReplay, sampleRace, simulateRace } from './core/race';
import { clearRaces, deleteVoice, loadDrivers, loadRaces, saveDrivers, saveRace, saveVoice } from './core/storage';
import type { Driver, RaceEvent, RaceLog, Track } from './core/types';
import RaceHUD from './components/RaceHUD';
import { syncRaceAudio, unlockRaceAudio, stopRaceAudio, seekRaceAudio, disposeRaceAudio } from './audio/raceSound';
import RaceScene, { type Playback } from './graphics/RaceScene';
import { announceWinner, playTone } from './audio/recorder';
import Avatar from './components/Avatar';
import ResultsPodium from './components/ResultsPodium';
import CoffeeCelebration from './components/CoffeeCelebration';
import Modal from './components/Modal';
import VoiceModal from './components/VoiceModal';

type ModalType='register'|'order'|'edit'|'guide'|'history'|null;
const trackIcons=[Coffee,Waves,Leaf,Building2,Mountain,Flame];
const formatTime=(time:number)=>`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}.${Math.floor((time*10+0.00001)%10)}`;

function TrackMini({track}:{track:Track}) {
  const points=track.points.map(p=>`${p[0]+35},${p[2]+28}`).join(' ');
  return <svg className="track-mini" viewBox="0 0 70 56" aria-hidden="true"><polygon points={points} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinejoin="round"/><circle cx={track.points[0][0]+35} cy={track.points[0][2]+28} r="3.1" fill="#fff"/></svg>;
}

export default function App() {
  const [drivers,setDrivers]=useState<Driver[]>(demoDrivers),[hydrated,setHydrated]=useState(false),[trackId,setTrackId]=useState('roastery');
  const [view,setView]=useState<'lobby'|'race'|'results'>('lobby'),[modal,setModal]=useState<ModalType>(null),[editing,setEditing]=useState<Driver|undefined>();
  const [sound,setSound]=useState(()=>{try{return localStorage.getItem('brew-sound')!=='off';}catch{return true;}}),[toast,setToast]=useState(''),[log,setLog]=useState<RaceLog|null>(null),[history,setHistory]=useState<RaceLog[]>([]);
  const [time,setTime]=useState(0),[paused,setPaused]=useState(false),[speed,setSpeed]=useState(1),[overview,setOverview]=useState(false),[focus,setFocus]=useState<string|null>(null);
  const [celebration,setCelebration]=useState<'podium'|'coffee'|null>(null),celebrationActive=useRef<'podium'|'coffee'|null>(null);
  const podium=celebration==='podium',coffee=celebration==='coffee';
  const [countdown,setCountdown]=useState<number|null>(null),[clip,setClip]=useState(0),[replayMode,setReplayMode]=useState(false);
  const playback=useRef<Playback>({mode:'lobby',time:0,log:null,focus:null,paused:false,speed:1,overview:false});
  const current=useRef({view,sound,log,paused,speed,countdown,clip,celebration});current.current={view,sound,log,paused,speed,countdown,clip,celebration};
  const lastHit=useRef(-1),finished=useRef(false),toastTimer=useRef(0),countdownTimer=useRef(0),mounted=useRef(true),fileInput=useRef<HTMLInputElement>(null);
  const track=TRACKS.find(t=>t.id===(view==='lobby'?trackId:log?.trackId))||TRACKS[0];
  const sceneDrivers=view==='lobby'?drivers:log?.drivers||drivers;
  const notify=(message:string)=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=window.setTimeout(()=>setToast(''),5200);};
  useEffect(()=>{
    mounted.current=true;void Promise.all([loadDrivers(),loadRaces()]).then(([saved,races])=>{if(!mounted.current)return;if(saved)setDrivers(saved);setHistory(races);}).catch(()=>notify('기기 저장소를 열 수 없어요. 이번 세션에서는 플레이할 수 있어요.')).finally(()=>{if(mounted.current)setHydrated(true);});
    return()=>{mounted.current=false;clearTimeout(toastTimer.current);clearTimeout(countdownTimer.current);if('speechSynthesis'in window)speechSynthesis.cancel();};
  },[]);
  useEffect(()=>{
    try{localStorage.setItem('brew-sound',sound?'on':'off');}catch{/* Storage is optional. */}
    if(!sound)stopRaceAudio();
  },[sound]);
  useEffect(()=>{
    const unlock=()=>{if(current.current.sound)unlockRaceAudio();};
    document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
    return()=>{document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);disposeRaceAudio();};
  },[]);
  useEffect(()=>{playback.current.focus=focus;playback.current.paused=paused||modal!==null;playback.current.speed=speed;playback.current.overview=overview;},[focus,paused,speed,overview,modal]);
  const togglePause=()=>{const next=!current.current.paused;current.current.paused=next;playback.current.paused=next;setTime(playback.current.time);setPaused(next);};
  useEffect(()=>{
    let frame=0,last=performance.now(),lastUi=0;
    const animate=(now:number)=>{
      const delta=Math.min((now-last)/1000,.1);last=now;const state=current.current,p=playback.current;
      if(state.log&&state.view!=='lobby'&&!p.paused&&state.countdown===null&&state.celebration===null){
        p.time+=delta*state.speed;
        if(state.view==='results'){
          const highlights=getHighlights(state.log),active=highlights[state.clip%highlights.length];
          if(p.time>=active.end){const next=(state.clip+1)%highlights.length;setClip(next);p.time=highlights[next].start;p.focus=highlights[next].actor;}
        }else if(p.time>=state.log.duration&&!finished.current){
          p.time=state.log.duration;finished.current=true;
          setView('results');setCelebration('podium');celebrationActive.current='podium';setPaused(false);setSpeed(1);setClip(0);p.mode='highlights';p.time=getHighlights(state.log)[0].start;
          seekRaceAudio(state.log,p.time);playTone('finish',state.sound);
          void saveRace(state.log).then(()=>loadRaces()).then(races=>{if(mounted.current)setHistory(races);}).catch(()=>notify('레이스 저장 공간이 부족해요. JSON 로그를 내려받아 보관해 주세요.'));
        }

      }
      syncRaceAudio(state.view==='lobby'?null:state.log,p.time,state.sound,p.paused,{mode:state.view,countdown:state.countdown!==null||(state.view==='results'&&state.celebration!==null),focus:p.focus});
      if(now-lastUi>90){setTime(p.time);lastUi=now;}
      frame=requestAnimationFrame(animate);
    };
    frame=requestAnimationFrame(animate);return()=>{cancelAnimationFrame(frame);stopRaceAudio();};
  },[]);
  const persistDriver=async(driver:Driver,blob?:Blob)=>{
    const index=drivers.findIndex(d=>d.id===driver.id);
    if(index<0&&drivers.length>=8)throw new Error('레이서는 최대 8명까지 등록할 수 있어요.');
    const updated=index<0?[...drivers,driver]:drivers.map(d=>d.id===driver.id?driver:d);
    if(blob)await saveVoice(driver.id,blob);await saveDrivers(updated);setDrivers(updated);notify(`${driver.nickname} 님, 준비 완료!`);
  };
  const removeDriver=async(id:string)=>{const updated=drivers.filter(d=>d.id!==id);await saveDrivers(updated);await deleteVoice(id);setDrivers(updated);notify('레이서와 저장된 목소리를 삭제했어요.');};
  const resetDemo=async()=>{try{const updated=drivers.filter(d=>!d.demo);await saveDrivers(updated);setDrivers(updated);notify('체험 레이서를 비웠어요. 우리 멤버를 등록해 볼까요?');}catch{notify('레이서를 변경하지 못했어요. 다시 시도해 주세요.');}};
  const useDemo=async()=>{try{const updated=demoDrivers();await saveDrivers(updated);setDrivers(updated);notify('체험 레이서 4명이 입장했어요.');}catch{notify('저장소를 확인해 주세요.');}};
  const startRace=()=>{
    if(drivers.length<2)return;
    playTone('start',sound);
    const seed=crypto.getRandomValues(new Uint32Array(1))[0];const race=simulateRace(drivers,trackId,seed);
    setCelebration(null);celebrationActive.current=null;setLog(race);setView('race');setTime(0);setPaused(false);setSpeed(1);setOverview(false);setFocus(null);setReplayMode(false);setCountdown(3);finished.current=false;lastHit.current=-1;
    playback.current={mode:'race',time:0,log:race,focus:null,paused:false,speed:1,overview:false};
    let count=3;const tick=()=>{count--;playTone(count<=0?'go':'start',current.current.sound&&!playback.current.paused);if(count<=0){setCountdown(null);return;}setCountdown(count);countdownTimer.current=window.setTimeout(tick,800);};countdownTimer.current=window.setTimeout(tick,800);
  };
  const openReplay=(race:RaceLog)=>{
    setCelebration(null);celebrationActive.current=null;clearTimeout(countdownTimer.current);setCountdown(null);setLog(race);setView('race');setModal(null);setTime(0);setPaused(false);setSpeed(1);setFocus(null);setOverview(false);setReplayMode(true);finished.current=false;lastHit.current=-1;
    playback.current={mode:'replay',time:0,log:race,focus:null,paused:false,speed:1,overview:false};
  };
  const lobby=()=>{setCelebration(null);celebrationActive.current=null;clearTimeout(countdownTimer.current);setCountdown(null);setView('lobby');setLog(null);setTime(0);setPaused(false);setOverview(false);playback.current={mode:'lobby',time:0,log:null,focus:null,paused:false,speed:1,overview:false};if('speechSynthesis'in window)speechSynthesis.cancel();};
  const showCoffee=()=>{
    setCelebration('coffee');celebrationActive.current='coffee';setPaused(false);playback.current.paused=false;
    const race=current.current.log;if(race){seekRaceAudio(race,playback.current.time);const hero=race.drivers.find(d=>d.id===race.order.at(-1))!;announceWinner(hero.nickname,current.current.sound);}
  };
  const finishCeremony=()=>{if(celebrationActive.current==='podium')showCoffee();};
  const finishCoffee=()=>{
    if(celebrationActive.current!=='coffee')return;celebrationActive.current=null;setCelebration(null);setPaused(false);playback.current.paused=false;setClip(0);
    const race=current.current.log;if(race){const first=getHighlights(race)[0];playback.current.time=first.start;playback.current.focus=first.actor;setTime(first.start);seekRaceAudio(race,first.start);}
  };
  const showCeremony=()=>{if('speechSynthesis'in window)speechSynthesis.cancel();setCelebration('podium');celebrationActive.current='podium';setPaused(false);playback.current.paused=false;playTone('finish',sound);};
  const download=(race:RaceLog)=>{const url=URL.createObjectURL(new Blob([JSON.stringify(race)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`brew-racers-${race.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  const importReplay=async(file?:File)=>{if(!file)return;try{if(file.size>6_000_000)throw new Error('리플레이 파일은 6MB 이하여야 합니다.');const replay=parseReplay(await file.text());await saveRace(replay);setHistory(await loadRaces());openReplay(replay);notify('로그에서 레이스를 불러왔어요.');}catch(e){notify((e as Error).message);}};
  const snapshot=log?sampleRace(log,time):null,standings=snapshot?getStandings(snapshot.cars):[];
  const moment=log?raceMoment(log,time,focus):null;
  const impact=moment?.phase==='hit'?moment.event:null,highlights=log?getHighlights(log):[],loser=log?.drivers.find(d=>d.id===log.order.at(-1));
  const eventText=(event:RaceEvent)=>{const actor=log?.drivers.find(d=>d.id===event.actor)?.nickname,target=log?.drivers.find(d=>d.id===event.target)?.nickname;return event.type==='hit'?`${actor} → ${target} ${ITEMS[event.item!].short}!`:event.type==='blocked'?`${target}, 공격 방어!`:event.type==='overtake'?`${actor}, 선두로!`:event.type==='lap'?`${actor}, 마지막 바퀴!`:event.type==='finish'?`${actor}, 결승선 통과!`:event.type==='item'?`${actor}, ${ITEMS[event.item!].short} 획득`:'레이스가 시작됐어요!';};
  const latest=log?.events.filter(e=>e.time<=time&&(e.type==='hit'||e.type==='blocked'||e.type==='overtake'||e.type==='finish')).slice(-3).reverse()||[];

  return <div className="app-shell">
    <header className="site-header"><div className="header-inner"><button className="brand" onClick={lobby} aria-label="BREW RACERS 홈"><span className="brand-mark"><Coffee size={27} strokeWidth={2.5}/><i/><i/></span><span>BREW<span>RACERS<span className="brand-dot">®</span></span></span></button>
      <nav aria-label="메인 메뉴"><button className={modal!=='history'?'active':''} onClick={lobby}>레이스 로비</button><button className={modal==='history'?'active':''} onClick={()=>setModal('history')}>리플레이 <span className="nav-count">{history.length.toString().padStart(2,'0')}</span></button><button onClick={()=>setModal('guide')}>플레이 가이드 <span className="tiny-arrow">↗</span></button></nav>
      <div className="header-tools"><span className="local-status"><i/>LOCAL PLAY</span><div className="header-divider"/><button className={`icon-button ${sound?'sound-on':''}`} title={sound?'배경음 · 효과음 켜짐':'배경음 · 효과음 꺼짐'} aria-label={sound?'사운드 끄기':'사운드 켜기'} onClick={()=>{setSound(!sound);if(!sound)unlockRaceAudio();else stopRaceAudio();if(sound&&'speechSynthesis'in window)speechSynthesis.cancel();playTone('click',!sound);}}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><button className="icon-button" aria-label="도움말" onClick={()=>setModal('guide')}><CircleHelp size={19}/></button></div>
    </div></header>
    <main>
      <section className="page-heading"><div><div className="eyebrow"><span className="orange-dot"/> A LITTLE RACE. A LOT AT STAKE.</div><h1>{view==='lobby'?<>오늘 커피는, <span>누가 쏠까?</span><span className="heading-spark">✳</span></>:view==='results'?<>오늘의 <span>{podium?'그랑프리 챔피언!':'커피 히어로!'}</span><span className="heading-spark">✳</span></>:<>커피 한 잔을 건, <span>한판 승부.</span></>}</h1><p>{view==='lobby'?'목소리로 입장하고, 운명은 트랙에 맡기세요. 꼴찌가 쏘는 커피는 더 달콤하니까!':view==='results'?'순위는 잠깐, 커피의 달콤함은 오래. 오늘도 함께 달려서 즐거웠어요.':'운전은 카트에게, 응원은 우리에게. 마지막 코너까지 아무도 몰라요.'}</p></div><div className="heading-side"><div className="mini-checker"/><p>친구들과 가볍게.<br/><strong>커피 내기는 짜릿하게.</strong></p></div></section>
      {view==='lobby'?<>
        <div className="setup-grid"><section className="showcase" style={{'--stage-color':track.sky} as React.CSSProperties} aria-label="트랙 미리보기">
          <div className="showcase-top"><span className="pill"><i/>LIVE TRACK PREVIEW</span><span className="scene-index">{String(track.level).padStart(2,'0')} <span>/ 06</span></span></div>
          <RaceScene track={track} drivers={sceneDrivers} playback={playback}/>
          <div className="floating-tag"><span>100%</span><div>AUTO RACING<br/><b>응원만 준비하세요.</b></div><Zap size={21} fill="currentColor"/></div>
          <div className="showcase-bottom"><div><span className="eyebrow">{track.english}</span><h2>{track.name}<span className="level-badge">LV. {track.level}</span></h2><p>{track.subtitle}</p></div><div className="track-facts"><span><Route size={16}/>2 LAPS</span><span><Timer size={16}/>약 1분</span></div></div>
        </section>
        <aside className="race-control"><div className="section-kicker"><span>01</span> SELECT YOUR TRACK</div><h2>어디서 달려볼까요?</h2><p>취향대로 고르는 6가지 작은 모험.</p><div className="track-grid">{TRACKS.map((t,i)=>{const Icon=trackIcons[i];return <button key={t.id} className={`track-card ${trackId===t.id?'selected':''}`} onClick={()=>{setTrackId(t.id);playTone('click',sound);}} aria-pressed={trackId===t.id} aria-label={`${t.name} 난이도 ${t.level}`} style={{'--track-accent':t.accent} as React.CSSProperties}><div className="track-art"><TrackMini track={t}/>{trackId===t.id?<span className="selected-check"><Check size={11}/></span>:<Icon size={13} className="track-theme"/>}</div><strong>{t.name}</strong><span className="difficulty">{Array.from({length:6},(_,n)=><i key={n} className={n<t.level?'filled':''}/>)}<b>LV.{t.level}</b></span></button>;})}</div><div className="auto-note"><span><Zap size={17}/></span><div><strong>발은 쉬고, 심장은 바쁘게.</strong><p>주행도 아이템도 알아서. 100% 자동 레이스.</p></div></div></aside></div>
        <section className="crew-section"><div className="section-heading"><div><div className="section-kicker"><span>02</span> MEET THE RACERS</div><h2>함께 달릴 멤버 <span>{drivers.length}<i>/ 8</i></span></h2></div><div className="crew-actions">{drivers.some(d=>d.demo)&&<button className="text-button subtle" onClick={resetDemo}>체험 멤버 비우기</button>}<button className="button light" disabled={!drivers.length} onClick={()=>setModal('order')}><Mic size={16}/>음료 말하기</button><button className="button outline" disabled={drivers.length>=8||!hydrated} onClick={()=>setModal('register')}><Plus size={17}/>레이서 추가</button></div></div>
          <div className={`crew-grid ${drivers.length>4?'many':''}`}>{drivers.map((driver,i)=><button className="driver-card" key={driver.id} onClick={()=>{setEditing(driver);setModal('edit');}} aria-label={`${driver.nickname} 프로필 수정`}><span className="driver-number">{String(i+1).padStart(2,'0')}</span><div className="driver-ready"><i/>READY</div><div className="driver-main"><Avatar variant={driver.avatar} color={driver.color}/><div className="driver-info"><h3>{driver.nickname}<ChevronRight size={14}/></h3><span className="character-name">{characterFor(driver.avatar).name}</span><span className="voice-vibe"><AudioLines size={12}/>{driver.celebrity} 무드</span><p><Coffee size={13}/>{driver.drink}</p></div></div><div className="driver-footer"><span><i style={{background:driver.color}}/>{['TANGERINE','LAVENDER','MATCHA','BUTTER','SKY','ROSE','OLIVE','SLATE'][COLORS.indexOf(driver.color)]||'CUSTOM'} KART</span><span>{driver.demo?'체험 레이서':driver.voice?'VOICE SAVED':'직접 등록'}</span></div></button>)}
          {drivers.length===0&&<div className="empty-crew"><span className="empty-icon"><Coffee size={26}/></span><div><h3>첫 번째 레이서가 되어 주세요.</h3><p>목소리를 등록하거나 체험 멤버와 먼저 달려보세요.</p></div><button className="button light" onClick={useDemo}>체험 멤버 불러오기<ArrowRight size={15}/></button></div>}
          {drivers.length>0&&drivers.length<4&&<button className="add-driver-card" onClick={()=>setModal('register')}><Plus size={24}/><strong>다음 레이서, 입장!</strong><span>목소리로 간편하게 등록하세요</span></button>}</div>
          <div className="crew-note"><ShieldCheck size={13}/><span>목소리와 프로필은 이 기기에 저장돼요.</span><span className="note-dot">·</span><span>아바타를 누르면 프로필과 음료를 바꿀 수 있어요.</span></div>
        </section>
        <section className="launch-bar"><div className="race-rules"><span className="flag-circle"><Flag size={23}/></span><div><strong>마지막으로 들어오는 사람이, 오늘의 커피 히어로.</strong><p><span>2바퀴 자동 주행</span><i/><span>랜덤 아이템</span><i/><span>꼴찌가 커피 쏘기</span></p></div></div><div className="launch-action"><span><b>{drivers.length}명</b> {drivers.length>=2?'모두 준비 완료!':'최소 2명이 필요해요'}</span><button className="button primary start-race" disabled={drivers.length<2||!hydrated} onClick={startRace}>레이스 시작<ArrowRight size={21}/></button></div></section>
        <div className="bottom-note"><Sparkles size={14}/>아이템 한 방이면 순위는 뒤집힌다. 오늘의 행운을 믿어보세요.</div>
      </>:<>
        <section className={`live-stage ${view==='results'?'finished-stage':''} ${view==='results'&&podium?'podium-mode':view==='results'&&coffee?'coffee-mode':''}`} style={{'--stage-color':track.sky} as React.CSSProperties} aria-label="레이스 화면">
          {view==='results'&&podium&&log?<ResultsPodium log={log} playback={playback} onComplete={finishCeremony}/>:view==='results'&&coffee&&log?<CoffeeCelebration log={log} playback={playback} onComplete={finishCoffee}/>:<RaceScene track={track} drivers={sceneDrivers} playback={playback}/>}
          <div className="race-topbar"><div className="pill dark-pill"><i/>{view==='results'?'HIGHLIGHT LOOP':replayMode?'RACE REPLAY':'LIVE RACE'}</div><span className="race-track-name">{track.name}</span><span className="lap-counter">LAP <b>{Math.min(2,Math.floor(standings[0]?.progress||0)+1)}</b> / 2</span><span className="race-timer">{formatTime(time)}</span></div>
          {view==='race'&&<div className="leaderboard"><div className="leaderboard-title">LIVE STANDINGS<Radio size={13}/></div>{standings.map((car,i)=>{const d=log!.drivers.find(d=>d.id===car.id)!;return <button key={d.id} className={`standing ${focus===d.id?'focused':''}`} onClick={()=>{setFocus(d.id);setOverview(false);}} aria-label={`${d.nickname} 카메라 보기`}><span className="rank">{i+1}</span><span className="driver-dot" style={{background:d.color}}/><span>{d.nickname}</span><b>{car.finish!==null?'FINISH':car.effect?ITEMS[car.effect].icon:`${Math.round(car.speed*3.6)}`}</b></button>;})}<span className="leaderboard-hint">레이서를 눌러 카메라 전환</span></div>}
          {view==='race'&&<div className="event-feed" aria-live="polite">{latest.map((e,i)=><div key={`${e.time}-${e.actor}-${i}`}><Zap size={14}/>{eventText(e)}</div>)}</div>}
          {view==='race'&&log&&<RaceHUD log={log} time={time} track={track} focus={focus} overview={overview}/>}
          {countdown!==null&&<div className="countdown"><span>READY TO BREW?</span><strong key={countdown}>{countdown}</strong><p>오늘의 커피 운명이 시작됩니다.</p></div>}
          {view==='results'&&!celebration&&loser&&<><div className="confetti" aria-hidden="true">{Array.from({length:38},(_,i)=><i key={i} style={{left:`${(i*17)%100}%`,background:COLORS[i%8],animationDelay:`${i%9*.35}s`,transform:`rotate(${i*13}deg)`}}/>)}</div><div className="highlight-caption"><span><Play size={12} fill="currentColor"/> BEST MOMENTS · {clip+1} / {highlights.length}</span><strong>{highlights[clip]?.title}</strong><p>명장면이 자동으로 반복 재생되고 있어요.</p></div><div className="winner-card"><span className="winner-eyebrow"><Trophy size={15}/> TODAY'S COFFEE HERO</span><Avatar variant={loser.avatar} color={loser.color} className="winner-avatar"/><span className="winner-name">{loser.nickname}<small>님이 쏜다!</small></span><h2>달다 달아<br/><span>이썩겠네.</span></h2><p>꼴찌에게 보내는 가장 달콤한 박수 👏</p><div className="coffee-receipt"><span>오늘의 커피 주문서 <Coffee size={15}/></span>{log!.drivers.map(d=><div key={d.id}><span>{d.nickname}</span><b>{d.drink}</b></div>)}<footer><span>TOTAL</span><b>달콤한 커피 {log!.drivers.length}잔</b></footer></div></div></>}
          <div className="camera-badge"><span className="camera-dot"/>{overview?'전체 트랙':impact?'1인칭 · 피격 시점':'3인칭 · 팔로우 캠'}</div>
        </section>
        <div className={`playback-toolbar ${view==='results'&&celebration?'ceremony-controls':''}`}><button className="icon-button" onClick={togglePause} aria-label={paused?'재생':'일시 정지'} disabled={countdown!==null}>{paused?<Play size={20}/>:<Pause size={20}/>}</button>{view==='results'&&celebration&&<span className="ceremony-control-label">{podium?'우승 시상식 · 다음은 달콤한 커피 타임.':'커피 만드는 중 · 잠시 후 하이라이트가 이어집니다.'}</span>}<span className="playback-time">{formatTime(time)}</span><input aria-label="리플레이 타임라인" type="range" min={0} max={log?.duration||1} step="0.1" value={Math.min(time,log?.duration||1)} disabled={!replayMode&&view==='race'} onChange={e=>{playback.current.time=Number(e.target.value);seekRaceAudio(log,Number(e.target.value));setTime(Number(e.target.value));if(view==='results'){setCelebration(null);celebrationActive.current=null;setView('race');setReplayMode(true);finished.current=false;playback.current.mode='replay';}}}/><span className="playback-time">{formatTime(log?.duration||0)}</span><button className="speed-button" aria-label={`재생 속도 ${speed}배`} onClick={()=>setSpeed(speed===1?2:speed===2?4:1)}>{speed}×</button><span className="toolbar-divider"/><button className="icon-button" onClick={()=>setOverview(!overview)} aria-label={overview?'팔로우 카메라':'전체 트랙 보기'}>{overview?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button><button className="text-button" onClick={()=>log&&download(log)}><Download size={16}/><span>레이스 로그</span></button></div>
        {view==='results'?<section className="results-bottom"><div><h2>끝까지 짜릿했던 오늘의 순위</h2><div className="final-ranks">{log!.order.map((id,i)=>{const d=log!.drivers.find(d=>d.id===id)!;return <div key={id} className={i===log!.order.length-1?'last-place':''}><b>{String(i+1).padStart(2,'0')}</b><span className="driver-dot" style={{background:d.color}}/><strong>{d.nickname}</strong><span>{i===log!.order.length-1?<Coffee size={16}/>:formatTime(log!.snapshots.at(-1)!.cars.find(c=>c.id===id)!.finish!)}</span></div>;})}</div></div><div className="result-buttons"><button className="button outline" disabled={podium} onClick={showCeremony}><Trophy size={17}/>시상대 다시 보기</button><button className="button outline" disabled={coffee} onClick={showCoffee}><Coffee size={17}/>커피차 다시 보기</button><button className="button outline" onClick={()=>log&&openReplay(log)}><RotateCcw size={17}/>전체 리플레이</button><button className="button primary" onClick={lobby}>한 판 더 할까요?<ArrowRight size={18}/></button></div></section>:<div className="race-under"><span><ShieldCheck size={15}/>모든 주행과 아이템은 자동으로 진행돼요. 레이스 로그는 종료 후 저장됩니다.</span><button className="text-button" onClick={lobby}>로비로 돌아가기<ArrowRight size={15}/></button></div>}
      </>}
    </main>
    <footer className="site-footer"><span className="footer-brand"><Coffee size={16}/>BREW RACERS <b>작은 내기, 큰 즐거움.</b></span><span>MADE FOR YOUR COFFEE BREAK<span className="footer-dot">✳</span><button className="footer-guide" onClick={()=>setModal('guide')}>플레이 가이드</button><a href={`${import.meta.env.BASE_URL}reports/index.html`} target="_blank" rel="noreferrer">검증 리포트 ↗</a><span>© 2026 BREW RACERS</span></span></footer>
    {(modal==='register'||modal==='order'||modal==='edit')&&<VoiceModal mode={modal} drivers={drivers} editing={modal==='edit'?editing:undefined} onSave={persistDriver} onDelete={removeDriver} onClose={()=>setModal(null)}/>}
    {modal==='guide'&&<Modal title="커피 한 잔을 건 작은 레이스" onClose={()=>setModal(null)} wide><p className="modal-intro">누구나 달릴 수 있어요. 운전 실력은 잠시 내려놓으세요.</p><div className="guide-steps">{[{icon:Mic,title:'목소리로 입장',text:'2–8명의 별명과 목소리를 등록하고, 오늘 마실 음료를 말해 주세요.'},{icon:Route,title:'트랙을 골라 출발',text:'6개 트랙 중 하나를 선택해요. 레이서들은 두 바퀴를 자동으로 달려요.'},{icon:Coffee,title:'꼴찌가 커피 히어로',text:'마지막에 들어온 사람이 커피를 쏩니다. 하이라이트는 계속 반복돼요.'}].map((step,i)=><div key={step.title}><span><step.icon size={22}/></span><small>0{i+1}</small><h3>{step.title}</h3><p>{step.text}</p></div>)}</div><h3 className="guide-title">순위를 뒤집는 다섯 가지 아이템</h3><div className="item-guide">{Object.values(ITEMS).map(item=><div key={item.name}><span style={{background:`${item.color}25`,color:item.color}}>{item.icon}</span><div><strong>{item.name}</strong><p>{item.description}</p></div></div>)}</div><div className="guide-technical"><h3>알아두면 더 편해요</h3><p>목소리 구분은 로컬 음성 특징을 비교하는 실험적 기능이에요. 비슷한 목소리나 주변 소음 때문에 불확실하면 직접 레이서를 선택할 수 있어요. 별명·음료 받아쓰기는 Chrome을 권장하며 네트워크 연결이 필요할 수 있어요.</p><p>공격받으면 1인칭, 일반 주행은 3인칭으로 전환돼요. 순위표에서 보고 싶은 레이서를 선택하거나 전체 트랙 보기로 바꿀 수 있어요. 최신 10개의 레이스가 이 브라우저에 보관되며 JSON으로 내보내고 다시 불러올 수 있어요.</p></div><button className="button primary full-width" onClick={()=>setModal(null)}>좋아요, 준비됐어요<ArrowRight size={18}/></button></Modal>}
    {modal==='history'&&<Modal title="다시 봐도 짜릿한 순간들" onClose={()=>setModal(null)} wide><div className="history-intro"><p className="modal-intro">최근 10개의 레이스를 이 기기에 보관해요.</p><button className="button light" onClick={()=>fileInput.current?.click()}><Upload size={16}/>로그 불러오기</button><input type="file" accept=".json,application/json" hidden ref={fileInput} onChange={e=>{void importReplay(e.target.files?.[0]);e.target.value='';}}/></div>{history.length?<div className="history-list">{history.map(race=>{const raceTrack=TRACKS.find(t=>t.id===race.trackId)!,hero=race.drivers.find(d=>d.id===race.order.at(-1))!;return <div className="history-card" key={race.id}><span className="history-track" style={{color:raceTrack.accent}}><TrackMini track={raceTrack}/></span><div><h3>{raceTrack.name}<small>{race.drivers.length}명 · 2 LAPS</small></h3><p>{new Date(race.createdAt).toLocaleString('ko-KR')}<span>커피 히어로 <strong>{hero.nickname}</strong></span></p></div><button className="icon-button" aria-label={`${raceTrack.name} 로그 다운로드`} onClick={()=>download(race)}><Download size={18}/></button><button className="button dark" onClick={()=>openReplay(race)}><Play size={15}/>리플레이</button></div>;})}</div>:<div className="empty-history"><History size={38}/><h3>첫 레이스의 주인공이 되어 주세요.</h3><p>레이스를 완주하면 이곳에서 다시 볼 수 있어요.</p><button className="button primary" onClick={()=>{setModal(null);lobby();}}>로비로 가기<ArrowRight size={17}/></button></div>}{history.length>0&&<div className="history-bottom"><span><ShieldCheck size={14}/>로그에 목소리 녹음은 포함되지 않아요.</span><button className="text-button danger" onClick={async()=>{try{await clearRaces();setHistory([]);notify('저장된 레이스 기록을 비웠어요.');}catch{notify('기록을 삭제하지 못했어요.');}}}><Trash2 size={15}/>기록 비우기</button></div>}</Modal>}
    {toast&&<div className="toast" role="status"><Check size={17}/><span>{toast}</span><button className="icon-button" aria-label="알림 닫기" onClick={()=>setToast('')}><X size={15}/></button></div>}
  </div>;
}

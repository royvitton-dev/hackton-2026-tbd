import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bot, CalendarDays, Check, CircleHelp, Dices, Flag, Gamepad2, Layers3, Maximize2, Minus, MousePointer2, Plus, RotateCcw, Settings2, Sparkles, Star, Trophy, Users, Volume2, VolumeX, X } from 'lucide-react';
import BoardScene, { type BoardHandle } from './BoardScene';
import GameEvents from './GameEvents';
import { playTone } from './audio';
import { createGame, DAYS_PER_MONTH, IDOLS, level, rankPlayers, reducer, restoreGame, SAVE_KEY, SKILLS, SKILL_LABEL, TILES, type Setup } from './engine';
import { Avatar, colorStyle, Credits, PlayerDetail, Rules, SetupForm, Stats } from './ui';
import './game.css';
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); const game = restoreGame(raw); return { game: game ?? createGame(), problem: raw && !game ? '저장된 게임을 읽지 못해 새 보드를 열었어요. 새 게임을 시작하면 저장을 다시 사용할 수 있어요.' : '' }; }
  catch { return { game: createGame(), problem: '브라우저 저장소를 사용할 수 없어 이번 게임은 자동 저장되지 않아요.' }; }
}
function Die({ value, rolling = false }: { value: number; rolling?: boolean }) {
  const patterns: Record<number, number[]> = { 1: [4], 2: [0,8], 3: [0,4,8], 4: [0,2,6,8], 5: [0,2,4,6,8], 6: [0,2,3,5,6,8] };
  return <span className={`die ${rolling ? 'is-rolling' : ''}`} aria-label={`주사위 ${value}`} role="img">{Array.from({ length: 9 }, (_,i) => <i className={patterns[value].includes(i) ? 'dot' : ''} key={i} />)}</span>;
}
export default function GameApp() {
  const [initial] = useState(load); const [state, dispatch] = useReducer(reducer, initial.game);
  const [storageError, setStorageError] = useState(initial.problem); const [savingEnabled, setSavingEnabled] = useState(!initial.problem);
  const [dialog, setDialog] = useState<'setup' | 'rules' | 'credits' | null>(null);
  const [profile, setProfile] = useState<number | null>(null); const [tab, setTab] = useState<'board' | 'trainees' | 'ranking'>('board');
  const [sound, setSound] = useState(false); const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [full, setFull] = useState(false); const board = useRef<BoardHandle>(null);
  const active = state.players[state.active]; const idol = IDOLS[active.idol]; const tile = TILES[active.position];
  const ranked = rankPlayers(state.players); const canRoll = state.phase === 'ready' && !active.cpu;
  const busy = ['rolling','moving','training','battle'].includes(state.phase);
  const paused = !!dialog || profile !== null || tab !== 'board';
  const roll = useCallback(() => { dispatch({ type: 'ROLL', dice: Math.floor(Math.random() * 6) + 1 }); playTone(420,sound,.1); }, [sound]);
  useEffect(() => {
    document.title = 'DEBUT : ON — 당신의 데뷔가 시작되는 곳';
    if (!savingEnabled) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { setStorageError('자동 저장이 중단됐어요. 브라우저 저장 공간을 확인해 주세요. 현재 게임은 계속할 수 있어요.'); setSavingEnabled(false); }
  }, [state, savingEnabled]);
  useEffect(() => {
    if (paused) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (state.phase === 'rolling') timer = setTimeout(() => dispatch({ type: 'MOVE' }), 950);
    if (state.phase === 'moving') timer = setTimeout(() => { dispatch({ type: 'STEP', luck: Math.random() }); playTone(420 + (state.dice - state.remaining) * 80, sound, .07); }, 340);
    if (active.cpu) {
      if (state.phase === 'ready') timer = setTimeout(roll, 1100);
      if (state.phase === 'training') timer = setTimeout(() => dispatch({ type: 'TRAIN', performance: 45 + Math.floor(Math.random() * 51) }), 1900);
      if (state.phase === 'result') timer = setTimeout(() => dispatch({ type: 'CONTINUE' }), 2100);
    }
    if (state.phase === 'battle' && state.battle) {
      const battle = state.battle;
      if (!battle.skill && active.cpu) timer = setTimeout(() => dispatch({ type: 'CHOOSE', skill: SKILLS.reduce((a,b) => active.stats[a] > active.stats[b] ? a : b) }), 1000);
      if (battle.skill) {
        const performer = battle.attack === null ? active : state.players[battle.opponent];
        if (performer.cpu) timer = setTimeout(() => dispatch({ type: 'PERFORM', performance: 45 + Math.floor(Math.random() * 51) }), 1800);
      }
    }
    return () => clearTimeout(timer);
  }, [state, active, paused, sound, roll]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.code === 'Space' && !event.repeat && canRoll && !paused && (event.target === document.body || event.target === document.documentElement)) { event.preventDefault(); roll(); } };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown',listener);
  }, [canRoll, paused, roll]);
  useEffect(() => { const listener = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange',listener); return () => document.removeEventListener('fullscreenchange',listener); }, []);
  const newGame = (setup: Setup) => { dispatch({ type: 'NEW', setup }); setSavingEnabled(true); setStorageError(''); setDialog(null); setTab('board'); setSelectedTile(null); board.current?.reset(); };
  const fullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setFull(previous => !previous); } };
  const mainStatus = state.phase === 'ready' ? active.cpu ? `${active.name}의 차례예요` : `${active.name}님, 당신의 차례예요` : state.phase === 'rolling' ? '어떤 기회가 기다리고 있을까요?' : state.phase === 'moving' ? `${tile.name} · ${state.remaining}칸 더 이동해요` : state.phase === 'finished' ? '새로운 스타의 탄생을 축하해요!' : `${tile.name}에서 꿈에 한 걸음 더`;
  return <div className={`game-app ${full ? 'expanded-game' : ''}`}>
    <header className="topbar"><a className="brand" href={import.meta.env.BASE_URL} aria-label="데뷔온 홈"><span className="brand-symbol"><Sparkles size={23} fill="currentColor" /></span><span>DEBUT<span className="brand-colon">:</span>ON<small>꿈이 무대가 되는 순간</small></span></a>
      <nav aria-label="주 메뉴"><button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}><Gamepad2 size={17} /> 플레이</button><button className={tab === 'trainees' ? 'active' : ''} onClick={() => setTab('trainees')} disabled={busy}><Users size={17} /> 연습생</button><button className={tab === 'ranking' ? 'active' : ''} onClick={() => setTab('ranking')} disabled={busy}><Trophy size={17} /> 랭킹</button></nav>
      <div className="header-right"><span className="local-badge"><i /> LOCAL PLAY</span><button className="icon-button" onClick={() => { setSound(!sound); playTone(660,!sound,.16); }} aria-label={sound ? '소리 끄기' : '소리 켜기'} title={sound ? '소리 끄기' : '소리 켜기'}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button className="icon-button" onClick={() => setDialog('rules')} aria-label="게임 방법" title="게임 방법" disabled={busy}><CircleHelp size={19} /></button><button className="icon-button" onClick={() => setDialog('setup')} aria-label="새 게임 설정" title="새 게임 설정" disabled={busy}><Settings2 size={18} /></button></div>
    </header>
    <main className="game-main">
      <div className="page-heading"><div><div className="eyebrow"><span className="tiny-star">✦</span> ROLL THE DICE. OWN THE STAGE.</div><h1>꿈꾸던 무대까지, <span>한 걸음.</span></h1><p>기획사를 여행하고, 실력을 키우고, 당신만의 데뷔 스토리를 만들어보세요.</p></div><div className="session-info"><span><Users size={15} /> {state.players.filter(p => !p.cpu).length}인 플레이 {state.players.some(p => p.cpu) && <small>+ AI {state.players.filter(p => p.cpu).length}</small>}</span><button className="secondary compact" onClick={() => setDialog('setup')} disabled={busy}><Plus size={15} /> 새 게임</button></div></div>
      {storageError && <div className="storage-notice" role="status">{storageError}</div>}
      {tab === 'board' ? <>
        <div className="game-layout"><div className="board-column"><section className="board-panel" aria-label="게임 보드">
          <div className="board-top"><div><span className="live-dot" /><b>TRAINEE CITY</b><span className="board-edition">SEOUL · 01</span></div><span className="turn-pill">ROUND <b>{String(state.day).padStart(2,'0')}</b> / {String(DAYS_PER_MONTH).padStart(2,'0')}</span></div>
          <div className="board-caption"><span>작은 한 걸음이</span><b>큰 무대의 시작이 되도록.</b></div>
          <BoardScene ref={board} state={state} selected={selectedTile} onTile={setSelectedTile} />
          <div className="camera-controls"><button className="icon-button" title="확대" aria-label="보드 확대" onClick={() => board.current?.zoom(.15)}><Plus size={17} /></button><button className="icon-button" title="축소" aria-label="보드 축소" onClick={() => board.current?.zoom(-.15)}><Minus size={17} /></button><span /><button className="icon-button" title="위에서 보기" aria-label="보드 위에서 보기" onClick={() => board.current?.overhead()}><Layers3 size={17} /></button><button className="icon-button" title="시점 초기화" aria-label="보드 시점 초기화" onClick={() => board.current?.reset()}><RotateCcw size={16} /></button><button className="icon-button" title="전체 화면" aria-label="전체 화면 전환" onClick={() => void fullscreen()}><Maximize2 size={16} /></button></div>
          {selectedTile !== null && <div className="tile-detail" style={colorStyle(TILES[selectedTile].color)}><button className="icon-button" aria-label="칸 정보 닫기" onClick={() => setSelectedTile(null)}><X size={15} /></button><span className="eyebrow">SPACE {String(selectedTile+1).padStart(2,'0')}</span><h3>{TILES[selectedTile].name}</h3><p>{TILES[selectedTile].subtitle}</p><span>{TILES[selectedTile].skill ? `${SKILL_LABEL[TILES[selectedTile].skill!]} 능력치 +3~13 · 미니게임 보상` : TILES[selectedTile].type === 'chance' ? '랜덤 보너스 카드 · 15~35P' : '휴식과 성장 · 보너스 점수'}</span></div>}
          <div className="board-bottom"><div className="board-legend"><span><i className="vocal-dot" /> 보컬</span><span><i className="dance-dot" /> 댄스</span><span><i className="rap-dot" /> 랩</span><span><i className="event-dot" /> 이벤트</span></div><span className="drag-hint"><MousePointer2 size={12} /> 드래그로 회전 · 스크롤로 확대</span></div>
        </section><section className="turn-console" aria-label="현재 턴"><Avatar player={active} /><div className="turn-description"><span><i style={{ background: idol.color }} /> PLAYER {state.active + 1} {active.cpu && '· AI'}</span><h3 aria-live="polite">{mainStatus}</h3><p>{state.phase === 'ready' ? '주사위를 던져 새로운 기획사로 떠나볼까요?' : state.phase === 'moving' ? '말이 이동 중이에요. 곧 다음 무대에 도착합니다.' : '한 번의 도전이 내일의 실력이 됩니다.'}</p></div><div className="dice-action"><Die value={state.dice} rolling={state.phase === 'rolling'} /><button className="primary roll-button" disabled={!canRoll} onClick={roll} data-testid="roll-dice"><Dices size={20} /><span>{state.phase === 'rolling' ? '두근두근…' : state.phase === 'moving' ? '이동 중…' : active.cpu ? 'AI 플레이 중' : '주사위 던지기'}</span><kbd>SPACE</kbd></button></div></section></div>
        <aside className="game-sidebar"><section className="panel roster-panel"><div className="section-heading"><h2><Users size={17} /> 함께하는 연습생</h2><span>{state.players.length} / 4</span></div><div className="roster">{state.players.map(player => <button key={player.id} className={`roster-player ${player.id === state.active ? 'current' : ''}`} onClick={() => setProfile(player.id)} disabled={busy} style={colorStyle(IDOLS[player.idol].color)}><Avatar player={player} /><span className="roster-name"><b>{player.name} {player.cpu ? <Bot size={12} /> : <small>{player.id === 0 ? '나' : 'P'+(player.id+1)}</small>}</b><span>Lv.{level(player)} <i /> {player.lineup ? '데뷔조' : '연습생'}{player.id === state.active ? ' · 현재 턴' : ''}</span></span><span className="roster-score">{player.score}<small>P</small></span></button>)}</div></section>
        <section className="panel growth-panel"><div className="section-heading"><h2><Sparkles size={17} /> 이번 차례의 성장</h2><span>PLAYER {state.active+1}</span></div><div className="growth-identity"><Avatar player={active} size="large" /><div><span className="level-tag">LEVEL {level(active)}</span><h3>{active.name}<small>{idol.english}</small></h3></div><button className="icon-button" aria-label={`${active.name} 프로필 보기`} onClick={() => setProfile(active.id)} disabled={busy}><ArrowUpRight size={17} /></button></div><Stats player={active} /><div className="xp-line"><span>다음 레벨까지</span><b>{active.xp % 60}<small> / 60 XP</small></b></div><div className="progress-track xp-track"><i style={{ width: `${active.xp % 60 / 60 * 100}%` }} /></div></section>
        <section className="monthly-panel"><div className="month-icon"><CalendarDays size={22} /></div><div><span>다음 월말 평가</span><h3>{DAYS_PER_MONTH - state.day + 1}라운드 후 <ArrowRight size={16} /></h3></div><span className="month-number">{String(state.month).padStart(2,'0')}<small>MONTH</small></span><div className="month-days">{Array.from({ length: DAYS_PER_MONTH }, (_,i) => <span key={i} className={i < state.day ? 'passed' : ''}>{i + 1 < state.day ? <Check size={12} /> : `W${i+1}`}</span>)}</div></section></aside></div>
        <div className="lower-layout"><section className="goal-panel"><span className="goal-icon"><Flag size={24} /></span><div><span className="eyebrow">ROAD TO DEBUT</span><h3>연습생에서, 무대의 주인공으로.</h3><div className="goal-steps"><span className="reached"><i /><b>연습생</b></span><div /><span className={active.lineup ? 'reached' : ''}><i /><b>데뷔조 선발</b></span><div /><span className={active.lineup && active.score >= state.target ? 'reached' : ''}><Star size={13} /><b>{state.target}P 달성 · 데뷔</b></span></div></div><span className="goal-score">{active.score}<small> / {state.target}P</small></span></section><section className="panel activity-panel"><div className="section-heading"><h2><span className="live-dot" /> 플레이 로그</h2><span>LIVE</span></div><div className="activity-log" aria-live="polite">{state.log.slice(0,2).map((entry,i) => <p key={entry.id} className={i ? 'older' : ''}><i style={{ background: entry.color }} />{entry.text}</p>)}</div></section></div>
      </> : <section className="collection-page"><div className="collection-heading"><span className="eyebrow">{tab === 'trainees' ? 'MEET THE NEXT STARS' : 'THE SPOTLIGHT IS YOURS'}</span><h2>{tab === 'trainees' ? '같은 꿈, 서로 다른 반짝임.' : '오늘, 가장 빛나는 연습생.'}</h2><p>현재 게임의 {tab === 'trainees' ? '능력치와 성장 기록을 확인하세요.' : '누적 점수 순위입니다. 월말에는 상위 참가자가 데뷔조로 선발됩니다.'}</p></div><div className="trainee-grid">{(tab === 'ranking' ? ranked : state.players).map((player,i) => <button className="trainee-card" onClick={() => setProfile(player.id)} key={player.id} style={colorStyle(IDOLS[player.idol].color)}><div className="trainee-photo"><img src={IDOLS[player.idol].image} alt={player.name} /><span>{tab === 'ranking' ? `# ${i+1}` : `PLAYER ${player.id+1}`}</span><b>Lv. {level(player)}</b></div><div className="trainee-content"><small>{IDOLS[player.idol].english}</small><h3>{player.name}<span>{player.score}<small>P</small></span></h3><p>{player.lineup ? '★ 데뷔조 멤버' : '꿈꾸는 연습생'} · {player.cpu ? 'AI' : '직접 플레이'}</p><Stats player={player} /></div></button>)}</div><button className="primary" onClick={() => setTab('board')}><Gamepad2 size={18} /> 보드로 돌아가기 <ArrowRight size={17} /></button></section>}
      <footer className="game-footer"><span><Sparkles size={12} /> EVERY STAR STARTS SOMEWHERE.</span><div><span>{savingEnabled ? <><Check size={12} /> 자동 저장됨</> : '자동 저장 꺼짐'}</span><button onClick={() => setDialog('rules')} disabled={busy}>게임 방법</button><button onClick={() => setDialog('credits')} disabled={busy}>사진 출처</button><span>DEBUT : ON © 2026</span></div></footer>
    </main>
    {dialog === 'setup' && <SetupForm onClose={() => setDialog(null)} onStart={newGame} />}
    {dialog === 'rules' && <Rules onClose={() => setDialog(null)} />}
    {dialog === 'credits' && <Credits onClose={() => setDialog(null)} />}
    {profile !== null && !dialog && <PlayerDetail player={state.players[profile]} target={state.target} onClose={() => setProfile(null)} />}
    {!paused && <GameEvents state={state} dispatch={dispatch} sound={sound} onNew={() => setDialog('setup')} />}
  </div>;
}

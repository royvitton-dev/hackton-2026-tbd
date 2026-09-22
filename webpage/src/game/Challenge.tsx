import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, AudioLines, Mic2, Music2, Play, Timer } from 'lucide-react';
import { playTone } from './audio';
import { SKILL_LABEL, type Skill } from './engine';
const directions = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'];
const ArrowIcons = [ArrowLeft, ArrowUp, ArrowDown, ArrowRight];
const durations = [450, 700, 550, 850, 650];
export default function Challenge({ skill, name, sound, onComplete }: { skill: Skill; name: string; sound: boolean; onComplete: (score: number) => void }) {
  const [started, setStarted] = useState(false); const [step, setStep] = useState(0); const [feedback, setFeedback] = useState('READY?');
  const [cursor, setCursor] = useState(0); const [seconds, setSeconds] = useState(16); const [holding, setHolding] = useState(false);
  const [sequence] = useState(() => Array.from({ length: 8 }, () => Math.floor(Math.random() * 4)));
  const progress = useRef({ count: 0, total: 0, done: false, start: 0, last: 0, hold: 0 });
  const callback = useRef(onComplete); callback.current = onComplete;
  const count = skill === 'dance' ? 8 : 5;
  const finish = useCallback(() => { if (progress.current.done) return; progress.current.done = true; callback.current(Math.round(progress.current.total / count)); }, [count]);
  const record = useCallback((score: number) => {
    const p = progress.current; if (p.done || p.count >= count) return;
    p.total += score; p.count++; setStep(p.count); setFeedback(score >= 85 ? 'PERFECT!' : score >= 50 ? 'GREAT!' : 'KEEP GOING');
    playTone(score >= 85 ? 880 : score >= 50 ? 660 : 330, sound, .13);
    if (p.count >= count) finish();
  }, [count, finish, sound]);
  const hit = useCallback((key?: string) => {
    const p = progress.current; const now = performance.now();
    if (!started || p.done || now - p.last < 140) return; p.last = now;
    if (skill === 'vocal') { const value = (Math.sin((now - p.start) / 350) + 1) * 50; record(Math.max(0, 100 - Math.abs(value - 50) * 2.5)); }
    if (skill === 'dance') record(key === directions[sequence[p.count]] ? 100 : 0);
  }, [started, skill, sequence, record]);
  const beginHold = useCallback(() => { if (!started || progress.current.done || progress.current.hold) return; progress.current.hold = performance.now(); setHolding(true); playTone(220, sound, .07); }, [started, sound]);
  const cancelHold = useCallback(() => {
    progress.current.hold = 0;
    setHolding(false);
    setCursor(0);
  }, []);
  const release = useCallback(() => {
    const p = progress.current; if (!p.hold || p.done) return;
    const held = performance.now() - p.hold; p.hold = 0; setHolding(false);
    record(Math.max(0, 100 - Math.abs(held - durations[p.count]) / durations[p.count] * 110));
  }, [record]);
  useEffect(() => {
    if (!started) return;
    let frame = 0;
    const tick = () => {
      if (progress.current.done) return;
      const elapsed = performance.now() - progress.current.start; setSeconds(Math.max(0, Math.ceil((16000 - elapsed) / 1000)));
      if (skill === 'vocal') setCursor((Math.sin(elapsed / 350) + 1) * 50);
      if (skill === 'rap') setCursor(progress.current.hold ? Math.min(100, (performance.now() - progress.current.hold) / durations[progress.current.count] * 100) : 0);
      if (elapsed >= 16000) { finish(); return; } frame = requestAnimationFrame(tick);
    }; frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [started, skill, finish]);
  useEffect(() => {
    if (!started) return;
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (skill === 'dance' && directions.includes(event.key)) { event.preventDefault(); hit(event.key); }
      if (event.code === 'Space' && skill !== 'dance') { event.preventDefault(); if (skill === 'rap') beginHold(); else hit(); }
    };
    const up = (event: KeyboardEvent) => { if (event.code === 'Space' && skill === 'rap') { event.preventDefault(); release(); } };
    const blur = () => { if (skill === 'rap') cancelHold(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [started, skill, hit, beginHold, release, cancelHold]);
  const Icon = skill === 'vocal' ? Mic2 : skill === 'dance' ? Music2 : AudioLines;
  return <div className={`challenge challenge-${skill}`}>
    <div className="challenge-heading"><span className="eyebrow">{name}’S PERFORMANCE</span><span className="timer"><Timer size={14} /> {seconds}s</span></div>
    <div className="challenge-icon"><Icon size={30} /></div>
    <h2>{skill === 'vocal' ? '완벽한 음정을 찾아봐' : skill === 'dance' ? '리듬에 몸을 맡겨봐' : '너만의 플로우를 보여줘'}</h2>
    <p>{skill === 'vocal' ? '바늘이 가운데 영역에 들어오면 SPACE 또는 버튼을 누르세요.' : skill === 'dance' ? '강조된 화살표 순서대로 방향키 또는 화면 버튼을 누르세요.' : '표시된 박자만큼 SPACE 또는 버튼을 꾹 누른 뒤 놓으세요.'}</p>
    {!started ? <div className="challenge-intro"><div className="wave-decoration">{Array.from({ length: 23 }, (_,i) => <i key={i} style={{ height: `${12 + Math.abs(Math.sin(i * .9)) * 52}px` }} />)}</div><span>{SKILL_LABEL[skill]} · {count}회 도전 · 제한 시간 16초</span><button className="primary wide" onClick={() => { progress.current.start = performance.now(); setStarted(true); playTone(523,sound,.15); }}><Play size={17} fill="currentColor" /> 퍼포먼스 시작</button></div> : <>
      <div className="performance-feedback" aria-live="polite">{feedback}</div>
      {skill === 'vocal' && <><div className="pitch-track"><div className="pitch-perfect" /><i style={{ left: `${cursor}%` }} /><span>LOW</span><span>PERFECT ZONE</span><span>HIGH</span></div><button className="primary wide performance-button" onClick={() => hit()}><Mic2 size={18} /> 음정 맞추기 <kbd>SPACE</kbd></button></>}
      {skill === 'dance' && <><div className="dance-sequence">{sequence.map((direction,i) => { const Arrow = ArrowIcons[direction]; return <span key={i} className={i === step ? 'now' : i < step ? 'done' : ''}><Arrow size={23} /></span>; })}</div><div className="dance-controls">{ArrowIcons.map((Arrow,i) => <button key={i} aria-label={['왼쪽','위쪽','아래쪽','오른쪽'][i]} onClick={() => hit(directions[i])}><Arrow size={26} /></button>)}</div></>}
      {skill === 'rap' && <><div className="rap-phrase" aria-live="polite"><span key={step}>{['내 꿈은', '이 무대 위에', '더 빛나', '지금 이 순간', 'I make my debut'][Math.min(step,4)]}</span><small>목표 {(durations[Math.min(step,4)] / 1000).toFixed(2)}초</small></div><div className="rap-beats" aria-label={`랩 박자 ${step + 1} / ${count}`}>{durations.map((duration,i) => <i key={duration} className={i < step ? 'done' : i === step ? 'now' : ''} style={{ '--beat': duration / 450 } as CSSProperties} />)}</div><div className={`hold-track ${holding ? 'active' : ''}`}><span className="hold-target" /><i style={{ width: `${cursor}%` }} /></div><button className={`primary wide performance-button ${holding ? 'holding' : ''}`} onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginHold(); }} onPointerUp={release} onPointerCancel={cancelHold}><AudioLines size={19} /> {holding ? '지금 박자를 느껴봐…' : '꾹 누르고 박자에 맞춰 놓기'} <kbd>SPACE</kbd></button></>}
      <div className="challenge-progress">{Array.from({ length: count }, (_,i) => <i key={i} className={i < step ? 'filled' : ''} />)}<span>{step} / {count}</span></div>
    </>}
  </div>;
}

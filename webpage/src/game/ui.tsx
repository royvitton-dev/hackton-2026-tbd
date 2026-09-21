import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, AudioLines, Check, ChevronRight, Crown, Mic2, Music2, Sparkles, Star, Users, X } from 'lucide-react';
import { IDOLS, SKILLS, SKILL_COLOR, SKILL_LABEL, level, type Player, type Setup } from './engine';
export const skillIcons = { vocal: Mic2, dance: Music2, rap: AudioLines };
export const colorStyle = (color: string) => ({ '--accent': color }) as CSSProperties;
export function Avatar({ player, size = '', className = '' }: { player: Pick<Player, 'idol' | 'name'>; size?: string; className?: string }) {
  const idol = IDOLS[player.idol];
  return <span className={`avatar ${size} ${className}`} style={colorStyle(idol.color)}><img src={idol.image} alt={player.name} /><i /></span>;
}
export function Stats({ player }: { player: Player }) {
  return <div className="stats">{SKILLS.map(skill => { const Icon = skillIcons[skill]; return <div className="stat" key={skill} style={colorStyle(SKILL_COLOR[skill])}><span><Icon size={14} />{SKILL_LABEL[skill]}</span><div className="stat-track"><i style={{ width: `${player.stats[skill]}%` }} /></div><b>{player.stats[skill]}</b></div>; })}</div>;
}
export function Modal({ children, title, onClose, wide = false }: { children: ReactNode; title: string; onClose?: () => void; wide?: boolean }) {
  const root = useRef<HTMLDivElement>(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = root.current!; node.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && close.current) { event.stopPropagation(); close.current(); }
      if (event.key === 'Tab') {
        const items = [...node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, [tabindex="0"]')];
        if (!items.length) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === node)) { event.preventDefault(); items.at(-1)!.focus(); }
        if (!event.shiftKey && (document.activeElement === items.at(-1) || document.activeElement === node)) { event.preventDefault(); items[0].focus(); }
      }
    };
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', listener);
    return () => { document.removeEventListener('keydown',listener); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose?.(); }}><div ref={root} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>{onClose && <button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><X size={20} /></button>}{children}</div></div>;
}
export function SetupForm({ onStart, onClose }: { onStart: (setup: Setup) => void; onClose: () => void }) {
  const [setup, setSetup] = useState<Setup>({ count: 4, humans: 1, idol: 0, target: 400, name: '' });
  return <Modal title="새 게임 설정" onClose={onClose} wide><div className="setup-header"><span className="eyebrow">A NEW CHAPTER</span><h2>다음 주인공은, 당신.</h2><p>함께할 멤버를 정하고 데뷔를 향한 여정을 시작하세요.</p></div>
    <form onSubmit={event => { event.preventDefault(); onStart(setup); }}>
      <label className="field-label">나의 캐릭터 <span>공개 사진을 적용한 샘플 캐릭터</span></label>
      <div className="character-picker">{IDOLS.map((idol,i) => <button type="button" className={setup.idol === i ? 'chosen' : ''} key={idol.name} onClick={() => setSetup({ ...setup, idol: i })} style={colorStyle(idol.color)} aria-label={`${idol.name} 선택`} aria-pressed={setup.idol === i}><img src={idol.image} alt={idol.name} /><div><small>{idol.group}</small><b>{idol.name}</b></div>{setup.idol === i && <span className="chosen-check"><Check size={14} /></span>}</button>)}</div>
      <div className="setup-grid"><label className="field-label">플레이어 이름<input maxLength={12} placeholder={IDOLS[setup.idol].name} value={setup.name} onChange={event => setSetup({ ...setup, name: event.target.value })} /></label><label className="field-label">데뷔 목표 점수<select value={setup.target} onChange={event => setSetup({ ...setup, target: Number(event.target.value) })}><option value={300}>300P · 빠른 데뷔</option><option value={400}>400P · 기본 모드</option><option value={600}>600P · 긴 여정</option></select></label></div>
      <label className="field-label">전체 참가자 수</label><div className="segmented">{[1,2,3,4].map(count => <button type="button" key={count} className={setup.count === count ? 'selected' : ''} aria-pressed={setup.count === count} onClick={() => setSetup({ ...setup, count, humans: Math.min(count,setup.humans) })}><Users size={16} /> {count}명</button>)}</div>
      <label className="field-label">직접 플레이하는 사람<select value={setup.humans} onChange={event => setSetup({ ...setup, humans: Number(event.target.value) })}>{Array.from({ length: setup.count }, (_,i) => <option key={i} value={i+1}>{i+1}명 직접 플레이{setup.count - i - 1 ? ` + AI ${setup.count - i - 1}명` : ' · 모두 함께'}</option>)}</select></label>
      <p className="setup-note">같은 기기에서 순서대로 플레이합니다. 새 게임을 시작하면 현재 게임의 저장 내용이 교체됩니다.</p><button type="submit" className="primary wide"><Sparkles size={17} /> 새 게임 시작 <ArrowRight size={18} /></button>
    </form></Modal>;
}
export function Rules({ onClose }: { onClose: () => void }) {
  return <Modal title="게임 방법" onClose={onClose} wide><span className="eyebrow">HOW TO PLAY</span><h2>연습실에서, 스포트라이트까지.</h2><p className="modal-description">최대 4명이 함께하는 연예기획사 성장 보드게임</p>
    <div className="rules-list">{[
      ['01', '주사위를 던져 기획사로', '1~6칸 이동합니다. 보드를 한 바퀴 돌 때마다 20P를 받아요. AI는 자기 차례를 자동으로 진행합니다.'],
      ['02', '미니게임으로 실력 키우기', '보컬은 가운데 음정 맞추기, 댄스는 방향키 순서 맞추기, 랩은 박자 길이만큼 눌렀다 놓기! 모두 16초 안에 도전해요. 성적에 따라 능력치 +3~13, 점수와 경험치를 얻어요.'],
      ['03', '같은 칸에서 1:1 배틀', '도착한 칸에 다른 참가자가 있으면 트레이닝 후 배틀합니다. 도전자가 장르를 선택하고 두 사람이 순서대로 플레이해요. 능력치 55% + 미니게임 45%로 승부! 승리 45P, 패배 10P, 무승부는 각각 25P입니다. 여러 명이면 차례대로 배틀해요.'],
      ['04', '매 4라운드, 월말 평가', '모두가 한 번씩 움직이면 1라운드입니다. 4라운드마다 점수 상위 절반(동점 포함) 중 목표 점수의 25% 이상인 참가자가 데뷔조에 선발돼요. 1위 40P, 2위 25P, 나머지 15P 보너스! 한 번 선발되면 자격을 유지합니다.'],
      ['05', '목표 점수를 채우면 데뷔!', '데뷔조에 선발된 상태에서 목표 점수(기본 400P)를 달성하면 데뷔합니다. 경험치 60마다 레벨이 오르고 3D 말도 성장해요. 진행 내용은 이 브라우저에 자동 저장됩니다.'],
    ].map(([n,title,description]) => <div key={n}><span>{n}</span><section><h3>{title}</h3><p>{description}</p></section></div>)}</div><button className="primary wide" onClick={onClose}>좋아, 무대로 가보자 <ChevronRight size={18} /></button>
  </Modal>;
}
export function Credits({ onClose }: { onClose: () => void }) {
  return <Modal title="사진 출처" onClose={onClose}><span className="eyebrow">PHOTO CREDITS</span><h2>캐릭터 텍스처 출처</h2><p className="modal-description">공개 행사 사진을 UI 초상과 3D 말의 원형 텍스처에 맞게 표시했습니다. 인물과 기획사의 공식 제작·후원 게임이 아니며, 능력치와 활동은 게임을 위한 가상 설정입니다.</p><div className="credit-list">{IDOLS.map((idol,i) => <a href={idol.source} target="_blank" rel="noreferrer" key={idol.name}><Avatar player={{ idol: i, name: idol.name }} /><span><b>{idol.name}</b><small>{idol.author} · Wikimedia Commons</small></span><ArrowRight size={16} /></a>)}</div><p className="credit-license">사진 라이선스: <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>. 원본 파일은 보존하며 화면 표시 시 크기 조절과 원형 마스킹을 적용합니다.</p></Modal>;
}
export function PlayerDetail({ player, target, onClose }: { player: Player; target: number; onClose: () => void }) {
  const idol = IDOLS[player.idol];
  return <Modal title={`${player.name} 프로필`} onClose={onClose}><div className="profile-cover" style={colorStyle(idol.color)}><img src={idol.image} alt={player.name} /><span className="profile-level">LV. {level(player)}</span><div><small>{idol.english}</small><h2>{player.name}</h2><span>{player.lineup ? '데뷔조 멤버' : '꿈꾸는 연습생'} · {player.cpu ? 'AI 플레이어' : '직접 플레이'}</span></div></div><Stats player={player} /><div className="profile-numbers"><div><Star size={18} /><b>{player.score}<small>P</small></b><span>누적 점수</span></div><div><Crown size={18} /><b>{player.wins}<small>회</small></b><span>배틀 승리</span></div><div><Sparkles size={18} /><b>{Math.max(0,target-player.score)}<small>P</small></b><span>데뷔까지</span></div></div><div className="xp-line"><span>다음 레벨까지</span><b>{player.xp % 60} / 60 XP</b></div><div className="progress-track"><i style={{ width: `${player.xp % 60 / 60 * 100}%` }} /></div></Modal>;
}

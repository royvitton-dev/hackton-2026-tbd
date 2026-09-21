export type Skill = 'vocal' | 'dance' | 'rap';
export const SKILLS: Skill[] = ['vocal', 'dance', 'rap'];
export const SKILL_LABEL: Record<Skill, string> = { vocal: '보컬', dance: '댄스', rap: '랩' };
export const SKILL_COLOR: Record<Skill, string> = { vocal: '#c0a2ff', dance: '#7ae3c6', rap: '#ffa2be' };
export const DAYS_PER_MONTH = 4;
export const SAVE_KEY = 'debut-on.game.v1';
export const IDOLS = [
  { name: '카리나', english: 'KARINA', group: 'aespa', image: '/idols/karina.jpg', color: '#b49bff', specialty: 'dance' as Skill, author: '10Asia', source: 'https://commons.wikimedia.org/wiki/File:Aespa_Karina_2024_MMA_2_(cropped).jpg' },
  { name: '장원영', english: 'WONYOUNG', group: 'IVE', image: '/idols/wonyoung.png', color: '#ff9fbe', specialty: 'vocal' as Skill, author: 'TenAsia', source: 'https://commons.wikimedia.org/wiki/File:Jang_Won-young_at_the_2024_Melon_Music_Awards-2.png' },
  { name: '제니', english: 'JENNIE', group: 'BLACKPINK', image: '/idols/jennie.png', color: '#7ae3c6', specialty: 'rap' as Skill, author: '티비텐', source: 'https://commons.wikimedia.org/wiki/File:Jennie_Kim_2024_(facecrop).png' },
  { name: '나연', english: 'NAYEON', group: 'TWICE', image: '/idols/nayeon.jpg', color: '#ffd58b', specialty: 'vocal' as Skill, author: 'K-POPIT 케이팝잇', source: 'https://commons.wikimedia.org/wiki/File:241024_TWICE_Nayeon.jpg' },
];
export type Tile = { name: string; subtitle: string; type: 'start' | 'agency' | 'chance' | 'stage' | 'rest'; skill?: Skill; color: string; mark: string };
export const TILES: Tile[] = [
  { name: 'START', subtitle: '꿈의 시작', type: 'start', color: '#b9a0ff', mark: '★' },
  { name: 'SM', subtitle: '보컬 클래스', type: 'agency', skill: 'vocal', color: '#c0a2ff', mark: 'SM' },
  { name: 'JYP', subtitle: '댄스 클래스', type: 'agency', skill: 'dance', color: '#7ae3c6', mark: 'JYP' },
  { name: 'LUCKY', subtitle: '행운의 카드', type: 'chance', color: '#ffd58b', mark: '?' },
  { name: 'YG', subtitle: '랩 클래스', type: 'agency', skill: 'rap', color: '#ffa2be', mark: 'YG' },
  { name: 'STARSHIP', subtitle: '보컬 클래스', type: 'agency', skill: 'vocal', color: '#c0a2ff', mark: 'S' },
  { name: 'BUSKING', subtitle: '버스킹 무대', type: 'stage', skill: 'dance', color: '#f8c882', mark: '♪' },
  { name: 'HYBE', subtitle: '댄스 클래스', type: 'agency', skill: 'dance', color: '#7ae3c6', mark: 'H' },
  { name: 'CUBE', subtitle: '랩 클래스', type: 'agency', skill: 'rap', color: '#ffa2be', mark: 'C' },
  { name: 'LUCKY', subtitle: '행운의 카드', type: 'chance', color: '#ffd58b', mark: '?' },
  { name: 'SM', subtitle: '보컬 클래스', type: 'agency', skill: 'vocal', color: '#c0a2ff', mark: 'SM' },
  { name: 'JYP', subtitle: '댄스 클래스', type: 'agency', skill: 'dance', color: '#7ae3c6', mark: 'JYP' },
  { name: 'LOUNGE', subtitle: '재충전 시간', type: 'rest', color: '#b4d8ee', mark: '☕' },
  { name: 'YG', subtitle: '랩 클래스', type: 'agency', skill: 'rap', color: '#ffa2be', mark: 'YG' },
  { name: 'STARSHIP', subtitle: '보컬 클래스', type: 'agency', skill: 'vocal', color: '#c0a2ff', mark: 'S' },
  { name: 'LUCKY', subtitle: '행운의 카드', type: 'chance', color: '#ffd58b', mark: '?' },
  { name: 'HYBE', subtitle: '댄스 클래스', type: 'agency', skill: 'dance', color: '#7ae3c6', mark: 'H' },
  { name: 'CUBE', subtitle: '랩 클래스', type: 'agency', skill: 'rap', color: '#ffa2be', mark: 'C' },
  { name: 'SHOWCASE', subtitle: '쇼케이스 무대', type: 'stage', skill: 'vocal', color: '#f8c882', mark: '★' },
  { name: 'SM', subtitle: '보컬 클래스', type: 'agency', skill: 'vocal', color: '#c0a2ff', mark: 'SM' },
  { name: 'JYP', subtitle: '댄스 클래스', type: 'agency', skill: 'dance', color: '#7ae3c6', mark: 'JYP' },
  { name: 'LUCKY', subtitle: '행운의 카드', type: 'chance', color: '#ffd58b', mark: '?' },
  { name: 'YG', subtitle: '랩 클래스', type: 'agency', skill: 'rap', color: '#ffa2be', mark: 'YG' },
  { name: 'STARSHIP', subtitle: '보컬 클래스', type: 'agency', skill: 'vocal', color: '#c0a2ff', mark: 'S' },
];
export type Player = { id: number; idol: number; name: string; cpu: boolean; position: number; score: number; xp: number; stats: Record<Skill, number>; lineup: boolean; wins: number };
export type Phase = 'ready' | 'rolling' | 'moving' | 'training' | 'battle' | 'result' | 'evaluation' | 'finished';
export type Battle = { opponent: number; skill: Skill | null; attack: number | null; defense: number | null };
export type Result = { title: string; description: string; points: number; player: number; skill?: Skill; gain?: number; performance?: number; kind: 'training' | 'battle' | 'chance' | 'rest' };
export type Evaluation = { player: number; rank: number; score: number; bonus: number; selected: boolean };
export type GameState = {
  version: 1; players: Player[]; active: number; day: number; month: number; turn: number; phase: Phase; dice: number; remaining: number;
  target: number; rivals: number[]; battle: Battle | null; result: Result | null; evaluation: Evaluation[]; winners: number[];
  log: { id: number; text: string; color: string }[];
};
export type Setup = { count: number; humans: number; target: number; idol: number; name: string };
export function createGame(setup: Setup = { count: 4, humans: 1, target: 400, idol: 0, name: '' }): GameState {
  const count = Math.max(1, Math.min(4, Math.floor(setup.count)));
  const order = [setup.idol, ...IDOLS.map((_, i) => i).filter(i => i !== setup.idol)];
  return { version: 1, players: order.slice(0, count).map((idol, id) => ({ id, idol, name: id === 0 && setup.name.trim() ? setup.name.trim().slice(0, 12) : IDOLS[idol].name, cpu: id >= Math.max(1, setup.humans), position: 0, score: 0, xp: 0, stats: { vocal: 20, dance: 20, rap: 20 }, lineup: false, wins: 0 })), active: 0, day: 1, month: 1, turn: 1, phase: 'ready', dice: 1, remaining: 0, target: setup.target, rivals: [], battle: null, result: null, evaluation: [], winners: [], log: [{ id: 0, text: '새로운 연습생 생활이 시작됐어요. 첫 주사위를 던져보세요!', color: '#b49bff' }] };
}
export function level(player: Player) { return 1 + Math.floor(player.xp / 60); }
export function rankPlayers(players: Player[]) { return [...players].sort((a, b) => b.score - a.score || b.xp - a.xp || a.id - b.id); }
function note(state: GameState, text: string, color = '#b49bff') { state.log = [{ id: (state.log[0]?.id ?? 0) + 1, text, color }, ...state.log].slice(0, 30); }
function result(state: GameState, value: Result) { state.result = value; state.phase = 'result'; note(state, `${state.players[value.player].name} · ${value.title}${value.points ? ` +${value.points}P` : ''}`, IDOLS[state.players[value.player].idol].color); }
function performance(value: number) { return Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))); }
function findWinners(state: GameState) { state.winners = state.players.filter(p => p.lineup && p.score >= state.target).map(p => p.id); if (state.winners.length) state.phase = 'finished'; }
function land(state: GameState, luck: number) {
  const player = state.players[state.active];
  const tile = TILES[player.position];
  state.rivals = state.players.filter(p => p.id !== player.id && p.position === player.position).map(p => p.id);
  note(state, `${player.name}, ${tile.name} 도착!`, tile.color);
  if (tile.type === 'agency' || tile.type === 'stage') { state.phase = 'training'; return; }
  if (tile.type === 'chance') {
    const cards = [
      { title: '직캠이 화제가 됐어요!', description: '자신감 넘치는 무대에 새로운 팬들이 찾아왔어요.', points: 35 },
      { title: '특별 레슨 초대', description: '선배 아티스트의 원포인트 레슨! 모든 능력치 +5.', points: 15 },
      { title: '캐스팅 디렉터의 픽', description: '눈에 띄는 존재감으로 보너스 점수를 얻었어요.', points: 25 },
      { title: '팬레터가 도착했어요', description: '응원 한마디로 한 단계 더 성장했어요. 경험치 +20.', points: 20 },
    ];
    const index = Math.min(3, Math.max(0, Math.floor(luck * 4)));
    const card = cards[index]; player.score += card.points; player.xp += 15 + (index === 3 ? 20 : 0);
    if (index === 1) SKILLS.forEach(key => { player.stats[key] = Math.min(100, player.stats[key] + 5); });
    result(state, { ...card, player: player.id, kind: 'chance' });
  } else {
    player.score += 15; player.xp += 10;
    result(state, { title: tile.type === 'start' ? '다시, 새로운 시작!' : '잠깐 쉬어가도 괜찮아', description: tile.type === 'start' ? '한 바퀴를 돌아 더욱 단단해졌어요. 출발 칸 보너스!' : '에너지를 충전했어요. 꾸준함도 실력이니까요.', points: 15, player: player.id, kind: 'rest' });
  }
}
export type Action = { type: 'ROLL'; dice: number } | { type: 'MOVE' } | { type: 'STEP'; luck: number } | { type: 'TRAIN'; performance: number } | { type: 'CHOOSE'; skill: Skill } | { type: 'PERFORM'; performance: number } | { type: 'CONTINUE' } | { type: 'NEXT_MONTH' } | { type: 'NEW'; setup: Setup };
export function reducer(previous: GameState, action: Action): GameState {
  if (action.type === 'NEW') return createGame(action.setup);
  const state = structuredClone(previous);
  const player = state.players[state.active];
  switch (action.type) {
    case 'ROLL':
      if (state.phase !== 'ready' || !Number.isInteger(action.dice) || action.dice < 1 || action.dice > 6) return previous;
      state.dice = action.dice; state.remaining = action.dice; state.phase = 'rolling'; break;
    case 'MOVE': if (state.phase !== 'rolling') return previous; state.phase = 'moving'; break;
    case 'STEP':
      if (state.phase !== 'moving') return previous;
      player.position = (player.position + 1) % TILES.length; state.remaining--;
      if (player.position === 0) { player.score += 20; note(state, `${player.name}, 한 바퀴 완주! +20P`); }
      if (state.remaining === 0) land(state, action.luck);
      break;
    case 'TRAIN': {
      if (state.phase !== 'training') return previous;
      const tile = TILES[player.position]; const skill = tile.skill!; const quality = performance(action.performance);
      const gain = 3 + Math.round(quality / 10); const points = 10 + Math.round(quality * (tile.type === 'stage' ? 0.45 : 0.25));
      player.stats[skill] = Math.min(100, player.stats[skill] + gain); player.score += points; player.xp += 15 + Math.round(quality / 4);
      result(state, { title: quality >= 80 ? '빛나는 퍼포먼스!' : quality >= 45 ? '한 걸음 더 성장했어요!' : '도전하는 당신을 응원해요!', description: `${tile.name} ${SKILL_LABEL[skill]} 트레이닝 완료`, points, player: player.id, skill, gain, performance: quality, kind: 'training' }); break;
    }
    case 'CHOOSE':
      if (state.phase !== 'battle' || !state.battle || state.battle.skill || !SKILLS.includes(action.skill)) return previous;
      state.battle.skill = action.skill; break;
    case 'PERFORM': {
      if (state.phase !== 'battle' || !state.battle?.skill) return previous;
      const battle = state.battle;
      if (battle.attack === null) { battle.attack = performance(action.performance); break; }
      battle.defense = performance(action.performance);
      const skill = battle.skill!; const opponent = state.players[battle.opponent];
      const a = Math.round(player.stats[skill] * .55 + battle.attack * .45);
      const b = Math.round(opponent.stats[skill] * .55 + battle.defense * .45);
      const winner = a >= b ? player : opponent; const loser = a >= b ? opponent : player; const draw = a === b;
      winner.score += draw ? 25 : 45; loser.score += draw ? 25 : 10;
      player.xp += 20; opponent.xp += 20; if (!draw) winner.wins++;
      result(state, { title: draw ? '멋진 무승부!' : `${winner.name}, 배틀 승리!`, description: `${SKILL_LABEL[skill]} 배틀 · ${player.name} ${a} vs ${opponent.name} ${b} · ${draw ? '두 참가자 모두 +25P' : `${loser.name}도 도전 보상 +10P`}`, points: draw ? 25 : 45, player: winner.id, kind: 'battle' });
      state.battle = null; break;
    }
    case 'CONTINUE': {
      if (state.phase !== 'result') return previous;
      findWinners(state); if (state.winners.length) break;
      if (state.rivals.length) { state.battle = { opponent: state.rivals.shift()!, skill: null, attack: null, defense: null }; state.phase = 'battle'; break; }
      state.result = null; state.active = (state.active + 1) % state.players.length; state.turn++;
      if (state.active === 0) {
        if (state.day === DAYS_PER_MONTH) {
          const ranked = rankPlayers(state.players); const selectionScore = ranked[Math.ceil(ranked.length / 2) - 1].score;
          const scores = ranked.map(p => p.score);
          state.evaluation = ranked.map(p => {
            const rank = 1 + scores.filter(score => score > p.score).length;
            const bonus = rank === 1 ? 40 : rank === 2 ? 25 : 15;
            const selected = p.score >= Math.ceil(state.target * .25) && p.score >= selectionScore;
            p.lineup ||= selected; p.score += bonus;
            return { player: p.id, rank, score: p.score - bonus, bonus, selected: p.lineup };
          });
          state.phase = 'evaluation'; note(state, `${state.month}개월 차 월말 평가! 데뷔조 선발 결과를 확인하세요.`); break;
        }
        state.day++;
      }
      state.phase = 'ready'; break;
    }
    case 'NEXT_MONTH':
      if (state.phase !== 'evaluation') return previous;
      findWinners(state); if (!state.winners.length) { state.month++; state.day = 1; state.phase = 'ready'; }
      break;
    default: return previous;
  }
  return state;
}
export function restoreGame(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    const integer = (n: unknown, low: number, high: number) => typeof n === 'number' && Number.isInteger(n) && n >= low && n <= high;
    if (s.version !== 1 || !Array.isArray(s.players) || !integer(s.players.length, 1, 4) || !integer(s.active, 0, s.players.length - 1) || !integer(s.target, 100, 5000) || !integer(s.day, 1, DAYS_PER_MONTH) || !integer(s.month, 1, 100000) || !integer(s.turn, 1, 10000000) || !integer(s.dice, 1, 6) || !integer(s.remaining, 0, 6)) return null;
    if (!['ready','rolling','moving','training','battle','result','evaluation','finished'].includes(s.phase)) return null;
    if (s.players.some((p, i) => !p || p.id !== i || !integer(p.idol, 0, 3) || typeof p.name !== 'string' || p.name.length > 12 || typeof p.cpu !== 'boolean' || typeof p.lineup !== 'boolean' || !integer(p.position, 0, 23) || !integer(p.score, 0, 10000000) || !integer(p.xp, 0, 10000000) || !integer(p.wins, 0, 1000000) || !p.stats || SKILLS.some(k => !integer(p.stats[k], 0, 100)))) return null;
    const validId = (id: unknown) => integer(id, 0, s.players.length - 1);
    if (!Array.isArray(s.rivals) || s.rivals.some(id => !validId(id) || id === s.active) || !Array.isArray(s.winners) || s.winners.some(id => !validId(id))) return null;
    if (!Array.isArray(s.log) || s.log.some(l => !l || typeof l.text !== 'string' || typeof l.color !== 'string' || !integer(l.id, 0, 10000000))) return null;
    if (!Array.isArray(s.evaluation) || s.evaluation.some(e => !e || !validId(e.player) || !integer(e.rank, 1, 4) || !integer(e.score, 0, 10000000) || !integer(e.bonus, 0, 100) || typeof e.selected !== 'boolean')) return null;
    if (s.phase === 'result' && (!s.result || !validId(s.result.player) || typeof s.result.title !== 'string' || typeof s.result.description !== 'string' || !integer(s.result.points, 0, 100))) return null;
    if (s.result && (!['training','battle','chance','rest'].includes(s.result.kind) || (s.result.skill !== undefined && !SKILLS.includes(s.result.skill)) || (s.result.gain !== undefined && !integer(s.result.gain, 0, 13)) || (s.result.performance !== undefined && !integer(s.result.performance, 0, 100)))) return null;
    if (s.phase === 'battle' && (!s.battle || !validId(s.battle.opponent) || s.battle.opponent === s.active || (s.battle.skill !== null && !SKILLS.includes(s.battle.skill)) || (s.battle.attack !== null && !integer(s.battle.attack, 0, 100)) || (s.battle.defense !== null && !integer(s.battle.defense, 0, 100)))) return null;
    if (s.phase === 'training' && !TILES[s.players[s.active].position].skill) return null;
    if (s.phase === 'moving' && s.remaining < 1) return null;
    if (s.phase === 'finished' && !s.winners.length) return null;
    if (s.phase === 'evaluation' && s.evaluation.length !== s.players.length) return null;
    return s;
  } catch { return null; }
}

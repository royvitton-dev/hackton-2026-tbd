import type { Driver, Track, VoicePrint } from './types';

export const COLORS = ['#ff663a', '#aa91f1', '#69be9c', '#edb846', '#65a9da', '#ee91b1', '#8fbc61', '#8e9dab'];
export const DRINKS = ['아이스 아메리카노', '카페 라떼', '바닐라 라떼', '콜드브루', '말차 라떼', '초콜릿 라떼'];
export const TRACKS: Track[] = [
  { id: 'roastery', name: '로스터리 서킷', english: 'ROASTERY CIRCUIT', subtitle: '커피 향을 따라, 가볍게 한 바퀴.', level: 1, accent: '#f17849', ground: '#bdcca7', road: '#737977', sky: '#e7edde', length: 820, grip: .96,
    points: [[-25,0,-12],[-13,0,-23],[13,0,-21],[28,0,-8],[24,0,13],[6,0,21],[-15,0,18],[-28,0,5]] },
  { id: 'coast', name: '선셋 비치', english: 'SUNSET BEACH', subtitle: '바닷바람과 함께 달리는 해안 도로.', level: 2, accent: '#eeab54', ground: '#efd7a6', road: '#b8a187', sky: '#f1e8d7', length: 880, grip: .93,
    points: [[-28,0,-12],[-9,1,-23],[18,0,-19],[30,0,-2],[16,1,7],[23,0,20],[-1,0,21],[-25,0,13]] },
  { id: 'forest', name: '말차 포레스트', english: 'MATCHA FOREST', subtitle: '초록빛 숲속, 아슬아슬한 코너.', level: 3, accent: '#71a582', ground: '#89a67d', road: '#657566', sky: '#dbe8d6', length: 920, grip: .88,
    points: [[-26,0,-15],[-7,2,-23],[14,0,-18],[26,1,-9],[11,2,3],[25,0,17],[2,1,22],[-14,0,11],[-29,1,6]] },
  { id: 'city', name: '미드나잇 시티', english: 'MIDNIGHT CITY', subtitle: '네온 불빛 사이로, 밤을 가르는 질주.', level: 4, accent: '#a390d6', ground: '#525977', road: '#363b51', sky: '#ccd2e2', length: 960, grip: .85,
    points: [[-26,0,-17],[-2,0,-19],[22,0,-18],[27,2,1],[10,2,4],[12,0,19],[-11,0,20],[-12,2,3],[-28,0,2]] },
  { id: 'snow', name: '슈가 마운틴', english: 'SUGAR MOUNTAIN', subtitle: '미끄러운 설원 위, 달콤한 긴장감.', level: 5, accent: '#73abc4', ground: '#dfe8e8', road: '#9dbecc', sky: '#e7eff4', length: 1000, grip: .79,
    points: [[-27,0,-14],[-8,4,-22],[17,2,-17],[29,0,1],[16,4,12],[0,1,5],[-8,3,21],[-26,0,15],[-19,1,0]] },
  { id: 'volcano', name: '에스프레소 볼케이노', english: 'ESPRESSO VOLCANO', subtitle: '마지막 한 방울까지, 뜨겁게.', level: 6, accent: '#d8725c', ground: '#927b6e', road: '#514a46', sky: '#eadacd', length: 1040, grip: .75,
    points: [[-25,0,-15],[-8,3,-23],[10,0,-16],[27,2,-11],[18,5,3],[28,0,16],[5,2,22],[-4,0,8],[-25,3,18],[-19,1,0]] },
];

export const ITEMS = {
  boost: { name: '에스프레소 부스트', short: '부스트', icon: '⚡', color: '#f3bd44', description: '진한 한 샷! 2.5초 동안 속도 UP.' },
  bean: { name: '원두 미사일', short: '원두탄', icon: '●', color: '#a78263', description: '앞선 레이서에게 원두를 날려 감속.' },
  ice: { name: '아이스 큐브', short: '얼음', icon: '❄', color: '#84c7df', description: '앞 차를 얼려 2초 동안 미끄러지게.' },
  shield: { name: '컵 홀더 실드', short: '실드', icon: '◈', color: '#ac9ddd', description: '4초 동안 날아오는 공격을 막아요.' },
  storm: { name: '디카페인 폭풍', short: '폭풍', icon: 'ϟ', color: '#e99aaf', description: '선두의 카페인을 빼앗아 잠깐 감속.' },
};

export const CELEBRITIES = [
  { name: '공유', tone: '따뜻한 저음', range: [65, 160], avatar: 0 },
  { name: '김우빈', tone: '묵직한 저음', range: [65, 170], avatar: 1 },
  { name: '박서준', tone: '편안한 중저음', range: [100, 200], avatar: 2 },
  { name: '유재석', tone: '경쾌한 중음', range: [130, 250], avatar: 3 },
  { name: '장도연', tone: '또렷한 중음', range: [150, 280], avatar: 4 },
  { name: '아이유', tone: '맑은 고음', range: [190, 400], avatar: 5 },
  { name: '박보영', tone: '산뜻한 고음', range: [180, 400], avatar: 6 },
  { name: '태연', tone: '부드러운 고음', range: [180, 400], avatar: 7 },
];

export function matchCelebrity(voice: VoicePrint | undefined, random = Math.random) {
  const pitch = voice?.pitch || 180;
  const pool = CELEBRITIES.filter(c => pitch >= c.range[0] && pitch <= c.range[1]);
  const candidates = pool.length ? pool : CELEBRITIES;
  return candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length))];
}

export function demoDrivers(): Driver[] {
  return [
    { id: 'demo-1', nickname: '김커피', drink: DRINKS[0], color: COLORS[0], avatar: 0, celebrity: '공유', demo: true },
    { id: 'demo-2', nickname: '라떼러버', drink: DRINKS[1], color: COLORS[1], avatar: 5, celebrity: '아이유', demo: true },
    { id: 'demo-3', nickname: '샷추가', drink: DRINKS[3], color: COLORS[2], avatar: 2, celebrity: '박서준', demo: true },
    { id: 'demo-4', nickname: '말차사랑', drink: DRINKS[4], color: COLORS[3], avatar: 6, celebrity: '박보영', demo: true },
  ];
}

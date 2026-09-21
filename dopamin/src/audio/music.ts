export type MusicMood = 'lobby' | 'race' | 'results';
export type Instrument = 'lead' | 'bass' | 'chord' | 'kick' | 'snare' | 'hat';
export type MusicNote = { step:number; midi:number; length:number; velocity:number; instrument:Instrument };
export type Score = { bpm:number; steps:number; notes:MusicNote[] };
export const midiFrequency=(midi:number)=>440*2**((midi-69)/12);

// Original eight-bar arcade tunes, in sixteenth-note steps. No remote audio assets.
const raceMelody = [
  [76,79,81,79,76,74,72,74], [74,79,83,81,79,76,74,71],
  [76,81,84,83,81,79,76,79], [77,81,84,81,79,77,76,74],
  [84,83,81,79,76,79,81,84], [83,81,79,74,79,81,83,86],
  [84,81,79,76,81,79,76,74], [77,79,81,79,76,74,72,79],
];
const lobbyMelody = [
  [72,76,79,76], [71,74,79,74], [69,72,76,79], [69,72,77,76],
  [76,79,83,79], [74,79,81,79], [76,72,69,72], [77,76,74,72],
];
const victoryMelody = [
  [79,79,84,83,84,88,86,84], [83,81,79,74,79,83,86,83],
  [84,84,88,86,84,81,79,81], [81,84,89,88,86,84,81,79],
  [84,88,91,88,86,84,83,81], [83,86,91,86,83,81,79,74],
  [81,84,88,84,81,79,76,79], [77,81,84,81,79,76,72,72],
];
const chords=[[48,52,55],[43,47,50],[45,48,52],[41,45,48]];
const transpositions:Record<string,number>={roastery:0,coast:2,forest:-2,city:3,snow:5,volcano:-3};
export function createScore(mood:MusicMood,trackId='roastery',finalLap=false):Score {
  const notes:MusicNote[]=[],transpose=mood==='race'?(transpositions[trackId]??0):0;
  const bpm=mood==='lobby'?108:mood==='results'?126:150+(finalLap?16:0);
  const add=(step:number,midi:number,length:number,velocity:number,instrument:Instrument)=>notes.push({step,midi:midi+transpose,length,velocity,instrument});
  for(let bar=0;bar<8;bar++){
    const root=chords[bar%4],base=bar*16,melody=(mood==='lobby'?lobbyMelody:mood==='results'?victoryMelody:raceMelody)[bar];
    melody.forEach((note,i)=>add(base+i*(mood==='lobby'?4:2),note,mood==='lobby'?2.8:1.35,mood==='lobby'?.065:.075,'lead'));
    for(let beat=0;beat<4;beat++){
      add(base+beat*4,root[beat%2===0?0:2]-12,2.8,.12,'bass');
      if(mood!=='lobby'||beat%2===0)add(base+beat*4,36,.7,mood==='lobby'?.20:.37,'kick');
      if(beat%2===1)add(base+beat*4,38,.6,mood==='lobby'?.10:.22,'snare');
      for(const tone of root)add(base+beat*4+(mood==='lobby'?2:2.5),tone+12,1.2,.032,'chord');
      add(base+beat*4,42,.28,mood==='lobby'?.025:.042,'hat');
      if(mood!=='lobby')add(base+beat*4+2,42,.2,.027,'hat');
    }
    if(mood!=='lobby'&&bar%4===3)for(const step of [13,14,15])add(base+step,38,.4,.1,'snare');
  }
  return {bpm,steps:128,notes:notes.sort((a,b)=>a.step-b.step)};
}

import { describe, expect, it } from 'vitest';
import { CELEBRITIES, demoDrivers, matchCelebrity, TRACKS } from '../../src/core/catalog';
import { buildVoicePrint, cleanNickname, detectDrink, detectPitch, identifySpeaker, spectralFeatures, voiceSimilarity } from '../../src/core/voice';
import type { VoicePrint } from '../../src/core/types';

const vector=[1,0,0,0,0,0,0,0,0,0,0,0],voice:VoicePrint={vector,pitch:150,frames:35};
describe('local voice fingerprint',()=>{
  it.each([90,150,220,320])('finds %d Hz from a synthetic microphone signal',frequency=>{const rate=48000,samples=Float32Array.from({length:2048},(_,i)=>.3*Math.sin(2*Math.PI*frequency*i/rate));expect(Math.abs(detectPitch(samples,rate)-frequency)).toBeLessThan(8);});
  it('rejects silence and aperiodic noise',()=>{expect(detectPitch(new Float32Array(2048),48000)).toBe(0);let seed=5;const noise=Float32Array.from({length:2048},()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296-.5;});expect(detectPitch(noise,48000)).toBe(0);});
  it('extracts finite normalized cepstral features independent of microphone gain',()=>{const spectrum=Float32Array.from({length:1024},(_,i)=>-30-i*.035+Math.sin(i/27)*3);const a=spectralFeatures(spectrum,48000),b=spectralFeatures(spectrum.map(v=>v-10),48000);expect(a).toHaveLength(12);expect(a.every(Number.isFinite)).toBe(true);expect(Math.hypot(...a)).toBeCloseTo(1);expect(voiceSimilarity({...voice,vector:a},{...voice,vector:b})).toBeGreaterThan(.99);});
  it('handles low sample rates and silence spectra without NaN',()=>{expect(spectralFeatures(new Float32Array(128).fill(-Infinity),8000).every(Number.isFinite)).toBe(true);});
  it('requires enough voiced frames, not only ambient sound',()=>{expect(()=>buildVoicePrint([])).toThrow('3초');expect(()=>buildVoicePrint(Array(30).fill({vector,pitch:0}))).toThrow();expect(()=>buildVoicePrint(Array(30).fill({vector:[1],pitch:150}))).toThrow();});
  it('aggregates voiced frames and uses a robust median pitch',()=>{const frames=Array.from({length:21},(_,i)=>({vector,pitch:140+i}));frames.push({vector,pitch:0});const print=buildVoicePrint(frames);expect(print.frames).toBe(21);expect(print.pitch).toBe(150);expect(print.vector).toEqual(vector);expect(buildVoicePrint(Array(20).fill({vector:Array(12).fill(0),pitch:150})).vector).toEqual(Array(12).fill(0));});
  it('matches known voices but rejects ambiguous or unknown speakers',()=>{
    const ds=demoDrivers();ds[0].voice=voice;ds[1].voice={...voice,vector:vector.map(v=>-v),pitch:300};
    expect(identifySpeaker(voice,ds).match?.id).toBe(ds[0].id);
    expect(identifySpeaker({...voice,vector:[0,1,0,0,0,0,0,0,0,0,0,0],pitch:400},ds).match).toBeNull();
    ds[1].voice=voice;expect(identifySpeaker(voice,ds).reason).toBe('ambiguous');expect(identifySpeaker(voice,[]).reason).toBe('empty');
  });
  it('rejects invalid fingerprints and bounds similarity',()=>{
    expect(voiceSimilarity(voice,voice)).toBe(1);expect(voiceSimilarity(voice,{...voice,vector:[]})).toBe(0);expect(voiceSimilarity(voice,{...voice,vector:Array(12).fill(0)})).toBe(0);expect(voiceSimilarity(voice,{...voice,pitch:0})).toBe(0);expect(voiceSimilarity(voice,{...voice,vector:Array(12).fill(NaN)})).toBe(0);expect(voiceSimilarity(voice,{...voice,pitch:NaN})).toBe(0);
  });
});

describe('Korean voice commands and avatar moods',()=>{
  it.each([['제 별명은 커피왕입니다','커피왕'],['저는 샷추가예요','샷추가'],['내 이름은 종호라고 해요','종호'],['커피러버','커피러버'],['나는 라떼러버이에요','라떼러버']])('cleans nickname: %s',(input,expected)=>{expect(cleanNickname(input)).toBe(expected);});
  it('limits nickname length',()=>{expect(cleanNickname('가'.repeat(30))).toHaveLength(12);});
  it.each([['아이스 아메리카노 한 잔 주세요','아이스 아메리카노'],['따뜻한 아메리카노요','따뜻한 아메리카노'],['바닐라 라떼 마실게요','바닐라 라떼'],['말차 라테 주세요','말차 라떼'],['카페 라테','카페 라떼'],['콜드 브루','콜드브루'],['초코 라떼','초콜릿 라떼'],['아아','아이스 아메리카노'],['안녕하세요',null]])('understands order: %s',(input,expected)=>{expect(detectDrink(input)).toBe(expected);});
  it('chooses only celebrities in the supplied pitch range',()=>{for(const pitch of [90,150,240,350])for(const random of [0,.4,.99,1]){const chosen=matchCelebrity({...voice,pitch},()=>random);expect(pitch).toBeGreaterThanOrEqual(chosen.range[0]);expect(pitch).toBeLessThanOrEqual(chosen.range[1]);}});
  it('has safe fallbacks for manual entry and unusual pitch',()=>{expect(CELEBRITIES).toContain(matchCelebrity(undefined,()=>0));expect(CELEBRITIES).toContain(matchCelebrity({...voice,pitch:900},()=>1));expect(CELEBRITIES).toContain(matchCelebrity({...voice,pitch:0},()=>0));});
  it('defines six progressively harder, distinct tracks',()=>{expect(TRACKS).toHaveLength(6);expect(TRACKS.map(t=>t.level)).toEqual([1,2,3,4,5,6]);expect(new Set(TRACKS.map(t=>JSON.stringify(t.points))).size).toBe(6);});
});

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { clearRaces, deleteVoice, getVoice, loadDrivers, loadRaces, saveDrivers, saveRace, saveVoice } from '../../src/core/storage';
import { demoDrivers } from '../../src/core/catalog';
import { simulateRace } from '../../src/core/race';

describe('local persistence',()=>{
  it('distinguishes first use from an intentionally emptied roster',async()=>{expect(await loadDrivers()).toBeUndefined();await saveDrivers([]);expect(await loadDrivers()).toEqual([]);});
  it('round-trips registered profiles',async()=>{const ds=demoDrivers();await saveDrivers(ds);expect(await loadDrivers()).toEqual(ds);});
  it('saves and removes audio without putting it in a race log',async()=>{const recording=new Blob(['sample audio'],{type:'audio/webm'});await saveVoice('voice-test',recording);const stored=await getVoice('voice-test');expect(stored?.size).toBe(recording.size);expect(stored?.type).toBe('audio/webm');await deleteVoice('voice-test');expect(await getVoice('voice-test')).toBeUndefined();});
  it('keeps the newest ten races and deduplicates IDs',async()=>{
    for(let i=0;i<12;i++)await saveRace(simulateRace(demoDrivers(),'roastery',i,new Date(Date.UTC(2026,8,20,0,i)).toISOString()));
    const races=await loadRaces();expect(races).toHaveLength(10);expect(races[0].seed).toBe(11);expect(races.at(-1)!.seed).toBe(2);await saveRace(races[0]);expect(await loadRaces()).toHaveLength(10);
  });
  it('filters corrupt stored races',async()=>{await saveRace({version:99,id:'corrupt'} as never);expect((await loadRaces()).some(r=>r.id==='corrupt')).toBe(false);});
  it('clears race history while retaining profiles',async()=>{await clearRaces();expect(await loadRaces()).toEqual([]);expect(await loadDrivers()).toHaveLength(4);});
});

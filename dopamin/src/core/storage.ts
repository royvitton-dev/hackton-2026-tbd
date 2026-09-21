import type { Driver, RaceLog } from './types';
import { parseReplay } from './race';

let connection: Promise<IDBDatabase> | undefined;
function db() {
  if (!connection) connection = new Promise((resolve, reject) => {
    const req = indexedDB.open('brew-racers', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('settings');
      req.result.createObjectStore('voices');
      req.result.createObjectStore('races', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { connection = undefined; reject(req.error); };
  });
  return connection;
}
async function transaction<T>(store: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode);
    const request = run(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error || request.error);
    tx.onabort = () => reject(tx.error || new Error('저장 작업이 취소되었습니다.'));
  });
}
export async function loadDrivers(): Promise<Driver[] | undefined> { return transaction('settings', 'readonly', s => s.get('drivers')); }
export async function saveDrivers(drivers: Driver[]) { await transaction('settings', 'readwrite', s => s.put(drivers, 'drivers')); }
export async function saveVoice(id: string, blob: Blob) { await transaction('voices', 'readwrite', s => s.put(blob, id)); }
export async function getVoice(id: string): Promise<Blob | undefined> { return transaction('voices', 'readonly', s => s.get(id)); }
export async function deleteVoice(id: string) { await transaction('voices', 'readwrite', s => s.delete(id)); }
export async function saveRace(log: RaceLog) {
  await transaction('races', 'readwrite', s => s.put(log));
  const all = await loadRaces();
  for (const old of all.slice(10)) await transaction('races', 'readwrite', s => s.delete(old.id));
}
export async function loadRaces(): Promise<RaceLog[]> {
  const logs = await transaction<RaceLog[]>('races', 'readonly', s => s.getAll());
  return logs.filter(log => { try { parseReplay(JSON.stringify(log)); return true; } catch { return false; } }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function clearRaces() { await transaction('races', 'readwrite', s => s.clear()); }

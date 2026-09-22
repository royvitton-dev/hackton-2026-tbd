import type { BrowserCommand } from './wasmCore.ts'

export const DATABASE = 'leave-park.browser-market.v1'
export interface JournalEntry {
  seq: number
  command: BrowserCommand
}
export async function openJournal() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('commands', { keyPath: 'seq' })
      request.result.createObjectStore('settings')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('저장소를 사용 중인 다른 거래소 탭을 닫아 주세요.'))
  })
  function read<T>(store: string, key?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const object = tx.objectStore(store)
      const query = key ? object.get(key) : object.getAll()
      tx.oncomplete = () => resolve(query.result as T)
      tx.onabort = () => reject(tx.error || new Error('브라우저 저장소 읽기에 실패했습니다.'))
      tx.onerror = () => {
        /* onabort owns rejection */
      }
    })
  }
  function write(store: string, value: unknown, key?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite', { durability: 'strict' })
      const object = tx.objectStore(store)
      if (key) object.put(value, key)
      else object.add(value)
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error || new Error('브라우저 저장 공간을 확인하세요.'))
      tx.onerror = () => {
        /* onabort owns rejection; no success before commit */
      }
    })
  }
  return {
    read: () => read<JournalEntry[]>('commands'),
    append: (entry: JournalEntry) => write('commands', entry),
    botsEnabled: async () => (await read<boolean | undefined>('settings', 'botsEnabled')) !== false,
    setBotsEnabled: (enabled: boolean) => write('settings', enabled, 'botsEnabled'),
    onClose: (callback: () => void) => {
      db.onversionchange = () => {
        db.close()
        callback()
      }
    },
  }
}

/** Serialize client request operations per account before React can rerender. */
export function createRequestGate() {
  const active = new Set<string>()
  return {
    begin(accountId: string): boolean {
      if (active.has(accountId)) return false
      active.add(accountId)
      return true
    },
    finish(accountId: string) {
      active.delete(accountId)
    },
    busy(accountId: string): boolean {
      return active.has(accountId)
    },
  }
}

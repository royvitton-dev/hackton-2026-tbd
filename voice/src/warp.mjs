// Delivery stays in the native helper so macOS permissions belong to TBD Speech.
export function createWarpRunner({ send, dryRun = false, output = process.stdout, timeoutMs = 5000 }) {
  let sequence = 0;
  let pending;
  const settle = (error, result) => {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimeout(current.timer);
    if (error) current.reject(error);
    else current.resolve(result);
  };
  return {
    run(prompt) {
      if (pending) return Promise.reject(new Error('Warp에 이미 전달 중입니다.'));
      if (dryRun) {
        output.write(`[연습 모드 · 포커스된 Warp CLI에 전달할 내용]\n${prompt}\n`);
        return Promise.resolve({ delivery: 'warp-preview' });
      }
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          try { send(`warp-cancel:${id}`); } catch { /* helper already disconnected */ }
          settle(new Error('Warp 전달 응답이 없습니다. 자동으로 다시 전송하지 않습니다.'));
        }, timeoutMs);
        pending = { id, resolve, reject, timer };
        try { send(`warp-submit:${JSON.stringify({ id, text: prompt })}`); }
        catch (error) { settle(error); }
      });
    },
    accept(event) {
      if (event.type !== 'warp-delivery' || event.id !== pending?.id) return false;
      if (event.ok) settle(null, { delivery: 'warp', target: event.target });
      else settle(new Error(event.message || 'Warp에 전달하지 못했습니다.'));
      return true;
    },
    cancel() {
      if (!pending) return;
      try { send(`warp-cancel:${pending.id}`); } catch { /* helper already disconnected */ }
      settle(new Error('Warp 전달을 중단했습니다.'));
    },
  };
}

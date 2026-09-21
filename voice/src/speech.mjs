import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, chmod, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';

// LaunchServices gives the helper its own privacy identity. Direct child execution
// attributes Speech authorization to the host app, which may lack a usage description.
export async function launchSpeech(bundle, { onDevice = false, check = false, feedbackOnly = false, sound = true, dryRun = false, diagnostics = false, audioFile, thread } = {}) {
  const directory = await mkdtemp('/tmp/tbd-voice-');
  await chmod(directory, 0o700);
  const socketPath = join(directory, 'speech.sock');
  const errorPath = join(directory, 'stderr.log');
  const server = createServer();
  const session = new EventEmitter();
  let socket;
  let launcher;
  let timer;
  let closing = false;
  let rejectConnection;
  const cleanup = async () => {
    clearTimeout(timer);
    socket?.destroy();
    server.close();
    await rm(directory, { recursive: true, force: true });
  };
  session.stop = () => {
    if (closing) return;
    closing = true;
    if (socket && !socket.destroyed) socket.end('stop\n');
    else { launcher?.kill(); void cleanup(); }
  };
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(socketPath, resolve);
    });
    const connected = new Promise((resolve, reject) => {
      rejectConnection = reject;
      server.once('connection', peer => {
        socket = peer;
        server.close();
        clearTimeout(timer);
        session.stdin = peer;
        session.stdout = peer;
        resolve(session);
      });
      timer = setTimeout(() => reject(new Error('음성 도우미 연결 시간이 초과되었습니다. macOS 권한 창을 확인하세요.')), 15_000);
    });
    const args = ['-n', '-W', '--stderr', errorPath, bundle, '--args', '--socket', socketPath];
    if (onDevice) args.push('--on-device');
    if (check) args.push('--check');
    if (feedbackOnly) args.push('--feedback-only');
    if (!sound) args.push('--no-sound');
    if (dryRun) args.push('--dry-run');
    if (diagnostics) args.push('--diagnostics');
    if (audioFile) args.push('--recognize-file', audioFile);
    if (thread) args.push('--target-session', thread);
    launcher = spawn('/usr/bin/open', args, { stdio: 'ignore' });
    launcher.once('error', rejectConnection);
    launcher.once('close', async (code, signal) => {
      const details = await readFile(errorPath, 'utf8').catch(() => '');
      const message = `음성 도우미 종료 (${signal ?? code})${details ? `: ${details.trim()}` : ''}`;
      if (!socket) rejectConnection(new Error(message));
      else session.emit('close', code, signal);
      await cleanup();
    });
    return await connected;
  } catch (error) {
    session.stop();
    await cleanup();
    throw error;
  }
}

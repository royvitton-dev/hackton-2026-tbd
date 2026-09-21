import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, copyFile, readdir, open, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const generatedPaths = [
  'assets/wonder/assets', 'assets/wonder/model',
  'assets/wonder/park-source', 'assets/wonder/demo', 'assets/wonder/park-catalog.json',
  'assets/wonder/park-reference.png', 'assets/wonder/original-score.wav', 'assets/wonder/soundtrack.wav',
  'output/wonder', 'output/wonder-park-30s.mp4', 'output/vitalis-hackathon-30s.mp4',
];
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function atomicJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, file);
}

export async function acquireLock(file) {
  await mkdir(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const handle = await open(file, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      await handle.close();
      return async () => {
        const owner = JSON.parse(await readFile(file, 'utf8'));
        if (owner.pid === process.pid) await unlink(file);
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = JSON.parse(await readFile(file, 'utf8')); }
      catch { return null; } // A writer may still be filling its newly created lock.
      try { process.kill(owner.pid, 0); return null; }
      catch (failure) {
        if (failure.code !== 'ESRCH') return null;
        await unlink(file).catch(e => { if (e.code !== 'ENOENT') throw e; });
      }
    }
  }
  return null;
}

async function filesWithin(root, relative) {
  const base = path.join(root, relative);
  try {
    const items = await readdir(base, { withFileTypes: true });
    const files = [];
    for (const item of items) {
      const child = path.join(relative, item.name);
      if (item.isDirectory()) files.push(...await filesWithin(root, child));
      else if (item.isFile()) files.push(child);
    }
    return files;
  } catch (error) {
    if (error.code === 'ENOTDIR') return [relative];
    throw error;
  }
}

export async function validateCandidate(stage) {
  const [video, check, rendering, media, cinema] = await Promise.all([
    readFile(path.join(stage, 'output/wonder-park-30s.mp4')),
    ...['playback-check', 'render-check', 'media-check', 'cinema-link'].map(name =>
      readFile(path.join(stage, `output/wonder/${name}.json`), 'utf8').then(JSON.parse)),
  ]);
  const hash = sha256(video);
  if (check.sha256 !== hash || check.media?.duration !== 30 || check.media?.width !== 1920 ||
      check.media?.height !== 1080 || check.browserErrors?.length !== 0 || !check.playbackAdvances ||
      rendering.frames !== 900 || rendering.browserErrors?.length !== 0 || media.fullDecode !== 'passed' ||
      cinema.sha256 !== hash || !cinema.identical ||
      sha256(await readFile(path.join(stage, 'output/vitalis-hackathon-30s.mp4'))) !== hash) {
    throw new Error('Candidate video did not pass complete validation. Existing film is unchanged.');
  }
  return { sha256: hash, bytes: video.length };
}

export async function publishCandidate(stage, movieRoot) {
  const validated = await validateCandidate(stage);
  const files = [];
  for (const relative of generatedPaths) files.push(...await filesWithin(stage, relative));
  // Prepare every copy first. Only complete files are ever renamed onto public paths.
  const pending = [];
  try {
    for (const relative of files) {
      const destination = path.join(movieRoot, relative);
      await mkdir(path.dirname(destination), { recursive: true });
      const temporary = `${destination}.${randomUUID()}.tmp`;
      await copyFile(path.join(stage, relative), temporary);
      pending.push({ temporary, destination });
    }
    for (const { temporary, destination } of pending) await rename(temporary, destination);
  } finally {
    await Promise.all(pending.map(p => unlink(p.temporary).catch(e => { if (e.code !== 'ENOENT') throw e; })));
  }
  return { ...validated, files: files.length };
}

export async function commitGenerated(repoRoot, movieRelative, runId) {
  const paths = generatedPaths.map(relative => path.join(movieRelative, relative));
  const git = async (...args) => {
    for (let attempt = 0; ; attempt++) {
      try { return await exec('git', ['-C', repoRoot, ...args], { maxBuffer: 4 * 1024 * 1024 }); }
      catch (error) {
        if (attempt >= 7 || !/index.*lock.*File exists|Unable to create.*lock/is.test(error.stderr || '')) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  };
  await git('add', '--', ...paths);
  const { stdout } = await git('diff', '--cached', '--name-only', '--', ...paths);
  if (!stdout.trim()) return null;
  await git('commit', '--quiet', '--only', '-m', `Refresh Wonder Park film (${runId})`, '--', ...paths);
  // HEAD may advance again in this shared repository; find the exact commit by its unique subject.
  const result = await git('log', '-1', '--format=%H', '--fixed-strings', `--grep=Refresh Wonder Park film (${runId})`);
  return result.stdout.trim();
}

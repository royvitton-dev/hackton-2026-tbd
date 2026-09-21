import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { acquireLock, commitGenerated, generatedPaths, publishCandidate, sha256 } from '../scripts/hourly-lib.mjs';
import { bundleModel } from '../scripts/bundle-model.mjs';

async function temporary(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wonder-hourly-test-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function put(root, file, contents) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), typeof contents === 'string' ? contents : JSON.stringify(contents));
}
async function candidate(root) {
  for (const relative of generatedPaths) {
    if (path.extname(relative)) await put(root, relative, 'new content');
    else await put(root, path.join(relative, 'sample.txt'), 'new content');
  }
  const hash = sha256('new content');
  await put(root, 'output/wonder/playback-check.json', {sha256:hash,media:{duration:30,width:1920,height:1080},browserErrors:[],playbackAdvances:true});
  await put(root, 'output/wonder/render-check.json', {frames:900,browserErrors:[]});
  await put(root, 'output/wonder/media-check.json', {fullDecode:'passed'});
  await put(root, 'output/wonder/cinema-link.json', {sha256:hash,identical:true});
}

test('a mismatched validated hash preserves the currently playing video', () => temporary(async root => {
  const stage=path.join(root,'candidate'),publicRoot=path.join(root,'public');
  await candidate(stage);await put(publicRoot,'output/wonder-park-30s.mp4','last good film');
  await put(stage,'output/wonder-park-30s.mp4','truncated or changed video');
  await assert.rejects(publishCandidate(stage,publicRoot),/complete validation/);
  assert.equal(await readFile(path.join(publicRoot,'output/wonder-park-30s.mp4'),'utf8'),'last good film');
}));

test('validated video replaces both public paths and leaves no partial temporary files', () => temporary(async root => {
  const stage=path.join(root,'candidate'),publicRoot=path.join(root,'public');await candidate(stage);
  const report=await publishCandidate(stage,publicRoot);
  assert.equal(report.sha256,sha256('new content'));
  assert.equal(await readFile(path.join(publicRoot,'output/wonder-park-30s.mp4'),'utf8'),'new content');
  assert.equal(await readFile(path.join(publicRoot,'output/vitalis-hackathon-30s.mp4'),'utf8'),'new content');
}));

test('overlapping jobs do not acquire the same rendering lock', () => temporary(async root => {
  const file=path.join(root,'render.lock'),release=await acquireLock(file);
  assert.equal(await acquireLock(file),null);await release();
  const next=await acquireLock(file);assert.equal(typeof next,'function');await next();
}));

test('model bundling embeds newly added landmark image imports', () => temporary(async root => {
  const source='assets/wonder/park-source';
  await put(root,`${source}/castle.js`,"export const createCastle = () => 'castle';");
  await put(root,`${source}/landscape.js`,"import logo from '../assets/logo.png'; export const createLandscape = () => logo;");
  await put(root,`${source}/attractions.js`,"export const createAttraction = () => 'ride';");
  await put(root,`${source}/materials.js`,"export const staticBatch = () => {};");
  await put(root,'assets/wonder/assets/logo.png','fixture image');
  await bundleModel(root);
  const code=await readFile(path.join(root,'assets/wonder/model/park-model.js'),'utf8');
  assert.match(code,/data:image\/png(?:;base64)?,/);
  assert.doesNotMatch(code,/import logo from/);
}));

test('automatic commit excludes unrelated staged changes and preserves their staged state', () => temporary(async root => {
  const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
  git('init','--quiet');git('config','user.name','Hourly Test');git('config','user.email','test@example.invalid');
  await candidate(path.join(root,'movie'));await put(root,'other.txt','initial');await put(root,'movie/film.js','original source');
  git('add','.');git('-c','core.hooksPath=/dev/null','commit','--quiet','-m','baseline');
  await put(root,'other.txt','unrelated staged work');await put(root,'movie/film.js','unrelated movie source edit');
  git('add','other.txt','movie/film.js');await put(root,'movie/output/wonder-park-30s.mp4','updated output');
  const commit=await commitGenerated(root,'movie','test-run');assert(commit);
  assert.equal(git('show','--format=','--name-only',commit),'movie/output/wonder-park-30s.mp4');
  assert.equal(git('diff','--cached','--name-only'),'movie/film.js\nother.txt');
}));

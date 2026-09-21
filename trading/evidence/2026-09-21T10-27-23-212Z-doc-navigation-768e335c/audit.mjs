import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = process.cwd();
if (path.basename(root) !== 'trading') throw new Error('Run from trading');
const output = path.dirname(fileURLToPath(import.meta.url));
const repository = path.dirname(root);
const relative = file => path.relative(repository, file).replaceAll('\\', '/');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.md') ? [path.join(dir, entry.name)] : []);
const docs = [path.join(root, 'README.md'), ...walk(path.join(root, 'docs'))];
const evidenceDirectories = fs.readdirSync(path.join(root, 'evidence'), { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name);
const links = [], references = [], commands = [];
for (const file of docs) {
  const content = fs.readFileSync(file, 'utf8');
  const contextRuns = evidenceDirectories.filter(name => content.includes(name)).flatMap(name => ['', 'browser', 'before', 'after'].map(suffix => path.join(root, 'evidence', name, suffix)));
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, '').split(/\s+["']/)[0];
      if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
      const pathname = decodeURIComponent(target.split('#')[0]);
      const resolved = path.resolve(path.dirname(file), pathname);
      links.push({ document: relative(file), line: index + 1, target, resolved: relative(resolved), exists: fs.existsSync(resolved), kind: fs.existsSync(resolved) ? fs.statSync(resolved).isDirectory() ? 'directory' : 'file' : 'missing' });
    }
    for (const match of line.matchAll(/`([^`\r\n]+)`/g)) {
      const value = match[1];
      if (/\s/.test(value) || !/(?:[\\/]|\.(?:md|mjs|ps1|json|jsonl|rs|tsx?|ya?ml|toml|log|bin)$)/i.test(value) || /^(?:https?:|wss?:|\/api|\/health|\/ws|\/assets|\/@vite|\/src|#)/.test(value)) continue;
      if (/[<>*{}]/.test(value)) { references.push({ document: relative(file), line: index + 1, target: value, kind: 'template_or_glob' }); continue; }
      const candidate = value.replaceAll('\\', '/').replace(/:\d+(?:[–-]\d+)?$/, '');
      const roots = [path.dirname(file), root, path.join(root, 'frontend'), repository, ...['scripts', 'frontend/src', 'engine/src', 'engine/examples', 'engine/tests', 'engine/tests/fixtures', 'engine', 'data/demo'].map(dir => path.join(root, dir)), ...contextRuns];
      const candidates = [...new Set(roots.map(base => path.resolve(base, candidate)))];
      const existing = candidates.filter(item => fs.existsSync(item));
      references.push({ document: relative(file), line: index + 1, target: value, kind: existing.length ? 'resolved' : 'needs_context_review', resolved: existing.map(relative) });
    }
    if (/(?:node\s+[^`]*scripts[\\/]|\.ps1\b|\bcargo\s|\bpnpm\s)/.test(line)) commands.push(`${relative(file)}:${index + 1}: ${line}`);
  });
}
const paths = [...new Set(links.map(item => item.resolved).concat(references.flatMap(item => item.resolved || [])))].filter(item => item && !item.startsWith('../') && !path.isAbsolute(item));
const ignoredResult = spawnSync('git', ['check-ignore', '-z', '--stdin'], { cwd: repository, encoding: 'utf8', input: paths.join('\0') + '\0' });
if (![0, 1].includes(ignoredResult.status)) throw new Error(ignoredResult.stderr);
const ignored = new Set(ignoredResult.stdout.split('\0').filter(Boolean));
const tracked = new Set(execFileSync('git', ['ls-files', '-z'], { cwd: repository, encoding: 'utf8' }).split('\0').filter(Boolean));
for (const link of links) link.source_control = ignored.has(link.resolved) ? 'ignored_local_runtime' : tracked.has(link.resolved) ? 'tracked' : link.kind === 'directory' ? 'directory' : 'not_tracked';
for (const ref of references) if (ref.resolved) ref.source_control = ref.resolved.map(item => ({ path: item, state: ignored.has(item) ? 'ignored_local_runtime' : tracked.has(item) ? 'tracked' : fs.statSync(path.join(repository, item)).isDirectory() ? 'directory' : 'not_tracked' }));
const report = { recorded_at: new Date().toISOString(), scope: docs.map(relative), document_sha256: Object.fromEntries(docs.map(file => [relative(file), createHash('sha256').update(fs.readFileSync(file)).digest('hex')])), excludes: ['Historical evidence Markdown content', 'External URLs', 'Service/process/API execution', 'Builds/tests'], counts: { documents: docs.length, markdown_local_links: links.length, missing_links: links.filter(item => !item.exists).length, ignored_existing_links: links.filter(item => item.exists && item.source_control === 'ignored_local_runtime').length, untracked_existing_link_targets: new Set(links.filter(item => item.exists && item.source_control === 'not_tracked').map(item => item.resolved)).size, ignored_inline_reference_targets: new Set(references.flatMap(item => item.source_control || []).filter(item => item.state === 'ignored_local_runtime').map(item => item.path)).size }, links };
fs.writeFileSync(path.join(output, 'link-audit.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(output, 'reference-candidates.json'), JSON.stringify(references, null, 2));
fs.writeFileSync(path.join(output, 'commands.txt'), commands.join('\n'));
console.log(JSON.stringify({ ...report.counts, missing: links.filter(item => !item.exists), contextual_reference_candidates: references.filter(item => item.kind === 'needs_context_review').length }, null, 2));

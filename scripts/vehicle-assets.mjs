import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const resource = path.join(root, 'battery_health/resoures/images');
export const publicRoot = path.join(root, 'public/assets/vehicles');
export const manifestPath = path.join(resource, 'image_sources.json');
export const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
export const writeJson = async (p, value) => writeFile(p, JSON.stringify(value, null, 2) + '\n');
export async function directories() {
  for (const p of [resource, publicRoot, ...['originals', 'cutouts', 'sources', 'models'].map(x => path.join(resource, x)), ...['cutouts', 'models'].map(x => path.join(publicRoot, x))]) await mkdir(p, { recursive: true });
}
export function recordFailure(entry, stage, error, url) {
  const message = String(error?.message ?? error);
  entry.failureReason = `${stage}: ${message}`;
  entry.failures ??= [];
  entry.failures.push({ stage, url, message, at: new Date().toISOString(), nextAction: stage === 'download' ? 'Verify source URL/network and rerun download:vehicles.' : 'Install rembg / inspect source and rerun cutout:vehicles.' });
  console.error(`${entry.manufacturer} ${entry.model}: ${entry.failureReason}`);
}
export const userAgent = 'EVBatteryViewer/1.0 (local educational prototype; Wikimedia Commons attribution retained)';
export async function fetchChecked(url) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}: ${url}`);
  return response;
}

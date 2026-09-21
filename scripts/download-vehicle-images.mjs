import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { directories, root, manifestPath, readJson, writeJson, recordFailure, fetchChecked } from './vehicle-assets.mjs';
await directories();
const entries = await readJson(manifestPath);
const processed = new Map();
for (const entry of entries) {
  if (processed.has(entry.fileName)) { Object.assign(entry, processed.get(entry.fileName)); continue; }
  try {
    const dest = path.join(root, entry.resourceOriginalPath);
    let cached = false;
    try { const m = await sharp(await readFile(dest)).metadata(); cached = m.format==='jpeg' && m.width>=500; } catch {}
    if (!cached || !entry.downloaded || process.argv.includes('--force')) {
      const response = await fetchChecked(entry.downloadUrl);
      const bytes = Buffer.from(await response.arrayBuffer());
      const meta = await sharp(bytes).metadata();
      if (!meta.width || meta.width<500) throw Error('Source image too small or invalid');
      await writeFile(dest, await sharp(bytes).rotate().resize({width:1600,withoutEnlargement:true}).jpeg({quality:94}).toBuffer());
      cached=false;
      await new Promise(resolve=>setTimeout(resolve,1500));
    }
    entry.downloaded = true; entry.failureReason = null;
    console.log(`OK ${entry.fileName}${cached?' (validated cache)':''}`);
  } catch (error) { entry.downloaded=false; recordFailure(entry,'download',error,entry.downloadUrl); }
  processed.set(entry.fileName,{downloaded:entry.downloaded,failureReason:entry.failureReason,failures:entry.failures});
  await writeJson(manifestPath, entries);
}
await writeJson(manifestPath,entries);
if (entries.some(e=>!e.downloaded)) process.exitCode=1;

// Preserve a user-provided source verbatim; generate the normalized JPEG used by the pipeline.
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { directories, root, resource, manifestPath, readJson, writeJson } from './vehicle-assets.mjs';

const [vehicleId, input, note] = process.argv.slice(2);
if (!vehicleId || !input || !note) throw new Error('Usage: node scripts/import-vehicle-image.mjs vehicleId input "representative note"');
const entries = await readJson(manifestPath);
const entry = entries.find(e => e.vehicleId === vehicleId);
if (!entry) throw new Error(`Unknown workbook vehicle: ${vehicleId}`);
const bytes = await readFile(input);
const sourceHash = createHash('sha256').update(bytes).digest('hex');
const metadata = await sharp(bytes).metadata();
if (!metadata.width || metadata.width < 500) throw new Error('Image must be at least 500 pixels wide');
await directories();
const sourceName = `${vehicleId}_user_${sourceHash.slice(0,12)}.${metadata.format === 'jpeg' ? 'jpg' : metadata.format}`;
const sourcePath = path.join(resource, 'sources', sourceName);
await copyFile(input, sourcePath);
const jpeg = await sharp(bytes).rotate().resize({ width: 2400, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 94 }).toBuffer();
await writeFile(path.join(root, entry.resourceOriginalPath), jpeg);
entry.sourceHistory ??= [];
if (entry.sourceFileSha256 !== sourceHash) {
  entry.sourceHistory.push({ ...Object.fromEntries(['sourceUrl','downloadUrl','originalDownloadUrl','license','licenseUrl','author','sourceTitle','sourceDate','representativeNote','cutoutSourceSha256','resourceSourcePath','sourceFileSha256'].map(key => [key,entry[key]])), replacedOn: new Date().toISOString(), reason: 'User supplied a replacement vehicle image.' });
  delete entry.cutoutMaskCorrectionsPath;
  delete entry.cutoutAlphaMode;
}
Object.assign(entry, {
  sourceKind: 'user-upload', resourceSourcePath: path.relative(root, sourcePath),
  sourceFileSha256: sourceHash,
  sourceHasAlpha: metadata.hasAlpha ?? false,
  sourceUrl: `user-upload:${path.basename(input)}`, downloadUrl: `local:${path.relative(root, sourcePath)}`,
  originalDownloadUrl: null, licenseUrl: null,
  license: 'User-provided file; original author and redistribution license not supplied. No open license asserted.',
  author: 'Original author not supplied', sourceTitle: path.basename(input),
  sourceDate: new Date().toISOString().slice(0,10), representativeNote: note,
  modifications: 'Source file preserved verbatim; JPEG normalization. Source alpha is preserved when available; otherwise rembg removes the background.',
  downloaded: true, cutoutGenerated: false, failureReason: 'Replacement imported; cutout generation pending.',
});
delete entry.cutoutSourceSha256;
delete entry.cutoutSha256;
await writeJson(manifestPath, entries);
console.log(`Imported ${vehicleId}: ${metadata.width}x${metadata.height}, alpha=${metadata.hasAlpha ?? false}. Run cutout:vehicles, sync:vehicle-assets, verify:assets.`);

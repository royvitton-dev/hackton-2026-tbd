import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

export async function applySourceUpgrades(catalog,publicDir){
 let records;try{records=JSON.parse(await readFile(path.join(publicDir,'sources/resolution-upgrades.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return catalog;throw error;}
 for(const record of records.upgrades){
  const site=catalog.find(s=>s.id===record.id);if(!site||site.source!==record.publisherPage)continue;
  const asset=record.asset;
  if(!/^sources\/high-resolution\/[\w-]+\.(jpg|png|webp)$/.test(asset.file))throw Error('Unexpected upgraded source path');
  const bytes=await readFile(path.join(publicDir,asset.file));
  if(createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Upgraded source hash mismatch: '+record.id);
  site.previewAsset=site.previewAsset||site.sourceAsset;
  site.sourceAsset={...site.sourceAsset,...asset};
  site.sourceResolution={method:'publisher-declared-srcset',publisherPage:record.publisherPage,inspectedAt:record.inspectedAt,pageSha256:record.pageSha256,previous:record.previous,selectedWidth:asset.width,selectedHeight:asset.height};
 }
 return catalog;
}

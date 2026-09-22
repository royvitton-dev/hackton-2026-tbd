import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import {publisherDrawings,assetIdentity} from './address-drawing-parser.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)), publicDir=path.join(root,'public');
const cache=path.join(root,'.runtime/address-expansion/pages'), out=path.join(publicDir,'address/drawings');
await mkdir(cache,{recursive:true});await mkdir(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalog=JSON.parse(await readFile(path.join(publicDir,'sources/catalog.json'),'utf8'));
const previous=JSON.parse(await readFile(path.join(out,'catalog.json'),'utf8').catch(()=>'{}'));
const reviews=JSON.parse(await readFile(new URL('./address-drawing-reviews.json',import.meta.url),'utf8')).reviews;
const places=[...new Map(catalog.map(s=>[s.siteId,s])).values()];
const records=[],checks=[],failures=[],excluded=[];
const known=new Set(catalog.map(s=>s.sourceAsset?.url).filter(Boolean).map(assetIdentity));
async function get(url) {
  const response=await fetch(url,{signal:AbortSignal.timeout(35000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  if(Number(response.headers.get('content-length'))>25e6)throw Error('Source exceeds 25 MB');
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>25e6)throw Error('Source exceeds 25 MB');return bytes;
}
for(const place of places) {
  if(!/https:\/\/(soco.seoul.go.kr|magazine.brique.co)\//.test(place.source))continue;
  try {
    const file=path.join(cache,place.siteId+'.html');
    let page=await readFile(file).catch(()=>null);
    if(!page||process.argv.includes('--refresh')){page=await get(place.source);await writeFile(file,page);}
    const drawings=publisherDrawings(page.toString('utf8'),place.source);
    const missing=drawings.filter(d=>!known.has(d.identity));let added=0;
    for(const drawing of missing) {
      const id=place.siteId+'-'+sha(drawing.identity).slice(0,12);
      const review=reviews[id];
      if(review?.exclude){excluded.push({id,siteId:place.siteId,url:drawing.url,reason:review.reason});continue;}
      const reviewed=review?{...drawing,kind:review.kind||drawing.kind,label:review.label||drawing.label}:drawing;
      const old=previous.drawings?.find(d=>d.id===id);
      if(old){const bytes=await readFile(path.join(publicDir,old.file)).catch(()=>null);if(bytes&&sha(bytes)===old.sha256){records.push({...old,kind:reviewed.kind,label:reviewed.label,...(review?{reviewNote:review.reason}:{})});added++;continue;}}
      try {
        const bytes=await get(drawing.url),meta=await sharp(bytes).metadata();
        if(!['jpeg','png','webp','gif'].includes(meta.format)||meta.width*meta.height>32e6)throw Error('Unsupported image');
        const duplicate=catalog.some(s=>s.sourceAsset?.sha256===sha(bytes))||records.some(d=>d.siteId===place.siteId&&d.sha256===sha(bytes));
        if(duplicate)continue;
        const extension=meta.format==='jpeg'?'jpg':meta.format,assetFile=`address/drawings/${id}.${extension}`;
        await writeFile(path.join(publicDir,assetFile),bytes);
        const thumbnail=`address/drawings/${id}-thumb.webp`;
        await sharp(bytes).resize({width:480,height:360,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toFile(path.join(publicDir,thumbnail));
        records.push({id,siteId:place.siteId,name:place.name.replace(/ · (도면 \d+|[B\d]+F).*$/,''),address:place.address,source:place.source,publisher:place.publisher|| (place.source.includes('soco.seoul')?'서울특별시 공동체주택 플랫폼':'브리크 매거진'),label:reviewed.label,kind:reviewed.kind,credit:drawing.credit,url:drawing.url,file:assetFile,thumbnail,width:meta.width,height:meta.height,sha256:sha(bytes),bytes:bytes.length,pageSha256:sha(page),acquiredAt:new Date().toISOString(),scaleStatus:'uncalibrated',status:'publisher-drawing',...(review?{reviewNote:review.reason}:{})});added++;
      } catch(error){failures.push({siteId:place.siteId,url:drawing.url,error:error.message});}
      await new Promise(resolve=>setTimeout(resolve,180));
    }
    checks.push({siteId:place.siteId,source:place.source,publishedDrawings:drawings.length,existing:drawings.length-missing.length,added,pageSha256:sha(page),status:'checked'});
    console.log(`${place.siteId}: ${drawings.length} published, ${added} added`);
  }catch(error){
    failures.push({siteId:place.siteId,source:place.source,error:error.message});
    // A publisher outage must not remove already acquired drawings.
    for(const old of previous.drawings||[])if(old.siteId===place.siteId&&!old.sourcePage&&!records.some(d=>d.id===old.id)&&!reviews[old.id]?.exclude)records.push(old);
  }
}
// PDF page assets are managed by address-pdf-drawings.mjs and retained on HTML refresh.
records.push(...(previous.drawings||[]).filter(d=>d.sourcePage));
const result={version:1,acquiredAt:new Date().toISOString(),method:'uncapped-publisher-figures; existing URL/byte deduplication; visually reviewed classifications',rights:'발행처와 저작자 표기를 보존한 공개 도면 참고 자료. 치수 검증·재배포 허가를 뜻하지 않습니다.',summary:{checkedPlaces:checks.length,additionalDrawings:records.length,additionalPlaces:new Set(records.map(d=>d.siteId)).size,failures:failures.length},drawings:records,checks,excluded,failures};
await writeFile(path.join(out,'catalog.json.tmp'),JSON.stringify(result,null,2)+'\n');
await rename(path.join(out,'catalog.json.tmp'),path.join(out,'catalog.json'));
console.log(JSON.stringify(result.summary));if(failures.length)process.exitCode=1;

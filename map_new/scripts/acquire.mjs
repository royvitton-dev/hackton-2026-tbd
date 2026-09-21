import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),previous=path.resolve(root,'../map/public');
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalog=JSON.parse(await readFile(path.join(previous,'plans/catalog.json'))),locations=JSON.parse(await readFile(path.join(previous,'plans/locations.json')));
const output=[];
await mkdir(path.join(root,'public/sources'),{recursive:true});
const typeOf=site=>site.id==='parking-168780'?'parking':site.id==='parking-68790'?'library':site.id==='parking-140714'?'religious':site.id==='parking-65955'?'cultural':site.id==='parking-131601'||site.id==='multilevel-dogok'?'public':site.id.startsWith('complex-')||/공동|주택마을|소행주|코이노니아|예가/.test(site.name)?'apartment':/녹틸럭스|스튜디오|논현 109|이오스|카페|포뮬리에/.test(site.name)?'building':'house';
const preferred=['10000901','20000555','10002143','parking-159344','multilevel-dogok'];
const ordered=[...preferred.map(id=>catalog.find(s=>s.id===id)),...catalog.filter(s=>!preferred.includes(s.id))];
for(const site of ordered){
  const {id}=site;
  for(const [i,a] of site.assets.entries()){
    const bytes=await readFile(path.join(previous,a.file.slice(1)));
    if(hash(bytes)!==a.sha256)throw Error(`${id}: original hash mismatch`);
    const file=`sources/${id}-${i}${path.extname(a.file)}`;
    await writeFile(path.join(root,'public',file),bytes);
    const floor=a.floor||a.label?.match(/지하\s*(\d)층/)?.[1]&&`B${a.label.match(/지하\s*(\d)층/)[1]}`||a.label?.match(/지상\s*(\d)층/)?.[1]&&`${a.label.match(/지상\s*(\d)층/)[1]}F`;
    output.push({id:`${id}-${i}`,siteId:id,name:site.name+(floor?` · ${floor}`:site.assets.length>1?` · 도면 ${i+1}`:''),address:site.address,acquiredAt:site.acquiredAt,buildingType:typeOf(site),source:site.source,publisher:site.publisher,sourceAsset:{...a,file,bytes:bytes.length,...(floor?{floor}:{})},location:locations[id]||null,parkingEvidence:site.parkingEvidence||null,scaleStatus:'estimated',metersAcross:id==='multilevel-dogok'?90:id==='parking-168780'?905*8.75/64:id==='parking-131601'?70:40});
  }
}
for(const name of ['changdong-parking-b2.png','changdong-parking-annotated.svg','changdong-parking-source.pdf'])await copyFile(path.join(previous,'plans',name),path.join(root,'public/sources',name));
const b2=await readFile(path.join(root,'public/sources/changdong-parking-b2.png'));
const b2pdf=await readFile(path.join(root,'public/sources/changdong-parking-source.pdf'));
output.unshift({id:'changdong-b2',siteId:'changdong',sourceDocument:{file:'sources/changdong-parking-source.pdf',sha256:hash(b2pdf),bytes:b2pdf.length},acquiredAt:(await stat(path.join(previous,'plans/changdong-parking-source.pdf'))).mtime.toISOString(),name:'동북권 복합시설 · B2 주차장',address:'서울특별시 도봉구 창동 · 공개 계획도',buildingType:'public',publisher:'서울특별시',source:'https://mediahub.seoul.go.kr/wp-content/uploads/2020/03/ff42c687eb729c49cb070336a85c9abc.pdf#page=16',sourceAsset:{file:'sources/changdong-parking-b2.png',sha256:hash(b2),bytes:b2.length,sourcePage:16},annotation:'sources/changdong-parking-annotated.svg',scaleStatus:'estimated',parkingEvidence:{floor:'B2',note:'공개 PDF 16쪽 주차장 평면도. 차로·코어는 분석자가 수동 주석; 축척 추정.',currentFacilityStatus:'not-surveyed'},location:null});
// Restore the publicly supplied photo and Naver-location source when requested.
const photoUrl='https://soco.seoul.go.kr/cohome/cmmn/file/fileDown.do?atchFileId=D5D1F9CA6408ABDDE050007F01002F05&fileSn=15';
const pageUrl=catalog.find(s=>s.id==='10000901').source;
await mkdir(path.join(root,'public/photos'),{recursive:true});
await mkdir(path.join(root,'.runtime'),{recursive:true});
for(const [file,url] of [['photos/neonadeuli-exterior.jpg',photoUrl],['../.runtime/neonadeuli-page.html',pageUrl]]){
  try{await readFile(path.join(root,'public',file));}catch{
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`HTTP ${response.status}`);
    await writeFile(path.join(root,'public',file),Buffer.from(await response.arrayBuffer()));
  }
}
const photo=await readFile(path.join(root,'public/photos/neonadeuli-exterior.jpg'));
if(photo[0]!==255||photo[1]!==216)throw Error('Photo response is not JPEG');
const page=await readFile(path.join(root,'.runtime/neonadeuli-page.html'),'utf8');
const point=page.match(/new naver\.maps\.Point\('([\d.]+)',\s*'([\d.]+)'\)/);
if(!point)throw Error('Naver location is missing in the publisher page');
await writeFile(path.join(root,'public/sources/neonadeuli-location.json'),JSON.stringify({source:pageUrl,sourcePageSha256:hash(page),method:'publisher-embedded-naver.maps.Point',coordinate:{lat:Number(point[2]),lng:Number(point[1])},residentialFloors:[2,3,4,5],floorEvidence:'Public occupancy table: 201–506, 24 units'},null,2)+'\n');
const neon=output.find(s=>s.siteId==='10000901');
neon.location={lat:Number(point[2]),lng:Number(point[1]),precision:'publisher-naver-point',source:pageUrl,independentCheck:locations['10000901']};
neon.photo={file:'photos/neonadeuli-exterior.jpg',url:photoUrl,sha256:hash(photo),bytes:photo.length,publisher:neon.publisher,source:pageUrl,acquiredAt:(await stat(path.join(root,'public/photos/neonadeuli-exterior.jpg'))).birthtime.toISOString(),rights:'서울시 공개 게시 사진. 별도 자유 재배포 라이선스 확인되지 않음.',review:'외관 직접 검토: 흰색 상부, 회색 하부, 어두운 기단, 검은 난간, 노란색 입면 부분. 공개 입주표 2–5층의 4개 주거층을 반영한 개념 재구성; 실측 아님.',facade:{residentialFloors:4,baseHeight:4,floorHeight:2.8,upper:'#d5d4c3',lower:'#939292',base:'#41494a',accent:'#dbbd42',rail:'#303939'}};
for(const extra of ['parks-catalog.json','precise-locations.json']){
  let data;try{data=JSON.parse(await readFile(path.join(root,'public/sources',extra)));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  if(extra==='parks-catalog.json')output.push(...data);else for(const site of output)if(data[site.siteId])site.location={...data[site.siteId],independentCheck:site.location};
}
await writeFile(path.join(root,'public/sources/catalog.json'),JSON.stringify(output,null,2)+'\n');
console.log(`Verified ${output.length} source drawings and 1 exterior photograph in map_new/`);

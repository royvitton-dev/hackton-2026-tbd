import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCanvas} from '../../map/node_modules/@napi-rs/canvas/index.js';
import {getDocument} from '../../map/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
const publicRoot=new URL('../public/',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await readFile(new URL('sources/changdong-parking-source.pdf',publicRoot));
const catalog=JSON.parse(await readFile(new URL('address/drawings/catalog.json',publicRoot),'utf8'));
const documentTask=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,disableFontFace:true}),pdf=await documentTask.promise;
const pages=[{page:15,label:'공공시설 배치도',kind:'site'},{page:17,label:'지하 1층 평면도',kind:'floor'},{page:18,label:'지상 1층 평면도',kind:'floor'},{page:19,label:'지상 2층 평면도',kind:'floor'},{page:20,label:'지상 3층 평면도',kind:'floor'},{page:21,label:'지상 4·5층 평면도',kind:'floor'}];
const source='https://mediahub.seoul.go.kr/wp-content/uploads/2020/03/ff42c687eb729c49cb070336a85c9abc.pdf';
for(const item of pages){
  const page=await pdf.getPage(item.page),viewport=page.getViewport({scale:3}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
  const output=canvas.toBuffer('image/png'),id='changdong-pdf-'+item.page,file=`address/drawings/${id}.png`,thumbnail=`address/drawings/${id}-thumb.webp`;
  await writeFile(new URL(file,publicRoot),output);await sharp(output).resize({width:480,height:360,fit:'inside'}).webp({quality:85}).toFile(new URL(thumbnail,publicRoot).pathname);
  const record={id,siteId:'changdong',name:'동북권 세대융합형 복합시설',address:'서울특별시 도봉구 창동 · 공개 계획도',label:item.label,kind:item.kind,source:source+'#page='+item.page,url:source,sourcePage:item.page,publisher:'서울특별시 · 내 손안에 서울',file,thumbnail,width:canvas.width,height:canvas.height,sha256:sha(output),bytes:output.length,sourcePdfSha256:sha(bytes),acquiredAt:new Date().toISOString(),scaleStatus:'uncalibrated',status:'publisher-drawing',reviewNote:'공개 계획 PDF의 해당 페이지 전체를 렌더링. 준공도면 아님.'};
  catalog.drawings=catalog.drawings.filter(d=>d.id!==id);catalog.drawings.push(record);console.log(id,item.label);
}
await documentTask.destroy();
catalog.summary.additionalDrawings=catalog.drawings.length;catalog.summary.additionalPlaces=new Set(catalog.drawings.map(d=>d.siteId)).size;
await writeFile(new URL('address/drawings/catalog.json',publicRoot),JSON.stringify(catalog,null,2)+'\n');

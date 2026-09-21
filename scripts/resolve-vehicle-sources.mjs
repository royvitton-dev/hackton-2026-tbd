import path from 'node:path';
import { directories, resource, root, readJson, writeJson, fetchChecked, manifestPath } from './vehicle-assets.mjs';
await directories();
const { vehicles } = await readJson(path.join(root, 'src/data/battery/workbook.json'));
const candidates = await readJson(path.join(resource, 'sources/candidates.json'));
const selected = {
  'Ioniq 6': '2023 Hyundai Ioniq 6 Limited, front 4.27.23.jpg',
  'ID.4': '2021 Volkswagen ID.4 City Front.jpg',
  'Kona Electric': 'Hyundai KONA Lounge (ZAA-SX2LRG) front.jpg',
  'Casper Electric': '2024 Hyundai Casper Electric front view.png',
  'EV3': 'Kia EV3 Auto Zuerich 2024 DSC 6599.jpg',
  'EV6': '2022 Kia EV6 Air Long Range 2WD (Front).jpg',
  'EV9': '2024 Kia EV9, front 11.15.24.jpg',
  'Niro EV': '2023 KIA Niro 3 EV - 68kWh (201PS) Electric - Infra Red - 04-2024, Front.jpg',
  'Model Y': '2025 Tesla Model Y Juniper Long Range RWD.jpg',
  'i5': 'BMW i5 eDrive40 M Sport (G60) front.jpg',
  'All-Electric MINI Cooper': 'BMW MINI COOPER SE (J01) front.jpg'
};
const wikiModels = {'Ioniq 5': 'Hyundai Ioniq 5', 'Model 3': 'Tesla Model 3', 'Q4 45 e-tron': 'Audi Q4 e-tron', 'Q6 e-tron': 'Audi Q6 e-tron', 'ID.4': 'Volkswagen ID.4', 'i5': 'BMW 5 Series (G60)', 'All-Electric MINI Cooper': 'Mini Cooper (J01)', 'EX30': 'Volvo EX30'};
const wikiUrl = new URL('https://en.wikipedia.org/w/api.php');
wikiUrl.search = new URLSearchParams({action:'query',format:'json',titles:Object.values(wikiModels).join('|'),prop:'pageimages',piprop:'name',redirects:'1'}).toString();
const wiki = await (await fetchChecked(wikiUrl)).json();
await writeJson(path.join(resource, 'sources/wikipedia-selection.json'), wiki);
for (const [model, title] of Object.entries(wikiModels)) {
  if (selected[model]) continue;
  const page = Object.values(wiki.query.pages).find(p => p.title === title);
  if (!page?.pageimage) throw Error(`No representative image for ${model}: ${title}`);
  selected[model] = page.pageimage;
}
const url = new URL('https://commons.wikimedia.org/w/api.php');
url.search = new URLSearchParams({action:'query',format:'json',titles:Object.values(selected).map(t=>'File:'+t).join('|'),prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1400'}).toString();
const data = await (await fetchChecked(url)).json();
await writeJson(path.join(resource,'sources/selected-metadata.json'), data);
const clean = v => String(v ?? '').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
const entries = vehicles.map(v => {
  const title = selected[v.modelName];
  const p = Object.values(data.query.pages).find(p => p.title.replaceAll('_',' ') === ('File:'+title).replaceAll('_',' '));
  if (!p?.imageinfo?.[0]) throw Error(`Metadata missing: ${title}`);
  const info = p.imageinfo[0], meta = info.extmetadata;
  const base = `${v.manufacturer}_${v.modelName}_${v.modelYear}`.toLowerCase().replace(/[^a-z0-9]+/g,'_');
  const previous = candidates.find(c=>c.model===v.modelName);
  return {
    vehicleId:v.vehicleId, manufacturer:v.manufacturer, model:v.modelName, year:v.modelYear,
    fileName:base+'.jpg',resourceOriginalPath:`battery_health/resoures/images/originals/${base}.jpg`,publicOriginalPath:`/assets/vehicles/${base}.jpg`,
    resourceCutoutPath:`battery_health/resoures/images/cutouts/${base}.png`,publicCutoutPath:`/assets/vehicles/cutouts/${base}.png`,
    sourceUrl:info.descriptionurl,downloadUrl:info.thumburl??info.url,originalDownloadUrl:info.url,
    license:clean(meta.LicenseShortName?.value),licenseUrl:clean(meta.LicenseUrl?.value),author:clean(meta.Artist?.value),
    sourceTitle:p.title,sourceDate:clean(meta.DateTimeOriginal?.value),
    representativeNote:'모델 대표 사진입니다. mock의 연식·트림·색상과 사진의 사양은 다를 수 있습니다. 원본 출처의 촬영일과 설명을 확인하세요.',
    modifications:'JPEG normalization/resizing; rembg background removal; transparent crop. Derivative retains source license.',
    downloaded:false,cutoutGenerated:false,failureReason:null,
    failures: previous?.failureReason ? [{stage:'source-search',url:previous.queryUrl,message:previous.failureReason,nextAction:'Resolved using batched source metadata query.'}] : []
  };
});
await writeJson(manifestPath,entries);
console.log(entries.map(x=>`${x.model}: ${x.sourceTitle}`).join('\n'));

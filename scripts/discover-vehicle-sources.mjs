// Optional source discovery; review candidate images before accepting a source.
import path from 'node:path';
import { directories, root, resource, readJson, writeJson, fetchChecked } from './vehicle-assets.mjs';
await directories();
const { vehicles } = await readJson(path.join(root, 'src/data/battery/workbook.json'));
const queries = {
  'Ioniq 5': 'Hyundai Ioniq 5 facelift front', 'Ioniq 6': 'Hyundai Ioniq 6 front',
  'Kona Electric': 'Hyundai Kona Electric SX2 front', 'Casper Electric': 'Hyundai Casper Electric front',
  'EV3': 'Kia EV3 front', 'EV6': 'Kia EV6 front', 'EV9': 'Kia EV9 front', 'Niro EV': 'Kia Niro EV SG2 front',
  'Model 3': 'Tesla Model 3 Highland front', 'Model Y': 'Tesla Model Y Juniper front',
  'Q4 45 e-tron': 'Audi Q4 e-tron front', 'Q6 e-tron': 'Audi Q6 e-tron front',
  'ID.4': 'Volkswagen ID.4 front', 'i5': 'BMW i5 front',
  'All-Electric MINI Cooper': 'Mini Cooper SE J01 front', 'EX30': 'Volvo EX30 front'
};
const candidates = [];
for (const [model, query] of Object.entries(queries)) {
  const vehicle = vehicles.find(v => v.modelName === model);
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '5', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1400' }).toString();
  try {
    const data = await (await fetchChecked(url)).json();
    await writeJson(path.join(resource, 'sources', `${vehicle.vehicleId}.json`), data);
    const pages = Object.values(data.query?.pages ?? {}).sort((a, b) => a.index - b.index);
    candidates.push({ model, queryUrl: url.toString(), candidates: pages.map(p => ({ title: p.title, ...p.imageinfo[0] })) });
    console.log(model, pages.map(p => p.title));
  } catch (error) {
    candidates.push({ model, queryUrl: url.toString(), failureReason: error.message, candidates: [] });
    console.error(model, error.message);
  }
}
await writeJson(path.join(resource, 'sources/candidates.json'), candidates);

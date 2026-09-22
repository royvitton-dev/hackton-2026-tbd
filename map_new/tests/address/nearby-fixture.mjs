// Never make automated pan/zoom tests fetch community-hosted map tiles.
import sharp from 'sharp';
export async function mockStreetTiles(page){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e3e9d9"/><path d="M0 55H256M0 180H256M55 0V256M190 0V256" stroke="#fafcf5" stroke-width="14"/><path d="M0 55H256M0 180H256M55 0V256M190 0V256" stroke="#b7c6ae" stroke-width="1"/><text x="82" y="122" font-size="9" fill="#798975">TEST MAP TILE</text></svg>';
  const bytes=await sharp(Buffer.from(svg)).png().toBuffer();
  await page.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/png',body:bytes}));
}

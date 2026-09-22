// Publisher HTML only; no guessing image URLs or treating photos as drawings.
export const decodeHTML = value => String(value || '').replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n))).replace(/&amp;|&quot;|&#39;|&apos;|&nbsp;/g, s => ({'&amp;':'&','&quot;':'"','&#39;':"'",'&apos;':"'",'&nbsp;':' '}[s]));
const clean = value => decodeHTML(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => decodeHTML(tag.match(new RegExp('(?:^|[\\s"\'])' + name + '=["\']([^"\']*)["\']', 'i'))?.[1] || '');
export function assetIdentity(value) {
  const url = new URL(value);
  return url.hostname + decodeURIComponent(url.pathname).normalize('NFC').replace(/-\d+x\d+(?=\.[^.]+$)/, '') + url.search;
}
export function drawingKind(text) {
  if (/단면도|section/i.test(text)) return 'section';
  if (/입면도|elevation/i.test(text)) return 'elevation';
  if (/배치도|site[ _-]?plan/i.test(text)) return 'site';
  if (/평면|(?:floor[ _-]?)?plan(?:[ _./-]|$)|(?:^|[ _-])(?:B?\d+F|RF)(?:[ _.-]|$)/i.test(text)) return 'floor';
  return null;
}
export function publisherDrawings(html, source) {
  const host = new URL(source).hostname, found = new Map();
  // Limit each image's caption to its own figure, avoiding adjacent photo captions.
  const figures = [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/gi)].map(m => m[0]);
  const blocks = host === 'soco.seoul.go.kr' ? [...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]) : figures;
  for (const block of blocks) for (const match of block.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0], src = attr(tag, 'data-src') || attr(tag, 'src');
    if (!src) continue;
    const caption = clean(block.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]);
    const alt = attr(tag, 'alt');
    let url; try { url = new URL(src, source); } catch { continue; }
    if (!['soco.seoul.go.kr','media.brique.co'].includes(url.hostname) || url.protocol !== 'https:') continue;
    const filename = decodeURIComponent(url.pathname.split('/').pop()).replace(/-\d+x\d+(?=\.)/, '').replace(/\.[^.]+$/, '');
    const drawingCaption = caption.length < 180 && /평면도|단면도|입면도|배치도/.test(caption) ? caption : '';
    const kind = drawingKind([alt,drawingCaption,filename].join(' '));
    if (!kind || (host === 'soco.seoul.go.kr' && !/평면|입면|단면|배치/.test(alt))) continue;
    const identity = assetIdentity(url.href), choices = [{url:url.href,width:Number(attr(tag,'width')) || 0}];
    for (const item of attr(tag, 'srcset').split(',')) {
      const choice = item.trim().match(/^(https:\/\/\S+)\s+(\d+)w$/);
      if (choice && Number(choice[2]) <= 4096 && assetIdentity(choice[1]) === identity) choices.push({url:choice[1],width:Number(choice[2])});
    }
    choices.sort((a,b) => b.width-a.width);
    const label = drawingCaption || alt || filename.replaceAll('-', ' ');
    const previous = found.get(identity);
    const row = {url:choices[0].url,identity,label,kind,credit:caption || null};
    if (!previous || /평면|단면|입면|배치/.test(caption)) found.set(identity, row);
  }
  return [...found.values()];
}

const finite = Number.isFinite;

export function coordinate(lat, lng) {
  if (lat === null || lng === null || lat === '' || lng === '') return null;
  lat = Number(lat); lng = Number(lng);
  return finite(lat) && finite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? {lat, lng} : null;
}

export function normalizeAddress(value) {
  return String(value || '').normalize('NFKC').toLowerCase()
    .replace(/서울특별시|서울시/g, '서울').replace(/경기도/g, '경기')
    .replace(/[()[\],·]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseMapInput(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 1000) throw Error('주소 또는 지도 링크를 1,000자 이내로 입력해 주세요.');
  if (!/^https?:\/\//i.test(text)) return {query:text};
  const url = new URL(text), host = url.hostname.toLowerCase();
  const provider = ['map.naver.com','naver.me','m.map.naver.com'].includes(host) ? 'naver' : ['map.kakao.com','kko.to','place.map.kakao.com','m.map.kakao.com'].includes(host) ? 'kakao' : null;
  if (!provider) throw Error('네이버·카카오 지도 링크 또는 주소를 입력해 주세요.');
  let point = coordinate(url.searchParams.get('lat'), url.searchParams.get('lng'));
  let query = url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('title') || '';
  const pathname = decodeURIComponent(url.pathname);
  if (provider === 'kakao') {
    const match = pathname.match(/\/link\/(?:map|roadview)\/(?:([^,]+),)?(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (match) { point = coordinate(match[2], match[3]); query ||= match[1] || ''; }
    query ||= pathname.match(/\/link\/search\/(.+)/)?.[1] || '';
  } else {
    query ||= pathname.match(/\/(?:p\/|v5\/)?search\/([^/]+)/)?.[1] || '';
    // Naver's viewport parameter can be projected meters; it is not a place coordinate.
  }
  if (!point && !query) throw Error('이 링크에는 주소·위경도가 없습니다. 지도에서 도로명 주소를 복사해 주세요.');
  return {query, coordinate:point, provider, source:url.href};
}

export function uniquePlaces(catalog) {
  const groups = new Map();
  for (const site of catalog) {
    if (site.synthetic) continue;
    const id = site.siteId || site.id;
    if (!groups.has(id)) groups.set(id, {...site, floors:[]});
    groups.get(id).floors.push(site);
  }
  return [...groups.values()];
}

export function searchPlaces(places, query) {
  const needle = normalizeAddress(query);
  if (!needle) return places;
  const tokens = needle.split(' ');
  return places.map(site => {
    const name = normalizeAddress(site.name), address = normalizeAddress(site.address);
    const haystack = name + ' ' + address;
    const matches = tokens.every(token => /^\d+(?:-\d+)?$/.test(token)
      ? new RegExp(`(^|[^\\d-])${token}($|[^\\d-])`).test(haystack)
      : haystack.includes(token));
    return {site, score:matches ? (address === needle ? 4 : name === needle ? 3 : address.includes(needle) ? 2 : 1) : 0};
  }).filter(r => r.score).sort((a,b) => b.score-a.score).map(r => r.site);
}

export function metersBetween(a, b) {
  if (!a || !b) return Infinity;
  const k = Math.PI / 180, lat = (a.lat+b.lat)/2*k;
  return Math.hypot((a.lng-b.lng)*k*Math.cos(lat), (a.lat-b.lat)*k)*6371008.8;
}

export function preciseLocation(location) {
  return !!coordinate(location?.lat, location?.lng) && !['address-area','park-centroid'].includes(location?.precision);
}

export function mapLinks(site) {
  const query = site.address || site.name || '', point = preciseLocation(site.location) ? site.location : null;
  return {
    naver:`https://map.naver.com/p/search/${encodeURIComponent(query)}`,
    kakao:point ? `https://map.kakao.com/link/map/${encodeURIComponent(site.name || query)},${point.lat},${point.lng}` : `https://map.kakao.com/link/search/${encodeURIComponent(query)}`,
    roadview:point ? `https://map.kakao.com/link/roadview/${point.lat},${point.lng}` : null,
  };
}

export function normalizeGeocodes(provider, response) {
  const records = provider === 'naver' ? response?.v2?.addresses || [] : Array.isArray(response) ? response : [];
  return records.flatMap(item => {
    const point = coordinate(item.y, item.x);
    if (!point) return [];
    const address = provider === 'naver' ? item.roadAddress || item.jibunAddress : item.road_address?.address_name || item.address_name;
    if (!address) return [];
    return [{name:address, address, location:{...point, precision:'provider-address', provider, source:provider === 'naver' ? 'https://navermaps.github.io/maps.js.ncp/docs/tutorial-Geocoder-Geocoding.html' : 'https://apis.map.kakao.com/web/sample/addr2coord/'}}];
  });
}

export function imagePixel(rect, naturalWidth, naturalHeight, clientX, clientY) {
  const scale = Math.min(rect.width/naturalWidth, rect.height/naturalHeight);
  if (!finite(scale) || scale <= 0) return null;
  const x = (clientX-rect.left-(rect.width-naturalWidth*scale)/2)/scale;
  const y = (clientY-rect.top-(rect.height-naturalHeight*scale)/2)/scale;
  return x >= 0 && x < naturalWidth && y >= 0 && y < naturalHeight ? {x:Math.floor(x), y:Math.floor(y)} : null;
}

export function safeSource(value) {
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}

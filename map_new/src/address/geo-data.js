import {coordinate,uniquePlaces,normalizeAddress,safeSource} from './location.js';

export const kindLabels={floor:'평면도',elevation:'입면도',section:'단면도',site:'배치도',diagram:'다이어그램',axonometric:'입체 평면도'};
export function locationQuality(location) {
  if(!coordinate(location?.lat,location?.lng))return {id:'missing',label:'좌표 확인 필요',color:'#a57737'};
  if(['address-area','park-centroid','google-approximate'].includes(location.precision))return {id:'area',label:location.precision==='park-centroid'?'공원 대표 위치':'대략적인 지역 위치',color:'#b87d36'};
  if(['publisher-naver-point','publisher-google-point'].includes(location.precision))return {id:'publisher',label:'발행처 제공 위치',color:'#52798e'};
  if(['osm-facility-centroid','address-result','provider-address','google-address','verified-address'].includes(location.precision))return {id:'address',label:'주소·시설 위치',color:'#487a60'};
  return {id:'area',label:'정밀도 미확인 위치',color:'#b87d36'};
}
export function geoPlaces(catalog,drawings=[],overrides=[]) {
  return uniquePlaces(catalog).map(place=>{
    const override=overrides.find(o=>o.siteId===place.siteId);
    const result={...place,...(override?{location:override.location,address:override.address||place.address}:{}),name:(override?.name||place.name).replace(/\s*·\s*(?:도면 \d+|[B\d]+F|SITE)\s*$/,''),drawings:drawings.filter(d=>d.siteId===place.siteId)};
    return {...result,quality:locationQuality(result.location)};
  });
}
export function googleMapsURL(place) {
  return 'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:place.address||place.name});
}
export function markerRecords(places,{includeAreas=true,height=60}={}) {
  const altitude=Math.max(10,Math.min(300,Number(height)||60));
  return places.filter(p=>coordinate(p.location?.lat,p.location?.lng)&& (includeAreas||locationQuality(p.location).id!=='area')).map(p=>({
    ...p,quality:locationQuality(p.location),position:{lat:Number(p.location.lat),lng:Number(p.location.lng),altitude},
    markerLabel:p.name+(locationQuality(p.location).id==='area'?' · 지역 위치':''),
  }));
}
const xml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function earthKML(places,options={}) {
  const rows=markerRecords(places,options),kmlColor=hex=>'ff'+hex.slice(5,7)+hex.slice(3,5)+hex.slice(1,3);
  const folders=['address','publisher','area'].map(id=>`<Folder><name>${xml({address:'주소·시설 위치',publisher:'발행처 제공 위치',area:'대략적인 지역 위치 — 건물 지점 아님'}[id])}</name>${rows.filter(p=>p.quality.id===id).map(p=>{
    const source=safeSource(p.source);
    const description=`<p>${xml(p.address)}</p><p>${xml(p.quality.label)} · 추가 도면 ${p.drawings?.length||0}장</p><p>마커 높이는 표시용이며 건물 높이가 아닙니다.</p><p>${source?`<a href="${xml(source)}">도면 발행처 원문</a> · `:''}<a href="${xml(googleMapsURL(p))}">구글 지도에서 주소 확인</a></p>`;
    return `<Placemark id="${xml(p.siteId)}"><name>${xml(p.markerLabel)}</name><address>${xml(p.address)}</address><description>${xml(description)}</description><Style><IconStyle><color>${kmlColor(p.quality.color)}</color><scale>1.1</scale><Icon><href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LineStyle><color>${kmlColor(p.quality.color)}</color><width>2</width></LineStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style><LookAt><longitude>${p.position.lng}</longitude><latitude>${p.position.lat}</latitude><altitude>0</altitude><heading>0</heading><tilt>65</tilt><range>850</range><altitudeMode>relativeToGround</altitudeMode></LookAt><ExtendedData><Data name="siteId"><value>${xml(p.siteId)}</value></Data><Data name="precision"><value>${xml(p.location.precision)}</value></Data><Data name="source"><value>${xml(p.location.source||p.source)}</value></Data></ExtendedData><Point><extrude>1</extrude><altitudeMode>relativeToGround</altitudeMode><coordinates>${p.position.lng},${p.position.lat},${p.position.altitude}</coordinates></Point></Placemark>`;
  }).join('')}</Folder>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>ATLAS · 주소와 도면 · 3D 마커</name><description>발행처 위치와 대략적인 지역 위치를 폴더·색상으로 구분합니다. 마커 높이는 표시용이며 건물 높이가 아닙니다.</description><LookAt><longitude>127.4</longitude><latitude>36.4</latitude><altitude>0</altitude><heading>0</heading><tilt>25</tilt><range>650000</range></LookAt>${folders}</Document></kml>\n`;
}
export function normalizedGoogleResult(result,requestedAddress) {
  if(!result?.geometry?.location)return null;
  const loc=result.geometry.location,point=coordinate(typeof loc.lat==='function'?loc.lat():loc.lat,typeof loc.lng==='function'?loc.lng():loc.lng);
  if(!point || point.lat<33||point.lat>39||point.lng<124||point.lng>132)return null;
  const precise=!result.partial_match&&['ROOFTOP','RANGE_INTERPOLATED'].includes(result.geometry.location_type);
  // A rooftop returned for a vague district query is still not a verified building match.
  const addressParts=[...normalizeAddress(requestedAddress).matchAll(/[가-힣\d]+(?:로|길|동|리)\s*\d+(?:-\d+)?/g)].map(m=>m[0].replace(/\s/g,''));
  const formatted=normalizeAddress(result.formatted_address).replace(/\s/g,'');
  const matchesNumber=addressParts.some(part=>new RegExp(part+'(?![\\d-])').test(formatted));
  return {...point,precision:precise&&matchesNumber?'google-address':'google-approximate',provider:'google',formattedAddress:result.formatted_address,locationType:result.geometry.location_type,partialMatch:!!result.partial_match,source:'https://developers.google.com/maps/documentation/javascript/geocoding'};
}

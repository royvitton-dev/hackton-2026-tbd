import {describe,it,expect} from 'vitest';
import {geoPlaces,markerRecords,earthKML,normalizedGoogleResult} from '../../src/address/geo-data.js';
import {publisherDrawings,assetIdentity} from '../../scripts/address-drawing-parser.mjs';

describe('address-linked geographic data',()=>{
  const sites=[{id:'a-0',siteId:'a',name:'A & B <건물>',address:'서울 중랑구 신내역로1길 145',location:{lat:37.6,lng:127.1,precision:'publisher-naver-point'}},{id:'a-1',siteId:'a',location:{lat:37.6,lng:127.1}},{id:'b-0',siteId:'b',name:'지역',address:'서울 서초구',location:{lat:37.4,lng:127.1,precision:'address-area'}},{id:'bad-0',siteId:'bad',name:'없음',location:{lat:undefined,lng:127}},{id:'fixture',siteId:'fixture',synthetic:true}];
  it('groups floors into one marker, retains uncertainty and omits invalid or synthetic locations',()=>{
    const places=geoPlaces(sites,[{id:'extra',siteId:'a'}]);expect(places).toHaveLength(3);expect(places[0].floors).toHaveLength(2);expect(places[0].drawings).toHaveLength(1);
    expect(markerRecords(places)).toHaveLength(2);expect(markerRecords(places,{includeAreas:false})).toHaveLength(1);
    expect(markerRecords(places)[1].markerLabel).toContain('지역 위치');expect(markerRecords(places,{height:999})[0].position.altitude).toBe(300);
  });
  it('exports valid escaped longitude, latitude, relative altitude and source precision',()=>{
    const text=earthKML(geoPlaces(sites),{height:80});expect(text).toContain('A &amp; B &lt;건물&gt;');expect(text).toContain('<coordinates>127.1,37.6,80</coordinates>');expect(text).toContain('<extrude>1</extrude>');expect(text).toContain('relativeToGround');expect(text).not.toMatch(/NaN|undefined/);expect(text.match(/<Placemark /g)).toHaveLength(2);expect(text).toContain('건물 지점 아님');
  });
  it('does not upgrade mismatched, partial, approximate or vague addresses to building locations',()=>{
    const result={formatted_address:'서울특별시 중랑구 신내역로1길 145',geometry:{location:{lat:()=>37.6,lng:()=>127.1},location_type:'ROOFTOP'}};
    expect(normalizedGoogleResult(result,sites[0].address).precision).toBe('google-address');
    expect(normalizedGoogleResult({...result,partial_match:true},sites[0].address).precision).toBe('google-approximate');
    expect(normalizedGoogleResult({...result,formatted_address:'서울특별시 중랑구 신내역로1길 145-1'},sites[0].address).precision).toBe('google-approximate');
    expect(normalizedGoogleResult(result,'서울 중랑구').precision).toBe('google-approximate');
    expect(normalizedGoogleResult({...result,geometry:{location:{lat:0,lng:0}}},sites[0].address)).toBeNull();
  });
});
describe('remaining drawing acquisition',()=>{
  it('reads all publisher drawings including malformed adjacent attributes, without a three-image cap',()=>{
    const html=Array.from({length:10},(_,i)=>`<img src="/cohome/fileDown.do?fileSn=${i}&amp;x=1"alt="건물_평면도_${i}">`).join('');
    const drawings=publisherDrawings(html,'https://soco.seoul.go.kr/example');expect(drawings).toHaveLength(10);expect(drawings[9].url).toContain('fileSn=9&x=1');
  });
  it('deduplicates published image sizes and preserves floor captions without accepting prose about photos',()=>{
    const figure=(src,caption,set='')=>`<figure><img src="https://media.brique.co/2026/${src}" srcset="${set}"><figcaption>${caption}</figcaption></figure>`;
    const html=figure('plan-2f-905x640.jpg','2층 평면도 ©Architect','https://media.brique.co/2026/plan-2f-905x640.jpg 905w, https://media.brique.co/2026/plan-2f.jpg 2000w')+figure('plan-2f.jpg','2층 평면도 ©Architect')+figure('photo.jpg','남측에 계단을 배치하여 빛을 머금게 했다.')+figure('floors.jpg','3층(왼쪽), 4층 평면도 ©Architect');
    const drawings=publisherDrawings(html,'https://magazine.brique.co/project/example/');expect(drawings).toHaveLength(2);expect(drawings[0].url.endsWith('/plan-2f.jpg')).toBe(true);expect(drawings[1].kind).toBe('floor');expect(assetIdentity(drawings[0].url)).toBe(assetIdentity('https://media.brique.co/2026/plan-2f-905x640.jpg'));
  });
});

import {describe,it,expect} from 'vitest';
import {coordinate,parseMapInput,normalizeAddress,searchPlaces,uniquePlaces,metersBetween,preciseLocation,mapLinks,normalizeGeocodes,imagePixel,safeSource} from '../../src/address/location.js';
import {buildingProfile,modelDescription} from '../../src/address/model.js';

describe('address identity and provider inputs',()=>{
  it('preserves Korean searches and reads coordinate links in latitude/longitude order',()=>{
    expect(parseMapInput('서울 중랑구 신내역로1길 145')).toEqual({query:'서울 중랑구 신내역로1길 145'});
    expect(parseMapInput('https://map.kakao.com/link/map/너나들이,37.6180982,127.1102204')).toMatchObject({provider:'kakao',query:'너나들이',coordinate:{lat:37.6180982,lng:127.1102204}});
    expect(parseMapInput('https://map.naver.com/p/?lat=37.618&lng=127.11&title=너나들이')).toMatchObject({coordinate:{lat:37.618,lng:127.11}});
    expect(parseMapInput('https://map.naver.com/p/search/'+encodeURIComponent('성미산로5안길 15')).query).toBe('성미산로5안길 15');
    expect(parseMapInput('https://map.kakao.com/link/search/'+encodeURIComponent('성미산로5안길 15')).query).toBe('성미산로5안길 15');
  });
  it('does not turn short links, viewport centers, or unrelated URLs into building coordinates',()=>{
    for(const input of ['https://naver.me/short','https://kko.to/short','https://map.naver.com/p/entry/place/123?c=14123456,4500000,15','https://example.com/?lat=37&lng=127','https://map.naver.com.evil.test/?lat=37&lng=127',''])expect(()=>parseMapInput(input)).toThrow();
    expect(coordinate('',127)).toBeNull();expect(coordinate(null,127)).toBeNull();expect(coordinate(91,181)).toBeNull();expect(coordinate(undefined,127)).toBeNull();
  });
  it('keeps floor drawings together and does not match house 145 to 145-1 or 1450',()=>{
    const sites=[{id:'a-1',siteId:'a',name:'너나들이',address:'서울특별시 중랑구 신내역로1길 145 너나들이'},{id:'a-2',siteId:'a',name:'너나들이 2층',address:'서울 중랑구 신내역로1길 145'},{id:'b',siteId:'b',name:'다른 건물',address:'서울 중랑구 신내역로1길 145-1'},{id:'c',siteId:'c',address:'서울 중랑구 신내역로1길 1450'},{id:'lab',synthetic:true}];
    const grouped=uniquePlaces(sites);expect(grouped).toHaveLength(3);expect(grouped[0].floors).toHaveLength(2);
    expect(searchPlaces(grouped,'서울시 신내역로1길 145').map(s=>s.id)).toEqual(['a-1']);
    expect(searchPlaces(grouped,'145-1').map(s=>s.id)).toEqual(['b']);expect(searchPlaces(grouped,'없는주소')).toEqual([]);expect(searchPlaces(grouped,'')).toEqual(grouped);
    expect(normalizeAddress(' 경기도  (성남시) ')).toBe('경기 성남시');
  });
  it('does not offer roadview for a district centroid',()=>{
    const area={name:'주택',address:'서울 강남구 논현동',location:{lat:37.5,lng:127,precision:'address-area'}};
    expect(preciseLocation(area.location)).toBe(false);expect(mapLinks(area).roadview).toBeNull();expect(mapLinks(area).kakao).toContain('/search/');
    const exact={...area,location:{...area.location,precision:'provider-address'}};
    expect(mapLinks(exact).roadview).toBe('https://map.kakao.com/link/roadview/37.5,127');
    expect(metersBetween(exact.location,{lat:37.50001,lng:127})).toBeCloseTo(1.11,1);expect(metersBetween(null,exact.location)).toBe(Infinity);
  });
  it('normalizes both official geocoder response shapes and filters malformed results',()=>{
    const address='서울 중랑구 신내역로1길 145';
    expect(normalizeGeocodes('naver',{v2:{addresses:[{x:'127.11',y:'37.618',roadAddress:address}]}})[0]).toMatchObject({address,location:{lat:37.618,lng:127.11,provider:'naver'}});
    expect(normalizeGeocodes('kakao',[{x:'127.11',y:'37.618',road_address:{address_name:address}}])[0]).toMatchObject({address,location:{provider:'kakao'}});
    expect(normalizeGeocodes('naver',{})).toEqual([]);expect(normalizeGeocodes('kakao',[{x:'?',y:'37'},{x:'127',y:'37'}])).toEqual([]);
  });
});

describe('photo and 3D evidence',()=>{
  it('samples the displayed image, excluding object-fit letterboxing',()=>{
    const rect={left:10,top:20,width:300,height:300};
    expect(imagePixel(rect,600,300,160,170)).toEqual({x:300,y:150});
    expect(imagePixel(rect,600,300,160,30)).toBeNull();expect(imagePixel(rect,0,0,30,40)).toBeNull();
  });
  it('only makes web source links',()=>{
    expect(safeSource('javascript:alert(1)')).toBeNull();expect(safeSource('/internal')).toBeNull();expect(safeSource('https://soco.seoul.go.kr/')).toBe('https://soco.seoul.go.kr/');
  });
  it('preserves a sourced footprint while bounding user-supplied dimensions',()=>{
    const site={footprint:[{x:0,z:0},{x:10,z:0},{x:10,z:5},{x:0,z:5}],photo:{facade:{residentialFloors:4,baseHeight:4,floorHeight:2.8,upper:'#d5d4c3'}}};
    const profile=buildingProfile(site,null);expect(profile.footprint).toEqual(site.footprint);expect(profile.height).toBeCloseTo(15.2);expect(profile.floors).toBe(5);expect(profile.footprintKind).toBe('published-footprint');
    const changed=buildingProfile(site,null,{floors:1000,floorHeight:-5,color:'invalid'});expect(changed.floors).toBe(20);expect(changed.floorHeight).toBe(2);expect(changed.color).toBe('#d5d4c3');expect(changed.floorEvidence).toContain('가정');
  });
  it('labels drawing bounds and a location-only mass as assumptions',()=>{
    const plan={walls:[{x1:-5,z1:-3,x2:8,z2:6}]};const profile=buildingProfile({},plan);
    expect(profile.footprintKind).toBe('drawing-bounds');expect(modelDescription(profile,'exterior')).toContain('실제 외곽선 미확인');
    const mass=buildingProfile({},null);expect(modelDescription(mass,'exterior')).toContain('실제 건물 형상이 아닙니다');expect(modelDescription(mass,'drawing')).toContain('추정');
    expect(buildingProfile({footprint:[{x:NaN,z:1},{x:2,z:2},{x:4,z:4}]},null).footprintKind).toBe('reference-mass');
  });
});

import {it,expect} from 'vitest';
import {webSearchLinks} from '../../src/address/web-sources.js';

it('opens address-based websites without substituting an unverified nearby coordinate',()=>{
  const address='서울 마포구 성미산로5안길 15 온음공동체주택';
  const links=webSearchLinks({address,name:'온음공동체주택 · 도면 2',location:{lat:38,lng:128,precision:'publisher-naver-point'},source:'https://soco.seoul.go.kr/'});
  expect(decodeURIComponent(links.find(l=>l.id==='naver').url)).toBe('https://map.naver.com/p/search/'+address);
  expect(decodeURIComponent(links.find(l=>l.id==='kakao').url)).toBe('https://map.kakao.com/link/search/'+address);
  expect(new URL(links.find(l=>l.id==='google-images').url).searchParams.get('q')).toBe(address+' 외관');
  expect(links.some(l=>l.id==='publisher')).toBe(true);
});
it('encodes punctuation as search text and never makes a source-page script link',()=>{
  const links=webSearchLinks({name:'건물 & 옥상 #1',source:'javascript:alert(1)'});
  expect(links.some(l=>l.id==='publisher')).toBe(false);
  expect(new URL(links.find(l=>l.id==='naver-images').url).searchParams.get('query')).toBe('건물 & 옥상 #1 외관');
  expect(links.every(l=>new URL(l.url).protocol==='https:')).toBe(true);
});

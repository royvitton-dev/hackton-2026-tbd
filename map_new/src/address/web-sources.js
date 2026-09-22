import {mapLinks,safeSource} from './location.js';

export function webSearchLinks(site) {
  const address=String(site.address||site.name||'').trim();
  const fullName=String(site.name||'').replace(/\s*·\s*도면\s*\d+$/, '').trim();
  const name=fullName.match(/\[([^\]]+)\]/)?.[1]||fullName;
  const query=[address,...(name&&!address.replaceAll(' ','').includes(name.replaceAll(' ',''))?[name]:[]),'외관'].join(' ');
  const links=[
    {id:'naver',label:'네이버 지도에서 주소 보기',detail:'지도 웹사이트 · 거리뷰 선택 가능',url:'https://map.naver.com/p/search/'+encodeURIComponent(address)},
    {id:'kakao',label:'카카오맵에서 주소 보기',detail:'지도 웹사이트 · 로드뷰 선택 가능',url:'https://map.kakao.com/link/search/'+encodeURIComponent(address)},
    {id:'naver-images',label:'네이버에서 외관 사진 찾기',detail:'주소와 건물 이름으로 이미지 검색',url:'https://search.naver.com/search.naver?where=image&query='+encodeURIComponent(query)},
    {id:'google-images',label:'Google에서 외관 사진 찾기',detail:'주소와 건물 이름으로 이미지 검색',url:'https://www.google.com/search?udm=2&q='+encodeURIComponent(query)},
    {id:'web',label:'건물 관련 웹 문서 찾기',detail:'건축 소개·공개 사진·도면의 원문',url:'https://www.google.com/search?q='+encodeURIComponent([address,name,'건축'].filter(Boolean).join(' '))},
  ];
  const source=safeSource(site.source);if(source)links.unshift({id:'publisher',label:'수집한 사진·도면의 원문 보기',detail:new URL(source).hostname,url:source});
  return links;
}

function el(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
export function mountWebSources(target,site,{provider,kind,onPhoto}={}) {
  let alive=true;const section=el('section',null,'address-web-sources');
  section.append(el('h3','웹에서 이 장소 찾기'),el('p',site.address||site.name,'address-web-address'));
  const links=webSearchLinks(site),road=mapLinks(site).roadview;
  if(provider==='kakao'&&kind==='road'&&road)links.unshift({id:'roadview',label:'카카오 로드뷰 웹사이트 열기',detail:'현재 연결된 좌표의 거리뷰',url:road});
  if(provider)links.sort((a,b)=>(b.id===provider)-(a.id===provider));
  const list=el('div',null,'address-web-links');
  for(const item of links) {
    const link=el('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.dataset.webSource=item.id;
    link.append(el('strong',item.label+' ↗'),el('small',item.detail));list.append(link);
  }
  section.append(list,el('p','새 탭에서 주소와 외관을 확인하세요. 검색 결과의 사진은 주소가 같은 건물인지 확인한 뒤 참고 자료로 연결할 수 있습니다.','address-web-help'));
  if(onPhoto) {
    const form=el('form',null,'address-add-reference'),title=el('h4','찾은 사진을 참고 자료로 추가');
    const sourceLabel=el('label','사진의 출처 페이지 (선택)'),source=el('input');source.type='url';source.placeholder='https://…';source.setAttribute('aria-label','참고 사진 출처 페이지');sourceLabel.append(source);
    const fileLabel=el('label','저장한 외관 사진'),file=el('input');file.type='file';file.accept='image/jpeg,image/png,image/webp';file.setAttribute('aria-label','참고 사진 파일');fileLabel.append(file);
    const submit=el('button','이 건물에 사진 연결');submit.type='submit';
    const feedback=el('p',null,'address-web-help');feedback.setAttribute('role','status');
    form.append(title,sourceLabel,fileLabel,submit,feedback,el('small','새로고침 전까지 참고 사진으로 보관합니다. 기존 3D의 형태·재질을 자동으로 바꾸지는 않습니다.'));
    form.onsubmit=async event=>{
      event.preventDefault();const selected=file.files?.[0];
      if(!selected){feedback.textContent='JPEG·PNG·WebP 사진을 선택해 주세요.';return;}
      if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>15*1024*1024){feedback.textContent='15MB 이하의 JPEG·PNG·WebP 사진을 선택해 주세요.';return;}
      const url=source.value.trim()?safeSource(source.value.trim()):null;
      if(source.value.trim()&&!url){feedback.textContent='http 또는 https 출처 주소를 입력해 주세요.';return;}
      const blobUrl=URL.createObjectURL(selected),image=new Image();image.src=blobUrl;submit.disabled=true;
      try {
        await image.decode();if(!alive){URL.revokeObjectURL(blobUrl);return;}
        if(onPhoto({file:blobUrl,fileName:selected.name,source:url,alt:site.name+' · 참고 외관 사진',publisher:'직접 연결한 참고 사진',local:true,bytes:selected.size})===false){URL.revokeObjectURL(blobUrl);feedback.textContent='이 건물에 사진을 더 추가할 수 없습니다.';}
      }catch {URL.revokeObjectURL(blobUrl);if(alive)feedback.textContent='이 파일을 사진으로 읽지 못했습니다.';}
      finally{if(alive)submit.disabled=false;}
    };
    section.append(form);
  }
  target.replaceChildren(section);return {dispose(){alive=false;}};
}

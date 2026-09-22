import {normalizeGeocodes, coordinate} from './location.js';

const loaded = new Map();
export const PROVIDER_DOCS = {
  naver:'https://navermaps.github.io/maps.js.ncp/docs/tutorial-Geocoder-Geocoding.html',
  kakao:'https://apis.map.kakao.com/web/guide/',
};
const message = provider => `${provider === 'naver' ? '네이버 Maps Key ID' : '카카오 JavaScript 키'}와 허용 웹 주소를 연결 설정에서 확인해 주세요.`;

export function loadProvider(provider, key) {
  if (!['naver','kakao'].includes(provider)) return Promise.reject(Error('지원하지 않는 지도입니다.'));
  if (!key) return Promise.reject(Error(message(provider)));
  if (!/^[\w-]{5,256}$/.test(key)) return Promise.reject(Error('브라우저용 지도 키의 형식을 확인해 주세요.'));
  if (loaded.has(provider)) {
    const entry = loaded.get(provider);
    return entry.key === key ? entry.promise : Promise.reject(Error('지도 키를 변경했습니다. 설정 저장 후 화면을 새로고침해 주세요.'));
  }
  const promise = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    const finish = error => {
      clearTimeout(timer); script.onload = null; script.onerror = null;
      if (error) { script.remove(); loaded.delete(provider); reject(error); } else resolve(provider === 'naver' ? window.naver.maps : window.kakao.maps);
    };
    const timer = setTimeout(() => finish(Error('지도 연결 시간이 초과됐습니다. '+message(provider))), 15000);
    script.onerror = () => finish(Error('지도 SDK를 불러오지 못했습니다. '+message(provider)));
    script.onload = () => {
      if (provider === 'naver') {
        if (!window.naver?.maps?.Service || !window.naver.maps.Panorama) return finish(Error(message(provider)));
        finish();
      } else if (window.kakao?.maps?.load) {
        window.kakao.maps.load(() => window.kakao.maps.services?.Geocoder ? finish() : finish(Error(message(provider))));
      } else finish(Error(message(provider)));
    };
    script.src = provider === 'naver'
      ? `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&submodules=geocoder,panorama`
      : `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    document.head.append(script);
  });
  loaded.set(provider,{key,promise});
  return promise;
}

export async function geocode(provider, query, key) {
  const maps = await loadProvider(provider,key);
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => reject(Error('주소 검색 시간이 초과됐습니다.')), 10000);
    const done = (ok, data) => { clearTimeout(timer); ok ? resolve(normalizeGeocodes(provider,data)) : reject(Error('주소를 검색하지 못했습니다. '+message(provider))); };
    if (provider === 'naver') maps.Service.geocode({query}, (status, response) => done(status === maps.Service.Status.OK,response));
    else new maps.services.Geocoder().addressSearch(query, (result,status) => done(status === maps.services.Status.OK || status === maps.services.Status.ZERO_RESULT,result));
  });
}

export async function referenceView(element, site, provider, kind, key, onBearing = () => {}, signal) {
  const point = coordinate(site.location?.lat,site.location?.lng);
  if (!point) throw Error('먼저 주소 검색으로 건물 위치를 선택해 주세요.');
  const maps = await loadProvider(provider,key), position = new maps.LatLng(point.lat,point.lng);
  if(signal?.aborted)throw new DOMException('화면을 변경했습니다.','AbortError');
  const events = [], listen = (target,name,fn) => {
    const token = maps.Event ? maps.Event.addListener(target,name,fn) : maps.event.addListener(target,name,fn);
    events.push({target,name,fn,token});
  };
  let view, marker, observer, disposed=false, cancelPending;
  const dispose = () => {
    if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);
    observer?.disconnect();
    for (const event of events) maps.Event ? maps.Event.removeListener(event.token) : maps.event.removeListener(event.target,event.name,event.fn);
    marker?.setMap(null); view?.setVisible?.(false); view?.destroy?.(); element.replaceChildren();
  };
  const abort=()=>{cancelPending?.();dispose();};signal?.addEventListener('abort',abort,{once:true});
  try {
    if (kind === 'map') {
      view = new maps.Map(element,{center:position, ...(provider === 'naver' ? {zoom:18,zoomControl:true} : {level:3})});
      marker = new maps.Marker({position,map:view});
      observer = new ResizeObserver(() => { if (provider === 'kakao') view.relayout(); else maps.Event.trigger(view,'resize'); view.setCenter(position); });
      observer.observe(element);
      return {status:'map',dispose};
    }
    await new Promise((resolve,reject) => {
      let finished=false;
      const timer = setTimeout(() => done(Error('이 위치의 거리뷰를 불러오지 못했습니다. 지도에서 위치를 확인해 주세요.')),15000);
      const done = error => { if(finished)return;finished=true;clearTimeout(timer);cancelPending=null;error ? reject(error) : resolve(); };
      cancelPending=()=>done(new DOMException('화면을 변경했습니다.','AbortError'));
      if (provider === 'naver') {
        view = new maps.Panorama(element,{position});
        listen(view,'pano_status',status => status === 'OK' ? done() : done(Error('이 위치에 네이버 거리뷰가 없습니다.')));
        listen(view,'pov_changed',() => onBearing(view.getPov().pan));
        observer = new ResizeObserver(() => view.setSize(new maps.Size(element.clientWidth,element.clientHeight)));
      } else {
        new maps.RoadviewClient().getNearestPanoId(position,100,id => {
          if(disposed||finished)return;
          if (!id) return done(Error('100m 안에서 카카오 로드뷰를 찾지 못했습니다.'));
          view = new maps.Roadview(element);
          listen(view,'init',() => done());
          listen(view,'viewpoint_changed',() => onBearing(view.getViewpoint().pan));
          view.setPanoId(id,position);
          observer = new ResizeObserver(() => view.relayout()); observer.observe(element);
        });
      }
    });
    observer?.observe(element);
    return {status:'streetview',dispose};
  } catch (error) { dispose(); throw error; }
}

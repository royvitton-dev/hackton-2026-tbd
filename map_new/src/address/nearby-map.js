// Reuse the installed map package without changing shared package/config files.
import {Map as LibreMap,Marker,NavigationControl,AttributionControl,ScaleControl,setWorkerUrl} from '../../../map/node_modules/maplibre-gl/dist/maplibre-gl.mjs';
import workerURL from '../../../map/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import '../../../map/node_modules/maplibre-gl/dist/maplibre-gl.css';
import {nearbyMarkers} from './nearby-data.js';
import {miniatureLayer} from './miniature-layer.js';

setWorkerUrl(workerURL);
export function mountNearbyMap(container,{places,selectedId,onSelect,onStatus,onModelInfo=()=>{},includeAreas=true,height=60,scale=70,assetBase=import.meta.env.BASE_URL}){
  let rows=nearbyMarkers(places,{includeAreas,height}),selected=selectedId,ready=false,disposed=false,labels=[],tileFailed=false,buildings;
  const first=rows.find(p=>p.siteId===selected)||rows[0];
  const map=new LibreMap({container,center:first?[first.displayPosition.lng,first.displayPosition.lat]:[127.02,37.56],zoom:19.1,pitch:58,bearing:-22,maxPitch:72,maxZoom:21,minZoom:5,attributionControl:false,renderWorldCopies:false,canvasContextAttributes:{antialias:true},style:{version:8,projection:{type:'mercator'},sources:{streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#e8eddf'}},{id:'streets',type:'raster',source:'streets',paint:{'raster-saturation':-.55,'raster-opacity':.88}}]}});
  map.addControl(new NavigationControl({visualizePitch:true}),'bottom-right');
  map.addControl(new AttributionControl({compact:false}),'bottom-right');
  map.addControl(new ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
  const points=()=>({type:'FeatureCollection',features:rows.map(r=>({type:'Feature',properties:{siteId:r.siteId,color:r.siteId===selected?'#d69b34':r.quality.color},geometry:{type:'Point',coordinates:[r.displayPosition.lng,r.displayPosition.lat]}}))});
  function report(){
    if(disposed)return;
    const models=buildings?.snapshot().models||[],loaded=models.filter(m=>m.status==='ready').length,loading=models.filter(m=>['queued','loading'].includes(m.status)).length;
    container.dataset.modelCount=String(loaded);container.dataset.modelsReady=String(!!models.length&&!loading);
    onModelInfo(models.find(m=>m.siteId===selected)||{status:rows.some(r=>r.siteId===selected)?'loading':'filtered'});
    const selectedModel=models.find(m=>m.siteId===selected);
    if(tileFailed)onStatus('배경 지도를 불러오지 못했습니다. 주소 주변의 3D 모형은 계속 표시됩니다.','error');
    else if(selectedModel?.status==='failed')onStatus('선택한 장소의 모델을 불러오지 못했습니다. 위치와 도면 링크는 계속 이용할 수 있습니다.','error');
    else onStatus(`주소 주변 3D 모형 ${loaded}개${loading?` · ${loading}개 불러오는 중`:` · 위치 표시 ${rows.length-loaded}곳`} · 드래그 이동 · 우클릭 드래그 회전`,'ready');
  }
  function rebuild(){
    if(disposed)return;
    if(ready)map.getSource('address-locations')?.setData(points());
    buildings?.update(rows,{selectedId:selected,scale});
    labels.forEach(m=>m.remove());labels=[];
    rows.forEach((row,i)=>{
      const wrapper=document.createElement('div'),button=document.createElement('button');wrapper.style.zIndex=row.siteId===selected?'1':'0';button.type='button';button.className='nearby-pin-label';button.classList.toggle('selected',row.siteId===selected);button.dataset.nearbySite=row.siteId;
      button.style.setProperty('--pin-color',row.quality.color);button.setAttribute('aria-label',`${row.name} · ${row.address} · ${row.quality.label}`);button.title=row.name+' · '+row.quality.label+(row.displayOffsetMeters?' · 겹침 방지를 위해 주변 배치':'');
      const number=document.createElement('b');number.textContent=String(i+1).padStart(2,'0');const name=document.createElement('span');name.textContent=row.name;button.append(number,name);wrapper.append(button);
      button.onclick=event=>{event.stopPropagation();onSelect(row.siteId);};
      const marker=new Marker({element:wrapper,anchor:'top',offset:[0,22]}).setLngLat([row.displayPosition.lng,row.displayPosition.lat]).addTo(map);labels.push(marker);
    });
    container.dataset.markerCount=String(rows.length);
  }
  function focus(siteId,{instant=false}={}){
    const row=rows.find(p=>p.siteId===siteId);if(!row)return false;selected=siteId;rebuild();report();
    const camera={center:[row.displayPosition.lng,row.displayPosition.lat],zoom:19.1,pitch:58,bearing:-22};
    if(instant||matchMedia('(prefers-reduced-motion: reduce)').matches)map.jumpTo(camera);else map.flyTo({...camera,duration:700});return true;
  }
  map.on('style.load',()=>{
    if(disposed)return;
    map.addSource('address-locations',{type:'geojson',data:points()});
    map.addLayer({id:'address-location-dots',type:'circle',source:'address-locations',paint:{'circle-radius':6,'circle-color':['get','color'],'circle-opacity':.5,'circle-stroke-width':2,'circle-stroke-color':'#ffffff'}});
    buildings=miniatureLayer({rows,selectedId:selected,assetBase,onChange:report});map.addLayer(buildings);buildings.update(rows,{selectedId:selected,scale});
    ready=true;container.dataset.mapReady='true';report();
  });
  map.on('click',event=>{if(!ready)return;const id=buildings?.pick(event.point)||map.queryRenderedFeatures(event.point,{layers:['address-location-dots']})[0]?.properties?.siteId;if(id)onSelect(id);});
  map.on('mousemove',event=>{if(ready&&!event.originalEvent.buttons)map.getCanvas().style.cursor=buildings?.pick(event.point)?'pointer':'';});
  map.on('mouseenter','address-location-dots',()=>{map.getCanvas().style.cursor='pointer';});map.on('mouseleave','address-location-dots',()=>{map.getCanvas().style.cursor='';});
  map.on('error',event=>{if(disposed)return;if(event.sourceId==='streets'||/tile\.openstreetmap\.org/.test(event.error?.message||'')){tileFailed=true;report();}else onStatus('지도 표시 중 오류가 발생했습니다. 새로고침해 주세요.','error');});
  map.on('sourcedata',event=>{if(tileFailed&&event.sourceId==='streets'&&event.sourceDataType==='content'){tileFailed=false;report();}});
  const observer=new ResizeObserver(()=>{if(!disposed)map.resize();});observer.observe(container);rebuild();
  return {provider:'openstreetmap',
    update(nextPlaces,options={}){places=nextPlaces;includeAreas=options.includeAreas??includeAreas;height=options.height??height;scale=options.scale??scale;rows=nearbyMarkers(places,{includeAreas,height});rebuild();if(ready)report();},
    focus,select(siteId){selected=siteId;rebuild();if(ready)report();},resize(){map.resize();},
    overview(){if(!rows.length)return;const lng=rows.map(r=>r.displayPosition.lng),lat=rows.map(r=>r.displayPosition.lat);map.fitBounds([[Math.min(...lng),Math.min(...lat)],[Math.max(...lng),Math.max(...lat)]],{padding:70,pitch:30,bearing:0,maxZoom:19.1,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:700});},
    snapshot(){return {provider:'openstreetmap',ready,background:tileFailed?'unavailable':'openstreetmap',selected,zoom:map.getZoom(),pitch:map.getPitch(),center:map.getCenter().toArray(),...buildings?.snapshot(),markers:rows.map(r=>({siteId:r.siteId,position:r.position,displayPosition:r.displayPosition,displayOffsetMeters:r.displayOffsetMeters}))};},
    dispose(){if(disposed)return;disposed=true;observer.disconnect();labels.forEach(m=>m.remove());map.remove();}
  };
}

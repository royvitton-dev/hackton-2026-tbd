import {Map as LibreMap,Marker,NavigationControl,MercatorCoordinate} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import {buildingModel,buildingType,buildingTypes} from './buildings.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createAddressMap(element,sites,onSelect){
 const map=new LibreMap({container:element,center:[127.02,37.56],zoom:11.3,pitch:48,bearing:-16,maxPitch:70,canvasContextAttributes:{antialias:true},style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#e2e9df'}},{id:'streets',type:'raster',source:'osm',paint:{'raster-saturation':-.65,'raster-opacity':.8}}]}});
 map.addControl(new NavigationControl(),'bottom-right');
 const scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(new THREE.AmbientLight('#ffffff',2.3));const sun=new THREE.DirectionalLight('#fff1d5',3);sun.position.set(-1,-2,3);scene.add(sun);
 const valid=sites.filter(s=>Number.isFinite(s.mapLocation?.lat)&&Number.isFinite(s.mapLocation?.lng)),models=[],markers=[];
 for(const [i,site] of valid.entries()){
  const type=buildingType(site),info=buildingTypes[type],p=site.mapLocation,model=buildingModel(type),merc=MercatorCoordinate.fromLngLat([p.lng,p.lat]);model.matrixAutoUpdate=false;scene.add(model);models.push({site,model,merc});
  const container=document.createElement('div'),button=document.createElement('button');button.className='address-marker';button.dataset.siteId=site.id;button.dataset.buildingType=type;button.style.setProperty('--marker-color',info.color);button.setAttribute('aria-label',`${site.name} · ${site.address} · ${info.label}`);
  button.innerHTML=`<span class="marker-number">${String(i+1).padStart(2,'0')}</span><span class="marker-copy"><strong>${esc(site.name)}</strong><small>${esc(site.address)}</small><em>${info.label} · ${p.precision==='address-area'?'주소 범위':p.precision==='publisher-unverified'?'발행 좌표·미검증':'주소 검색 위치'}</em></span>`;container.append(button);
  button.onclick=()=>focus(site);button.ondblclick=()=>onSelect(site.id);
  const marker=new Marker({element:container,anchor:'top',offset:[0,4]}).setLngLat([p.lng,p.lat]).addTo(map);markers.push({site,marker,button});
 }
 const card=document.createElement('section');card.className='map-selection';card.hidden=true;element.append(card);
 function focus(site){const p=site.mapLocation;map.flyTo({center:[p.lng,p.lat],zoom:17.5,pitch:60,bearing:-25,duration:800});markers.forEach(m=>m.button.classList.toggle('selected',m.site.id===site.id));card.hidden=false;card.innerHTML=`<span>${buildingTypes[buildingType(site)].label} · 유형별 3D 모델</span><h3>${esc(site.name)}</h3><p>${esc(site.address)}</p><small>${p.precision==='address-area'?'동·구·도로 범위의 대표 위치입니다. 정확한 건물 좌표는 미확인입니다.':'주소 검색/발행 좌표이며 현장 위치 검증 전입니다.'} 외관·높이는 유형을 구분하는 개념 모델입니다.</small><button>도면 열기 →</button>`;card.querySelector('button').onclick=()=>onSelect(site.id);}
 const layer={id:'atlas-buildings',type:'custom',renderingMode:'3d',onAdd(map,gl){this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl});this.renderer.autoClear=false;element.dataset.models=String(models.length);},render(gl,args){camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix);const glyphScale=Math.max(1,2**(16-map.getZoom()));for(const {model,merc} of models){const s=merc.meterInMercatorCoordinateUnits()*glyphScale;model.matrix.makeTranslation(merc.x,merc.y,merc.z).scale(new THREE.Vector3(s,-s,s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));}this.renderer.resetState();this.renderer.render(scene,camera);this.renderer.resetState();},onRemove(){scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});this.renderer?.dispose();}};
 map.on('style.load',()=>{map.addLayer(layer);element.dataset.mapReady='true';});
 map.on('zoomend',()=>element.classList.toggle('map-close',map.getZoom()>14));
 const observer=new ResizeObserver(()=>map.resize());observer.observe(element);
 const legend=document.createElement('div');legend.className='building-legend';legend.innerHTML=Object.entries(buildingTypes).map(([key,v])=>`<span style="--marker-color:${v.color}"><i></i>${v.label}</span>`).join('')+`<button class="map-all">전체 ${valid.length}곳</button><a href="https://maps.google.com/maps?q=South+Korea" target="_blank" rel="noopener">Google 지도 ↗</a>`;element.append(legend);
 legend.querySelector('button').onclick=()=>{const points=valid.map(s=>[s.mapLocation.lng,s.mapLocation.lat]);map.fitBounds([[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]],{padding:100,pitch:30,duration:700});card.hidden=true;};
 return {mode:'address-map',map,models,markers,focus,resize:()=>map.resize(),dispose:()=>{observer.disconnect();map.remove();}};
}

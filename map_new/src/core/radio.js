import {localPosition,geographicPosition} from './geometry.js';
import {fitTwoPoints} from './georeference.js';
export const RADIO_DEFAULTS=Object.freeze({pathLossExponent:3,wallLossDb:6,floorLossDb:18,clutterLossDb:15,uncertaintyDb:12,minDistanceM:10,receiverHeightM:1.5});
export function distanceMeters(a,b){
 if(![a?.lat,a?.lng,b?.lat,b?.lng].every(Number.isFinite)||[a.lat,b.lat].some(v=>Math.abs(v)>90)||[a.lng,b.lng].some(v=>Math.abs(v)>180))throw Error('유효한 기지국·대상지 좌표가 필요합니다.');
 const r=Math.PI/180,v=Math.sin((a.lat-b.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((a.lng-b.lng)*r/2)**2;
 return 12742000*Math.asin(Math.sqrt(Math.min(1,v)));
}
export function dms(value){
 if(typeof value==='number')return Number.isFinite(value)?value:null;
 if(typeof value!=='string'||!value.trim())return null;
 if(/^-?\d+(\.\d+)?$/.test(value.trim()))return Number(value);
 const m=value.match(/^\s*(-?\d+)°\s*(\d+)'\s*([\d.]+)"\s*$/);if(!m||Number(m[2])>=60||Number(m[3])>=60)return null;
 return (m[1].startsWith('-')?-1:1)*(Math.abs(Number(m[1]))+Number(m[2])/60+Number(m[3])/3600);
}
const numeric=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
export function normalizeStation(raw,point){
 const lat=dms(raw.lat),lng=dms(raw.lon),hz=numeric(raw.frq_hz),powerW=numeric(raw.arw_pwr_wtt),gainDbi=numeric(raw.arw_gan_nmv),heightM=numeric(raw.arw_gnd_altd_het);
 if(!raw.uid||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 const frequencyMHz=hz===null?null:hz/1e6;
 return {id:raw.uid,name:raw.rds_cll_nm||raw.uid,operator:point?.operator||raw.cus_nm||'사업자 미상',lat,lng,frequencyMHz:frequencyMHz>=300&&frequencyMHz<=6000?frequencyMHz:null,powerW:powerW>0&&powerW<=10000?powerW:null,gainDbi:gainDbi!==null&&gainDbi>=-10&&gainDbi<=60?gainDbi:null,heightM:heightM!==null&&heightM>=0?heightM:null,radio:/5G/.test(raw.service_name)?'5G':/LTE/.test(raw.service_name)?'LTE':'other',outdoor:/지상/.test(raw.service_name)&&!/옥내|터널/.test(raw.service_name),address:raw.rds_trs_adr||'',installation:raw.arw_wek_nsn_form_cd_nm||'',measurement:null};
}
export function freeSpaceLoss(frequencyMHz,distanceM){
 if(!Number.isFinite(frequencyMHz)||frequencyMHz<=0||!Number.isFinite(distanceM)||distanceM<=0)throw Error('주파수와 거리는 양수여야 합니다.');
 return 32.45+20*Math.log10(frequencyMHz)+20*Math.log10(distanceM/1000);
}
export function prediction(station,distanceM,{walls=0,basements=0,...overrides}={}){
 const a={...RADIO_DEFAULTS,...overrides};
 if(!Number.isFinite(distanceM)||distanceM<0||!Number.isInteger(walls)||walls<0||!Number.isInteger(basements)||basements<0||!Object.values(a).every(Number.isFinite)||a.pathLossExponent<2||a.pathLossExponent>6||a.wallLossDb<0||a.floorLossDb<0||a.clutterLossDb<0||a.uncertaintyDb<0||a.minDistanceM<=0)throw Error('전파 추정 조건이 올바르지 않습니다.');
 if(!station.outdoor||![station.frequencyMHz,station.powerW,station.gainDbi,station.heightM].every(Number.isFinite)||station.frequencyMHz<=0||station.powerW<=0)return null;
 const d=Math.max(a.minDistanceM,Math.hypot(distanceM,station.heightM-a.receiverHeightM+basements*3));
 const loss=freeSpaceLoss(station.frequencyMHz,1)+10*a.pathLossExponent*Math.log10(d)+walls*a.wallLossDb+basements*a.floorLossDb+a.clutterLossDb;
 const dbm=10*Math.log10(station.powerW*1000)+station.gainDbi-loss;
 return {dbm,lowDbm:dbm-a.uncertaintyDb,highDbm:dbm+a.uncertaintyDb,lossDb:loss,distanceM,stationId:station.id,frequencyMHz:station.frequencyMHz,walls,basements,assumptions:a,kind:'estimated-received-power',metric:'received-power-not-RSRP'};
}
export function wallCrossings(point,station,plan){
 // Count each authored/extracted wall once; parallel/collinear rays do not
 // invent a wall intersection. These are 2D screening losses, not ray tracing.
 let count=0;const dx=station.x-point.x,dz=station.z-point.z;
 for(const w of plan.walls){const wx=w.x2-w.x1,wz=w.z2-w.z1,den=dx*wz-dz*wx;if(Math.abs(den)<1e-8)continue;const ax=w.x1-point.x,az=w.z1-point.z,t=(ax*wz-az*wx)/den,u=(ax*dz-az*dx)/den;if(t>1e-6&&t<1&&u>=0&&u<=1)count++;}
 return count;
}
export function radioGeometry(plan,site){
 if(plan.roadAlignment?.controls?.length===2){const fit=fitTwoPoints(...plan.roadAlignment.controls),scale=plan.roadAlignment.drawingMetersPerPixel;return {kind:'drawing-alignment',coordinate(point){return geographicPosition(fit.pixelToWorld({x:point.x/scale+500,z:point.z/scale+170}),fit.anchor);},station(s){const p=fit.geoToPixel(s);return {x:(p.x-500)*scale,z:(p.z-170)*scale};}};}
 if(!site.location)return null;
 return {kind:'assumed-north-up-at-site-center',coordinate:p=>geographicPosition(p,site.location),station:s=>localPosition(s,site.location)};
}
export function signalForCandidate(point,plan,site,stations,{operator='all',radio='LTE',basements=0,...assumptions}={}){
 const geometry=radioGeometry(plan,site);
 if(!geometry||site.location?.precision==='address-area')return {status:'location-needed',best:null,alternatives:[]};
 const coordinate=geometry.coordinate(point),alternatives=stations.filter(s=>(operator==='all'||s.operator===operator)&&(radio==='all'||s.radio===radio)).map(s=>{const d=distanceMeters(coordinate,s);if(d>1500)return null;const result=prediction(s,d,{...assumptions,basements,walls:wallCrossings(point,geometry.station(s),plan)});return result&&{...result,station:s};}).filter(Boolean).sort((a,b)=>b.dbm-a.dbm||a.stationId.localeCompare(b.stationId));
 return {status:alternatives.length?'estimated':'no-station-data',best:alternatives[0]||null,alternatives,coordinate,alignment:geometry.kind};
}

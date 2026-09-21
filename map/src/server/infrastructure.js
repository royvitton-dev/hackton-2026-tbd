export function infrastructurePlugin(apiKey){
 const cache=new Map();
 const middleware=async(req,res,next)=>{
  if(!req.url.startsWith('/api/infrastructure/cells'))return next();
  const send=(status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));};
  if(req.method!=='GET')return send(405,{error:'GET 요청만 지원합니다.'});
  const url=new URL(req.url,'http://localhost'),lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));
  if(!url.searchParams.has('lat')||!url.searchParams.has('lng')||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<33||lat>39||lng<124||lng>132)return send(400,{error:'대한민국 범위의 유효한 위도·경도를 입력해 주세요.'});
  if(!apiKey)return send(503,{error:'공개 기지국 조회 키가 연결되지 않았습니다. 현장 신호 자료는 JSON으로 입력할 수 있습니다.'});
  const cacheKey=`${lat.toFixed(3)},${lng.toFixed(3)}`,cached=cache.get(cacheKey);if(cached&&Date.now()-cached.at<3600000)return send(200,cached.data);
  try{
   const endpoint=new URL('https://opencellid.org/cell/getInArea');endpoint.search=new URLSearchParams({key:apiKey,BBOX:`${lat-.0045},${lng-.0057},${lat+.0045},${lng+.0057}`,mcc:'450',format:'json',limit:'25'});
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error();const raw=await response.json();if(!Array.isArray(raw.cells))throw new Error();
   const data={source:'OpenCelliD',license:'CC BY-SA 4.0',scope:'outdoor-cell-records',cells:raw.cells.filter(c=>Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lon))).map(c=>({cellid:String(c.cellid),radio:String(c.radio||'unknown'),lat:Number(c.lat),lng:Number(c.lon),signal:Number(c.averageSignalStrength)<0?Number(c.averageSignalStrength):null,samples:c.samples}))};cache.set(cacheKey,{at:Date.now(),data});return send(200,data);
  }catch{return send(502,{error:'공개 셀 자료 조회에 실패했습니다. 키·제공처 상태를 확인해 주세요.'});}
 };
 return {name:'atlas-infrastructure',configureServer(server){server.middlewares.use(middleware);},configurePreviewServer(server){server.middlewares.use(middleware);}};
}

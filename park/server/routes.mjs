export const APPS = Object.freeze([
 {id:'park',name:'Wonder Park',kind:'vite',root:'.',config:'park/vite.config.mjs'},
 {id:'map',name:'ATLAS · 도면과 모빌리티',kind:'vite',root:'map',config:'map/vite.config.mjs'},
 {id:'dopamin',name:'BREW RACERS',kind:'vite',root:'dopamin',config:'dopamin/vite.config.ts'},
 {id:'webpage',name:'DEBUT : ON · VITALIS',kind:'vite',root:'webpage',config:'webpage/vite.config.ts'},
 {id:'battery_health',name:'배터리 관리',kind:'vite',root:'battery_health',config:'battery_health/vite.config.ts'},
 {id:'trading',name:'휴가 거래소',kind:'vite',root:'trading/frontend',config:'trading/frontend/vite.config.ts'},
 {id:'pinball',name:'DROP LAND',kind:'static',root:'pinball'},
 {id:'movie',name:'Wonder Park Film',kind:'static',root:'movie'},
 {id:'voice',name:'매직 보이스 · 실행 안내',kind:'guide',root:'voice'},
 {id:'vehicle',name:'EVision · 차량 인텔리전스',kind:'next',root:'.'},
]);

export function appPath(id){return APPS.some(app=>app.id===id)?`/${id}/`:null;}
// Public entry links use the vehicle viewer's intro; canonical app/asset paths stay unchanged.
export function launchPath(id){return id==='battery_health'||id==='vehicle'?'/vehicle/?intro=pitstop':appPath(id);}
export function matchApp(pathname){return APPS.find(app=>pathname===`/${app.id}`||pathname.startsWith(`/${app.id}/`))||null;}
export function privatePath(pathname){
 try {const decoded=decodeURIComponent(pathname);return /[\\\x00]/.test(decoded)||decoded.split('/').some(p=>p==='..'||(p.startsWith('.')&&!['.vite','.vite-unified'].includes(p))||/\.(?:pem|key)$/i.test(p));}catch{return true;}
}
export function staticPath(app,pathname){
 if(!app||app.kind!=='static'||privatePath(pathname))return null;
 const relative=pathname.slice(app.id.length+2)||'index.html';
 if(!/^(?:index\.html|STORYBOARD\.md|(?:src|vendor|assets|output)\/)/.test(relative))return null;
 return /\.(?:html|js|mjs|css|json|png|jpe?g|webp|svg|woff2?|mp4|webm|wav|vtt|glb|md)$/i.test(relative)?relative:null;
}
export function redirectPath(pathname,search=''){
 if(pathname==='/')return '/park/'+search;
 const app=matchApp(pathname);if(app&&pathname===`/${app.id}`)return appPath(app.id)+search;
 const old=/^\/apps\/([\w-]+)\/(.*)$/.exec(pathname);
 return old&&appPath(old[1])?appPath(old[1])+old[2]+search:null;
}

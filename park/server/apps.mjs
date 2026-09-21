import path from 'node:path';
import {createServer as createVite} from 'vite';
import {APPS} from './routes.mjs';

export function createAppMiddleware({root,server,port,production}){
 const pending=new Map();let nextApp;
 async function get(app){
  if(!pending.has(app.id)){
   const loading=createVite({
    root:path.join(root,app.root),configFile:path.join(root,app.config),base:`/${app.id}/`,
    cacheDir:path.join(root,'node_modules/.vite-unified',app.id),
    server:{middlewareMode:true,hmr:{server,path:`/${app.id}-hmr`,clientPort:port},open:false,
     fs:{deny:['.env','.env.*','**/.git/**','**/.park-runtime/**','**/*.{pem,key}']},
     watch:{ignored:['**/.server-dist/**','**/.next*/**','**/reports/**','**/evidence/**','**/test-results/**']}},
    ...(app.id==='trading'?{define:{'import.meta.env.VITE_ROUTER_MODE':'true'}}:{}),
   });pending.set(app.id,loading);loading.catch(()=>pending.delete(app.id));
  }
  return pending.get(app.id);
 }
 async function next(){
  if(!nextApp){
   process.env.NEXT_PUBLIC_BASE_PATH='/vehicle';
   nextApp=import('next').then(async({default:next})=>{
    const app=next({dev:!production,dir:root,hostname:'127.0.0.1',port,httpServer:server,webpack:true});
    await app.prepare();return app;
   });nextApp.catch(()=>{nextApp=null;});
  }
  return nextApp;
 }
 return {
  async handle(app,req,res,notFound){
   if(app.kind==='next')return (await next()).getRequestHandler()(req,res);
   return (await get(app)).middlewares(req,res,notFound);
  },
  async upgrade(req,socket,head){
   if(req.url.startsWith('/vehicle/'))return (await next()).getUpgradeHandler()(req,socket,head);
   // Each Vite instance attaches an upgrade listener to this same HTTP server.
  },
  async close(){await Promise.allSettled([...pending.values()].map(async p=>(await p).close()));if(nextApp)await (await nextApp).close();},
  async warmPark(){if(!production)await get(APPS[0]);},
 };
}

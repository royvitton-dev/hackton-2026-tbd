'use client';
import { useSyncExternalStore } from 'react';
const key='ev_battery_selected_user_v1';
let memorySelection:string|null=null;
function subscribe(callback:()=>void){window.addEventListener('storage',callback);window.addEventListener('vehicle-selection',callback);return()=>{window.removeEventListener('storage',callback);window.removeEventListener('vehicle-selection',callback);};}
export function useSelectedUser(defaultId:string){
  return useSyncExternalStore(subscribe,()=>{try{return memorySelection??new URLSearchParams(window.location.search).get('user')??localStorage.getItem(key)??defaultId;}catch{return memorySelection??defaultId;}},()=>defaultId);
}
export function selectUser(userId:string){memorySelection=userId;try{localStorage.setItem(key,userId);const url=new URL(window.location.href);url.searchParams.set('user',userId);window.history.replaceState(null,'',url);}catch{}window.dispatchEvent(new Event('vehicle-selection'));}

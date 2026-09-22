// This prevents idle screen sleep, without changing the user's brightness setting.
export class ScreenAwake {
 constructor({wakeLock=globalThis.navigator?.wakeLock,visible=()=>!globalThis.document?.hidden}={}){this.api=wakeLock;this.visible=visible;this.active=false;this.generation=0;this.sentinel=null;this.status=wakeLock?'idle':'unsupported';}
 setState(state){const active=['mixing','countdown','racing'].includes(state)&&this.visible();if(active===this.active)return;this.active=active;const generation=++this.generation;
  if(!active){const held=this.sentinel;this.sentinel=null;this.status=this.api?'idle':'unsupported';if(held)Promise.resolve(held.release()).catch(()=>{});return;}
  if(!this.api)return;this.status='requesting';
  Promise.resolve().then(()=>this.api.request('screen')).then(sentinel=>{
   if(generation!==this.generation||!this.active||!this.visible()){return sentinel.release();}
   this.sentinel=sentinel;this.status=sentinel.released?'released':'held';
   sentinel.addEventListener('release',()=>{if(this.sentinel===sentinel){this.sentinel=null;this.status='released';}},{once:true});
  }).catch(()=>{if(generation===this.generation)this.status='unavailable';});
 }
 snapshot(){return {requested:this.active,status:this.status,held:!!this.sentinel&&!this.sentinel.released};}
}

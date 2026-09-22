import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchSpeech} from '../../voice/src/speech.mjs';
import {VoiceController} from '../../voice/src/controller.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),scratch=path.join(root,'movie/.movie-runtime/voice-demo'),out=path.join(root,'movie/assets/tour-demo');
await mkdir(scratch,{recursive:true});await mkdir(out,{recursive:true});
const events=[],started=Date.now();let sequence=0,submitted;
const record=(type,value)=>{events.push({at:(Date.now()-started)/1000,type,value});console.log(type,typeof value==='string'?value:JSON.stringify(value));};
const controller=new VoiceController({run:async prompt=>{submitted=prompt;record('preview',prompt);return {delivery:'warp-preview'};}});
controller.on('state',value=>record('state',value));controller.on('transcript',value=>record('transcript',value));
controller.on('notice',value=>record('notice',value));controller.on('feedback',value=>record('feedback',value));
try{
 for(const [index,phrase] of ['헤이 티비디야','파크 영상의 소개 문구를 정리해줘','티비디야 시작해줘'].entries()){
  const file=path.join(scratch,`${index}.aiff`);const spoken=spawnSync('/usr/bin/say',['-v','Yuna','-r','145','-o',file,phrase]);assert.equal(spoken.status,0);
  const session=await launchSpeech(path.join(root,'voice/.build/TBD Speech.app'),{audioFile:file,sound:false,dryRun:true});
  const lines=createInterface({input:session.stdout});let recognized=false;
  const timer=setTimeout(()=>session.stop(),35000);
  try{
   for await(const line of lines){
    const event=JSON.parse(line);
    if(event.type==='partial')record('partial',event.text);
    if(event.type==='error')throw new Error(event.message||JSON.stringify(event));
    if(event.type==='final'){
     record('recognized',event.text);controller.accept({...event,id:++sequence});await controller.pending;recognized=true;session.stop();break;
    }
   }
   assert(recognized,`No actual speech result for step ${index}`);
  }finally{clearTimeout(timer);session.stop();lines.close();}
  if(index===0)assert.equal(controller.state,'listening');
 }
 assert(submitted?.includes('소개')&&submitted.includes('정리'),'Speech must actually produce the requested command');
 await writeFile(path.join(out,'voice-session.json'),JSON.stringify({kind:'actual-apple-speech-file-recognition',input:'Yuna synthetic Korean audio',execution:'preview only; no Codex or Warp command sent',submitted,events},null,2)+'\n');
 console.log('PASS: actual audio recognition → wake → command collection → execution preview.');
}finally{controller.close();}

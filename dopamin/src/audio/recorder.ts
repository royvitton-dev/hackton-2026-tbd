import { buildVoicePrint, detectPitch, spectralFeatures } from '../core/voice';
import type { VoicePrint } from '../core/types';
import { duckRaceMusic } from './raceSound';

type RecognitionResult = { results: { [key:number]: { [key:number]: { transcript:string }; isFinal:boolean }; length:number }; resultIndex:number };
type Recognition = { lang:string;continuous:boolean;interimResults:boolean;onresult:((e:RecognitionResult)=>void)|null;onerror:((e:{error:string})=>void)|null;start:()=>void;stop:()=>void;abort:()=>void };
type SpeechWindow = Window & { SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition };
export type RecordingResult = { voice:VoicePrint;blob:Blob;transcript:string;transcriptError:string };
export type RecordingSession = { stop:()=>void;cancel:()=>void;result:Promise<RecordingResult> };
export const supportsTranscription = () => Boolean((window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition);

export async function recordVoice(onLevel:(level:number)=>void,onTranscript:(text:string)=>void):Promise<RecordingSession> {
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('이 브라우저는 마이크를 지원하지 않아요. Chrome에서 localhost로 열어 주세요.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
  let context:AudioContext;
  try {context=new AudioContext();await context.resume();}catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
  const analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.25;
  const source=context.createMediaStreamSource(stream);source.connect(analyser);
  const waveform=new Float32Array(analyser.fftSize),spectrum=new Float32Array(analyser.frequencyBinCount);
  const frames:{vector:number[];pitch:number}[]=[];
  const chunks:Blob[]=[];let recorder:MediaRecorder;
  try {recorder=new MediaRecorder(stream);}catch(error){stream.getTracks().forEach(t=>t.stop());await context.close();throw error;}
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const Speech=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
  let speech:Recognition|undefined,transcript='',transcriptError='';
  if(Speech){
    speech=new Speech();speech.lang='ko-KR';speech.continuous=true;speech.interimResults=true;
    speech.onresult=e=>{transcript=Array.from({length:e.results.length},(_,i)=>e.results[i][0].transcript).join(' ');onTranscript(transcript);};
    speech.onerror=e=>{transcriptError=e.error==='not-allowed'?'음성 받아쓰기 권한을 확인해 주세요.':'받아쓰기가 연결되지 않았어요. 아래에 직접 입력할 수 있어요.';};
    try {speech.start();}catch{transcriptError='음성 받아쓰기를 시작하지 못했어요. 직접 입력해 주세요.';}
  }else transcriptError='이 브라우저는 받아쓰기를 지원하지 않아요. 목소리는 저장되며 별명은 직접 입력할 수 있어요.';
  let cancelled=false,stopped=false;
  let resolveResult:(result:RecordingResult)=>void,rejectResult:(error:Error)=>void;
  const result=new Promise<RecordingResult>((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});
  const interval=window.setInterval(()=>{
    analyser.getFloatTimeDomainData(waveform);analyser.getFloatFrequencyData(spectrum);
    const rms=Math.sqrt(waveform.reduce((sum,v)=>sum+v*v,0)/waveform.length);onLevel(Math.min(1,rms*8));
    const pitch=detectPitch(waveform,context.sampleRate);if(pitch)frames.push({vector:spectralFeatures(spectrum,context.sampleRate),pitch});
  },100);
  let timer=0;
  const cleanup=()=>{clearInterval(interval);clearTimeout(timer);source.disconnect();stream.getTracks().forEach(t=>t.stop());void context.close();onLevel(0);};
  recorder.onstop=()=>{
    cleanup();
    if(cancelled){rejectResult(new Error('녹음을 취소했어요.'));return;}
    // Recognition may deliver its final transcript shortly after stop().
    window.setTimeout(()=>{try {resolveResult({voice:buildVoicePrint(frames),blob:new Blob(chunks,{type:recorder.mimeType}),transcript,transcriptError});}catch(e){rejectResult(e as Error);}finally{speech?.abort();}},300);
  };
  recorder.onerror=()=>{cancelled=true;cleanup();speech?.abort();rejectResult(new Error('녹음 중 오류가 발생했어요. 다시 시도해 주세요.'));};
  const stop=()=>{if(stopped)return;stopped=true;speech?.stop();if(recorder.state!=='inactive')recorder.stop();};
  const cancel=()=>{cancelled=true;speech?.abort();stop();};
  try {recorder.start();timer=window.setTimeout(stop,7000);}catch(error){cleanup();speech?.abort();throw error;}
  return {result,stop,cancel};
}

export { playTone } from './raceSound';
export function announceWinner(name:string,enabled:boolean) {
  if(!enabled||!('speechSynthesis'in window))return;
  duckRaceMusic();
  speechSynthesis.cancel();const text=new SpeechSynthesisUtterance(`${name} 님, 오늘 커피 잘 마실게요! 달다 달아 이썩겠네.`);text.lang='ko-KR';text.rate=1.05;speechSynthesis.speak(text);
}

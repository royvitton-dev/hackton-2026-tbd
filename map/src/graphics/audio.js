export class AudioGuide {
 constructor(){this.enabled=false;this.context=null;this.last='';}
 async toggle(){this.enabled=!this.enabled;if(this.enabled){const Audio=window.AudioContext||window.webkitAudioContext;this.context||=new Audio();await this.context.resume();this.play('소리 안내를 켰습니다.','notice');}else window.speechSynthesis?.cancel();return this.enabled;}
 play(message,kind='notice'){
  this.last=message;if(!this.enabled||!this.context)return;
  const now=this.context.currentTime;const freqs=kind==='fire'?[660,440,660]:kind==='arrive'?[523,659,784]:[523,659];
  freqs.forEach((f,i)=>{const osc=this.context.createOscillator(),gain=this.context.createGain();osc.frequency.value=f;gain.gain.setValueAtTime(0,now+i*.22);gain.gain.linearRampToValueAtTime(.07,now+i*.22+.02);gain.gain.exponentialRampToValueAtTime(.001,now+i*.22+.2);osc.connect(gain);gain.connect(this.context.destination);osc.start(now+i*.22);osc.stop(now+i*.22+.21);});
  if('speechSynthesis'in window){speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(message);utterance.lang='ko-KR';utterance.rate=1.08;speechSynthesis.speak(utterance);}
 }
 dispose(){window.speechSynthesis?.cancel();this.context?.close();}
}

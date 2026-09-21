import { useEffect, useRef, useState } from 'react';
import { Check, Mic, Square, Keyboard, AudioLines, ArrowRight, RotateCcw, Volume2, Trash2, ShieldCheck } from 'lucide-react';
import type { Driver } from '../core/types';
import { CHARACTERS, characterFor } from '../core/characters';
import { COLORS, DRINKS, matchCelebrity } from '../core/catalog';
import { cleanNickname, detectDrink, identifySpeaker } from '../core/voice';
import { getVoice } from '../core/storage';
import { recordVoice, type RecordingResult, type RecordingSession } from '../audio/recorder';
import Avatar from './Avatar';
import Modal from './Modal';

type Props={mode:'register'|'order'|'edit';drivers:Driver[];editing?:Driver;onSave:(driver:Driver,blob?:Blob)=>Promise<void>;onDelete?:(id:string)=>Promise<void>;onClose:()=>void};
export default function VoiceModal({mode,drivers,editing,onSave,onDelete,onClose}:Props) {
  const [nickname,setNickname]=useState(editing?.nickname||''),[drink,setDrink]=useState(editing?.drink||DRINKS[0]);
  const [status,setStatus]=useState<'idle'|'recording'|'ready'|'saving'>('idle'),[result,setResult]=useState<RecordingResult|null>(null),[manual,setManual]=useState(mode==='edit');
  const [level,setLevel]=useState(0),[transcript,setTranscript]=useState(''),[error,setError]=useState(''),[selected,setSelected]=useState(editing?.id||''),[matched,setMatched]=useState(false),[started,setStarted]=useState(false);
  const [celebrity,setCelebrity]=useState(()=>matchCelebrity(editing?.voice,()=>((editing?.avatar||0)+.1)/8));
  const [avatar,setAvatar]=useState(editing?.avatar??drivers.length%8),avatarChosen=useRef(Boolean(editing));
  const session=useRef<RecordingSession|null>(null),alive=useRef(true),audioRef=useRef<HTMLAudioElement|null>(null),audioUrl=useRef('');
  const color=editing?.color||COLORS[drivers.length%8];
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;session.current?.cancel();audioRef.current?.pause();if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);};},[]);
  const start=async()=>{
    setError('');setStarted(true);setTranscript('');setStatus('recording');
    try {
      const current=await recordVoice(v=>{if(alive.current)setLevel(v);},text=>{if(alive.current)setTranscript(text);});
      session.current=current;
      if(!alive.current){current.cancel();await current.result.catch(()=>{});return;}
      const data=await current.result;if(!alive.current)return;session.current=null;
      setResult(data);setStatus('ready');
      if(mode==='order') {
        const identity=identifySpeaker(data.voice,drivers);setSelected(identity.match?.id||'');setMatched(Boolean(identity.match));
        const beverage=detectDrink(data.transcript);if(beverage)setDrink(beverage);
        if(!identity.match)setError('목소리를 확실히 구분하지 못했어요. 주문할 레이서를 직접 선택해 주세요.');
      } else { const name=cleanNickname(data.transcript);if(name)setNickname(name);const mood=matchCelebrity(data.voice);setCelebrity(mood);if(!avatarChosen.current)setAvatar(mood.avatar); }
      if(data.transcriptError)setError(previous=>[previous,data.transcriptError].filter(Boolean).join(' '));
    }catch(e){if(alive.current){setStatus('idle');setError(e instanceof DOMException&&e.name==='NotAllowedError'?'마이크 권한이 꺼져 있어요. 주소창에서 허용하거나 직접 입력해 주세요.':(e as Error).message);}}
    finally {if(alive.current)setStarted(false);}
  };
  const save=async()=>{
    if(mode!=='order'&&!nickname.trim()){setError('별명을 입력해 주세요.');return;}
    if(mode==='order'&&!selected){setError('음료를 주문할 레이서를 선택해 주세요.');return;}
    if(mode!=='order'&&drivers.some(d=>d.id!==editing?.id&&d.nickname===nickname.trim())){setError('이미 등록된 별명이에요. 다른 별명을 정해 주세요.');return;}
    setStatus('saving');setError('');
    try {
      if(mode==='order'){const driver=drivers.find(d=>d.id===selected)!;await onSave({...driver,drink});}
      else await onSave({id:editing?.id||crypto.randomUUID(),nickname:nickname.trim(),drink,color,avatar,celebrity:result?celebrity.name:editing?.celebrity??celebrity.name,voice:result?.voice||editing?.voice,demo:false},result?.blob);
      onClose();
    }catch(e){setError((e as Error).message||'저장하지 못했어요. 다시 시도해 주세요.');setStatus('ready');}
  };
  const listen=async()=>{try{const blob=result?.blob||(editing?await getVoice(editing.id):undefined);if(!blob){setError('저장된 목소리가 없어요. 목소리를 먼저 등록해 주세요.');return;}audioRef.current?.pause();if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current=URL.createObjectURL(blob);audioRef.current=new Audio(audioUrl.current);await audioRef.current.play();}catch{setError('녹음을 재생하지 못했어요.');}};
  const fields=manual||result||mode==='edit';
  return <Modal title={mode==='order'?'목소리로 음료 주문':mode==='edit'?'레이서 프로필':'새로운 레이서 등록'} onClose={onClose}>
    <p className="modal-intro">{mode==='order'?'누가 말하는지 듣고, 마실 음료를 담아드릴게요.':'별명을 말하고, 함께 달릴 닌텐도 캐릭터를 골라 주세요.'}</p>
    <div className={`voice-zone ${status==='recording'?'listening':''}`}>
      {result&&mode!=='order'?<Avatar variant={avatar} color={color} className="large"/>:<div className="mic-orb"><Mic size={31}/></div>}
      <strong>{status==='recording'?'듣고 있어요. 편하게 말해 주세요':result?(mode==='order'?(matched?'목소리를 찾았어요!':'주문을 확인해 주세요'):`${characterFor(avatar).name} · ${celebrity.name} 보이스 무드`):mode==='order'?'“아이스 아메리카노 마실게요”':'“제 별명은 커피왕입니다”'}</strong>
      <span>{status==='recording'?'3초 이상 말하면 좋아요 · 7초 후 자동 완료':result?'등록된 목소리는 이 기기에 저장됩니다.':'마이크 버튼을 누르고 3초 이상 말해 주세요.'}</span>
      <div className="waveform" aria-hidden="true">{Array.from({length:35},(_,i)=><i key={i} style={{height:`${6+(status==='recording'?level*65:4)*(.4+Math.abs(Math.sin(i*2.3)))}px`,background:status==='recording'?'#fa6038':undefined}}/>)}</div>
      {status==='recording'?<button className="button primary" disabled={!session.current} onClick={()=>session.current?.stop()}><Square size={16}/>녹음 완료</button>:<button className="button primary" disabled={status==='saving'||started} onClick={start}>{result?<RotateCcw size={17}/>:<Mic size={17}/>} {result?'다시 녹음하기':'목소리 등록 시작'}</button>}
      {transcript&&<p className="transcript">“{transcript}”</p>}
    </div>
    {!fields&&<button className="text-button centered" onClick={()=>setManual(true)}><Keyboard size={16}/>직접 입력할게요</button>}
    {fields&&<div className="voice-fields">
      {mode==='order'?<label>주문할 레이서<select value={selected} onChange={e=>{setSelected(e.target.value);setMatched(false);}}><option value="">레이서를 선택하세요</option>{drivers.map(d=><option value={d.id} key={d.id}>{d.nickname}{d.voice?' · 목소리 등록됨':''}</option>)}</select></label>:<label>별명 <span>최대 12자</span><input autoComplete="off" maxLength={12} placeholder="트랙에서 불릴 나의 이름" value={nickname} onChange={e=>setNickname(e.target.value)}/></label>}
      <label>오늘 마실 음료<select value={drink} onChange={e=>setDrink(e.target.value)}>{[...new Set([...DRINKS,drink])].map(d=><option key={d}>{d}</option>)}</select></label>
      {mode!=='order'&&<fieldset className="character-picker"><legend>함께 달릴 캐릭터 <span>{characterFor(avatar).name}</span></legend><div className="character-options">{CHARACTERS.map(character=><button type="button" key={character.id} aria-label={`${character.name} 선택`} aria-pressed={avatar===character.id} disabled={status==='recording'||status==='saving'} className={avatar===character.id?'selected':''} onClick={()=>{setAvatar(character.id);avatarChosen.current=true;}}><Avatar variant={character.id} color={character.color}/><span>{character.name}</span>{avatar===character.id&&<Check size={12} aria-hidden="true"/>}</button>)}</div></fieldset>}
      {(result||editing?.voice)&&<button className="text-button" onClick={listen}><Volume2 size={16}/>저장할 목소리 들어보기</button>}
      {!result&&!editing?.voice&&mode!=='order'&&<p className="field-note"><AudioLines size={14}/>직접 입력 시 목소리 구분 기능은 등록 후 사용할 수 있어요.</p>}
    </div>}
    {error&&<p role="alert" className="form-error">{error}</p>}
    <div className="privacy-note"><ShieldCheck size={17}/><p>녹음·음성 특징은 이 브라우저에 저장돼요. 받아쓰기는 브라우저 제공업체 서버에서 처리될 수 있어요. 연예인 무드는 음역에 따른 재미용 배정이며 실제 인물 식별이 아닙니다.</p></div>
    <div className="modal-actions">{mode==='edit'&&onDelete?<button className="text-button danger" disabled={status==='saving'||status==='recording'} onClick={async()=>{setStatus('saving');try{await onDelete(editing!.id);onClose();}catch{setError('삭제하지 못했어요. 다시 시도해 주세요.');setStatus('ready');}}}><Trash2 size={16}/>레이서 삭제</button>:<span className="small-label"><Check size={14}/>최대 8명까지 함께</span>}<button className="button dark" disabled={!fields||status==='recording'||status==='saving'} onClick={save}>{status==='saving'?'저장 중…':mode==='order'?'음료 주문 완료':mode==='edit'?'변경 저장':'레이서 등록'}<ArrowRight size={17}/></button></div>
  </Modal>;
}

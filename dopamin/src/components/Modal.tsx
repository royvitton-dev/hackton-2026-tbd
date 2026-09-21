import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({title,children,onClose,wide=false}:{title:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null),closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();const cancel=(e:Event)=>{e.preventDefault();closeRef.current();};dialog.addEventListener('cancel',cancel);return()=>{dialog.removeEventListener('cancel',cancel);dialog.close();};},[]);
  return <dialog ref={ref} className={`modal ${wide?'wide':''}`} aria-label={title} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><div className="modal-header"><div><span className="eyebrow">BREW RACERS CLUB</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={21}/></button></div>{children}</dialog>;
}

import { useEffect, useState } from 'react';
import { characterFor } from '../core/characters';
import { avatarImage } from '../graphics/models';

export default function Avatar({variant,color,className=''}:{variant:number;color:string;className?:string}) {
  const [src,setSrc]=useState('');
  useEffect(()=>{try{setSrc(avatarImage(variant,color));}catch{setSrc('');}},[variant,color]);
  return <div className={`avatar ${className}`} style={{background:`${color}26`}}>{src?<img src={src} alt={`${characterFor(variant).name} 3D 얼굴 아바타`}/>:<span>☺</span>}</div>;
}

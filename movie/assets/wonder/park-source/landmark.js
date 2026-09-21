import * as THREE from 'three';
import logoUrl from '../assets/gs-group-ci.png';
import { group, cyl, torus, rounded, material, textSign } from './materials.js';

export function createLandmark(parent){
 const plaza=group(parent,0,.39,3.1);plaza.name='GS central landmark';
 const brass=material('#d6ac57',{metalness:.82,roughness:.26});
 cyl(plaza,3.65,.14,'#d2c4a9',0,.02,0);cyl(plaza,3.4,.19,'#f2e7d1',0,.17,0);
 for(const r of [3.45,3.66]){const ring=torus(plaza,r,.025,brass,0,.22,0);ring.rotation.x=-Math.PI/2;}
 const sign=group(plaza,0,.45,0);sign.rotation.y=.28;
 rounded(sign,6.9,3.9,.26,.14,brass,0,2.0,0);
 rounded(sign,6.75,3.75,.28,.13,material('#fffdf6',{roughness:.3,metalness:.08}),0,2.0,.025);
 // Preserve the official gradients as sRGB printing, independent of day/night exposure.
 const print=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});
 const logo=new THREE.Mesh(new THREE.PlaneGeometry(6.05,6.05*151/299),print);logo.position.set(0,2.03,.18);logo.name='GS group CI — original colors';sign.add(logo);
 plaza.userData.ready=new THREE.TextureLoader().loadAsync(logoUrl).then(map=>{map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;print.map=map;print.needsUpdate=true;});
 textSign(sign,'GROW SUSTAINABLY',3.3,.25,'#816c41','#f2e7d1',0,.12,.19);
 return plaza;
}

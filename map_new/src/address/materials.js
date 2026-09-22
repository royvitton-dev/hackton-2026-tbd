import * as THREE from 'three';
import {photoHomography} from './facades.js';

// Metric UVs keep a brick the same size on walls, reveals and roof structures.
export function metricUV(geometry, span=[1,1], offset=[0,0,0]) {
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=[];
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i)+offset[0],y=p.getY(i)+offset[1],z=p.getZ(i)+offset[2];
    uv.push((Math.abs(n.getX(i))>.5?z:x)/span[0],(Math.abs(n.getY(i))>.5?z:y)/span[1]);
  }
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); return geometry;
}

function relief(kind) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);let seed=9187;
  for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const v=198+(seed>>>27);pixels.data.set([v,v,v,255],i);}
  ctx.putImageData(pixels,0,0);ctx.fillStyle='#8b8b8b';
  if(kind==='brick')for(let row=0;row<8;row++){ctx.fillRect(0,row*32,256,2);for(let x=-(row%2)*32;x<256;x+=64)ctx.fillRect(x,row*32,2,32);}
  if(kind==='panel'||kind==='stone'){ctx.fillRect(0,0,256,1);ctx.fillRect(0,0,1,256);}
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
}

export class PhotoMaterials {
  constructor(base, renderer) { this.base=base;this.renderer=renderer;this.alive=true;this.records=new Map();this.materials=[];this.textures=new Set();this.wallMaterials=[]; }
  plain(color,options={}) {const m=new THREE.MeshStandardMaterial({color,roughness:.8,...options});this.materials.push(m);return m;}
  surface(spec, {usePhotos=true,color,tintable=true}={}) {
    const m=this.plain(color || spec.color);m.userData.span=spec.photo?.span||spec.span||[1,1];
    const bump=relief(spec.kind);if(spec.photo&&spec.span)bump.repeat.set(spec.photo.span[0]/spec.span[0],spec.photo.span[1]/spec.span[1]);
    this.textures.add(bump);m.bumpMap=bump;m.bumpScale=spec.kind==='brick'?.009:.005;
    if(tintable)this.wallMaterials.push(m);
    if(!spec.photo||!usePhotos||color)return m;
    const photo=spec.photo, h=photoHomography(photo.quad),matrix=new THREE.Matrix3().set(...h);
    m.onBeforeCompile=shader=>{
      shader.uniforms.atlasPhotoMatrix={value:matrix};
      shader.fragmentShader='uniform mat3 atlasPhotoMatrix;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        #ifdef USE_MAP
          vec2 atlasTile = 1.0-abs(mod(vMapUv,2.0)-1.0);
          vec3 atlasPhotoUv = atlasPhotoMatrix * vec3(atlasTile.x, 1.0-atlasTile.y, 1.0);
          vec2 atlasSourceUv = atlasPhotoUv.xy / atlasPhotoUv.z;
          vec4 sampledDiffuseColor = texture2D(map, vec2(atlasSourceUv.x, 1.0-atlasSourceUv.y));
          diffuseColor *= sampledDiffuseColor;
        #endif
      `);
    };
    m.customProgramCacheKey=()=> 'atlas-photo-surface-v1';
    let record=this.records.get(photo.file);
    if(!record) {
      record={file:photo.file,state:'loading',materials:[]};this.records.set(photo.file,record);
      new THREE.TextureLoader().load(new URL(photo.file,new URL(this.base,location.href)).href,texture=>{
        if(!this.alive){texture.dispose();return;}
        texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
        this.textures.add(texture);record.texture=texture;record.state='ready';
        for(const mat of record.materials){mat.map=texture;mat.color.set('#ffffff');mat.needsUpdate=true;}
        this.onChange?.();
      },undefined,()=>{if(this.alive){record.state='failed';this.onChange?.();}});
    }
    record.materials.push(m);
    if(record.texture){m.map=record.texture;m.color.set('#ffffff');m.needsUpdate=true;}
    return m;
  }
  glass(warm=false) {
    const c=document.createElement('canvas');c.width=128;c.height=256;const ctx=c.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,105,256);gradient.addColorStop(0,warm?'#e5bb84':'#83a6b9');gradient.addColorStop(.45,warm?'#af8654':'#506775');gradient.addColorStop(.48,warm?'#e0ba7c':'#8197a0');gradient.addColorStop(1,warm?'#756451':'#2b3538');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,256);
    ctx.fillStyle=warm?'#f2d4a746':'#edf7ff15';for(let x=14;x<128;x+=35)ctx.fillRect(x,0,8,256);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;this.textures.add(texture);
    return this.plain('#ffffff',{map:texture,roughness:.21,metalness:.18,emissive:warm?'#725322':'#000000',emissiveIntensity:.3});
  }
  setColor(color){for(const m of this.wallMaterials){m.map=null;m.color.set(color);m.needsUpdate=true;}for(const r of this.records.values())r.materials=[];}
  snapshot(){return [...this.records.values()].map(({file,state})=>({file,state}));}
  dispose(){this.alive=false;this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());}
}

import {Renderer3D} from './renderer3d.js';
import {Renderer as Renderer2D} from './renderer2d.js';
export class Renderer {
 constructor(canvas){try{return new Renderer3D(canvas);}catch(error){console.warn('WebGL unavailable; using 2.5D fallback.',error.message);const replacement=canvas.cloneNode();canvas.replaceWith(replacement);const fallback=new Renderer2D(replacement);fallback.mode='canvas2d';return fallback;}}
}

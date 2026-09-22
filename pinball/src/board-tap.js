export function installBoardTap(canvas,toggle,reset){
 let down=null;canvas.tabIndex=0;canvas.setAttribute('aria-description','공을 누르면 따라 확대, 빈 곳을 누르면 부분 확대. 다시 누르거나 Escape로 원래 시점.');
 canvas.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0)down={id:e.pointerId,x:e.clientX,y:e.clientY,time:performance.now()};});
 canvas.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10)down=null;});
 canvas.addEventListener('pointercancel',()=>down=null);
 canvas.addEventListener('pointerup',e=>{const start=down;down=null;if(start&&start.id===e.pointerId&&performance.now()-start.time<700)toggle(e.clientX,e.clientY);});
 canvas.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&!e.repeat){e.preventDefault();e.stopPropagation();const r=canvas.getBoundingClientRect();toggle(r.x+r.width/2,r.y+r.height/2);}if(e.key==='Escape'){reset();e.stopPropagation();}});
}

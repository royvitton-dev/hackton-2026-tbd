const finite=Number.isFinite;
export function rectangleOverlap(a,b){
 const w=Math.max(0,Math.min(a.x+a.width/2,b.x+b.width/2)-Math.max(a.x-a.width/2,b.x-b.width/2));
 const d=Math.max(0,Math.min(a.z+a.depth/2,b.z+b.depth/2)-Math.max(a.z-a.depth/2,b.z-b.depth/2));
 return w*d/(a.width*a.depth+b.width*b.depth-w*d);
}

// Repeated parallel stems, plausible bay proportions and a common end line.
// This detects drawing geometry, not parking permission or accessibility.
export function detectParking({data,width,height},{metersPerPixel=.05,crop={x:0,y:0,width:1,height:1},thresholds=[85,140,185,220,235,245,250,254]}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4e6||data?.length!==width*height*4||!finite(metersPerPixel)||metersPerPixel<=0||metersPerPixel>10)throw Error('주차 구획 분석의 이미지·축척을 확인하세요.');
 if(![crop.x,crop.y,crop.width,crop.height].every(finite)||crop.x<0||crop.y<0||crop.width<=0||crop.height<=0||crop.x+crop.width>1.00001||crop.y+crop.height>1.00001||!Array.isArray(thresholds)||!thresholds.length||thresholds.length>12||thresholds.some(n=>!Number.isInteger(n)||n<1||n>255))throw Error('주차 구획 분석 영역·명암 기준을 확인하세요.');
 const candidates=[],x0=Math.floor(width*crop.x),x1=Math.min(width,Math.ceil(width*(crop.x+crop.width))),z0=Math.floor(height*crop.y),z1=Math.min(height,Math.ceil(height*(crop.y+crop.height)));
 const tolerance=Math.max(2,Math.round(.25/metersPerPixel)),merge=Math.max(1,.15/metersPerPixel);
 for(const threshold of thresholds){
  const mask=new Uint8Array(width*height);
  for(let z=z0;z<z1;z++)for(let x=x0;x<x1;x++){const i=z*width+x;mask[i]=data[i*4+3]>100&&Math.max(data[i*4],data[i*4+1],data[i*4+2])<threshold?1:0;}
  for(const vertical of [true,false]){
   const major=vertical?height:width,minor=vertical?width:height,groups=[];
   const ink=(cross,along)=>cross>=0&&along>=0&&cross<minor&&along<major?mask[vertical?along*width+cross:cross*width+along]:0;
   for(let cross=vertical?x0:z0;cross<(vertical?x1:z1);cross++){
    let start=-1;
    for(let p=vertical?z0:x0;p<=(vertical?z1:x1);p++){
     const dark=p<(vertical?z1:x1)&&ink(cross,p);if(dark&&start<0)start=p;
     if(!dark&&start>=0){
      const length=(p-start)*metersPerPixel;
      if(length>=3.8&&length<=6.8){
       let g=groups.find(g=>Math.abs(g.start-start)<=tolerance&&Math.abs(g.end-p)<=tolerance);
       if(!g){g={start,end:p,stems:[]};groups.push(g);}g.stems.push({cross,start,end:p});
      }
      start=-1;
     }
    }
   }
   for(const g of groups){
    const stems=[];
    for(const s of g.stems){const last=stems.at(-1);if(last&&s.cross-last.right<=merge){last.right=s.cross;last.cross=(last.left+last.right)/2;}else stems.push({...s,left:s.cross,right:s.cross});}
    let row=[];
    const finish=()=>{
     if(row.length>=3){
      const widths=row.map(r=>(r.b-r.a)*metersPerPixel),mean=widths.reduce((a,b)=>a+b,0)/widths.length;
      const regularity=1-Math.min(1,Math.max(...widths.map(w=>Math.abs(w-mean)))/mean);
      for(const r of row){
       const px=vertical?(r.a+r.b)/2:(g.start+g.end)/2,pz=vertical?(g.start+g.end)/2:(r.a+r.b)/2;
       const pw=vertical?r.b-r.a:g.end-g.start,pd=vertical?g.end-g.start:r.b-r.a;
       candidates.push({x:(px-width*(crop.x+crop.width/2))*metersPerPixel,z:(pz-height*(crop.y+crop.height/2))*metersPerPixel,width:pw*metersPerPixel,depth:pd*metersPerPixel,pixelBounds:{x:px-pw/2,y:pz-pd/2,width:pw,height:pd},threshold,repeatedBays:row.length,patternScore:Math.round(100*(regularity*.6+r.endSupport*.3+Math.min(1,row.length/8)*.1))});
      }
     }
     row=[];
    };
    for(let i=1;i<stems.length;i++){
     const a=stems[i-1].cross,b=stems[i].cross,span=(b-a)*metersPerPixel,ratio=(g.end-g.start)/(b-a);
     let support=0;
     if(span>=1.7&&span<=3.8&&ratio>=1.45&&ratio<=3.2){
      for(const end of [g.start,g.end-1])for(let p=Math.max(0,end-tolerance);p<=Math.min(major-1,end+tolerance);p++){
       let count=0,total=0;for(let cross=Math.ceil(a);cross<=Math.floor(b);cross++){count+=ink(cross,p);total++;}support=Math.max(support,count/total);
      }
     }
     if(support>=.5)row.push({a,b,endSupport:support});else finish();
    }
    finish();
   }
  }
 }
 // Multiple contrast levels can identify the same rectangle. Keep the most
 // regular supported geometry; do not count repeated detections as new bays.
 candidates.sort((a,b)=>b.patternScore-a.patternScore||a.threshold-b.threshold||a.z-b.z||a.x-b.x);
 const unique=[];for(const c of candidates)if(!unique.some(s=>rectangleOverlap(c,s)>.6))unique.push(c);
 unique.sort((a,b)=>a.z-b.z||a.x-b.x);
 const spaces=unique.slice(0,400).map((s,i)=>({...s,id:'detected-bay-'+(i+1),kind:'parking-candidate',status:'review-required',classification:'unknown',method:'repeated-raster-stems-and-end-line'}));
 return {spaces,sourcePixels:{width,height},metersPerPixel,crop,thresholds,truncated:unique.length>400,limitations:['평행선·구획 비례에 따른 후보입니다. 빗금·전용 표시·시설 용도는 자동 확정하지 않습니다.','패턴 점수는 선의 반복·정렬 정도이며 실제 주차면일 확률이나 전파 점수가 아닙니다.']};
}

export function matchReviewedParking(detection,spaces){
 const used=new Set();
 return {...detection,spaces:detection.spaces.map(candidate=>{
  const matches=spaces.filter(s=>['parking','ev'].includes(s.kind)&&!used.has(s.id)).map(s=>({space:s,overlap:rectangleOverlap(candidate,s)})).sort((a,b)=>b.overlap-a.overlap);
  const match=matches[0];if(!match||match.overlap<.6)return candidate;
  used.add(match.space.id);return {...candidate,reviewedSpaceId:match.space.id,reviewOverlap:match.overlap,classification:match.space.accessible?'accessible':match.space.reserved?'reserved':match.space.kind==='ev'?'ev':'parking'};
 })};
}

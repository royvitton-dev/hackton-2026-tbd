import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
let patch='';
for(const file of ['model.rs','core.rs']) {
  const a=fs.readFileSync(path.join(root,'baseline/src',file),'utf8').trimEnd().split('\n');
  const b=fs.readFileSync(path.join(root,'candidate/src',file),'utf8').trimEnd().split('\n');
  const width=b.length+1, dp=new Uint32Array((a.length+1)*width);
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i*width+j]=a[i]===b[j]?1+dp[(i+1)*width+j+1]:Math.max(dp[(i+1)*width+j],dp[i*width+j+1]);
  const ops=[];let i=0,j=0;
  while(i<a.length||j<b.length) {
    if(i<a.length&&j<b.length&&a[i]===b[j]){ops.push([' ',a[i],i+1,j+1]);i++;j++;}
    else if(i<a.length&&(j===b.length||dp[(i+1)*width+j]>=dp[i*width+j+1])){ops.push(['-',a[i],i+1,j+1]);i++;}
    else {ops.push(['+',b[j],i+1,j+1]);j++;}
  }
  const ranges=[];
  for(let n=0;n<ops.length;n++)if(ops[n][0]!==' '){const start=Math.max(0,n-3),end=Math.min(ops.length,n+4);if(ranges.length&&start<=ranges.at(-1)[1])ranges.at(-1)[1]=end;else ranges.push([start,end]);}
  patch+=`--- a/trading/engine/src/${file}\n+++ b/trading/engine/src/${file}\n`;
  for(const [start,end] of ranges) {
    const h=ops.slice(start,end),old=h.filter(x=>x[0]!=='+').length,neo=h.filter(x=>x[0]!=='-').length;
    patch+=`@@ -${ops[start][2]},${old} +${ops[start][3]},${neo} @@\n`+h.map(x=>x[0]+x[1]).join('\n')+'\n';
  }
}
fs.writeFileSync(path.join(root,'proposal.patch'),patch,{flag:'wx'});
console.log(patch);

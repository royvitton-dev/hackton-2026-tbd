import {getDocument,GlobalWorkerOptions} from '../../../map/node_modules/pdfjs-dist/build/pdf.mjs';
import workerUrl from '../../../map/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=workerUrl;
export async function firstPdfPage(data){
 const task=getDocument({data:new Uint8Array(data),isEvalSupported:false});
 try{
  const document=await task.promise;if(document.numPages>500)throw Error('500쪽 이하의 도면 PDF를 선택하세요.');
  const page=await document.getPage(1),viewport=page.getViewport({scale:1}),size=page.getViewport({scale:1000/Math.max(viewport.width,viewport.height)}),canvas=window.document.createElement('canvas');
  canvas.width=Math.round(size.width);canvas.height=Math.round(size.height);const context=canvas.getContext('2d',{willReadFrequently:true});
  await page.render({canvasContext:context,viewport:size}).promise;
  return {pixels:context.getImageData(0,0,canvas.width,canvas.height),image:canvas.toDataURL('image/png')};
 }finally{await task.destroy();}
}

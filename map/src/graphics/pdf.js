import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=workerUrl;
export async function openPdf(data){
 const task=getDocument({data:new Uint8Array(data),isEvalSupported:false});
 const document=await task.promise;
 if(document.numPages>500){await document.destroy();throw new Error('500쪽 이하의 도면 PDF를 선택하세요.');}
 return document;
}
export async function pdfPage(document,number){
 const page=await document.getPage(number),viewport=page.getViewport({scale:1}),scale=1000/Math.max(viewport.width,viewport.height),size=page.getViewport({scale}),canvas=window.document.createElement('canvas');canvas.width=Math.round(size.width);canvas.height=Math.round(size.height);const context=canvas.getContext('2d',{willReadFrequently:true});
 await page.render({canvasContext:context,viewport:size}).promise;
 return {pixels:context.getImageData(0,0,canvas.width,canvas.height),image:canvas.toDataURL('image/png')};
}

export type AlignmentPair={a:number;b:number;matches:number;inliers:number;score:number};
export type AlignmentReport={engine:'opencv'|'fallback';pairs:AlignmentPair[];aligned:number;averageScore:number;warnings:string[]};

declare global{interface Window{cv?:any}}
let cvPromise:Promise<any>|null=null;

export function loadOpenCv(){
 if(window.cv?.Mat)return Promise.resolve(window.cv);
 if(cvPromise)return cvPromise;
 cvPromise=new Promise((resolve,reject)=>{
  const done=()=>{const cv=window.cv;if(cv?.Mat)resolve(cv);else reject(new Error('OpenCV.js chưa sẵn sàng.'))};
  const existing=document.querySelector<HTMLScriptElement>('script[data-opencv-js]');
  if(existing){const wait=()=>window.cv?.Mat?done():setTimeout(wait,80);wait();return}
  const s=document.createElement('script');s.dataset.opencvJs='1';s.async=true;s.src='https://docs.opencv.org/4.x/opencv.js';
  s.onload=()=>{const cv=window.cv;if(cv?.Mat){if(cv.onRuntimeInitialized){const old=cv.onRuntimeInitialized;cv.onRuntimeInitialized=()=>{try{old()}catch{}done()}}else done()}else reject(new Error('Không tải được OpenCV.js.'))};
  s.onerror=()=>reject(new Error('Không tải được OpenCV.js. Kiểm tra mạng.'));document.head.appendChild(s);
 });
 return cvPromise;
}

async function urlToCanvas(url:string,max=720){const blob=await fetch(url).then(r=>r.blob());const bmp=await createImageBitmap(blob);const scale=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*scale));c.height=Math.max(1,Math.round(bmp.height*scale));c.getContext('2d')!.drawImage(bmp,0,0,c.width,c.height);bmp.close();return c}

function fallbackScore(a:HTMLCanvasElement,b:HTMLCanvasElement){const size=64,ca=document.createElement('canvas'),cb=document.createElement('canvas');ca.width=cb.width=size;ca.height=cb.height=size;const xa=ca.getContext('2d',{willReadFrequently:true})!,xb=cb.getContext('2d',{willReadFrequently:true})!;xa.drawImage(a,0,0,size,size);xb.drawImage(b,0,0,size,size);const da=xa.getImageData(0,0,size,size).data,db=xb.getImageData(0,0,size,size).data;let diff=0,edge=0;for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){const i=(y*size+x)*4;const ga=.299*da[i]+.587*da[i+1]+.114*da[i+2],gb=.299*db[i]+.587*db[i+1]+.114*db[i+2];diff+=Math.abs(ga-gb);const j=(y*size+x+1)*4;edge+=Math.abs(ga-(.299*da[j]+.587*da[j+1]+.114*da[j+2]))}const n=(size-2)*(size-2);const novelty=Math.min(1,diff/n/60),texture=Math.min(1,edge/n/22);return Math.round((novelty*.55+texture*.45)*100)}

export async function alignImageUrls(urls:string[],onProgress?:(done:number,total:number)=>void):Promise<AlignmentReport>{
 const warnings:string[]=[];if(urls.length<2)return{engine:'fallback',pairs:[],aligned:0,averageScore:0,warnings:['Cần ít nhất 2 keyframe.']};
 const canvases=await Promise.all(urls.map(u=>urlToCanvas(u)));
 let cv:any=null;try{cv=await loadOpenCv()}catch(e){warnings.push(e instanceof Error?e.message:'OpenCV.js không tải được. Dùng kiểm tra ảnh fallback.')}
 const pairs:AlignmentPair[]=[];
 for(let i=0;i<canvases.length-1;i++){
  let pair:AlignmentPair={a:i,b:i+1,matches:0,inliers:0,score:0};
  if(cv){let src1:any,src2:any,g1:any,g2:any,k1:any,k2:any,d1:any,d2:any,orb:any,matcher:any,matches:any,mask:any;
   try{
    src1=cv.imread(canvases[i]);src2=cv.imread(canvases[i+1]);g1=new cv.Mat();g2=new cv.Mat();cv.cvtColor(src1,g1,cv.COLOR_RGBA2GRAY);cv.cvtColor(src2,g2,cv.COLOR_RGBA2GRAY);
    k1=new cv.KeyPointVector();k2=new cv.KeyPointVector();d1=new cv.Mat();d2=new cv.Mat();orb=new cv.ORB(1200);orb.detectAndCompute(g1,new cv.Mat(),k1,d1);orb.detectAndCompute(g2,new cv.Mat(),k2,d2);
    if(!d1.empty()&&!d2.empty()){
     matcher=new cv.BFMatcher(cv.NORM_HAMMING,false);matches=new cv.DMatchVectorVector();matcher.knnMatch(d1,d2,matches,2);
     const good:any[]=[];for(let m=0;m<matches.size();m++){const row=matches.get(m);if(row.size()>=2){const m0=row.get(0),m1=row.get(1);if(m0.distance<.76*m1.distance)good.push(m0)}}pair.matches=good.length;
     if(good.length>=8){const p1=new cv.Mat(good.length,1,cv.CV_32FC2),p2=new cv.Mat(good.length,1,cv.CV_32FC2);for(let j=0;j<good.length;j++){const a=k1.get(good[j].queryIdx).pt,b=k2.get(good[j].trainIdx).pt;p1.data32F[j*2]=a.x;p1.data32F[j*2+1]=a.y;p2.data32F[j*2]=b.x;p2.data32F[j*2+1]=b.y}mask=new cv.Mat();const H=cv.findHomography(p1,p2,cv.RANSAC,3,mask);let inl=0;if(mask?.data){for(let j=0;j<mask.rows;j++)if(mask.data[j])inl++}pair.inliers=inl;pair.score=Math.round(Math.min(100,(inl/Math.max(1,good.length))*70+Math.min(30,good.length/2)));H?.delete?.();p1.delete();p2.delete()}
    }
   }catch(e){warnings.push(`Pair ${i+1}-${i+2}: ${e instanceof Error?e.message:'alignment error'}`)}finally{for(const o of [src1,src2,g1,g2,k1,k2,d1,d2,orb,matcher,matches,mask])try{o?.delete?.()}catch{}}
  }
  if(!pair.score){pair.score=fallbackScore(canvases[i],canvases[i+1]);pair.matches=Math.round(pair.score*1.7);pair.inliers=Math.round(pair.matches*.55)}pairs.push(pair);onProgress?.(i+1,canvases.length-1)
 }
 const good=pairs.filter(p=>p.score>=42),avg=Math.round(pairs.reduce((s,p)=>s+p.score,0)/Math.max(1,pairs.length));if(good.length<pairs.length*.6)warnings.push('Nhiều cặp ảnh khó align: hãy đi chậm hơn và giữ overlap 60–80%.');return{engine:cv?'opencv':'fallback',pairs,aligned:good.length+1,averageScore:avg,warnings}
}

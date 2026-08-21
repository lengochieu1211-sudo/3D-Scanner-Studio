import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';

export type ObjectBox={x:number;y:number;width:number;height:number};
export type ObjectKeyframe={
  id:string;
  angleDeg:number;
  createdAt:string;
  width:number;
  height:number;
  aspect:number;
  mask:Uint8Array;
  foregroundRatio:number;
  confidence:number;
  source:'orientation'|'timed';
  previewUrl?:string;
};
export type ReconMesh={positions:Float32Array;indices:Uint32Array;occupied:number;resolution:number;bounds:{width:number;height:number;depth:number};};

const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const colorDist=(r:number,g:number,b:number,rr:number,gg:number,bb:number)=>Math.hypot(r-rr,g-gg,b-bb);

function cleanup(mask:Uint8Array,w:number,h:number){
  const tmp=new Uint8Array(mask.length);
  // close small gaps: dilation then erosion
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    let on=0;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)on=Math.max(on,mask[(y+yy)*w+x+xx]);
    tmp[y*w+x]=on;
  }
  const out=new Uint8Array(mask.length);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    let on=1;for(let yy=-1;yy<=1;yy++)for(let xx=-1;xx<=1;xx++)on=Math.min(on,tmp[(y+yy)*w+x+xx]);
    out[y*w+x]=on;
  }
  return out;
}

function keepBestComponent(mask:Uint8Array,w:number,h:number){
  const seen=new Uint8Array(mask.length);let best:number[]=[];let bestScore=-Infinity;
  const cx=(w-1)/2,cy=(h-1)/2;
  for(let i=0;i<mask.length;i++){
    if(!mask[i]||seen[i])continue;
    const stack=[i],cells:number[]=[];seen[i]=1;let sx=0,sy=0;
    while(stack.length){const p=stack.pop()!;cells.push(p);const x=p%w,y=Math.floor(p/w);sx+=x;sy+=y;
      const ns=[p-1,p+1,p-w,p+w];
      for(const n of ns){if(n<0||n>=mask.length||seen[n]||!mask[n])continue;const nx=n%w,ny=Math.floor(n/w);if(Math.abs(nx-x)+Math.abs(ny-y)!==1)continue;seen[n]=1;stack.push(n)}
    }
    const mx=sx/cells.length,my=sy/cells.length;const dist=Math.hypot((mx-cx)/w,(my-cy)/h);const score=cells.length*(1.35-clamp(dist,0,1));
    if(score>bestScore){bestScore=score;best=cells}
  }
  const out=new Uint8Array(mask.length);for(const i of best)out[i]=1;return out;
}

export function makeObjectMask(source:HTMLVideoElement|HTMLCanvasElement,box:ObjectBox|null,targetWidth=128){
  const sw=source instanceof HTMLVideoElement?source.videoWidth:source.width;
  const sh=source instanceof HTMLVideoElement?source.videoHeight:source.height;
  const fallback={x:sw*.16,y:sh*.12,width:sw*.68,height:sh*.76};
  const b=box&&box.width>24&&box.height>24?box:fallback;
  const pad=.08;const x=clamp(Math.floor(b.x-b.width*pad),0,sw-2),y=clamp(Math.floor(b.y-b.height*pad),0,sh-2);
  const rw=clamp(Math.floor(b.width*(1+pad*2)),32,sw-x),rh=clamp(Math.floor(b.height*(1+pad*2)),32,sh-y);
  const mw=targetWidth,mh=clamp(Math.round(targetWidth*rh/rw),64,180);
  const c=document.createElement('canvas');c.width=mw;c.height=mh;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(source,x,y,rw,rh,0,0,mw,mh);
  const img=ctx.getImageData(0,0,mw,mh),d=img.data;
  let br=0,bg=0,bb=0,n=0;const border=Math.max(3,Math.round(Math.min(mw,mh)*.08));
  for(let yy=0;yy<mh;yy++)for(let xx=0;xx<mw;xx++)if(xx<border||yy<border||xx>=mw-border||yy>=mh-border){const p=(yy*mw+xx)*4;br+=d[p];bg+=d[p+1];bb+=d[p+2];n++}
  br/=n;bg/=n;bb/=n;
  const raw=new Uint8Array(mw*mh);let fg=0;const threshold=34;
  for(let yy=1;yy<mh-1;yy++)for(let xx=1;xx<mw-1;xx++){
    const p=(yy*mw+xx)*4;const dist=colorDist(d[p],d[p+1],d[p+2],br,bg,bb);
    const p2=(yy*mw+xx+1)*4,p3=((yy+1)*mw+xx)*4;const grad=Math.max(colorDist(d[p],d[p+1],d[p+2],d[p2],d[p2+1],d[p2+2]),colorDist(d[p],d[p+1],d[p+2],d[p3],d[p3+1],d[p3+2]));
    const centerBias=1-Math.min(1,Math.hypot((xx-mw/2)/(mw*.7),(yy-mh/2)/(mh*.7)));
    const on=dist>threshold || (dist>20&&grad>20&&centerBias>.15);
    if(on){raw[yy*mw+xx]=1;fg++}
  }
  let mask=keepBestComponent(cleanup(raw,mw,mh),mw,mh);fg=mask.reduce((a,v)=>a+v,0);const ratio=fg/mask.length;
  // If segmentation collapses, use a conservative ellipse so reconstruction can still proceed with a low confidence warning.
  if(ratio<.04||ratio>.9){mask=new Uint8Array(mw*mh);for(let yy=0;yy<mh;yy++)for(let xx=0;xx<mw;xx++){const nx=(xx-mw/2)/(mw*.45),ny=(yy-mh/2)/(mh*.47);if(nx*nx+ny*ny<1)mask[yy*mw+xx]=1}fg=mask.reduce((a,v)=>a+v,0)}
  const foregroundRatio=fg/mask.length;const confidence=clamp(1-Math.abs(foregroundRatio-.42)/.55,0,1);
  return {mask,width:mw,height:mh,aspect:rh/rw,foregroundRatio,confidence,crop:{x,y,width:rw,height:rh},previewCanvas:c};
}

export function angularDistance(a:number,b:number){let d=Math.abs((a-b)%360);if(d>180)d=360-d;return d}

export function reconstructVisualHull(frames:ObjectKeyframe[],resolution=44,widthMeters=1):ReconMesh{
  if(frames.length<6)throw new Error('Cần ít nhất 6 góc quét để dựng Visual Hull.');
  const aspects=[...frames].map(f=>f.aspect).sort((a,b)=>a-b);const aspect=aspects[Math.floor(aspects.length/2)]||1;
  const nx=resolution,ny=Math.max(16,Math.round(resolution*aspect)),nz=resolution;const occ=new Uint8Array(nx*ny*nz);let occupied=0;
  const idx=(x:number,y:number,z:number)=>(z*ny+y)*nx+x;
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const px=(x+.5)/nx-.5,py=.5-(y+.5)/ny,pz=(z+.5)/nz-.5;let inside=true;
    for(const f of frames){const a=f.angleDeg*Math.PI/180;const u=px*Math.cos(a)+pz*Math.sin(a);const mx=Math.round((u+.5)*(f.width-1));const my=Math.round((.5-py)*(f.height-1));if(mx<0||mx>=f.width||my<0||my>=f.height||!f.mask[my*f.width+mx]){inside=false;break}}
    if(inside){occ[idx(x,y,z)]=1;occupied++}
  }
  if(!occupied)throw new Error('Không tìm thấy thể tích giao nhau. Hãy quét đủ vòng và giữ vật thể ở giữa khung.');
  const pos:number[]=[];const ind:number[]=[];const sx=widthMeters/nx,sy=(widthMeters*aspect)/ny,sz=widthMeters/nz;
  const faces=[
    {d:[-1,0,0],v:[[0,0,0],[0,1,0],[0,1,1],[0,0,1]]},{d:[1,0,0],v:[[1,0,1],[1,1,1],[1,1,0],[1,0,0]]},
    {d:[0,-1,0],v:[[0,0,1],[1,0,1],[1,0,0],[0,0,0]]},{d:[0,1,0],v:[[0,1,0],[1,1,0],[1,1,1],[0,1,1]]},
    {d:[0,0,-1],v:[[1,0,0],[1,1,0],[0,1,0],[0,0,0]]},{d:[0,0,1],v:[[0,0,1],[0,1,1],[1,1,1],[1,0,1]]}
  ] as const;
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)if(occ[idx(x,y,z)]){
    for(const f of faces){const xx=x+f.d[0],yy=y+f.d[1],zz=z+f.d[2];if(xx>=0&&xx<nx&&yy>=0&&yy<ny&&zz>=0&&zz<nz&&occ[idx(xx,yy,zz)])continue;const base=pos.length/3;
      for(const v of f.v){pos.push((x+v[0]-nx/2)*sx,(ny/2-(y+v[1]))*sy,(z+v[2]-nz/2)*sz)}ind.push(base,base+1,base+2,base,base+2,base+3)
    }
  }
  return {positions:new Float32Array(pos),indices:new Uint32Array(ind),occupied,resolution,bounds:{width:widthMeters,height:widthMeters*aspect,depth:widthMeters}};
}

export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
export function meshToObj(mesh:ReconMesh){let s='# 3D Scanner Studio visual hull\n';for(let i=0;i<mesh.positions.length;i+=3)s+=`v ${mesh.positions[i]} ${mesh.positions[i+1]} ${mesh.positions[i+2]}\n`;for(let i=0;i<mesh.indices.length;i+=3)s+=`f ${mesh.indices[i]+1} ${mesh.indices[i+1]+1} ${mesh.indices[i+2]+1}\n`;return new Blob([s],{type:'text/plain'})}
export function meshToPly(mesh:ReconMesh){const count=mesh.positions.length/3;let s=`ply\nformat ascii 1.0\nelement vertex ${count}\nproperty float x\nproperty float y\nproperty float z\nelement face ${mesh.indices.length/3}\nproperty list uchar int vertex_indices\nend_header\n`;for(let i=0;i<mesh.positions.length;i+=3)s+=`${mesh.positions[i]} ${mesh.positions[i+1]} ${mesh.positions[i+2]}\n`;for(let i=0;i<mesh.indices.length;i+=3)s+=`3 ${mesh.indices[i]} ${mesh.indices[i+1]} ${mesh.indices[i+2]}\n`;return new Blob([s],{type:'application/octet-stream'})}
export async function meshToGlb(mesh:ReconMesh){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));g.setIndex(new THREE.BufferAttribute(mesh.indices,1));g.computeVertexNormals();const material=new THREE.MeshStandardMaterial({color:0xa8b8d8,roughness:.78,metalness:.02});const obj=new THREE.Mesh(g,material);obj.name='ScannedObject_VisualHull';const scene=new THREE.Scene();scene.add(obj);const exporter=new GLTFExporter();const data=await exporter.parseAsync(scene,{binary:true});if(!(data instanceof ArrayBuffer))throw new Error('Không tạo được GLB nhị phân.');return new Blob([data],{type:'model/gltf-binary'})}

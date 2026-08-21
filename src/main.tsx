import React,{useEffect,useMemo,useRef,useState} from 'react';
import{createRoot}from'react-dom/client';
import'./style.css';
import{detectFrame,prepareVision,type VisionFrame,type VisionMode}from'./vision';
import{clearProject,estimateStoredBytes,getRecentFrameUrls,listFrameMeta,loadLatestSession,saveFrame,saveProject,saveSession,testIndexedDb,type StoredFrameMeta}from'./storage';
import{ManualPeer,deviceId as makeDeviceId,makeSessionCode,type DeviceRole,type DeviceStatus,type ScanState}from'./multidevice';

type Mode='room'|'object'|'human'|'mocap';
type OverlayKey='guide'|'pose'|'face'|'hands'|'objects';
type TestState='idle'|'running'|'ok'|'warn'|'bad';
type SelfTest={label:string;state:TestState;detail:string};
const modes:[Mode,string,string][]=[
 ['room','Quét phòng','Hiện trạng, tường, sàn, trần, cửa và đo đạc'],
 ['object','Quét vật thể','Theo dõi vật thể, chụp nhiều góc, chuẩn bị mesh/texture'],
 ['human','Quét người','Khung xương + mặt + bàn tay, chuẩn bị model/rig game'],
 ['mocap','Motion Capture','Theo dõi pose/mặt/tay để ghi chuyển động']
];
const POSE_CONNECTIONS=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
const HAND_CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const sectorNames=['Trước','Trước-phải','Phải','Sau-phải','Sau','Sau-trái','Trái','Trước-trái'];

function App(){
 const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),stream=useRef<MediaStream|null>(null),raf=useRef(0),lastDetect=useRef(0),lastVision=useRef<VisionFrame>({}),orientationDeg=useRef<number|null>(null),thumbUrls=useRef<string[]>([]);
 const localDeviceId=useRef(makeDeviceId()),peer=useRef<ManualPeer|null>(null),statusTimer=useRef<number|null>(null);
 const projectId=useRef(globalThis.crypto?.randomUUID?.()??`project-${Date.now()}`);
 const projectCreatedAt=useRef(new Date().toISOString());
 const [mode,setMode]=useState<Mode>('room'),[on,setOn]=useState(false),[frameCount,setFrameCount]=useState(0),[msg,setMsg]=useState('Chọn chế độ rồi bật camera.');
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[deviceId,setDeviceId]=useState(''),[resolution,setResolution]=useState('1280x720');
 const [overlay,setOverlay]=useState<Record<OverlayKey,boolean>>({guide:true,pose:true,face:true,hands:true,objects:true});
 const [visionReady,setVisionReady]=useState(false),[visionBusy,setVisionBusy]=useState(false),[fps,setFps]=useState(0),[videoSize,setVideoSize]=useState('—');
 const [secure]=useState(window.isSecureContext),[webgl,setWebgl]=useState(false),[webgpu,setWebgpu]=useState(false),[xr,setXr]=useState(false),[idbOk,setIdbOk]=useState(false),[swOk,setSwOk]=useState(false);
 const [thumbs,setThumbs]=useState<string[]>([]),[storedBytes,setStoredBytes]=useState(0),[coverage,setCoverage]=useState<boolean[]>(Array(8).fill(false)),[orientationEnabled,setOrientationEnabled]=useState(false);
 const [quality,setQuality]=useState({score:0,brightness:0,blur:0,tracking:0,coverage:0,label:'Chưa đủ dữ liệu'});
 const [tests,setTests]=useState<SelfTest[]>([]);
 const [multiOpen,setMultiOpen]=useState(false),[peerMode,setPeerMode]=useState<'none'|'host'|'join'>('none'),[sessionCode,setSessionCode]=useState(makeSessionCode()),[signalOut,setSignalOut]=useState(''),[signalIn,setSignalIn]=useState(''),[peerState,setPeerState]=useState('Chưa kết nối');
 const [scanState,setScanState]=useState<ScanState>('idle'),[deviceRole,setDeviceRole]=useState<DeviceRole>('auto'),[remoteDevices,setRemoteDevices]=useState<DeviceStatus[]>([]),[remoteCoverage,setRemoteCoverage]=useState<boolean[]>(Array(8).fill(false)),[calibrationMm,setCalibrationMm]=useState('1000'),[calibrationNote,setCalibrationNote]=useState('');
 const [testLab,setTestLab]=useState(false);
 const modeInfo=useMemo(()=>modes.find(x=>x[0]===mode)!,[mode]);
 const combinedCoverage=coverage.map((v,i)=>v||remoteCoverage[i]);
 const coveragePct=Math.round(combinedCoverage.filter(Boolean).length/combinedCoverage.length*100);

 useEffect(()=>{
  const c=document.createElement('canvas');setWebgl(!!(c.getContext('webgl2')||c.getContext('webgl')));setWebgpu('gpu'in navigator);setXr('xr'in navigator);
  void testIndexedDb().then(setIdbOk);
  void loadLatestSession().then(s=>{if(s){setSessionCode(s.code);setScanState((s.scanState as ScanState)||'idle')}});
  if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js').then(()=>setSwOk(true)).catch(()=>setSwOk(false));}
  return()=>{stopCamera(false);revokeThumbs();disconnectPeer()};
 },[]);
 useEffect(()=>{if(on){stopCamera(false);void startCamera();}else setVisionReady(false)},[mode]);
 useEffect(()=>{setCoverage(Array(8).fill(false));setQuality({score:0,brightness:0,blur:0,tracking:0,coverage:0,label:'Chưa đủ dữ liệu'})},[mode]);

 function revokeThumbs(){thumbUrls.current.forEach(URL.revokeObjectURL);thumbUrls.current=[]}
 async function refreshStored(coverageOverride?:boolean[]){const [allMeta,bytes,urls]=await Promise.all([listFrameMeta(projectId.current),estimateStoredBytes(projectId.current),getRecentFrameUrls(projectId.current,mode)]);const meta=allMeta.filter(frame=>frame.mode===mode);const activeCoverage=coverageOverride??coverage;revokeThumbs();thumbUrls.current=urls;setThumbs(urls);setFrameCount(meta.length);setStoredBytes(bytes);setQuality(updateQualityFromMetaValues(meta,Math.round(activeCoverage.filter(Boolean).length/activeCoverage.length*100)))}
 async function enumerate(){try{const list=await navigator.mediaDevices.enumerateDevices();setDevices(list.filter(x=>x.kind==='videoinput'));}catch{setDevices([])}}
 async function startCamera(forcedDeviceId?:string){
  if(!navigator.mediaDevices?.getUserMedia){setMsg('Trình duyệt này không hỗ trợ camera web.');return}
  stopCamera(false);setMsg('Đang mở camera…');
  try{
   const [w,h]=resolution.split('x').map(Number);const selectedId=forcedDeviceId??deviceId;
   const videoConstraint:MediaTrackConstraints=selectedId?{deviceId:{exact:selectedId},width:{ideal:w},height:{ideal:h}}:{facingMode:{ideal:'environment'},width:{ideal:w},height:{ideal:h}};
   const s=await navigator.mediaDevices.getUserMedia({video:videoConstraint,audio:false});stream.current=s;if(video.current){video.current.srcObject=s;await video.current.play()}
   setOn(true);setVideoSize(`${video.current?.videoWidth||w}×${video.current?.videoHeight||h}`);await enumerate();
   const track=s.getVideoTracks()[0];if(track&&!deviceId)setDeviceId(track.getSettings().deviceId??'');
   if(mode==='human'||mode==='mocap'||mode==='object'){
    setVisionBusy(true);setVisionReady(false);setMsg('Camera sẵn sàng. Đang tải mô hình nhận diện…');
    try{await prepareVision(mode as VisionMode);setVisionReady(true);setMsg(mode==='object'?'Đã bật nhận diện vật thể. Quét chậm quanh vật thể.':'Đã bật khung xương, khuôn mặt và bàn tay. Giữ toàn thân trong khung.');}
    catch(e){console.error(e);setMsg('Camera hoạt động nhưng không tải được mô hình AI. Kiểm tra Internet rồi thử lại.');}
    finally{setVisionBusy(false)}
   }else setMsg('Camera sẵn sàng. Quét chậm, chồng lấp nhiều góc và tránh rung.');
   loop();
  }catch(e){console.error(e);setOn(false);setMsg('Không mở được camera. Hãy cấp quyền camera; trên điện thoại cần HTTPS hoặc localhost.')}
 }
 function stopCamera(update=true){cancelAnimationFrame(raf.current);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;if(update){setOn(false);setMsg('Camera đã dừng.')}}
 function switchCamera(){if(devices.length<2)return;const idx=Math.max(0,devices.findIndex(d=>d.deviceId===deviceId));const nextId=devices[(idx+1)%devices.length].deviceId;setDeviceId(nextId);stopCamera(false);void startCamera(nextId)}
 async function capture(){
  if(!video.current||!video.current.videoWidth)return;
  const v=video.current,c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;const ctx=c.getContext('2d');if(!ctx)return;ctx.drawImage(v,0,0);
  const metrics=analyzeImage(ctx,c,lastVision.current,mode);const sector=orientationToSector(orientationDeg.current);const nextCoverage=sector===null?coverage:coverage.map((value,i)=>i===sector?true:value);if(sector!==null)setCoverage(nextCoverage);
  const blob=await canvasToBlob(c);const id=globalThis.crypto?.randomUUID?.()??`frame-${Date.now()}`;const createdAt=new Date().toISOString();
  const track=stream.current?.getVideoTracks()[0];const settings=track?.getSettings();
  await saveFrame({id,projectId:projectId.current,createdAt,mode,width:c.width,height:c.height,brightness:metrics.brightness,blurScore:metrics.blurScore,trackingScore:metrics.trackingScore,orientationDeg:orientationDeg.current,coverageSector:sector,size:blob.size,blob,deviceId:localDeviceId.current,sessionId:sessionCode,cameraSettings:{deviceId:settings?.deviceId,width:settings?.width,height:settings?.height,facingMode:settings?.facingMode,frameRate:settings?.frameRate}});
  await saveProject({id:projectId.current,version:4,mode,createdAt:projectCreatedAt.current,updatedAt:createdAt,frameCount:frameCount+1,sessionId:sessionCode,scanState});
  if(sector!==null)peer.current?.send({type:'capture',payload:{sector,createdAt,quality:metrics.trackingScore}});
  await refreshStored(nextCoverage);setMsg(`Đã lưu frame vào thiết bị. ${metrics.message}`);
 }
 async function exportProject(){const allFrames=await listFrameMeta(projectId.current);const frames=allFrames.filter(frame=>frame.mode===mode);const payload={version:4,projectId:projectId.current,session:{code:sessionCode,scanState,deviceRole,remoteDevices},mode,createdAt:projectCreatedAt.current,exportedAt:new Date().toISOString(),device:{id:localDeviceId.current,videoSize,orientationEnabled},quality,coverage:combinedCoverage.map((done,i)=>({sector:i,name:sectorNames[i],done})),frames,note:'Ảnh gốc được lưu cục bộ trong IndexedDB; JSON chứa metadata, camera settings và session multi-device; không nhúng Base64.'};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});downloadBlob(blob,`${mode}-scan-project-v4.json`)}
 async function clearShots(){await clearProject(projectId.current);projectId.current=globalThis.crypto?.randomUUID?.()??`project-${Date.now()}`;projectCreatedAt.current=new Date().toISOString();setCoverage(Array(8).fill(false));setQuality({score:0,brightness:0,blur:0,tracking:0,coverage:0,label:'Chưa đủ dữ liệu'});await refreshStored();setMsg('Đã xóa project cục bộ và tạo phiên mới.')}
 function loop(){const tick=(now:number)=>{const v=video.current,c=canvas.current;if(v&&c&&v.readyState>=2){if(c.width!==v.videoWidth||c.height!==v.videoHeight){c.width=v.videoWidth;c.height=v.videoHeight}const ctx=c.getContext('2d');ctx?.clearRect(0,0,c.width,c.height);if(visionReady&&now-lastDetect.current>55){const dt=now-lastDetect.current;lastDetect.current=now;setFps(Math.round(1000/Math.max(dt,1)));try{const frame=detectFrame(v,mode as VisionMode,now);lastVision.current=frame;drawVision(ctx,c,frame,overlay)}catch(e){console.error(e)}}drawGuide(ctx,c,mode,overlay.guide)}raf.current=requestAnimationFrame(tick)};raf.current=requestAnimationFrame(tick)}

 async function persistSession(nextState=scanState){await saveSession({id:`session-${sessionCode}`,version:4,code:sessionCode,createdAt:projectCreatedAt.current,updatedAt:new Date().toISOString(),scanState:nextState,hostDeviceId:localDeviceId.current,calibration:{type:'reference-length',referenceMm:Number(calibrationMm)||0,notes:calibrationNote},devices:[{id:localDeviceId.current,role:deviceRole},...remoteDevices]})}
 function localStatus():DeviceStatus{return{id:localDeviceId.current,name:navigator.userAgent.includes('Mobile')?'Điện thoại này':'Thiết bị này',role:deviceRole,online:true,fps, resolution:videoSize,tracking:quality.tracking,depth:xr,battery:null,lastSeen:Date.now()}}
 function bindPeer(p:ManualPeer){p.onState=s=>setPeerState(s);p.onMessage=m=>{if(m.type==='status'){const d=m.payload as DeviceStatus;setRemoteDevices(xs=>[...xs.filter(x=>x.id!==d.id),{...d,lastSeen:Date.now()}])}if(m.type==='state')setScanState(m.payload as ScanState);if(m.type==='capture'){const sector=Number((m.payload as {sector?:number}).sector);if(Number.isInteger(sector)&&sector>=0&&sector<8)setRemoteCoverage(x=>x.map((v,i)=>i===sector?true:v))}};if(statusTimer.current)clearInterval(statusTimer.current);statusTimer.current=window.setInterval(()=>p.send({type:'status',payload:localStatus()}),2000)}
 async function createHostOffer(){disconnectPeer();const p=new ManualPeer();peer.current=p;bindPeer(p);setPeerMode('host');setPeerState('Đang tạo Offer…');try{setSignalOut(await p.createOffer());setPeerState('Gửi Offer này sang máy Join, rồi dán Answer nhận lại.')}catch(e){console.error(e);setPeerState('Không tạo được WebRTC Offer')}}
 async function createJoinAnswer(){disconnectPeer();const p=new ManualPeer();peer.current=p;bindPeer(p);setPeerMode('join');setPeerState('Đang nhận Offer…');try{setSignalOut(await p.acceptOffer(signalIn.trim()));setPeerState('Gửi Answer này lại máy Host.')}catch(e){console.error(e);setPeerState('Offer không hợp lệ hoặc WebRTC bị chặn')}}
 async function applyHostAnswer(){if(!peer.current)return;try{await peer.current.acceptAnswer(signalIn.trim());setPeerState('Đã nhận Answer, đang kết nối P2P…')}catch(e){console.error(e);setPeerState('Answer không hợp lệ')}}
 function disconnectPeer(){if(statusTimer.current){clearInterval(statusTimer.current);statusTimer.current=null}peer.current?.close();peer.current=null;setPeerMode('none');setRemoteDevices([])}
 async function changeScanState(next:ScanState){if((scanState==='scanning'||scanState==='paused')&&next==='idle'&&frameCount>0&&!confirm('Phiên đang có dữ liệu. Chuyển về Idle nhưng dữ liệu vẫn được giữ. Tiếp tục?'))return;setScanState(next);peer.current?.send({type:'state',payload:next});await persistSession(next)}
 async function saveCalibration(){await persistSession(scanState);peer.current?.send({type:'calibration',payload:{referenceMm:Number(calibrationMm)||0,notes:calibrationNote}});setMsg('Đã lưu calibration của phiên. Dùng cùng marker/kích thước chuẩn trên mọi thiết bị.')}
 function toggleTestLab(){if(testLab){setTestLab(false);setRemoteDevices([]);setRemoteCoverage(Array(8).fill(false));return}setTestLab(true);const now=Date.now();setRemoteDevices([{id:'sim-front',name:'Phone Front',role:'front',online:true,fps:30,resolution:'1920×1080',tracking:94,depth:true,battery:82,lastSeen:now,simulated:true},{id:'sim-left',name:'Phone Left',role:'left',online:true,fps:28,resolution:'1280×720',tracking:88,depth:false,battery:67,lastSeen:now,simulated:true},{id:'sim-back',name:'Phone Back',role:'back',online:true,fps:24,resolution:'1280×720',tracking:79,depth:false,battery:51,lastSeen:now,simulated:true}]);setRemoteCoverage([true,true,true,true,true,false,false,true])}

 function toggle(k:OverlayKey){setOverlay(x=>({...x,[k]:!x[k]}))}
 function markSector(index:number){setCoverage(x=>x.map((v,i)=>i===index?!v:v))}
 async function enableOrientation(){
  try{
   const ctor=DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<'granted'|'denied'>};
   if(ctor.requestPermission){const result=await ctor.requestPermission();if(result!=='granted'){setMsg('Bạn chưa cấp quyền cảm biến hướng. Có thể đánh dấu góc quét thủ công.');return}}
   window.addEventListener('deviceorientation',onOrientation,{passive:true});setOrientationEnabled(true);setMsg('Đã bật cảm biến hướng. Khi ghi frame, app sẽ tự đánh dấu góc quét nếu thiết bị cung cấp alpha.')
  }catch{setMsg('Thiết bị/trình duyệt không cho phép cảm biến hướng. Dùng đánh dấu coverage thủ công.')}
 }
 function onOrientation(e:DeviceOrientationEvent){if(typeof e.alpha==='number')orientationDeg.current=e.alpha}
 async function runSelfTest(){
  const rows:SelfTest[]=[];const push=(label:string,state:TestState,detail:string)=>{rows.push({label,state,detail});setTests([...rows])};setTests([{label:'Đang kiểm tra',state:'running',detail:'Vui lòng giữ trang mở…'}]);
  push('Ngữ cảnh an toàn',secure?'ok':'bad',secure?'HTTPS/localhost hợp lệ':'Camera trên mobile có thể bị chặn vì không phải HTTPS/localhost');
  push('WebGL',webgl?'ok':'bad',webgl?'Có thể dựng preview 3D':'Không tìm thấy WebGL');
  push('WebGPU',webgpu?'ok':'warn',webgpu?'Có WebGPU cho xử lý nâng cao':'Không có WebGPU; sẽ fallback WebGL/WASM');
  push('WebXR',xr?'ok':'warn',xr?'Có WebXR API':'Không có WebXR; depth/AR có thể không dùng được trên web');
  const idb=await testIndexedDb();setIdbOk(idb);push('IndexedDB',idb?'ok':'bad',idb?'Có thể lưu ảnh cục bộ':'Không thể lưu project cục bộ');
  push('Service Worker',swOk?'ok':'warn',swOk?'PWA shell đã đăng ký':'Chưa xác nhận service worker');
  if(!navigator.mediaDevices?.getUserMedia){push('Camera','bad','Không có getUserMedia');return}
  try{const test=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480}},audio:false});const track=test.getVideoTracks()[0];const settings=track.getSettings();push('Camera','ok',`${settings.width??'?'}×${settings.height??'?'} • ${settings.facingMode??'không rõ hướng'}`);test.getTracks().forEach(t=>t.stop());await enumerate()}catch{push('Camera','bad','Không mở được camera hoặc chưa cấp quyền')}
  const score=selfTestScore(rows);setMsg(`Self-Test hoàn tất: ${score.label}. ${score.detail}`)
 }

 return <main>
  <header className="appHeader"><div className="brand"><div className="brandMark"><span></span></div><div><b>3D Scanner Studio</b><span>Capture • Reconstruct • Rig • Export</span></div></div><div className="headerMeta"><span className="livePill"><em></em> Local-first</span><i>v0.5 UI Pro</i></div></header>
  <section className="modes">{modes.map(([id,t,d],idx)=><button key={id} className={mode===id?'active':''} onClick={()=>setMode(id)}><span className="modeIcon">{['▦','◇','◎','⌁'][idx]}</span><span className="modeCopy"><strong>{t}</strong><small>{d}</small></span><span className="modeArrow">›</span></button>)}</section>
  <section className="work">
   <div className="camera"><div className="cameraTop"><span className={on?'recording':'standby'}><em></em>{on?'LIVE SCAN':'READY'}</span><span>{modeInfo[1]}</span></div><video ref={video} autoPlay playsInline muted/><canvas ref={canvas}/>{!on&&<div className="empty"><div className="emptyOrb"><span></span></div><b>Sẵn sàng quét</b><small>Bật camera để bắt đầu phiên scan</small></div>}<div className="cornerTL"></div><div className="cornerTR"></div><div className="cornerBL"></div><div className="cornerBR"></div><div className="guideText">{mode==='human'||mode==='mocap'?'Giữ toàn thân trong khung • quay chậm • tránh che tay/chân':'Quét chậm • chồng lấp 60–80% • tránh rung'}</div></div>
   <aside><div className="asideHead"><div><span className="eyebrow">SCAN CONTROL</span><h2>{modeInfo[1]}</h2></div><span className="qualityDot"></span></div><p className="status">{visionBusy?'⏳ ':''}{msg}</p>
    <div className="actions"><button className="primary" onClick={()=>on?stopCamera():void startCamera()}>{on?'Dừng camera':'Bật camera'}</button><button disabled={!on||devices.length<2} onClick={switchCamera}>Đổi camera</button><button disabled={!on} onClick={()=>void capture()}>Ghi khung hình</button></div>
    <div className="control"><label>Camera</label><select value={deviceId} onChange={e=>setDeviceId(e.target.value)} disabled={on}><option value="">Tự chọn camera sau</option>{devices.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`Camera ${i+1}`}</option>)}</select></div>
    <div className="control"><label>Độ phân giải</label><select value={resolution} onChange={e=>setResolution(e.target.value)} disabled={on}><option>1280x720</option><option>1920x1080</option><option>640x480</option></select></div>
    {(mode==='human'||mode==='mocap')&&<div className="toggles"><b>Lớp nhận diện</b><label><input type="checkbox" checked={overlay.pose} onChange={()=>toggle('pose')}/> Khung xương</label><label><input type="checkbox" checked={overlay.face} onChange={()=>toggle('face')}/> Face mesh</label><label><input type="checkbox" checked={overlay.hands} onChange={()=>toggle('hands')}/> Bàn tay/ngón</label><label><input type="checkbox" checked={overlay.guide} onChange={()=>toggle('guide')}/> Khung hướng dẫn</label></div>}
    {mode==='object'&&<div className="toggles"><b>Lớp nhận diện</b><label><input type="checkbox" checked={overlay.objects} onChange={()=>toggle('objects')}/> Bounding box + nhãn</label><label><input type="checkbox" checked={overlay.guide} onChange={()=>toggle('guide')}/> Khung hướng dẫn</label></div>}
    <div className="stats"><div><b>{frameCount}</b><span>frame cục bộ</span></div><div><b>{on?videoSize:'—'}</b><span>camera</span></div><div><b>{visionReady?fps:'—'}</b><span>AI FPS</span></div></div>
    <div className="quality"><div className="score"><b>{quality.score||'—'}</b><span>Quality</span></div><div><strong>{quality.label}</strong><small>Sáng {quality.brightness}% • Nét {quality.blur}% • Tracking {quality.tracking}% • Coverage {coveragePct}%</small></div></div>
    {thumbs.length>0&&<div className="thumbs">{thumbs.map((s,i)=><img key={i} src={s} alt="Frame đã lưu"/>)}</div>}
    <div className="actions compact"><button disabled={!frameCount} onClick={()=>void exportProject()}>Xuất metadata JSON</button><button disabled={!frameCount} onClick={()=>void clearShots()}>Xóa project</button></div>
    <div className="storage">IndexedDB: {idbOk?'Sẵn sàng':'Chưa sẵn sàng'} • Đã lưu {formatBytes(storedBytes)}</div>
   </aside>
  </section>
  <section className="coverage premiumPanel"><div className="coverageHead"><div><h3>Coverage 360°</h3><p>Coverage hợp nhất máy này + các thiết bị P2P/Test Lab. Chạm từng hướng để đánh dấu thủ công khi không có cảm biến.</p></div><button onClick={()=>void enableOrientation()}>{orientationEnabled?'Cảm biến hướng ✓':'Bật cảm biến hướng'}</button></div><div className="coverageGrid">{sectorNames.map((name,i)=><button key={name} className={combinedCoverage[i]?'done':''} onClick={()=>markSector(i)}><b>{i+1}</b><span>{name}{remoteCoverage[i]&&!coverage[i]?' • remote':''}</span></button>)}</div></section>

  <section className="multi premiumPanel"><div className="coverageHead"><div><h3>Multi-Device Scan</h3><p>WebRTC P2P thật, không cần server dữ liệu. GitHub Pages không có signaling nên bản này ghép nối Offer/Answer thủ công để tránh chức năng QR/mã phòng giả.</p></div><button onClick={()=>setMultiOpen(x=>!x)}>{multiOpen?'Thu gọn':'Mở điều khiển'}</button></div>
  {multiOpen&&<div className="multiBody"><div className="sessionBar"><b>Phiên {sessionCode}</b><span>{peerMode.toUpperCase()} • {peerState}</span><select value={deviceRole} onChange={e=>setDeviceRole(e.target.value as DeviceRole)}><option value="auto">Auto</option><option value="front">Front</option><option value="back">Back</option><option value="left">Left</option><option value="right">Right</option><option value="top">Top</option></select></div>
  <div className="stateFlow">{(['idle','calibrating','ready','scanning','paused','processing','review','export'] as ScanState[]).map(s=><button key={s} className={scanState===s?'active':''} onClick={()=>void changeScanState(s)}>{s}</button>)}</div>
  <div className="pairGrid"><div><h4>Host</h4><button onClick={()=>void createHostOffer()}>Tạo Offer</button><button disabled={!peer.current||peerMode!=='host'||!signalIn.trim()} onClick={()=>void applyHostAnswer()}>Nhận Answer</button></div><div><h4>Join</h4><button disabled={!signalIn.trim()} onClick={()=>void createJoinAnswer()}>Dán Offer → tạo Answer</button></div><div><h4>Test Lab</h4><button onClick={toggleTestLab}>{testLab?'Tắt giả lập':'Giả lập 3 điện thoại'}</button></div></div>
  <div className="signalGrid"><label>Chuỗi nhận từ máy kia<textarea value={signalIn} onChange={e=>setSignalIn(e.target.value)} placeholder="Dán Offer hoặc Answer ở đây"/></label><label>Chuỗi gửi sang máy kia<textarea readOnly value={signalOut} onFocus={e=>e.currentTarget.select()} placeholder="Offer/Answer sẽ xuất hiện ở đây"/></label></div>
  <div className="calibration"><label>Kích thước chuẩn (mm)<input value={calibrationMm} onChange={e=>setCalibrationMm(e.target.value)} inputMode="decimal"/></label><label>Ghi chú marker/calibration<input value={calibrationNote} onChange={e=>setCalibrationNote(e.target.value)} placeholder="VD: QR board 1000 mm"/></label><button onClick={()=>void saveCalibration()}>Lưu calibration</button></div>
  <div className="deviceTable"><div className="deviceRow head"><span>Thiết bị</span><span>Vai trò</span><span>FPS</span><span>Camera</span><span>Tracking</span><span>Depth</span></div><div className="deviceRow"><span>Máy này</span><span>{deviceRole}</span><span>{fps||'—'}</span><span>{videoSize}</span><span>{quality.tracking}%</span><span>{xr?'Có':'—'}</span></div>{remoteDevices.map(d=><div className="deviceRow" key={d.id}><span>{d.name}{d.simulated?' (Test)':''}</span><span>{d.role}</span><span>{d.fps}</span><span>{d.resolution}</span><span>{d.tracking}%</span><span>{d.depth?'Có':'—'}</span></div>)}</div>
  <p className="privacyNote">P2P chỉ truyền trạng thái/điều khiển trong foundation này; ảnh scan vẫn lưu cục bộ từng máy. Việc truyền frame/point cloud dung lượng lớn sẽ được bật sau khi có chunking + retry để tránh mất dữ liệu.</p></div>}</section>

  <section className="diagnostics premiumPanel"><div className="diagnosticHead"><div><h3>Device & Scan Self-Test</h3><p>Kiểm tra nhanh trước khi bắt đầu quét trên điện thoại/PC.</p></div><button onClick={()=>void runSelfTest()}>Chạy Self-Test</button></div><div className="chips"><span className={secure?'ok':'bad'}>HTTPS/localhost {secure?'✓':'✕'}</span><span className={webgl?'ok':'bad'}>WebGL {webgl?'✓':'✕'}</span><span className={webgpu?'ok':'warn'}>WebGPU {webgpu?'✓':'—'}</span><span className={xr?'ok':'warn'}>WebXR {xr?'✓':'—'}</span><span className={idbOk?'ok':'bad'}>IndexedDB {idbOk?'✓':'✕'}</span><span className={swOk?'ok':'warn'}>PWA {swOk?'✓':'—'}</span></div>{tests.length>0&&<div className="testList">{tests.map((t,i)=><div key={`${t.label}-${i}`} className={t.state}><b>{t.label}</b><span>{t.detail}</span></div>)}</div>}</section>
  <section className="logic premiumPanel"><h3>Pipeline đúng logic</h3><div className="pipeline"><span>Multi-Camera</span><b>→</b><span>Sync + Calibration</span><b>→</b><span>Camera Pose/Depth</span><b>→</b><span>Tracking + QA</span><b>→</b><span>Point Cloud</span><b>→</b><span>Mesh</span><b>→</b><span>Clean/Retopo</span><b>→</b><span>Rig/Skin</span><b>→</b><span>GLB/FBX</span></div><p>v0.4 đã có session state machine, recovery metadata, P2P trạng thái, calibration, shared coverage và Test Lab. Camera pose/SLAM, depth fusion, point cloud và reconstruction 3D thật vẫn chưa được giả lập thành tính năng hoàn thành.</p></section>
  <footer><span>3D Scanner Studio</span><span>Dữ liệu scan lưu cục bộ • Không tự upload</span></footer>
 </main>
}

function canvasToBlob(canvas:HTMLCanvasElement):Promise<Blob>{return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Không tạo được JPEG')),'image/jpeg',.88))}
function downloadBlob(blob:Blob,name:string){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function formatBytes(bytes:number){if(bytes<1024)return`${bytes} B`;if(bytes<1024*1024)return`${(bytes/1024).toFixed(1)} KB`;return`${(bytes/1024/1024).toFixed(1)} MB`}
function orientationToSector(alpha:number|null){if(alpha===null||!Number.isFinite(alpha))return null;return Math.round((((alpha%360)+360)%360)/45)%8}
function updateAvg(values:number[]){return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0}
function qualityLabel(score:number){if(score>=85)return'Tốt để tiếp tục';if(score>=70)return'Khá • nên bổ sung góc thiếu';if(score>=50)return'Trung bình • nên quét lại vài vùng';return score?'Yếu • cần quét lại':'Chưa đủ dữ liệu'}
function updateQualityFromMetaValues(meta:StoredFrameMeta[],coverage:number){const brightness=updateAvg(meta.map(x=>Math.round(100-Math.min(100,Math.abs(x.brightness-0.5)*200))));const blur=updateAvg(meta.map(x=>x.blurScore));const tracking=updateAvg(meta.map(x=>x.trackingScore));const base=meta.length?Math.round(brightness*.25+blur*.3+tracking*.3+coverage*.15):0;return{score:base,brightness,blur,tracking,coverage,label:qualityLabel(base)}}
function analyzeImage(ctx:CanvasRenderingContext2D,c:HTMLCanvasElement,vision:VisionFrame,mode:Mode){
 const sample=64,tmp=document.createElement('canvas');tmp.width=sample;tmp.height=sample;const tctx=tmp.getContext('2d')!;tctx.drawImage(c,0,0,sample,sample);const data=tctx.getImageData(0,0,sample,sample).data;const gray=new Float32Array(sample*sample);let sum=0;
 for(let i=0,p=0;i<data.length;i+=4,p++){const g=(data[i]*.299+data[i+1]*.587+data[i+2]*.114)/255;gray[p]=g;sum+=g}const brightness=sum/gray.length;
 let lapSum=0,lapSq=0,n=0;for(let y=1;y<sample-1;y++)for(let x=1;x<sample-1;x++){const i=y*sample+x;const lap=4*gray[i]-gray[i-1]-gray[i+1]-gray[i-sample]-gray[i+sample];lapSum+=lap;lapSq+=lap*lap;n++}const variance=Math.max(0,lapSq/n-(lapSum/n)**2);const blurScore=Math.max(0,Math.min(100,Math.round(variance*5000)));
 let trackingScore=mode==='room'?100:0;if(mode==='object')trackingScore=Math.min(100,(vision.objects?.length??0)*35);if(mode==='human'||mode==='mocap'){const pose=vision.pose?.[0]??[];const visible=pose.filter(x=>(x.visibility??1)>.5).length;const poseScore=Math.min(100,visible/33*100);const handScore=Math.min(100,(vision.hands?.length??0)/2*100);const faceScore=(vision.face?.length??0)>0?100:0;trackingScore=Math.round(poseScore*.55+handScore*.25+faceScore*.2)}
 const lightOk=brightness>.18&&brightness<.88;const message=`Sáng ${Math.round(brightness*100)}% • nét ${blurScore}% • tracking ${trackingScore}%. ${!lightOk?'Ánh sáng chưa tốt. ':''}${blurScore<40?'Giữ máy ổn định hơn. ':''}${trackingScore<60&&mode!=='room'?'Đưa đối tượng/người đầy đủ vào khung.':''}`;
 return{brightness,blurScore,trackingScore,message};
}
function selfTestScore(rows:SelfTest[]){const bad=rows.filter(x=>x.state==='bad').length,warn=rows.filter(x=>x.state==='warn').length;if(bad)return{label:'Chưa sẵn sàng',detail:`Có ${bad} mục lỗi cần xử lý.`};if(warn)return{label:'Có thể dùng',detail:`Có ${warn} mục fallback/giới hạn.`};return{label:'Sẵn sàng',detail:'Các kiểm tra chính đều đạt.'}}
function drawGuide(ctx:CanvasRenderingContext2D|null,c:HTMLCanvasElement,mode:Mode,on:boolean){if(!ctx||!on)return;ctx.save();ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=Math.max(2,c.width/500);ctx.setLineDash([12,10]);if(mode==='human'||mode==='mocap'){ctx.beginPath();ctx.ellipse(c.width/2,c.height/2,c.width*.22,c.height*.43,0,0,Math.PI*2);ctx.stroke()}else ctx.strokeRect(c.width*.12,c.height*.12,c.width*.76,c.height*.76);ctx.restore()}
function drawVision(ctx:CanvasRenderingContext2D|null,c:HTMLCanvasElement,f:VisionFrame,o:Record<OverlayKey,boolean>){if(!ctx)return;ctx.save();ctx.lineWidth=Math.max(2,c.width/420);ctx.strokeStyle='rgba(0,255,170,.9)';ctx.fillStyle='rgba(0,255,170,.95)';const p=(x:number,y:number,r=3)=>{ctx.beginPath();ctx.arc(x*c.width,y*c.height,r,0,Math.PI*2);ctx.fill()};const line=(a:{x:number;y:number},b:{x:number;y:number})=>{ctx.beginPath();ctx.moveTo(a.x*c.width,a.y*c.height);ctx.lineTo(b.x*c.width,b.y*c.height);ctx.stroke()};if(o.pose)for(const lm of f.pose||[]){for(const[a,b]of POSE_CONNECTIONS)if(lm[a]&&lm[b])line(lm[a],lm[b]);for(const i of[0,11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32])if(lm[i])p(lm[i].x,lm[i].y,4)}if(o.hands)for(const lm of f.hands||[]){ctx.strokeStyle='rgba(255,210,0,.95)';ctx.fillStyle='rgba(255,210,0,.95)';for(const[a,b]of HAND_CONNECTIONS)if(lm[a]&&lm[b])line(lm[a],lm[b]);for(const x of lm)p(x.x,x.y,2.5)}if(o.face)for(const lm of f.face||[]){ctx.fillStyle='rgba(0,180,255,.78)';for(let i=0;i<lm.length;i+=2)p(lm[i].x,lm[i].y,1.3)}if(o.objects)for(const ob of f.objects||[]){ctx.strokeStyle='rgba(255,210,0,.95)';ctx.fillStyle='rgba(255,210,0,.95)';ctx.strokeRect(ob.box.x,ob.box.y,ob.box.width,ob.box.height);ctx.font=`${Math.max(14,c.width/45)}px system-ui`;ctx.fillText(`${ob.label} ${Math.round(ob.score*100)}%`,ob.box.x+4,Math.max(20,ob.box.y-6))}ctx.restore()}

createRoot(document.getElementById('root')!).render(<App/>);

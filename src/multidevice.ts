export type DeviceRole='front'|'back'|'left'|'right'|'top'|'auto';
export type ScanState='idle'|'calibrating'|'ready'|'scanning'|'paused'|'processing'|'review'|'export';
export type DeviceStatus={id:string;name:string;role:DeviceRole;online:boolean;fps:number;resolution:string;tracking:number;depth:boolean;battery:number|null;lastSeen:number;simulated?:boolean};
export type PeerMessage={type:'status'|'state'|'capture'|'hello'|'calibration';payload:unknown};

const rtcConfig:RTCConfiguration={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};

function waitIce(pc:RTCPeerConnection){
 return new Promise<void>((resolve)=>{if(pc.iceGatheringState==='complete')return resolve();const done=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',done);resolve()}};pc.addEventListener('icegatheringstatechange',done);setTimeout(resolve,8000)});
}

export class ManualPeer{
 pc:RTCPeerConnection;channel:RTCDataChannel|null=null;onMessage?:(m:PeerMessage)=>void;onState?:(s:RTCPeerConnectionState)=>void;
 constructor(){this.pc=new RTCPeerConnection(rtcConfig);this.pc.onconnectionstatechange=()=>this.onState?.(this.pc.connectionState);this.pc.ondatachannel=e=>this.attach(e.channel)}
 private attach(ch:RTCDataChannel){this.channel=ch;ch.onmessage=e=>{try{this.onMessage?.(JSON.parse(e.data) as PeerMessage)}catch{}}}
 async createOffer(){const ch=this.pc.createDataChannel('scan-sync',{ordered:true});this.attach(ch);await this.pc.setLocalDescription(await this.pc.createOffer());await waitIce(this.pc);return JSON.stringify(this.pc.localDescription)}
 async acceptOffer(text:string){const offer=JSON.parse(text) as RTCSessionDescriptionInit;await this.pc.setRemoteDescription(offer);await this.pc.setLocalDescription(await this.pc.createAnswer());await waitIce(this.pc);return JSON.stringify(this.pc.localDescription)}
 async acceptAnswer(text:string){const answer=JSON.parse(text) as RTCSessionDescriptionInit;await this.pc.setRemoteDescription(answer)}
 send(message:PeerMessage){if(this.channel?.readyState==='open')this.channel.send(JSON.stringify(message))}
 close(){this.channel?.close();this.pc.close()}
}

export function makeSessionCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
export function deviceId(){return globalThis.crypto?.randomUUID?.()??`device-${Date.now()}-${Math.random().toString(16).slice(2)}`}

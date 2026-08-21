import {
  FilesetResolver,
  PoseLandmarker,
  FaceLandmarker,
  HandLandmarker,
  ObjectDetector,
  type NormalizedLandmark
} from '@mediapipe/tasks-vision';

export type VisionMode = 'human' | 'mocap' | 'object';
export type VisionFrame = {
  pose?: NormalizedLandmark[][];
  face?: NormalizedLandmark[][];
  hands?: NormalizedLandmark[][];
  objects?: Array<{label:string;score:number;box:{x:number;y:number;width:number;height:number}}>;
};

let resolverPromise: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
let pose: PoseLandmarker | null = null;
let face: FaceLandmarker | null = null;
let hands: HandLandmarker | null = null;
let objects: ObjectDetector | null = null;

const wasmRoot='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const poseModel='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
const faceModel='https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const handModel='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const objectModel='https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';

async function resolver(){return resolverPromise ??= FilesetResolver.forVisionTasks(wasmRoot);}

export async function prepareVision(mode:VisionMode){
  const r=await resolver();
  if(mode==='human'||mode==='mocap'){
    pose ??= await PoseLandmarker.createFromOptions(r,{baseOptions:{modelAssetPath:poseModel},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minTrackingConfidence:.5});
    face ??= await FaceLandmarker.createFromOptions(r,{baseOptions:{modelAssetPath:faceModel},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:false});
    hands ??= await HandLandmarker.createFromOptions(r,{baseOptions:{modelAssetPath:handModel},runningMode:'VIDEO',numHands:2});
  }
  if(mode==='object') objects ??= await ObjectDetector.createFromOptions(r,{baseOptions:{modelAssetPath:objectModel},runningMode:'VIDEO',scoreThreshold:.35,maxResults:5});
}

export function detectFrame(video:HTMLVideoElement,mode:VisionMode,now:number):VisionFrame{
  if(mode==='human'||mode==='mocap'){
    return {pose:pose?.detectForVideo(video,now).landmarks,face:face?.detectForVideo(video,now).faceLandmarks,hands:hands?.detectForVideo(video,now).landmarks};
  }
  const result=objects?.detectForVideo(video,now);
  return {objects:result?.detections.map(d=>({label:d.categories[0]?.categoryName||'Vật thể',score:d.categories[0]?.score||0,box:{x:d.boundingBox?.originX||0,y:d.boundingBox?.originY||0,width:d.boundingBox?.width||0,height:d.boundingBox?.height||0}}))};
}

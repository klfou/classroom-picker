import {createNameReadout} from './name-readout.js';
import {drumrollExcerpt, revealExcerpt} from './drumroll.js';
export function createClassroomSounds({host=window,document:doc=document,storage,now=()=>performance.now(),loadSample}={}){
 let enabled=true,volume=65,context=null,master=null,active=false,generation=0,drawStarted=0,drawDuration=0;
 const voices=new Set(),buffers=new Map();
 let sample=null,decoded=null;
 const readout=createNameReadout({host,document:doc,beforeSpeak:stopVoices,onStatus(message){const note=doc.getElementById?.('speech-status');if(note){note.textContent=message;note.hidden=!message}}});
 // Fetch bytes early; creating/resuming AudioContext still requires a gesture.
 const fetchBytes=()=>Promise.resolve().then(()=>{const fetcher=host.fetch?.bind(host)??globalThis.fetch;if(!fetcher)return null;return fetcher(new URL('./audio/rollcall-drum.mp3',import.meta.url)).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer()})}).catch(()=>null);
 let bytes=loadSample?null:fetchBytes();
 function prepare(){
  if(!decoded)decoded=(loadSample?Promise.resolve().then(loadSample):bytes.then(data=>data?context.decodeAudioData(data):null)).then(value=>{sample=value;if(!value){decoded=null;if(!loadSample)bytes=fetchBytes()}return !!value}).catch(()=>{decoded=null;return false});
  return decoded;
 }
 if(storage===undefined){try{storage=host.localStorage??globalThis.localStorage}catch{}}
 try{enabled=storage?.getItem('sunlit-sound-enabled')!=='0';const saved=storage?.getItem('sunlit-sound-volume');volume=saved!==null&&saved!==undefined&&/^\d+$/.test(saved)&&Number(saved)<=100?Number(saved):65;storage?.setItem('sunlit-sound-volume',String(volume))}catch{}
 const level=()=>enabled?(volume/100)**1.35:0;
 function updateLevel(){try{master?.gain.setTargetAtTime(level(),context.currentTime,.015)}catch{}}
 function stopVoices(){for(const voice of voices){try{voice.stop();voice.disconnect()}catch{}}voices.clear()}
 function stop(){readout.cancel();generation++;active=false;stopVoices()}
 function unlock(){
  if(!enabled||doc.hidden)return Promise.resolve(false);
  try{
   if(!context){const Audio=host.AudioContext||host.webkitAudioContext;if(!Audio)return Promise.resolve(false);context=new Audio();master=context.createGain();master.gain.value=level();master.connect(context.destination)}
   const ready=context.state==='suspended'||context.state==='interrupted'?context.resume():Promise.resolve();
   return Promise.resolve(ready).then(()=>context?.state==='running'?prepare():false).catch(()=>false);
  }catch{context=null;master=null;return Promise.resolve(false)}
 }
 function buffer(kind,duration){
  const key=kind+':'+duration+':'+context.sampleRate;
  if(!buffers.has(key)){if(!sample)return null;buffers.set(key,kind==='suspense'?drumrollExcerpt(sample,duration,context):revealExcerpt(sample,context))}
  return buffers.get(key);
 }
 function play(kind,duration,offset=0){
  if(!enabled||doc.hidden||context?.state!=='running')return;
  try{const voice=context.createBufferSource();voice.buffer=buffer(kind,duration);if(!voice.buffer)return;voice.connect(master);voices.add(voice);voice.onended=()=>{voices.delete(voice);try{voice.disconnect()}catch{}};const seek=kind==='suspense'?Math.max(offset,(now()-drawStarted)/1000):offset;if(kind==='suspense'&&seek>=duration/1000){voices.delete(voice);voice.disconnect();return}voice.start(context.currentTime,seek);}catch{}
 }
 function begin(durationMs,startedAt=now()){
  stop();drawStarted=startedAt;drawDuration=durationMs;active=enabled&&!doc.hidden;const token=generation;
  // Resume is started synchronously in the user's gesture. A late resume joins
  // the current background position instead of dropping the first-click sound or replaying it.
  unlock().then(ready=>{if(!ready||!active||token!==generation)return;const elapsed=Math.max(0,now()-drawStarted);if(elapsed<drawDuration)play('suspense',drawDuration,elapsed/1000)});
 }
 function result(name){const playResult=active;stop();if(playResult){play('result',0);if(enabled&&volume>0&&!doc.hidden)readout.speak(name,{volume:1})}}
 function setEnabled(value){enabled=!!value;stop();updateLevel();try{storage?.setItem('sunlit-sound-enabled',enabled?'1':'0')}catch{}if(enabled)unlock();return enabled}
 function setVolume(value){readout.cancel();volume=Math.max(0,Math.min(100,Math.round(Number(value)||0)));updateLevel();try{storage?.setItem('sunlit-sound-volume',String(volume))}catch{}return volume}
 doc.addEventListener?.('visibilitychange',()=>{if(doc.hidden)stop()});host.addEventListener?.('pagehide',stop);
 return {begin,result,stop,setEnabled,setVolume,get enabled(){return enabled},get volume(){return volume}};
}

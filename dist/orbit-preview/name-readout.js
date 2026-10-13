// Never use an unspecified/default or remote voice for a student's name.
export function selectLocalChineseVoice(voices){
 const rank=voice=>{const lang=String(voice.lang||'').toLowerCase().replaceAll('_','-');if(voice.localService!==true||!/^zh(?:-|$)/.test(lang))return 99;if(lang==='zh-cn'||lang.startsWith('zh-hans'))return 0;if(lang==='zh-tw'||lang.startsWith('zh-hant-tw'))return 1;if(lang==='zh-hk'||lang.startsWith('zh-hant-hk'))return 2;return 3};
 return Array.from(voices||[]).filter(v=>rank(v)<99).sort((a,b)=>rank(a)-rank(b))[0]||null;
}
export function createNameReadout({host=window,document:doc=document,onStatus=()=>{},beforeSpeak=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,now=()=>performance.now()}={}){
 let synth=null,job=null,timer=null,watchdog=null,generation=0,utterance=null;
 try{synth=host.speechSynthesis}catch{}
 const status=message=>{try{onStatus(message)}catch{}};
 const voice=()=>{try{return selectLocalChineseVoice(synth?.getVoices())}catch{return null}};
 function cancel(){generation++;job=null;utterance=null;clearTimer(timer);clearTimer(watchdog);timer=watchdog=null;try{synth?.cancel()}catch{}}
 function attempt(){
  clearTimer(timer);timer=null;
  if(!job)return;
  if(doc.hidden){cancel();return}
  const remaining=job.start-now();if(remaining>0){timer=setTimer(attempt,remaining);return}
  const selected=voice();
  if(!selected){if(now()<job.deadline){timer=setTimer(attempt,Math.min(100,job.deadline-now()));return}job=null;status('本机暂无中文播报');return}
  const {name,volume}=job,token=generation;job=null;
  try{
   // Recheck the current list immediately before speaking. Never fallback.
   const u=new host.SpeechSynthesisUtterance(name);u.voice=selected;u.lang=selected.lang;u.rate=.88;u.pitch=1;u.volume=volume;
   utterance=u;u.onend=()=>{if(token===generation){clearTimer(watchdog);utterance=null}};
   u.onerror=()=>{if(token===generation){cancel();status('本机中文播报暂不可用')}};
   beforeSpeak();status('');synth.cancel();synth.resume?.();synth.speak(u);
   watchdog=setTimer(()=>{if(token===generation){cancel();status('本机中文播报暂不可用')}},8000);
  }catch{cancel();status('本机中文播报暂不可用')}
 }
 function speak(name,{delay=670,volume=1}={}){
  cancel();if(doc.hidden||typeof name!=='string'||!name.trim()||volume<=0)return;
  if(!synth||typeof host.SpeechSynthesisUtterance!=='function'){status('本机暂无中文播报');return}
  job={name,volume:Math.max(0,Math.min(1,volume)),start:now()+delay,deadline:now()+delay+800};attempt();
 }
 try{synth?.addEventListener?.('voiceschanged',()=>{if(job)attempt();else if(voice())status('')});voice()}catch{}
 doc.addEventListener?.('visibilitychange',()=>{if(doc.hidden)cancel()});host.addEventListener?.('pagehide',cancel);
 return {speak,cancel};
}

import {createCountdown,formatTime,splitPreciseTime} from './countdown-state.js';
const $=id=>document.getElementById(id);
let activeChime=null;
function stopChime(){if(!activeChime)return;try{activeChime.oscillator.stop();activeChime.gain.disconnect()}catch{}activeChime=null}
let boardVisible=false,audio,lastPreciseFrame=-Infinity,selectedMinutes=2;
const soundEnabled=()=>$('sound-toggle').getAttribute('aria-pressed')==='true';
function unlockAudio(force=false){if(!force&&!soundEnabled())return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state!=='running'&&audio.state!=='closed')audio.resume().catch(()=>{})}catch{}}
function soundVolume(){if(window.classroom?.getSoundVolume)return window.classroom.getSoundVolume();try{const v=localStorage.getItem('sunlit-sound-volume');return v!==null&&/^\d+$/.test(v)&&Number(v)<=100?Number(v):65}catch{return 65}}
function chime(){const volume=soundVolume();if(volume<=0||!soundEnabled()||!audio||audio.state!=='running')return;try{const oscillator=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;oscillator.type='sine';oscillator.frequency.setValueAtTime(660,t);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.16*volume/100,t+.025);gain.gain.exponentialRampToValueAtTime(.001,t+.75);oscillator.connect(gain);gain.connect(audio.destination);activeChime={oscillator,gain};oscillator.start(t);oscillator.stop(t+.8);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();if(activeChime?.oscillator===oscillator)activeChime=null}}catch{}}
const timer=createCountdown({onFinish(){chime();$('timer-announcement').textContent='背书时间到';}});
function updateBoard(s){if(boardVisible)window.classroom?.updateBoardCountdown({...splitPreciseTime(s.remaining),state:s.status})}
window.updatePreciseCountdown=now=>{const interval=window.classroom?.renderer.isSoftware?50:1000/30;if(boardVisible&&now-lastPreciseFrame>=interval){lastPreciseFrame=now;updateBoard(timer.tick())}};
function render(updateRunning=true){const s=timer.tick(),active=s.status==='running',label=s.status==='ready'?'倒计时':'重新计时',text=active?formatTime(s.remaining):'',aria=label+(active?'，剩余 '+text:'');if($('timer-action-label').textContent!==label)$('timer-action-label').textContent=label;if($('timer-mini').textContent!==text)$('timer-mini').textContent=text;if($('timer-primary').getAttribute('aria-label')!==aria)$('timer-primary').setAttribute('aria-label',aria);if(updateRunning||!active)updateBoard(s)}
function showBoard(visible){boardVisible=visible;document.body.dataset.view=visible?'board':'classroom';window.classroom?.setBoardMode(visible);render();}
window.leaveCountdownView=()=>showBoard(false);
// Cancel before ticking: a pick at the deadline must not emit a stale timer chime.
window.cancelCountdown=()=>{timer.cancel();stopChime();$('timer-announcement').textContent='';showBoard(false)};
$('timer-primary').onclick=()=>{window.classroom?.cancelDraw();stopChime();unlockAudio();timer.restart(selectedMinutes);$('timer-announcement').textContent='';showBoard(true)};
const minutesSelect=$('timer-minutes');minutesSelect.value=String(selectedMinutes);
minutesSelect.addEventListener('change',()=>{const minutes=Number(minutesSelect.value);selectedMinutes=Number.isInteger(minutes)&&minutes>=1&&minutes<=10?minutes:2;minutesSelect.value=String(selectedMinutes)});
$('sound-toggle').addEventListener('click',()=>{unlockAudio(true);queueMicrotask(()=>{if(!soundEnabled())stopChime()})});
$('edit').addEventListener('click',()=>showBoard(false));
addEventListener('keydown',event=>{if(boardVisible&&event.code==='Space'&&event.target===document.body&&!$('roster-dialog').open&&!event.repeat){event.preventDefault();$('timer-primary').click()}});
document.addEventListener('visibilitychange',()=>render());addEventListener('pageshow',()=>render());setInterval(()=>render(false),100);render();
function connectBoard(){if(window.classroom){window.classroom.setBoardMode(boardVisible);render()}else setTimeout(connectBoard,50)}connectBoard();

window.isCountdownRunning=()=>timer.tick().status==='running';

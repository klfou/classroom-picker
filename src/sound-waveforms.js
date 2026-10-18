// One sustained sound bed per draw. No ticks, note sequence, or rhythmic attacks.
// These exact PCM samples are used by the browser and waveform verification.
export function synthesizeCue(kind,durationMs=2000,sampleRate=44100){
 const suspense=kind==='suspense',seconds=suspense?durationMs/1000:.48;
 const data=new Float32Array(Math.ceil(seconds*sampleRate));
 let phaseLow=0,phaseMid=0,phaseHigh=0,seed=32771,lowNoise=0,slowNoise=0;
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate,u=t/seconds;
  let sample,envelope;
  if(suspense){
   // Slowly rising harmonic layers and band-limited air build tension without pulses.
   const pitch=180+75*u*u;
   phaseLow+=2*Math.PI*pitch/sampleRate;
   phaseMid+=2*Math.PI*(pitch*1.5+3*u)/sampleRate;
   phaseHigh+=2*Math.PI*(pitch*2+9+14*u)/sampleRate;
   seed=(Math.imul(seed,1664525)+1013904223)>>>0;
   const white=seed/2147483648-1;
   lowNoise+=.14*(white-lowNoise);slowNoise+=.012*(white-slowNoise);
   const air=lowNoise-slowNoise;
   sample=.59*Math.sin(phaseLow)+.26*Math.sin(phaseMid)+(.07+.07*u)*Math.sin(phaseHigh)+air*(.28+.16*u);
   envelope=(.27+.17*smooth(u))*smooth(t/.1)*smooth((seconds-t)/.055);
  }else{
   // A single soft consonant bloom resolves the reveal, rather than separate chime hits.
   sample=.53*Math.sin(2*Math.PI*261.63*t)+.28*Math.sin(2*Math.PI*329.63*t)+.19*Math.sin(2*Math.PI*392*t);
   envelope=.38*smooth(t/.065)*(1-smooth(t/seconds));
  }
  data[i]=sample*envelope;
 }
 return data;
}

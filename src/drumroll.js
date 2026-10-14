// Original-pitch excerpts from the user-provided roll-call recording.
// The cymbal starts just after 3s; use only the rolling section before reveal.
export function drumrollExcerpt(source, durationMs, context) {
 const rate=source.sampleRate, length=Math.round(durationMs*rate/1000);
 const output=context.createBuffer(source.numberOfChannels,length,rate);
 const start=Math.max(0,Math.round(3*rate)-length);
 for(let channel=0;channel<source.numberOfChannels;channel++){
  const input=source.getChannelData(channel),data=output.getChannelData(channel);
  const roll=Math.min(input.length,Math.round(3*rate)),fade=Math.min(Math.round(.02*rate),Math.floor(roll/4)),prefix=length-roll+fade;
  for(let i=0;i<length;i++){
   const attack=Math.min(1,i/(.012*rate));
   const release=Math.min(1,(length-1-i)/(.025*rate));
   // Gentle build, original recording and speed; no per-student audio ticks.
   const build=.72+.28*i/Math.max(1,length-1);
   let value=input[start+i]||0;
   if(length>3*rate){
    // Extend only the quiet rolling introduction, at its original speed. Crossfade
    // into the original three-second roll; never borrow the cymbal before reveal.
    if(i<prefix){value=input[i%roll]||0;if(fade&&i>=prefix-fade){const t=(i-prefix+fade)/fade;value=value*(1-t)+(input[i-prefix+fade]||0)*t}}
    else value=input[i-prefix+fade]||0;
   }
   data[i]=value*attack*release*build*2;
  }
 }
 return output;
}

// Keep the selected recording's own cymbal, gently reduced and shortened.
export function revealExcerpt(source, context) {
 const rate=source.sampleRate,length=Math.round(.65*rate),start=Math.round(3*rate);
 const output=context.createBuffer(source.numberOfChannels,length,rate);
 for(let channel=0;channel<source.numberOfChannels;channel++){
  const input=source.getChannelData(channel),data=output.getChannelData(channel);
  for(let i=0;i<length;i++){
   const attack=Math.min(1,i/(.003*rate));
   const release=Math.min(1,(length-1-i)/(.22*rate));
   data[i]=(input[start+i]||0)*attack*release*.65;
  }
 }
 return output;
}

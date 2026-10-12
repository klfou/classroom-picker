// Shared screen-space target for the heading alone. Each presentation converts
// this visible ink rectangle to its own font/mesh coordinates; timer digits keep
// their existing layout, camera and scale.
export function countdownTitleLayout(width,height){
 return {text:'背书倒计时',x:width/2,top:height*.09,height:Math.min(64,width*.07,height*.13)};
}

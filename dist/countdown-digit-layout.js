// Screen-space reference for main numerals, taken from the unchanged classroom
// board at its settled camera endpoint. These are the extremal Y/Z vertices of
// its cached 0–9 extrusions (0 supplies the envelope), including every bevel
// layer. Keeping a fixed alphabet envelope avoids resizing on each timer tick.
// The reference is tested against the actual board meshes, not a font size.
const layers=[
 [-.04500000178813934,-.014000000432133675,.7540000081062317],
 [-.04157457873225212,-.029384953901171684,.7693779468536377],
 [-.03181980550289154,-.04242768883705139,.7824147939682007],
 [-.01722075417637825,-.05114256590604782,.7911257147789001],
 [0,-.05420282110571861,.7941845655441284],
 [.07500000298023224,-.05420282110571861,.7941845655441284],
 [.09222075343132019,-.05114256590604782,.7911257147789001],
 [.10681980848312378,-.04242768883705139,.7824147939682007],
 [.11657457798719406,-.029384953901171684,.7693779468536377],
 [.11999999731779099,-.014000000432133675,.7540000081062317]
];
const halfFov=Math.tan(34*Math.PI/360);
export function countdownDigitLayout(width,height){
 // board.fit returns its inner height plus .18 of frame. scene.boardCamera
 // then adds .06 of fit margin. Its distance clamp/group scaling cancel in
 // projection, leaving this same fitted distance for every endpoint viewport.
 const fitted=(Math.max(3.8,10/Math.max(.2,width/height))/2+.15)/halfFov,focal=height/(2*halfFov);
 let top=Infinity,bottom=-Infinity;
 for(const [z,minY,maxY]of layers){const pixels=focal/(fitted-.24-.035-2.5*z);top=Math.min(top,height/2-(-.95+2.5*maxY)*pixels);bottom=Math.max(bottom,height/2-(-.95+2.5*minY)*pixels)}
 return {height:bottom-top,top,bottom,centerY:(top+bottom)/2};
}

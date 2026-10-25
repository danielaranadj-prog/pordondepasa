// Only the search dock follows the visual viewport. Never resize the map canvas.
export function homeKeyboardViewport({layoutHeight,baselineHeight,visualHeight,offsetTop,scale,focused}:{layoutHeight:number;baselineHeight:number;visualHeight:number;offsetTop:number;scale:number;focused:boolean}){
 const height=Math.max(1,visualHeight),bottom=Math.max(height,offsetTop+height);
 // Pinch zoom also shrinks visualViewport: it must not be classified as a keyboard.
 const keyboard=focused&&Math.abs(scale-1)<.05&&Math.max(layoutHeight,baselineHeight)-height>140;
 return {height,bottom,keyboard};
}

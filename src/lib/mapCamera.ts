type Rect={top:number;bottom:number;left:number;right:number;width:number;height:number};
export function visibleMapPadding(map:Rect,top?:Rect,panel?:Rect){
 const inset=24,side=panel&&map.width>=760&&panel.height<map.height*.85;
 return {top:Math.min(top?Math.max(inset,top.bottom-map.top+16):inset,map.height*.3),bottom:Math.min(panel&&!side?Math.max(inset,map.bottom-panel.top+16):inset,map.height*.6),left:Math.min(side?Math.max(inset,panel.right-map.left+inset):inset,map.width*.55),right:inset};
}

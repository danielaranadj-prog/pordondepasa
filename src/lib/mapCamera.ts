type Rect={top:number;bottom:number;left:number;right:number;width:number;height:number};
export function visibleMapPadding(map:Rect,top?:Rect,panel?:Rect){
 const inset=24,side=panel&&map.width>=760&&panel.height<map.height*.85;
 return {top:Math.min(top?Math.max(50,top.bottom-map.top+20):50,map.height*.35),bottom:Math.min(panel&&!side?Math.max(inset,map.bottom-panel.top+24):inset,map.height*.72),left:Math.min(side?Math.max(inset,panel.right-map.left+inset):inset,map.width*.55),right:inset};
}

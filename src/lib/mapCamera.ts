type Rect={top:number;bottom:number;left:number;right:number;width:number;height:number};
export function visibleMapPadding(map:Rect,top?:Rect,panel?:Rect,attributionHeight=0){
 const inset=24,side=panel&&map.width>=760&&panel.width<map.width*.65;
 const upper=Math.min(top?Math.max(50,top.bottom-map.top+20):50,map.height*.35);
 const credits=Math.max(0,attributionHeight)+(attributionHeight>0?8:0);
 return {top:upper,bottom:Math.min(panel&&!side?Math.max(inset,map.bottom-panel.top+inset+credits):inset,map.height*.78,Math.max(inset,map.height-upper-(credits?80:120))),left:Math.min(side?Math.max(inset,panel.right-map.left+inset):inset,map.width*.55),right:inset};
}
export function mapFocus(width:number,height:number,padding:{top:number;bottom:number;left:number;right:number}){
 return {x:(padding.left+width-padding.right)/2,y:(padding.top+height-padding.bottom)/2};
}
export function shouldFitTripCamera(exploring:boolean,reason:'data'|'resize'|'reset'|'picker'){
 return reason==='reset'||reason==='data'&&!exploring;
}
type MapPadding={top:number;bottom:number;left:number;right:number};
export function sameMapPadding(a:MapPadding,b:MapPadding){return (['top','bottom','left','right'] as const).every(key=>Math.abs(a[key]-b[key])<.1)}
export function tripBoundsOptions(padding:MapPadding,animate=false){
 // MapLibre 6.13 otherwise adds fit padding to the map's existing padding.
 return {padding,absolutePadding:true,maxZoom:15,duration:animate?400:0};
}
export function navigationCamera(mode:'walk'|'bus',remaining:number,reduced=false){
 return {zoom:mode==='walk'?(remaining<120?18.4:18.1):(remaining<120?18:16.8),pitch:reduced?0:mode==='walk'?18:42};
}

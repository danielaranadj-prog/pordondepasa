export type SheetMode='closed'|'open'|'expanded';
export function moveSheet(mode:SheetMode,direction:'up'|'down'):SheetMode{
 const modes:SheetMode[]=['closed','open','expanded'];
 return modes[Math.max(0,Math.min(2,modes.indexOf(mode)+(direction==='up'?1:-1)))];
}
export function sheetSwipe(mode:SheetMode,dx:number,dy:number):SheetMode{
 return Math.abs(dy)>=40&&Math.abs(dy)>Math.abs(dx)*1.25?moveSheet(mode,dy<0?'up':'down'):mode;
}

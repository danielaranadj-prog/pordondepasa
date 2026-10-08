import {visibleMapPadding} from './mapCamera.ts';
const map={top:0,bottom:844,left:0,right:390,width:390,height:844},top={top:20,bottom:130,left:0,right:390,width:390,height:110},panel={top:470,bottom:830,left:10,right:380,width:370,height:360};
const p=visibleMapPadding(map,top,panel),y=(p.top+map.height-p.bottom)/2;
if(y<=top.bottom||y>=panel.top)throw new Error('Position must be visible between panels');
if(visibleMapPadding(map,top,{...panel,top:766,height:64}).bottom>=p.bottom)throw new Error('Collapsed sheet must enlarge visible area');
console.log('OK: visible location between open and collapsed mobile sheets');

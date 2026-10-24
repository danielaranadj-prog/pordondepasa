import type {CSSProperties,ReactNode} from 'react';
export type IconName='route'|'search'|'pin'|'bus'|'walk'|'arrow'|'back'|'up-right'|'home'|'work'|'user'|'bookmark'|'close'|'chevron-up'|'chevron-down'|'swap'|'locate'|'compass'|'north'|'volume'|'mute'|'report'|'flag'|'check'|'left'|'right'|'straight'|'bell'|'list';
/** Shared control icons; route and advertiser identities stay separate. */
export default function UiIcon({name,className='',style}:{name:IconName;className?:string;style?:CSSProperties}){
 const paths={
  route:<><circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 5h7a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h7"/></>,
  search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  pin:<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  bus:<><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M8 19v2m8-2v2M8 15h1m6 0h1M9 6h6"/></>,
  walk:<><circle cx="14" cy="4" r="2"/><path d="m7 11 4-3 4 3 4 1M11 8l-1 7-4 5m4-5 5 2 1 4"/></>,
  arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,back:<path d="M20 12H4m6-6-6 6 6 6"/>,
  'up-right':<path d="M6 18 18 6M6 6h12v12"/>,
  home:<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/>,
  work:<><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 13a25 25 0 0 0 18 0M12 12v3"/></>,
  user:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  bookmark:<path d="M6 3h12v18l-6-4-6 4Z"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,
  'chevron-up':<path d="m6 15 6-6 6 6"/>,'chevron-down':<path d="m6 9 6 6 6-6"/>,swap:<path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4"/>,
  locate:<><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></>,
  compass:<><circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/></>,north:<path d="M8 19V9l8 10V9M9 5l3-3 3 3"/>,
  volume:<path d="M11 4 6 8H3v8h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>,mute:<path d="M11 4 6 8H3v8h3l5 4ZM16 9l6 6m0-6-6 6"/>,
  report:<><path d="M21 11a9 9 0 0 1-9 9H5l-3 2 1-6a9 9 0 1 1 18-5Z"/><path d="M12 6v6m0 3h.01"/></>,flag:<path d="M5 22V3m0 1c5-5 9 5 14 0v11c-5 5-9-5-14 0"/>,
  check:<path d="m5 12 4 4L20 5"/>,left:<path d="M20 21v-9a5 5 0 0 0-5-5H4m5-5L4 7l5 5"/>,right:<path d="M4 21v-9a5 5 0 0 1 5-5h11m-5-5 5 5-5 5"/>,straight:<path d="M12 22V3m-7 7 7-7 7 7"/>,
  bell:<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M2 6l2-3m16 0 2 3"/>,list:<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>,
 } satisfies Record<IconName,ReactNode>;
 return <svg className={`ui-icon ${className}`} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

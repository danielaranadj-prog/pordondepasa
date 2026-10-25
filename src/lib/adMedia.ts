import type {AdCampaign} from './ads.ts';
export function safeAdUrl(value:unknown):value is string{
 if(typeof value!=='string'||value.length>2000)return false;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password}catch{return false}
}
export function adImage(image:AdCampaign['image']){
 if(!image||typeof image.url!=='string'||typeof image.alt!=='string'||!Number.isFinite(image.width)||!Number.isFinite(image.height)||image.width<1||image.height<1||image.width>12000||image.height>12000)return;
 try{const url=new URL(image.url);if(!safeAdUrl(image.url)||/\.svg(?:$|[?#])/i.test(url.pathname))return;return {...image,alt:image.alt.slice(0,200)}}catch{return}
}

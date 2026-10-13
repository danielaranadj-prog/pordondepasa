import {meters} from './router.ts';
import {reliableJourneyFix,type JourneyFix} from './journeyStatus.ts';

export type ReportReason='roadworks'|'traffic'|'incident'|'different-route'|'unknown';
export type RouteReport={id:string;routeId:string;routeName:string;kind:'deviation'|'stop';reason:ReportReason;startedAt:number;endedAt?:number;fixes:JourneyFix[]};
const KEY='pordondepasa:route-reports:v1';
export function appendReportFix(report:RouteReport,fix:JourneyFix,now:number):RouteReport{
 if(report.endedAt||!reliableJourneyFix(fix,now)||report.fixes.length>=1200)return report;
 const previous=report.fixes.at(-1);
 if(previous&&(fix.time<=previous.time||meters(previous.point,fix.point)<5&&fix.time-previous.time<10000))return report;
 return {...report,fixes:[...report.fixes,fix]};
}
export function saveRouteReport(report:RouteReport,storage?:Pick<Storage,'getItem'|'setItem'>):boolean{
 try{
  const target=storage??localStorage,old=JSON.parse(target.getItem(KEY)??'[]');
  const existing:RouteReport[]=Array.isArray(old)?old.filter(item=>item&&typeof item.id==='string'&&item.id!==report.id):[];
  target.setItem(KEY,JSON.stringify([...existing,report].slice(-20)));
  return true;
 }catch{return false;}
}
export function routeReportGeoJSON(report:RouteReport){
 const segments:JourneyFix[][]=[];
 for(const fix of report.fixes){
  const segment=segments.at(-1),previous=segment?.at(-1);
  if(!previous||fix.time-previous.time>20000||meters(previous.point,fix.point)>Math.max(100,(fix.time-previous.time)/1000*45))segments.push([fix]);
  else segment!.push(fix);
 }
 return {type:'FeatureCollection',features:segments.map((segment,index)=>{
 const coordinates=segment.map(fix=>[fix.point.lng,fix.point.lat]);
 return {type:'Feature',properties:{
  reportId:report.id,routeId:report.routeId,routeName:report.routeName,kind:report.kind,reason:report.reason,
  startedAt:new Date(report.startedAt).toISOString(),endedAt:report.endedAt?new Date(report.endedAt).toISOString():null,
  segment:index,verified:false,readings:segment.map(fix=>({at:fix.time,accuracy:fix.accuracy}))
 },geometry:coordinates.length>1?{type:'LineString',coordinates}:{type:'Point',coordinates:coordinates[0]}};
 })};
}

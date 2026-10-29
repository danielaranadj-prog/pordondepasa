import {meters} from './router.ts';
import {saveLocalRecord,type LocalRecordStorage} from './localRecords.ts';
import {reliableJourneyFix,type JourneyFix} from './journeyStatus.ts';

export type ReportReason='roadworks'|'traffic'|'incident'|'different-route'|'unknown';
export type RouteReport={id:string;routeId:string;routeName:string;kind:'deviation'|'stop';reason:ReportReason;startedAt:number;endedAt?:number;fixes:JourneyFix[]};
export function appendReportFix(report:RouteReport,fix:JourneyFix,now:number):RouteReport{
 if(report.endedAt||!reliableJourneyFix(fix,now)||report.fixes.length>=1200)return report;
 const previous=report.fixes.at(-1);
 if(previous&&(fix.time<=previous.time||meters(previous.point,fix.point)<5&&fix.time-previous.time<10000))return report;
 return {...report,fixes:[...report.fixes,fix]};
}
export function saveRouteReport(report:RouteReport,storage?:LocalRecordStorage,expectedKey?:string):boolean{
 return saveLocalRecord('route-reports',report,20,storage,Date.now(),expectedKey);
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

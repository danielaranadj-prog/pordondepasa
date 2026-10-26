import type { AdSchedule } from './ads.ts';

export const AD_TIME_ZONE = 'America/Mazatlan' as const;
const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function minutes(value: string): number | undefined {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function validAdSchedule(schedule?: AdSchedule): boolean {
  if (schedule===undefined) return true;
  if(!schedule||typeof schedule!=='object')return false;
  return schedule.timeZone === AD_TIME_ZONE && Array.isArray(schedule.daysOfWeek) &&
    schedule.daysOfWeek.length > 0 && new Set(schedule.daysOfWeek).size === schedule.daysOfWeek.length &&
    schedule.daysOfWeek.every(day => Number.isInteger(day) && day >= 0 && day <= 6) &&
    Array.isArray(schedule.windows) && schedule.windows.length > 0 && schedule.windows.length <= 4 &&
    schedule.windows.every(window => typeof window?.start === 'string' && typeof window?.end === 'string' &&
      minutes(window.start) !== undefined && minutes(window.end) !== undefined && window.start !== window.end);
}

export function adRunsAt(schedule: AdSchedule | undefined, now = new Date()): boolean {
 return adDeliveryDays(schedule,now).length>0;
}
/** Vigencia belongs to the date a window starts, including its last night. */
export function adDeliveryDays(schedule:AdSchedule|undefined,now=new Date()):string[]{
 if(!Number.isFinite(now.getTime()))return [];
  if (schedule===undefined) return [tepicDay(now)];
  if (!validAdSchedule(schedule)) return [];
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AD_TIME_ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const day = weekdayIndex[get('weekday')];
  const minute = Number(get('hour')) % 24 * 60 + Number(get('minute'));
  if(day===undefined||!Number.isFinite(minute))return [];
  const today=tepicDay(now),yesterday=new Date(today+'T12:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);
  const previous=yesterday.toISOString().slice(0,10),days=new Set<string>();
  for(const window of schedule.windows){
   const start=minutes(window.start)!,end=minutes(window.end)!;
   if(schedule.daysOfWeek.includes(day)&&minute>=start&&(start>end||minute<=end))days.add(today);
   if(start>end&&minute<=end&&schedule.daysOfWeek.includes((day+6)%7))days.add(previous);
  }
  return [...days];
}

export function tepicDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AD_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

import type { AdSchedule } from './ads.ts';

export const AD_TIME_ZONE = 'America/Mazatlan' as const;
const weekdayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function minutes(value: string): number | undefined {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined;
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function validAdSchedule(schedule?: AdSchedule): boolean {
  if (!schedule) return true;
  return schedule.timeZone === AD_TIME_ZONE && Array.isArray(schedule.daysOfWeek) &&
    schedule.daysOfWeek.length > 0 && new Set(schedule.daysOfWeek).size === schedule.daysOfWeek.length &&
    schedule.daysOfWeek.every(day => Number.isInteger(day) && day >= 0 && day <= 6) &&
    Array.isArray(schedule.windows) && schedule.windows.length > 0 && schedule.windows.length <= 4 &&
    schedule.windows.every(window => typeof window?.start === 'string' && typeof window?.end === 'string' &&
      minutes(window.start) !== undefined && minutes(window.end) !== undefined && window.start !== window.end);
}

function scheduleMatchesWeekMinute(schedule: AdSchedule, day: number, minute: number): boolean {
  return schedule.windows.some(window => {
    const start = minutes(window.start)!;
    const end = minutes(window.end)!;
    if (start < end) return schedule.daysOfWeek.includes(day) && minute >= start && minute <= end;
    return (schedule.daysOfWeek.includes(day) && minute >= start) ||
      (schedule.daysOfWeek.includes((day + 6) % 7) && minute <= end);
  });
}

export function adRunsAt(schedule: AdSchedule | undefined, now = new Date()): boolean {
  if (!schedule) return true;
  if (!validAdSchedule(schedule)) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AD_TIME_ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  const day = weekdayIndex[get('weekday')];
  const minute = Number(get('hour')) % 24 * 60 + Number(get('minute'));
  return day !== undefined && Number.isFinite(minute) && scheduleMatchesWeekMinute(schedule, day, minute);
}

export function tepicDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AD_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

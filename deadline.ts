import { DayOfWeek } from '../types/database';

export interface DayDeadlineInfo {
  isPassed: boolean;
  isToday: boolean;
  isPastDay: boolean;
  isFutureDay: boolean;
  remainingHours: number;
  remainingMinutes: number;
  formattedCutoff: string;
  cutoffTimestamp: number;
}

/**
 * Returns current standard time as a Date object incorporating server offset
 */
export function getStandardTime(serverOffsetMs: number = 0): Date {
  return new Date(Date.now() + serverOffsetMs);
}

/**
 * Formats a Date into YYYY-MM-DD string in Asia/Ho_Chi_Minh timezone
 */
export function getVietnamDateString(date: Date): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    // Fallback if Intl timeZone fails
    const tzOffset = 7 * 60; // UTC+7 in minutes
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const vnDate = new Date(utc + tzOffset * 60000);
    const y = vnDate.getFullYear();
    const m = String(vnDate.getMonth() + 1).padStart(2, '0');
    const d = String(vnDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Computes exact epoch timestamp (ms) for cutoff moment of dateStr in Asia/Ho_Chi_Minh
 */
export function getDayCutoffTimestamp(dateStr: string, orderCutoff: string): number {
  const parts = (orderCutoff || '10:30:00').split(':');
  const hh = (parts[0] || '10').padStart(2, '0');
  const mm = (parts[1] || '30').padStart(2, '0');
  const ss = (parts[2] || '00').padStart(2, '0');
  const cutoffIso = `${dateStr}T${hh}:${mm}:${ss}+07:00`;
  const time = new Date(cutoffIso).getTime();
  if (isNaN(time)) {
    // Fallback
    return new Date(`${dateStr}T10:30:00+07:00`).getTime();
  }
  return time;
}

/**
 * Evaluates whether deadline has passed for a specific day in Asia/Ho_Chi_Minh
 */
export function checkDayDeadline(
  dateStr: string,
  orderCutoff: string = '10:30:00',
  serverOffsetMs: number = 0
): DayDeadlineInfo {
  const standardNow = getStandardTime(serverOffsetMs);
  const standardNowMs = standardNow.getTime();
  const vietnamTodayStr = getVietnamDateString(standardNow);

  const cutoffMs = getDayCutoffTimestamp(dateStr, orderCutoff);

  const parts = (orderCutoff || '10:30').split(':');
  const formattedCutoff = `${(parts[0] || '10').padStart(2, '0')}:${(parts[1] || '30').padStart(2, '0')}`;

  const isPastDay = dateStr < vietnamTodayStr;
  const isToday = dateStr === vietnamTodayStr;
  const isFutureDay = dateStr > vietnamTodayStr;

  // "Hạn chốt của từng ngày = ngày của món lúc order_cutoff theo múi giờ Asia/Ho_Chi_Minh.
  //  Ngày đã qua = coi như đã quá hạn."
  const isPassed = isPastDay || (isToday && standardNowMs >= cutoffMs) || (!isFutureDay && standardNowMs >= cutoffMs);

  let remainingHours = 0;
  let remainingMinutes = 0;
  if (isToday && !isPassed) {
    const diffMs = Math.max(0, cutoffMs - standardNowMs);
    remainingHours = Math.floor(diffMs / (1000 * 60 * 60));
    remainingMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  }

  return {
    isPassed,
    isToday,
    isPastDay,
    isFutureDay,
    remainingHours,
    remainingMinutes,
    formattedCutoff,
    cutoffTimestamp: cutoffMs,
  };
}

/**
 * Returns date string for a specific day of week given the week_start (Monday)
 */
export function getDateStrForDayOfWeek(weekStart: string, day: DayOfWeek): string {
  const dayIndexMap: Record<DayOfWeek, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
  };
  const offset = dayIndexMap[day] ?? 0;
  const cleanDate = (weekStart || '').split('T')[0].trim();
  const parts = cleanDate.split('-');
  if (parts.length === 3) {
    const yNum = Number(parts[0]);
    const mNum = Number(parts[1]);
    const dNum = Number(parts[2]);
    if (!isNaN(yNum) && !isNaN(mNum) && !isNaN(dNum)) {
      const mon = new Date(yNum, mNum - 1, dNum);
      mon.setDate(mon.getDate() + offset);
      const y = mon.getFullYear();
      const m = String(mon.getMonth() + 1).padStart(2, '0');
      const d = String(mon.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return weekStart;
}

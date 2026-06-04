import {
  addDays,
  differenceInMinutes,
  eachDayOfInterval,
  endOfDay,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay
} from "date-fns";

export function toDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(dateKey: string) {
  return startOfDay(parseISO(dateKey));
}

export function todayKey(now = new Date()) {
  return toDateKey(now);
}

export function dateKeysBetween(start: Date, end: Date) {
  return eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) }).map(toDateKey);
}

export function dayBounds(dateKey: string) {
  const start = parseDateKey(dateKey);
  return {
    start,
    end: startOfDay(addDays(start, 1))
  };
}

export function minutesInDay(dateKey: string) {
  const { start, end } = dayBounds(dateKey);
  return differenceInMinutes(end, start);
}

export function elapsedMinutesInDay(dateKey: string, now = new Date()) {
  const { start, end } = dayBounds(dateKey);

  if (isBefore(now, start)) {
    return 0;
  }

  if (isAfter(now, end) || !isSameDay(now, start)) {
    return differenceInMinutes(end, start);
  }

  return Math.max(0, differenceInMinutes(now, start));
}

export function rangeEndOfDay(dateKey: string) {
  return endOfDay(parseDateKey(dateKey));
}

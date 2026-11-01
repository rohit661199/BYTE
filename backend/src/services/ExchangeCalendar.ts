import { TradingSession } from '../types/index.js';
import { TimeProvider } from '../utils/TimeProvider.js';

export interface NyTimeComponents {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  isDst: boolean;
  timeZoneOffset: string; // e.g. "-04:00" or "-05:00"
}

export interface HolidayInfo {
  isHoliday: boolean;
  name?: string;
}

export interface EarlyCloseInfo {
  isEarlyClose: boolean;
  closeHour: number; // 13
  closeMinute: number; // 0
  name?: string;
}

/**
 * Computes Gregorian Easter Sunday for any year (Anonymous Gregorian Algorithm).
 * Used to determine official Good Friday market holiday (Easter minus 2 days).
 */
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * ExchangeCalendar provides official US equity market trading session schedules,
 * observed NYSE/Nasdaq holidays, early closings, and session transitions.
 * Timezone: America/New_York (automatically accounts for US Daylight Saving Time).
 */
export class ExchangeCalendar {
  public static readonly TIMEZONE = 'America/New_York';

  /**
   * Decomposes any UTC Date into local New York time components and exact UTC offset.
   * Zero hardcoded offsets — uses Intl with America/New_York.
   */
  public static getNyTime(date: Date = TimeProvider.now()): NyTimeComponents {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
      weekday: 'short',
      timeZoneName: 'longOffset',
    });

    const parts = formatter.formatToParts(date);
    let year = 0;
    let month = 0;
    let day = 0;
    let hour = 0;
    let minute = 0;
    let second = 0;
    let tzOffset = '-05:00';
    let weekdayStr = '';

    for (const p of parts) {
      if (p.type === 'year') year = parseInt(p.value, 10);
      else if (p.type === 'month') month = parseInt(p.value, 10);
      else if (p.type === 'day') day = parseInt(p.value, 10);
      else if (p.type === 'hour') hour = parseInt(p.value, 10);
      else if (p.type === 'minute') minute = parseInt(p.value, 10);
      else if (p.type === 'second') second = parseInt(p.value, 10);
      else if (p.type === 'weekday') weekdayStr = p.value;
      else if (p.type === 'timeZoneName') {
        tzOffset = p.value.replace('GMT', '');
      }
    }

    const dayOfWeekMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayOfWeek = dayOfWeekMap[weekdayStr] ?? 0;
    const isDst = tzOffset.includes('-04');

    return {
      year,
      month,
      day,
      hour,
      minute,
      second,
      dayOfWeek,
      isDst,
      timeZoneOffset: tzOffset,
    };
  }

  /**
   * Checks if a given New York calendar day is an official observed US equity market holiday.
   */
  public static isHoliday(date: Date = TimeProvider.now()): HolidayInfo {
    const ny = this.getNyTime(date);
    const { year, month, day, dayOfWeek } = ny;

    // 1. New Year's Day (Jan 1, observed Mon Jan 2 if Sun)
    if (month === 1 && day === 1 && dayOfWeek !== 0 && dayOfWeek !== 6) {
      return { isHoliday: true, name: "New Year's Day" };
    }
    if (month === 1 && day === 2 && dayOfWeek === 1) {
      return { isHoliday: true, name: "New Year's Day (Observed)" };
    }

    // 2. Martin Luther King Jr. Day (3rd Monday in January: day 15-21)
    if (month === 1 && dayOfWeek === 1 && day >= 15 && day <= 21) {
      return { isHoliday: true, name: 'Martin Luther King Jr. Day' };
    }

    // 3. Washington's Birthday / Presidents' Day (3rd Monday in February: day 15-21)
    if (month === 2 && dayOfWeek === 1 && day >= 15 && day <= 21) {
      return { isHoliday: true, name: "Washington's Birthday (Presidents' Day)" };
    }

    // 4. Good Friday (Friday before Easter Sunday)
    const easter = getEasterSunday(year);
    // Good Friday is Easter minus 2 days
    const easterDate = new Date(Date.UTC(year, easter.month - 1, easter.day));
    const goodFridayDate = new Date(easterDate.getTime() - 2 * 24 * 60 * 60 * 1000);
    if (month === goodFridayDate.getUTCMonth() + 1 && day === goodFridayDate.getUTCDate()) {
      return { isHoliday: true, name: 'Good Friday' };
    }

    // 5. Memorial Day (Last Monday in May: day 25-31)
    if (month === 5 && dayOfWeek === 1 && day >= 25 && day <= 31) {
      return { isHoliday: true, name: 'Memorial Day' };
    }

    // 6. Juneteenth National Independence Day (June 19, or observed Fri Jun 18 / Mon Jun 20)
    // NOTE: Established as an NYSE exchange holiday starting in 2022 (SR-NYSE-2021-56).
    // June 18, 2021 was NOT an observed exchange holiday. First observed closure was Monday June 20, 2022.
    if (year >= 2022 && month === 6) {
      if (day === 19 && dayOfWeek !== 0 && dayOfWeek !== 6) {
        return { isHoliday: true, name: 'Juneteenth National Independence Day' };
      }
      if (day === 18 && dayOfWeek === 5) {
        return { isHoliday: true, name: 'Juneteenth (Observed)' };
      }
      if (day === 20 && dayOfWeek === 1) {
        return { isHoliday: true, name: 'Juneteenth (Observed)' };
      }
    }

    // 7. Independence Day (July 4, or observed Fri Jul 3 / Mon Jul 5)
    if (month === 7) {
      if (day === 4 && dayOfWeek !== 0 && dayOfWeek !== 6) {
        return { isHoliday: true, name: 'Independence Day' };
      }
      if (day === 3 && dayOfWeek === 5) {
        return { isHoliday: true, name: 'Independence Day (Observed)' };
      }
      if (day === 5 && dayOfWeek === 1) {
        return { isHoliday: true, name: 'Independence Day (Observed)' };
      }
    }

    // 8. Labor Day (1st Monday in September: day 1-7)
    if (month === 9 && dayOfWeek === 1 && day >= 1 && day <= 7) {
      return { isHoliday: true, name: 'Labor Day' };
    }

    // 9. Thanksgiving Day (4th Thursday in November: day 22-28)
    if (month === 11 && dayOfWeek === 4 && day >= 22 && day <= 28) {
      return { isHoliday: true, name: 'Thanksgiving Day' };
    }

    // 10. Christmas Day (Dec 25, or observed Fri Dec 24 / Mon Dec 26)
    if (month === 12) {
      if (day === 25 && dayOfWeek !== 0 && dayOfWeek !== 6) {
        return { isHoliday: true, name: 'Christmas Day' };
      }
      if (day === 24 && dayOfWeek === 5) {
        return { isHoliday: true, name: 'Christmas Day (Observed)' };
      }
      if (day === 26 && dayOfWeek === 1) {
        return { isHoliday: true, name: 'Christmas Day (Observed)' };
      }
    }

    return { isHoliday: false };
  }

  /**
   * Checks if a given date is an official US equity market early close day (closes at 13:00 ET).
   */
  public static isEarlyClose(date: Date = TimeProvider.now()): EarlyCloseInfo {
    const ny = this.getNyTime(date);
    const { month, day, dayOfWeek } = ny;

    // Weekends and holidays are completely closed, not early close
    if (dayOfWeek === 0 || dayOfWeek === 6 || this.isHoliday(date).isHoliday) {
      return { isEarlyClose: false, closeHour: 16, closeMinute: 0 };
    }

    // 1. Day before Independence Day (July 3, when July 3 is a weekday and July 4 is a weekday)
    if (month === 7 && day === 3 && dayOfWeek >= 1 && dayOfWeek <= 4) {
      return { isEarlyClose: true, closeHour: 13, closeMinute: 0, name: 'Pre-Independence Day' };
    }

    // 2. Black Friday (Day after Thanksgiving: 4th Friday in November, day 23-29)
    if (month === 11 && dayOfWeek === 5 && day >= 23 && day <= 29) {
      return { isEarlyClose: true, closeHour: 13, closeMinute: 0, name: 'Black Friday' };
    }

    // 3. Christmas Eve (Dec 24, when Dec 24 is a weekday and not an observed Christmas holiday)
    if (month === 12 && day === 24 && dayOfWeek >= 1 && dayOfWeek <= 4) {
      return { isEarlyClose: true, closeHour: 13, closeMinute: 0, name: 'Christmas Eve' };
    }

    return { isEarlyClose: false, closeHour: 16, closeMinute: 0 };
  }

  /**
   * Evaluates the current US Equity trading session state.
   */
  public static getSession(date: Date = TimeProvider.now()): TradingSession {
    const ny = this.getNyTime(date);

    // Weekends
    if (ny.dayOfWeek === 0 || ny.dayOfWeek === 6) {
      return 'CLOSED';
    }

    // Market Holidays
    if (this.isHoliday(date).isHoliday) {
      return 'CLOSED';
    }

    const timeMinutes = ny.hour * 60 + ny.minute;
    const earlyClose = this.isEarlyClose(date);

    const regularCloseMinutes = earlyClose.isEarlyClose
      ? earlyClose.closeHour * 60 + earlyClose.closeMinute // 13:00 = 780 min
      : 16 * 60; // 16:00 = 960 min

    const afterHoursCloseMinutes = earlyClose.isEarlyClose
      ? 17 * 60 // 17:00 = 1020 min
      : 20 * 60; // 20:00 = 1200 min

    const preMarketOpenMinutes = 4 * 60; // 04:00 = 240 min
    const regularOpenMinutes = 9 * 60 + 30; // 09:30 = 570 min

    // 04:00 - 09:30 ET
    if (timeMinutes >= preMarketOpenMinutes && timeMinutes < regularOpenMinutes) {
      return 'PRE_MARKET';
    }

    // 09:30 - Close (16:00 or 13:00)
    if (timeMinutes >= regularOpenMinutes && timeMinutes < regularCloseMinutes) {
      return 'REGULAR';
    }

    // Regular Close - After Hours Close (20:00 or 17:00)
    if (timeMinutes >= regularCloseMinutes && timeMinutes < afterHoursCloseMinutes) {
      return 'AFTER_HOURS';
    }

    // Overnight / Closed
    return 'CLOSED';
  }

  /**
   * Returns true if US equity regular trading session is currently open (09:30 - 16:00 ET, or 13:00 ET on early close).
   */
  public static isMarketOpen(date: Date = TimeProvider.now()): boolean {
    return this.getSession(date) === 'REGULAR';
  }

  /**
   * Calculates the exact UTC Date of the next regular market open (09:30:00 ET).
   * If today is a trading day and 09:30 ET is in the future, returns today's open.
   * Otherwise, steps forward day-by-day skipping weekends and holidays.
   */
  public static getNextSessionOpen(fromDate: Date = TimeProvider.now()): Date {
    let candidate = new Date(fromDate.getTime());
    const initialNy = this.getNyTime(candidate);

    const isTodayTradingDay =
      initialNy.dayOfWeek >= 1 &&
      initialNy.dayOfWeek <= 5 &&
      !this.isHoliday(candidate).isHoliday;

    const todayOpenMinutes = 9 * 60 + 30;
    const currentMinutes = initialNy.hour * 60 + initialNy.minute + initialNy.second / 60;

    if (isTodayTradingDay && currentMinutes < todayOpenMinutes) {
      // Today 09:30 ET is in the future
      return this.createNyDate(initialNy.year, initialNy.month, initialNy.day, 9, 30, 0);
    }

    // Normalize candidate to 12:00:00 (noon) NY time on the initial date to prevent DST boundary anomalies
    candidate = this.createNyDate(initialNy.year, initialNy.month, initialNy.day, 12, 0, 0);

    // Advance candidate day by day until next valid weekday non-holiday
    while (true) {
      // Add 24 hours (lands safely around noon on the next day, immune to 23h or 25h DST shifts)
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      const candNy = this.getNyTime(candidate);

      const isWeekday = candNy.dayOfWeek >= 1 && candNy.dayOfWeek <= 5;
      const holiday = this.isHoliday(candidate);

      if (isWeekday && !holiday.isHoliday) {
        return this.createNyDate(candNy.year, candNy.month, candNy.day, 9, 30, 0);
      }
    }
  }

  /**
   * Constructs an exact UTC Date corresponding to a specific local New York time.
   */
  public static createNyDate(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number = 0
  ): Date {
    // Determine the timezone offset for America/New_York on this target calendar date
    const probeDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const probeNy = this.getNyTime(probeDate);
    const offset = probeNy.timeZoneOffset; // e.g. "-04:00" or "-05:00"

    const isoStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(
      hour
    ).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000${offset}`;

    return new Date(isoStr);
  }
}

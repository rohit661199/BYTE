export type NseTradingSession = 'PRE_MARKET' | 'REGULAR' | 'POST_MARKET' | 'CLOSED';

export class NseExchangeCalendar {
  public static readonly TIMEZONE = 'Asia/Kolkata';

  // NSE official trading holidays (YYYY-MM-DD in Asia/Kolkata)
  private static readonly NSE_HOLIDAYS = new Set<string>([
    // 2024
    '2024-01-22', // Special Holiday (Ayodhya consecration)
    '2024-01-26', // Republic Day
    '2024-03-08', // Mahashivratri
    '2024-03-25', // Holi
    '2024-03-29', // Good Friday
    '2024-04-11', // Id-Ul-Fitr
    '2024-04-17', // Ram Navami
    '2024-05-01', // Maharashtra Day
    '2024-05-20', // General Parliamentary Elections
    '2024-06-17', // Bakri Id
    '2024-07-17', // Muharram
    '2024-08-15', // Independence Day
    '2024-10-02', // Mahatma Gandhi Jayanti
    '2024-11-01', // Diwali Laxmi Pujan (Regular closed, evening Muhurat session)
    '2024-11-15', // Gurunanak Jayanti
    '2024-11-20', // Maharashtra Assembly Elections
    '2024-12-25', // Christmas

    // 2025
    '2025-01-26', // Republic Day
    '2025-02-26', // Mahashivratri
    '2025-03-14', // Holi
    '2025-03-31', // Id-Ul-Fitr
    '2025-04-10', // Mahavir Jayanti
    '2025-04-14', // Dr. Baba Saheb Ambedkar Jayanti
    '2025-04-18', // Good Friday
    '2025-05-01', // Maharashtra Day
    '2025-08-15', // Independence Day
    '2025-08-27', // Ganesh Chaturthi
    '2025-10-02', // Mahatma Gandhi Jayanti / Dussehra
    '2025-10-21', // Diwali Balipratipada
    '2025-11-05', // Gurunanak Jayanti
    '2025-12-25', // Christmas

    // 2026
    '2026-01-26', // Republic Day
    '2026-02-15', // Mahashivratri
    '2026-03-03', // Holi
    '2026-03-20', // Id-Ul-Fitr
    '2026-04-03', // Good Friday
    '2026-04-14', // Dr. Ambedkar Jayanti
    '2026-05-01', // Maharashtra Day
    '2026-05-27', // Bakri Id
    '2026-06-25', // Muharram
    '2026-08-15', // Independence Day
    '2026-09-14', // Ganesh Chaturthi
    '2026-10-02', // Mahatma Gandhi Jayanti
    '2026-10-20', // Dussehra
    '2026-11-08', // Diwali (Laxmi Pujan)
    '2026-11-24', // Gurunanak Jayanti
    '2026-12-25', // Christmas
  ]);

  /**
   * Helper to extract local date parts in Asia/Kolkata timezone (UTC+5:30)
   */
  public static getIstParts(date: Date = new Date()): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    dayOfWeek: number;
    dateString: string;
  } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10);
    const day = parseInt(getPart('day'), 10);
    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);
    const second = parseInt(getPart('second'), 10);

    const weekdayStr = getPart('weekday');
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const dayOfWeek = dayMap[weekdayStr] ?? 0;

    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    const dateString = `${year}-${monthStr}-${dayStr}`;

    return { year, month, day, hour, minute, second, dayOfWeek, dateString };
  }

  /**
   * Checks whether a given calendar day is an official NSE trading holiday.
   */
  public static isHoliday(date: Date = new Date()): boolean {
    const { dateString } = this.getIstParts(date);
    return this.NSE_HOLIDAYS.has(dateString);
  }

  /**
   * Checks whether a given calendar day is a weekend in India (Saturday or Sunday).
   */
  public static isWeekend(date: Date = new Date()): boolean {
    const { dayOfWeek } = this.getIstParts(date);
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  /**
   * Evaluates the current trading session for the Indian NSE stock market.
   * - PRE_MARKET: 09:00:00 - 09:14:59 IST
   * - REGULAR:    09:15:00 - 15:29:59 IST
   * - POST_MARKET:15:40:00 - 15:59:59 IST
   * - CLOSED:     All other times, weekends, and holidays.
   */
  public static getSession(date: Date = new Date()): NseTradingSession {
    if (this.isWeekend(date) || this.isHoliday(date)) {
      return 'CLOSED';
    }

    const { hour, minute } = this.getIstParts(date);
    const timeInMinutes = hour * 60 + minute;

    // Pre-Market: 09:00 - 09:15 (540 to 554)
    if (timeInMinutes >= 540 && timeInMinutes < 555) {
      return 'PRE_MARKET';
    }

    // Regular Trading Session: 09:15 - 15:30 (555 to 929)
    if (timeInMinutes >= 555 && timeInMinutes < 930) {
      return 'REGULAR';
    }

    // Post-Market Session: 15:40 - 16:00 (940 to 959)
    if (timeInMinutes >= 940 && timeInMinutes < 960) {
      return 'POST_MARKET';
    }

    return 'CLOSED';
  }

  /**
   * Returns true if the NSE regular trading session is currently active.
   */
  public static isMarketOpen(date: Date = new Date()): boolean {
    return this.getSession(date) === 'REGULAR';
  }

  /**
   * Calculates the exact Date when the next regular session will open (09:15:00 IST).
   */
  public static getNextSessionOpen(fromDate: Date = new Date()): Date {
    const ist = this.getIstParts(fromDate);
    let targetYear = ist.year;
    let targetMonth = ist.month;
    let targetDay = ist.day;

    const timeInMinutes = ist.hour * 60 + ist.minute;

    // If today is a trading day and it's before 09:15 IST, next open is today at 09:15 IST
    const isTodayTradingDay = !this.isWeekend(fromDate) && !this.isHoliday(fromDate);
    if (isTodayTradingDay && timeInMinutes < 555) {
      return this.createIstDate(targetYear, targetMonth, targetDay, 9, 15, 0);
    }

    // Otherwise, advance day by day until finding the next valid trading day
    let candidate = new Date(fromDate.getTime());
    while (true) {
      candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
      const candIst = this.getIstParts(candidate);
      if (!this.isWeekend(candidate) && !this.isHoliday(candidate)) {
        return this.createIstDate(candIst.year, candIst.month, candIst.day, 9, 15, 0);
      }
    }
  }

  /**
   * Constructs an exact Date from IST (Asia/Kolkata = UTC+5:30) components.
   */
  private static createIstDate(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number
  ): Date {
    // IST is fixed UTC+05:30 (330 minutes ahead of UTC, no DST)
    const utcEpoch = Date.UTC(year, month - 1, day, hour - 5, minute - 30, second);
    return new Date(utcEpoch);
  }
}

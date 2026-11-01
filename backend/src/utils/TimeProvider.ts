/**
 * TimeProvider is the authoritative server-side time source for BYTE Exchange.
 * 
 * Prevents client-side timestamp tampering and clock spoofing.
 * In production, it always derives the current wall-clock time from new Date().
 * In test environments, it allows deterministic internal time mocking.
 */
export class TimeProvider {
  private static mockTime: Date | null = null;

  /**
   * Returns current server date/time or internal test mock date.
   */
  public static now(): Date {
    return this.mockTime ? new Date(this.mockTime.getTime()) : new Date();
  }

  /**
   * Sets an internal mock date for testing.
   * Can NEVER be controlled via HTTP request payloads.
   */
  public static setMockTime(date: Date | string | null): void {
    if (date === null) {
      this.mockTime = null;
    } else {
      this.mockTime = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
    }
  }

  /**
   * Resets mock time back to real system time.
   */
  public static reset(): void {
    this.mockTime = null;
  }
}

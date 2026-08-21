import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStartOfDayVN, getEndOfDayVN, getStartOfMonthVN, getEndOfMonthVN } from '@/lib/utils';

describe('Dashboard Metrics Date Boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return correct start and end of day in Vietnam timezone', () => {
    // 10:30 AM on August 21, 2026 in Vietnam
    const vnTime = new Date('2026-08-21T10:30:00.000+07:00');
    vi.setSystemTime(vnTime);

    const start = getStartOfDayVN();
    const end = getEndOfDayVN();

    // 00:00:00 in VN is 17:00:00 the previous day in UTC
    expect(start.toISOString()).toBe('2026-08-20T17:00:00.000Z');
    
    // next day 00:00:00 in VN is 17:00:00 current day in UTC
    expect(end.toISOString()).toBe('2026-08-21T17:00:00.000Z');
  });

  it('should return correct start and end of month in Vietnam timezone', () => {
    // 10:30 AM on August 21, 2026 in Vietnam
    const vnTime = new Date('2026-08-21T10:30:00.000+07:00');
    vi.setSystemTime(vnTime);

    const start = getStartOfMonthVN();
    const end = getEndOfMonthVN();

    // 1st of August 00:00:00 in VN is 31st of July 17:00:00 in UTC
    expect(start.toISOString()).toBe('2026-07-31T17:00:00.000Z');
    
    // 1st of Sept 00:00:00 in VN is 31st of August 17:00:00 in UTC
    expect(end.toISOString()).toBe('2026-08-31T17:00:00.000Z');
  });

  it('should handle year rollover boundaries for month correctly', () => {
    // 10:30 AM on December 21, 2026 in Vietnam
    const vnTime = new Date('2026-12-21T10:30:00.000+07:00');
    vi.setSystemTime(vnTime);

    const end = getEndOfMonthVN();

    // 1st of January 2027 00:00:00 in VN is 31st of December 2026 17:00:00 in UTC
    expect(end.toISOString()).toBe('2026-12-31T17:00:00.000Z');
  });
});

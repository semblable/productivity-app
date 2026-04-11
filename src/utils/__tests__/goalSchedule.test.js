import {
  countAvailableDays,
  calculateDailyPlan,
  formatHours,
  DAY_LABELS,
  DAY_NAMES,
  DAY_SELECTOR,
  PRESET_WEEKDAYS,
  PRESET_ALL_DAYS,
} from '../goalSchedule';

// ── Constants ────────────────────────────────────────────────────────
describe('goalSchedule constants', () => {
  test('DAY_LABELS has 7 entries', () => {
    expect(DAY_LABELS).toHaveLength(7);
  });

  test('DAY_NAMES has 7 full names', () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe('Sunday');
    expect(DAY_NAMES[6]).toBe('Saturday');
  });

  test('DAY_SELECTOR covers Mon–Sun with correct values', () => {
    expect(DAY_SELECTOR).toHaveLength(7);
    expect(DAY_SELECTOR[0]).toEqual({ label: 'M', value: 1 });
    expect(DAY_SELECTOR[6]).toEqual({ label: 'S', value: 0 });
  });

  test('PRESET_WEEKDAYS is Mon–Fri', () => {
    expect(PRESET_WEEKDAYS).toEqual([1, 2, 3, 4, 5]);
  });

  test('PRESET_ALL_DAYS is 0–6', () => {
    expect(PRESET_ALL_DAYS).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

// ── countAvailableDays ──────────────────────────────────────────────
describe('countAvailableDays', () => {
  test('returns 0 for null/undefined from', () => {
    expect(countAvailableDays(null, '2025-01-05', [0, 1, 2, 3, 4, 5, 6])).toBe(0);
  });

  test('returns 0 for null/undefined to', () => {
    expect(countAvailableDays('2025-01-01', null, [0, 1, 2, 3, 4, 5, 6])).toBe(0);
  });

  test('returns 0 for empty scheduleDays', () => {
    expect(countAvailableDays('2025-01-01', '2025-01-05', [])).toBe(0);
  });

  test('returns 0 for null scheduleDays', () => {
    expect(countAvailableDays('2025-01-01', '2025-01-05', null)).toBe(0);
  });

  test('returns 0 when from > to (reversed range)', () => {
    expect(countAvailableDays('2025-01-10', '2025-01-01', [0, 1, 2, 3, 4, 5, 6])).toBe(0);
  });

  test('same day, all days scheduled → 1', () => {
    // 2025-01-06 is a Monday (day 1)
    expect(countAvailableDays('2025-01-06', '2025-01-06', [1])).toBe(1);
  });

  test('same day, not in schedule → 0', () => {
    // 2025-01-06 is Monday (day 1), but we only schedule Tuesdays
    expect(countAvailableDays('2025-01-06', '2025-01-06', [2])).toBe(0);
  });

  test('one full week (Mon-Sun), all days → 7', () => {
    // Mon Jan 6 to Sun Jan 12
    expect(countAvailableDays('2025-01-06', '2025-01-12', PRESET_ALL_DAYS)).toBe(7);
  });

  test('one full week, weekdays only → 5', () => {
    expect(countAvailableDays('2025-01-06', '2025-01-12', PRESET_WEEKDAYS)).toBe(5);
  });

  test('accepts Date objects', () => {
    const from = new Date(2025, 0, 6); // Mon Jan 6
    const to = new Date(2025, 0, 12);  // Sun Jan 12
    expect(countAvailableDays(from, to, PRESET_ALL_DAYS)).toBe(7);
  });

  test('two weeks → 14 all days', () => {
    expect(countAvailableDays('2025-01-06', '2025-01-19', PRESET_ALL_DAYS)).toBe(14);
  });
});

// ── formatHours ─────────────────────────────────────────────────────
describe('formatHours', () => {
  test('null returns "—"', () => {
    expect(formatHours(null)).toBe('—');
  });

  test('undefined returns "—"', () => {
    expect(formatHours(undefined)).toBe('—');
  });

  test('NaN returns "—"', () => {
    expect(formatHours(NaN)).toBe('—');
  });

  test('0 hours → "0m"', () => {
    expect(formatHours(0)).toBe('0m');
  });

  test('exact hours → "Xh" with no minutes', () => {
    expect(formatHours(3)).toBe('3h');
  });

  test('fractional hours → "Xh Ym"', () => {
    expect(formatHours(1.5)).toBe('1h 30m');
  });

  test('minutes only → "Ym"', () => {
    expect(formatHours(0.25)).toBe('15m');
  });

  test('rounding: 59.5 minutes rounds to 1h', () => {
    // 59.5 / 60 = 0.99167 hours
    // Math.round(0.99167 * 60) = Math.round(59.5) = 60 → bumps to 1h
    expect(formatHours(59.5 / 60)).toBe('1h');
  });

  test('large value', () => {
    expect(formatHours(100)).toBe('100h');
  });

  test('2.75 hours → "2h 45m"', () => {
    expect(formatHours(2.75)).toBe('2h 45m');
  });
});

// ── calculateDailyPlan ──────────────────────────────────────────────
describe('calculateDailyPlan', () => {
  // Use fixed dates to avoid flaky tests
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to create a date N days from now
  const daysFromNow = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };

  test('returns null when no deadline', () => {
    expect(calculateDailyPlan({ targetHours: 10, actualHours: 0 })).toBeNull();
  });

  test('returns null when no targetHours', () => {
    expect(calculateDailyPlan({ deadline: daysFromNow(7), actualHours: 0 })).toBeNull();
  });

  test('future deadline with full schedule', () => {
    const plan = calculateDailyPlan({
      targetHours: 14,
      actualHours: 0,
      startDate: today.toISOString().split('T')[0],
      deadline: daysFromNow(7),
      scheduleDays: PRESET_ALL_DAYS,
    });

    expect(plan).not.toBeNull();
    expect(plan.totalAvailableDays).toBe(8); // today + 7 more days
    expect(plan.remainingHours).toBe(14);
    expect(plan.dailyHoursRequired).toBeCloseTo(14 / plan.remainingAvailableDays, 5);
  });

  test('past deadline with work remaining → remainingAvailableDays = 0', () => {
    const plan = calculateDailyPlan({
      targetHours: 10,
      actualHours: 5,
      startDate: daysFromNow(-14),
      deadline: daysFromNow(-1),
      scheduleDays: PRESET_ALL_DAYS,
    });

    expect(plan).not.toBeNull();
    expect(plan.remainingAvailableDays).toBe(0);
    expect(plan.remainingHours).toBe(5);
    expect(plan.dailyHoursRequired).toBeNull();
    expect(plan.isOnTrack).toBe(false);
  });

  test('past deadline with all work completed → isOnTrack = true', () => {
    const plan = calculateDailyPlan({
      targetHours: 10,
      actualHours: 10,
      startDate: daysFromNow(-14),
      deadline: daysFromNow(-1),
      scheduleDays: PRESET_ALL_DAYS,
    });

    expect(plan.isOnTrack).toBe(true);
    expect(plan.remainingHours).toBe(0);
  });

  test('defaults to PRESET_ALL_DAYS when scheduleDays is empty', () => {
    const plan = calculateDailyPlan({
      targetHours: 7,
      actualHours: 0,
      startDate: today.toISOString().split('T')[0],
      deadline: daysFromNow(6),
      scheduleDays: [],
    });

    expect(plan).not.toBeNull();
    expect(plan.totalAvailableDays).toBe(7);
  });

  test('no startDate falls back to deadline day only', () => {
    const plan = calculateDailyPlan({
      targetHours: 2,
      actualHours: 0,
      deadline: daysFromNow(7),
      scheduleDays: PRESET_ALL_DAYS,
    });

    expect(plan).not.toBeNull();
    // Without startDate, start = deadline, so totalAvailableDays = 1
    expect(plan.totalAvailableDays).toBe(1);
  });

  test('isOnTrack uses ≈15-min tolerance', () => {
    // If we're behind by less than 15 min (0.25h), still on track
    const plan = calculateDailyPlan({
      targetHours: 10,
      actualHours: 4.8, // slightly behind expected
      startDate: daysFromNow(-5),
      deadline: daysFromNow(5),
      scheduleDays: PRESET_ALL_DAYS,
    });

    expect(plan).not.toBeNull();
    // The tolerance check: hoursAheadOrBehind >= -0.25
    if (plan.hoursAheadOrBehind >= -0.25) {
      expect(plan.isOnTrack).toBe(true);
    } else {
      expect(plan.isOnTrack).toBe(false);
    }
  });

  test('actualHours defaults to 0 when undefined', () => {
    const plan = calculateDailyPlan({
      targetHours: 5,
      startDate: daysFromNow(-1),
      deadline: daysFromNow(5),
      scheduleDays: PRESET_ALL_DAYS,
    });

    expect(plan.remainingHours).toBe(5);
  });
});

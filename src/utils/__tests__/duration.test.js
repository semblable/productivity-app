import { durationToSeconds, formatDuration } from '../duration';

describe('durationToSeconds', () => {
  test('parses hh:mm:ss', () => {
    expect(durationToSeconds('1:02:03')).toBe(3723);
  });

  test('parses hh:mm', () => {
    expect(durationToSeconds('2:30')).toBe(2 * 3600 + 30 * 60);
  });

  test('parses single number as hours', () => {
    expect(durationToSeconds('3')).toBe(3 * 3600);
  });

  test('returns 0 for empty/null/undefined input', () => {
    expect(durationToSeconds('')).toBe(0);
    expect(durationToSeconds(null)).toBe(0);
    expect(durationToSeconds(undefined)).toBe(0);
  });

  test('trims whitespace', () => {
    expect(durationToSeconds('  1:00  ')).toBe(3600);
  });

  test('returns NaN on invalid minutes (>= 60)', () => {
    expect(Number.isNaN(durationToSeconds('00:61'))).toBe(true);
  });

  test('returns NaN on invalid seconds (>= 60)', () => {
    expect(Number.isNaN(durationToSeconds('00:00:61'))).toBe(true);
  });

  test('returns NaN on negative values', () => {
    expect(Number.isNaN(durationToSeconds('-1:00'))).toBe(true);
  });

  test('returns NaN on 4+ parts', () => {
    expect(Number.isNaN(durationToSeconds('1:2:3:4'))).toBe(true);
  });

  test('returns NaN on non-numeric parts', () => {
    expect(Number.isNaN(durationToSeconds('abc'))).toBe(true);
    expect(Number.isNaN(durationToSeconds('1:abc'))).toBe(true);
  });

  test('zero values are valid', () => {
    expect(durationToSeconds('0')).toBe(0);
    expect(durationToSeconds('0:0')).toBe(0);
    expect(durationToSeconds('0:0:0')).toBe(0);
  });
});

describe('formatDuration', () => {
  test('formats seconds to HH:MM:SS', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  test('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('00:00:00');
  });

  test('formats large values', () => {
    expect(formatDuration(36000)).toBe('10:00:00');
  });

  test('returns 00:00:00 for negative values', () => {
    expect(formatDuration(-1)).toBe('00:00:00');
  });

  test('returns 00:00:00 for NaN', () => {
    expect(formatDuration(NaN)).toBe('00:00:00');
  });

  test('returns 00:00:00 for non-number', () => {
    expect(formatDuration('hello')).toBe('00:00:00');
  });

  test('pads single-digit components', () => {
    expect(formatDuration(61)).toBe('00:01:01');
  });
});





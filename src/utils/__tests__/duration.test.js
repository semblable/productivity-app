import { durationToSeconds, formatDuration } from '../duration';

describe('duration utils', () => {
  test('durationToSeconds parses hh:mm:ss', () => {
    expect(durationToSeconds('1:02:03')).toBe(3723);
  });

  test('durationToSeconds parses hh:mm', () => {
    expect(durationToSeconds('2:30')).toBe(2 * 3600 + 30 * 60);
  });

  test('durationToSeconds returns NaN on invalid minutes/seconds', () => {
    expect(Number.isNaN(durationToSeconds('00:61'))).toBe(true);
    expect(Number.isNaN(durationToSeconds('00:00:61'))).toBe(true);
  });

  test('formatDuration formats seconds to HH:MM:SS', () => {
    expect(formatDuration(3661)).toBe('01:01:01');
  });
});





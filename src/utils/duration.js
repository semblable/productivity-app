// Shared helpers for parsing and formatting duration strings
// Accepts "hh:mm:ss", "h:mm", "mm:ss" or just an integer hour value.
// Returns seconds (integer) or NaN if invalid.
export const durationToSeconds = (input) => {
  if (!input) return 0;
  const parts = input.trim().split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return NaN;

  // Single number => hours
  if (parts.length === 1) {
    return parts[0] * 3600;
  }

  // Two numbers => assume hh:mm OR mm:ss (treat first as hours if >= 24?)
  if (parts.length === 2) {
    const [h, m] = parts;
    if (m >= 60) return NaN;
    return h * 3600 + m * 60;
  }

  // Three numbers => hh:mm:ss
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m >= 60 || s >= 60) return NaN;
    return h * 3600 + m * 60 + s;
  }

  return NaN;
};

export const formatDuration = (seconds) => {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) return '00:00:00';
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
};

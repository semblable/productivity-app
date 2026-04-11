/**
 * Utility functions for time-based goal scheduling.
 * All functions are pure (no side effects).
 */

export const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DAY_SELECTOR = [
    { label: 'M', value: 1 },
    { label: 'T', value: 2 },
    { label: 'W', value: 3 },
    { label: 'T', value: 4 },
    { label: 'F', value: 5 },
    { label: 'S', value: 6 },
    { label: 'S', value: 0 },
];

export const PRESET_WEEKDAYS = [1, 2, 3, 4, 5];
export const PRESET_ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Counts available days in the inclusive range [from, to] whose day-of-week
 * appears in scheduleDays.
 *
 * @param {Date|string} from - Start of range (inclusive)
 * @param {Date|string} to   - End of range (inclusive)
 * @param {number[]}    scheduleDays - JS day numbers 0 (Sun) – 6 (Sat)
 * @returns {number}
 */
export function countAvailableDays(from, to, scheduleDays) {
    if (!from || !to || !scheduleDays || scheduleDays.length === 0) return 0;

    const start = toMidnight(from);
    const end   = toMidnight(to);
    if (start > end) return 0;

    const daySet = new Set(scheduleDays);
    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        if (daySet.has(cursor.getDay())) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}

/**
 * Computes the full scheduling plan for a goal.
 *
 * Requires goal to have: targetHours, actualHours, deadline.
 * Optional: startDate, scheduleDays.
 *
 * Returns null when insufficient data to compute a plan.
 *
 * @param {object} goal
 * @returns {{
 *   totalAvailableDays: number,
 *   remainingAvailableDays: number,
 *   remainingHours: number,
 *   dailyHoursRequired: number,
 *   expectedActualHours: number,
 *   isOnTrack: boolean,
 *   hoursAheadOrBehind: number,
 * } | null}
 */
export function calculateDailyPlan(goal) {
    const { targetHours, actualHours, deadline, startDate, scheduleDays } = goal;

    if (!deadline || !targetHours) return null;

    const days = scheduleDays && scheduleDays.length > 0 ? scheduleDays : PRESET_ALL_DAYS;
    const start = startDate ? toMidnight(startDate) : toMidnight(deadline); // fallback: only deadline day
    const end   = toMidnight(deadline);
    const today = toMidnight(new Date());

    if (end < today) {
        // Goal deadline is in the past
        const remainingHours = Math.max(0, targetHours - (actualHours || 0));
        return {
            totalAvailableDays: countAvailableDays(start, end, days),
            remainingAvailableDays: 0,
            remainingHours,
            dailyHoursRequired: null,
            expectedActualHours: targetHours,
            isOnTrack: remainingHours === 0,
            hoursAheadOrBehind: (actualHours || 0) - targetHours,
        };
    }

    const totalAvailableDays = countAvailableDays(start, end, days);
    // Remaining days start from today (inclusive) to deadline
    const remainingAvailableDays = countAvailableDays(today, end, days);
    const remainingHours = Math.max(0, targetHours - (actualHours || 0));
    const dailyHoursRequired = remainingAvailableDays > 0
        ? remainingHours / remainingAvailableDays
        : null;

    // How many hours should have been done by now at the original pace?
    const daysElapsed = totalAvailableDays - remainingAvailableDays;
    const expectedActualHours = totalAvailableDays > 0
        ? (daysElapsed / totalAvailableDays) * targetHours
        : 0;
    const hoursAheadOrBehind = (actualHours || 0) - expectedActualHours;
    const isOnTrack = hoursAheadOrBehind >= -0.25; // allow 15-min tolerance

    return {
        totalAvailableDays,
        remainingAvailableDays,
        remainingHours,
        dailyHoursRequired,
        expectedActualHours,
        isOnTrack,
        hoursAheadOrBehind,
    };
}

/**
 * Formats decimal hours to a short human-readable string, e.g. 1.5 → "1h 30m"
 * @param {number} hours
 * @returns {string}
 */
export function formatHours(hours) {
    if (hours === null || hours === undefined || isNaN(hours)) return '—';
    let h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

// --- helpers ---

function toMidnight(value) {
    const d = value instanceof Date ? new Date(value) : new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Utilities to normalize IDs depending on whether the app is using cloud string IDs

const isCloudMode = () => {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('cloudIdsMigrated') === '1';
  } catch {
    return false;
  }
};

export const normalizeId = (value) => {
  if (value == null || value === '') return null;
  if (isCloudMode()) {
    return String(value);
  }
  const candidate = typeof value === 'string' ? value.trim() : value;
  const num = typeof candidate === 'number' ? candidate : Number(candidate);
  if (!Number.isFinite(num)) {
    try {
      // Surface earlier but do not crash the app
      console.warn('[id-utils] Invalid numeric id received for normalizeId:', value);
    } catch {}
    return null;
  }
  return num;
};

export const normalizeNullableId = (value) => {
  if (value == null || value === '') return null;
  return normalizeId(value);
};

export const idsEqual = (a, b) => String(a) === String(b);








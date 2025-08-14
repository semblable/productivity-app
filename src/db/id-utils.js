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
  return isCloudMode() ? String(value) : Number(value);
};

export const normalizeNullableId = (value) => {
  if (value == null || value === '') return null;
  return normalizeId(value);
};

export const idsEqual = (a, b) => String(a) === String(b);








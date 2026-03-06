import { normalizeId, normalizeNullableId, idsEqual } from '../id-utils';

describe('id-utils', () => {
  beforeEach(() => {
    try { localStorage.removeItem('cloudIdsMigrated'); } catch {}
  });

  test('normalizeId handles nullish', () => {
    expect(normalizeId(null)).toBeNull();
    expect(normalizeId('')).toBeNull();
  });

  test('normalizeId numeric mode returns numbers', () => {
    expect(normalizeId('42')).toBe(42);
    expect(normalizeId(7)).toBe(7);
  });

  test('normalizeId cloud mode returns strings', () => {
    localStorage.setItem('cloudIdsMigrated', '1');
    expect(normalizeId(7)).toBe('7');
    expect(normalizeId('42')).toBe('42');
  });

  test('normalizeNullableId mirrors normalizeId but keeps null', () => {
    expect(normalizeNullableId('')).toBeNull();
    expect(normalizeNullableId('3')).toBe(3);
  });

  test('idsEqual compares by string value', () => {
    expect(idsEqual(1, '1')).toBe(true);
    expect(idsEqual('abc', 'abc')).toBe(true);
    expect(idsEqual('1', '2')).toBe(false);
  });
});





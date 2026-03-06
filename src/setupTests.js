// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
// Polyfill IndexedDB for Dexie in Jest (jsdom)
import 'fake-indexeddb/auto';

// Stable crypto.randomUUID for tests
if (typeof global.crypto === 'undefined') {
  global.crypto = {};
}
if (typeof global.crypto.randomUUID !== 'function') {
  global.crypto.randomUUID = () => '00000000-0000-4000-8000-000000000000';
}

// Basic Notification mock with granted permission by default
// Tests can override as needed
if (typeof global.Notification === 'undefined') {
  class MockNotification {
    constructor(title, options) {
      this.title = title;
      this.options = options;
    }
    static requestPermission() {
      return Promise.resolve('granted');
    }
  }
  MockNotification.permission = 'granted';
  // @ts-ignore
  global.Notification = MockNotification;
} else {
  // Ensure permission is granted in tests unless overridden
  try { global.Notification.permission = 'granted'; } catch {}
}

// Minimal matchMedia mock for components that might query it
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// Prevent React Hot Toast from throwing in tests (no DOM portal)
// No-op for window.scrollTo used by some libs
if (typeof window.scrollTo !== 'function') {
  window.scrollTo = () => {};
}

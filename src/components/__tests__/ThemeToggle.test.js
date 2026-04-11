/** @jest-environment jsdom */
import React from 'react';
import { render, act } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
  test('renders toggle button', () => {
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
  });

  test('clicking toggles dark class on html element', () => {
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('button');

    act(() => {
      button.click();
    });
    const hasDark = document.documentElement.classList.contains('dark');

    act(() => {
      button.click();
    });
    const hasDarkAfter = document.documentElement.classList.contains('dark');

    // One of the two states should have toggled
    expect(hasDark).not.toBe(hasDarkAfter);
  });
});

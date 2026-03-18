import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import IsometricModeToggle from './IsometricModeToggle';

describe('IsometricModeToggle', () => {
  beforeEach(() => {
    window.localStorage.removeItem('cryptosparrow-isometric-mode');
    document.documentElement.classList.remove('isometric-mode');
  });

  it('toggles html class and persists state', () => {
    render(<IsometricModeToggle />);
    const button = screen.getByRole('button', { name: 'ISO' });

    fireEvent.click(button);
    expect(window.localStorage.getItem('cryptosparrow-isometric-mode')).toBe('true');
    expect(document.documentElement.classList.contains('isometric-mode')).toBe(true);

    fireEvent.click(button);
    expect(window.localStorage.getItem('cryptosparrow-isometric-mode')).toBe('false');
    expect(document.documentElement.classList.contains('isometric-mode')).toBe(false);
  });
});

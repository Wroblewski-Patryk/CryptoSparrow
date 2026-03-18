import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ThemeSwitcher from './ThemeSwitch';

describe('ThemeSwitcher', () => {
  it('renders accessible theme selector and options', () => {
    render(<ThemeSwitcher />);

    expect(screen.getByLabelText('Theme selector')).toBeInTheDocument();
    expect(screen.getByLabelText('Default')).toBeInTheDocument();
    expect(screen.getByLabelText('Cyberpunk')).toBeInTheDocument();
    expect(screen.getByLabelText('Luxury')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ThemeSwitcher from './ThemeSwitch';

describe('ThemeSwitcher', () => {
  it('renders accessible theme selector and options', () => {
    render(<ThemeSwitcher />);

    expect(screen.getByLabelText('Theme selector')).toBeInTheDocument();
    expect(screen.getByLabelText('CryptoSparrow')).toBeInTheDocument();
    expect(screen.getByLabelText('System')).toBeInTheDocument();
    expect(screen.getByLabelText('Cupcake')).toBeInTheDocument();
    expect(screen.getByLabelText('Dracula')).toBeInTheDocument();
    expect(screen.getByLabelText('Forest')).toBeInTheDocument();
    expect(screen.getByLabelText('Valentine')).toBeInTheDocument();
    expect(screen.getByLabelText('Luxury')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n/I18nProvider';
import ThemeSwitcher from './ThemeSwitch';

describe('ThemeSwitcher', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders accessible theme selector and options', () => {
    render(
      <I18nProvider>
        <ThemeSwitcher />
      </I18nProvider>
    );

    expect(screen.getByLabelText('Theme selector')).toBeInTheDocument();
    expect(screen.getByLabelText('System')).toBeInTheDocument();
    expect(screen.getByLabelText('Cupcake')).toBeInTheDocument();
    expect(screen.getByLabelText('Dracula')).toBeInTheDocument();
    expect(screen.getByLabelText('Forest')).toBeInTheDocument();
    expect(screen.getByLabelText('Valentine')).toBeInTheDocument();
    expect(screen.getByLabelText('Cyberpunk')).toBeInTheDocument();
  });
});

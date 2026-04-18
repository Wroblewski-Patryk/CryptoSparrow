import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import OfflinePage from './page';

describe('OfflinePage', () => {
  beforeEach(() => {
    window.localStorage.setItem('cryptosparrow-locale', 'pl');
    window.history.pushState({}, '', '/offline');
  });

  it('renders localized offline copy', () => {
    render(<OfflinePage />);

    expect(screen.getByRole('heading', { name: 'Tryb offline' })).toBeInTheDocument();
    expect(
      screen.getByText('Soar jest chwilowo offline. Sprawdz polaczenie i sprobuj ponownie.')
    ).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders mode badge with semantic class', () => {
    render(<StatusBadge kind='mode' value='live' />);

    const badge = screen.getByText('Mode: LIVE');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('status-badge');
    expect(badge.className).toContain('mode-live');
  });

  it('renders risk badge with semantic class and custom label', () => {
    render(<StatusBadge kind='risk' value='warning' label='Heartbeat: Delayed' />);

    const badge = screen.getByText('Heartbeat: Delayed');
    expect(badge.className).toContain('risk-warning');
  });
});

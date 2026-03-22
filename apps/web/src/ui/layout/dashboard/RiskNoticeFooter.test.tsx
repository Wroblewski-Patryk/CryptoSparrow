import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RiskNoticeFooter from './RiskNoticeFooter';

describe('RiskNoticeFooter', () => {
  it('renders risk notice and logs shortcut links', () => {
    render(<RiskNoticeFooter />);

    expect(screen.getByText(/Trading risk notice/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Audit Logs' })).toHaveAttribute(
      'href',
      '/dashboard/logs'
    );
    expect(screen.getByRole('link', { name: 'Security Settings' })).toHaveAttribute(
      'href',
      '/dashboard/profile#security'
    );
  });
});

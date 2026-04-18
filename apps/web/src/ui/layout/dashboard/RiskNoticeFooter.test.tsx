import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '@/i18n/I18nProvider';
import RiskNoticeFooter from './RiskNoticeFooter';

describe('RiskNoticeFooter', () => {
  it('renders risk notice and logs shortcut links', () => {
    window.history.pushState({}, '', '/dashboard');
    window.localStorage.setItem('cryptosparrow-locale', 'en');
    render(
      <I18nProvider>
        <RiskNoticeFooter />
      </I18nProvider>
    );

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

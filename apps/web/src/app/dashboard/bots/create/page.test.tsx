import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());
const botFormPageContentMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('../_components/BotFormPageContent', () => ({
  default: (props: { mode: 'create' | 'edit'; editId?: string }) => {
    botFormPageContentMock(props);
    return <div data-testid='bot-form-page'>{props.mode}</div>;
  },
}));

describe('Bots create page', () => {
  it('redirects legacy editId query to canonical edit route', async () => {
    const { default: BotsCreatePage } = await import('./page');

    await BotsCreatePage({
      searchParams: Promise.resolve({ editId: 'bot-123' }),
    });

    expect(redirectMock).toHaveBeenCalledWith('/dashboard/bots/bot-123/edit');
  });

  it('renders create mode when editId is missing', async () => {
    const { default: BotsCreatePage } = await import('./page');
    const ui = await BotsCreatePage({
      searchParams: Promise.resolve({}),
    });

    render(ui);

    expect(screen.getByTestId('bot-form-page')).toHaveTextContent('create');
    expect(botFormPageContentMock).toHaveBeenCalledWith({ mode: 'create' });
  });

  it('renders create mode when search params are omitted', async () => {
    const { default: BotsCreatePage } = await import('./page');
    const ui = await BotsCreatePage({});

    render(ui);

    expect(screen.getByTestId('bot-form-page')).toHaveTextContent('create');
    expect(botFormPageContentMock).toHaveBeenCalledWith({ mode: 'create' });
  });
});

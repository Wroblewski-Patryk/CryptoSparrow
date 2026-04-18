import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const botFormPageContentMock = vi.hoisted(() => vi.fn());

vi.mock('../../_components/BotFormPageContent', () => ({
  default: (props: { mode: 'create' | 'edit'; editId?: string }) => {
    botFormPageContentMock(props);
    return <div data-testid='bot-form-page'>{props.mode}:{props.editId ?? '-'}</div>;
  },
}));

describe('Bots edit page', () => {
  it('renders edit mode for canonical /dashboard/bots/:id/edit route', async () => {
    const { default: BotsEditPage } = await import('./page');
    const ui = await BotsEditPage({
      params: Promise.resolve({ id: 'bot-321' }),
    });

    render(ui);

    expect(screen.getByTestId('bot-form-page')).toHaveTextContent('edit:bot-321');
    expect(botFormPageContentMock).toHaveBeenCalledWith({ mode: 'edit', editId: 'bot-321' });
  });
});

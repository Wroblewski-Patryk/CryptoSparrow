import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SafetyBar from './SafetyBar';

const { pushMock, getMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  getMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('../../../lib/api', () => ({
  default: {
    get: getMock,
  },
}));

describe('SafetyBar', () => {
  it('renders mode and heartbeat status', async () => {
    getMock.mockResolvedValue({ data: {} });

    render(<SafetyBar mode='LIVE' />);

    expect(screen.getByText('Mode: LIVE')).toBeInTheDocument();
    expect(screen.getByText(/Connectivity:/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Heartbeat: OK/)).toBeInTheDocument();
    });
  });

  it('navigates to security section on emergency action', async () => {
    getMock.mockResolvedValue({ data: {} });

    render(<SafetyBar mode='PAPER' />);
    await waitFor(() => {
      expect(getMock).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Emergency Stop' }));

    expect(pushMock).toHaveBeenCalledWith('/dashboard/profile#security');
  });
});

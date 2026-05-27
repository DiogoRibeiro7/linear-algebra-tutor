import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockLogin = vi.fn();
vi.mock('@/services/api', () => ({
  authAPI: {
    login: (...args: unknown[]) => mockLogin(...args),
  },
}));

// Imported AFTER vi.mock so the mocks are in place when the module loads
import { Login } from './Login';

describe('Login', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogin.mockReset();
  });

  it('submits credentials and navigates on success', async () => {
    mockLogin.mockResolvedValueOnce('test-token');
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/username/i), 'alice');
    await user.type(screen.getByLabelText(/password/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('alice', 'hunter2hunter2');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows the API error message on failure', async () => {
    mockLogin.mockRejectedValueOnce({
      response: {
        data: {
          code: 'unauthorized',
          message: 'Incorrect username or password',
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/username/i), 'alice');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/incorrect username or password/i),
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a generic error when the API rejects without a message', async () => {
    mockLogin.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    await user.type(screen.getByLabelText(/username/i), 'alice');
    await user.type(screen.getByLabelText(/password/i), 'pw12345678');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
  });
});

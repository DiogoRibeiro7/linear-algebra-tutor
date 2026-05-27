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

const mockRegister = vi.fn();
vi.mock('@/services/api', () => ({
  authAPI: {
    register: (...args: unknown[]) => mockRegister(...args),
  },
}));

import { Register } from './Register';

async function fillForm(user: ReturnType<typeof userEvent.setup>, overrides: Partial<{
  full_name: string;
  email: string;
  username: string;
  password: string;
  confirm: string;
}> = {}) {
  const defaults = {
    full_name: 'Alice Example',
    email: 'alice@example.com',
    username: 'alice',
    password: 'hunter2hunter2',
    confirm: 'hunter2hunter2',
  };
  const v = { ...defaults, ...overrides };
  await user.type(screen.getByLabelText(/full name/i), v.full_name);
  await user.type(screen.getByLabelText(/email/i), v.email);
  await user.type(screen.getByLabelText(/^username$/i), v.username);
  await user.type(screen.getByLabelText(/^password$/i), v.password);
  await user.type(screen.getByLabelText(/confirm password/i), v.confirm);
}

describe('Register', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockRegister.mockReset();
  });

  it('rejects mismatched passwords without calling the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await fillForm(user, { confirm: 'different' });
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/passwords do not match/i),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('submits the form and navigates to /login on success', async () => {
    mockRegister.mockResolvedValueOnce({});
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: 'alice',
        email: 'alice@example.com',
        password: 'hunter2hunter2',
        full_name: 'Alice Example',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('surfaces server-side validation errors', async () => {
    mockRegister.mockRejectedValueOnce({
      response: {
        data: {
          code: 'bad_request',
          message: 'Username already registered',
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText(/username already registered/i),
    ).toBeInTheDocument();
  });
});

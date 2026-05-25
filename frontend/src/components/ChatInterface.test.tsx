import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';

const mockGetMessages = vi.fn();
const mockSendMessage = vi.fn();
vi.mock('@/services/api', () => ({
  chatAPI: {
    getMessages: (...args: unknown[]) => mockGetMessages(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
  },
}));

const storeState = {
  currentConversation: null as null | { id: number; title: string },
};
vi.mock('@/store', () => ({
  useStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

import { ChatInterface } from './ChatInterface';

describe('ChatInterface', () => {
  beforeEach(() => {
    mockGetMessages.mockReset();
    mockSendMessage.mockReset();
    storeState.currentConversation = null;
  });

  it('shows the welcome screen when no conversation is selected', () => {
    renderWithProviders(<ChatInterface />);
    expect(
      screen.getByText(/welcome to linear algebra tutor/i),
    ).toBeInTheDocument();
    expect(mockGetMessages).not.toHaveBeenCalled();
  });

  it('renders existing messages from the API', async () => {
    storeState.currentConversation = { id: 7, title: 'Vectors' };
    mockGetMessages.mockResolvedValueOnce([
      {
        id: 1,
        role: 'user',
        content: 'What is a vector?',
        created_at: '2026-05-25T10:00:00Z',
      },
      {
        id: 2,
        role: 'assistant',
        content: 'A vector has **magnitude** and direction.',
        created_at: '2026-05-25T10:00:05Z',
      },
    ]);

    renderWithProviders(<ChatInterface />);
    expect(await screen.findByText(/what is a vector\?/i)).toBeInTheDocument();
    expect(await screen.findByText(/magnitude/i)).toBeInTheDocument();
  });

  it('sends a typed message and clears the input', async () => {
    storeState.currentConversation = { id: 7, title: 'Vectors' };
    mockGetMessages.mockResolvedValue([]);
    mockSendMessage.mockResolvedValueOnce({
      answer: 'Sure!',
      sources: [],
      conversation_id: 7,
      message_id: 99,
    });

    const user = userEvent.setup();
    renderWithProviders(<ChatInterface />);

    const input = await screen.findByPlaceholderText(/ask a question/i);
    await user.type(input, 'Hello tutor');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(7, 'Hello tutor');
      expect((input as HTMLInputElement).value).toBe('');
    });
  });

  it('disables the send button while the input is empty', async () => {
    storeState.currentConversation = { id: 7, title: 'Vectors' };
    mockGetMessages.mockResolvedValue([]);

    renderWithProviders(<ChatInterface />);
    await screen.findByPlaceholderText(/ask a question/i);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conversation, User } from '@/services/api';
import { renderWithProviders } from '@/test/utils';

const mockGetConversations = vi.fn();
const mockCreateConversation = vi.fn();
vi.mock('@/services/api', () => ({
  chatAPI: {
    getConversations: () => mockGetConversations(),
    createConversation: (title?: string) => mockCreateConversation(title),
  },
}));

// Lightweight in-memory store stub. The real store ties conversations
// state to setConversations; mirror that so Dashboard's useEffect lands.
interface StoreState {
  user: User | null;
  currentConversation: Conversation | null;
  conversations: Conversation[];
  sidebarOpen: boolean;
  setCurrentConversation: (c: Conversation | null) => void;
  setConversations: (c: Conversation[]) => void;
  addConversation: (c: Conversation) => void;
  toggleSidebar: () => void;
  setToken: (t: string | null) => void;
  setUser: (u: User | null) => void;
}

let storeState: StoreState;

function resetStore() {
  storeState = {
    user: {
      id: 1,
      username: 'tester',
      email: 't@example.com',
      full_name: 'Test',
      is_active: true,
    },
    currentConversation: null,
    conversations: [],
    sidebarOpen: true,
    setCurrentConversation: vi.fn((c) => {
      storeState.currentConversation = c;
    }),
    setConversations: vi.fn((c) => {
      storeState.conversations = c;
    }),
    addConversation: vi.fn((c) => {
      storeState.conversations = [c, ...storeState.conversations];
    }),
    toggleSidebar: vi.fn(),
    setToken: vi.fn(),
    setUser: vi.fn(),
  };
}

vi.mock('@/store', () => ({
  useStore: () => storeState,
}));

import { Dashboard } from './Dashboard';

const SAMPLE_CONVERSATIONS: Conversation[] = [
  { id: 1, title: 'Vectors intro', created_at: '2026-05-25T10:00:00Z', message_count: 3 },
  { id: 2, title: 'Matrix multiplication', created_at: '2026-05-25T11:00:00Z', message_count: 7 },
  { id: 3, title: 'Eigenvalues', created_at: '2026-05-25T12:00:00Z', message_count: 1 },
];

describe('Dashboard', () => {
  beforeEach(() => {
    resetStore();
    mockGetConversations.mockReset();
    mockCreateConversation.mockReset();
    mockGetConversations.mockResolvedValue(SAMPLE_CONVERSATIONS);
  });

  it('filters conversations by case-insensitive title substring', async () => {
    // Pre-populate the store so the list renders without waiting on useQuery
    storeState.conversations = SAMPLE_CONVERSATIONS;
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    expect(screen.getByText('Vectors intro')).toBeInTheDocument();
    expect(screen.getByText('Matrix multiplication')).toBeInTheDocument();
    expect(screen.getByText('Eigenvalues')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/search conversations/i), 'MATRIX');

    await waitFor(() => {
      expect(screen.queryByText('Vectors intro')).not.toBeInTheDocument();
      expect(screen.getByText('Matrix multiplication')).toBeInTheDocument();
      expect(screen.queryByText('Eigenvalues')).not.toBeInTheDocument();
    });
  });

  it('shows an empty-state message when the filter matches nothing', async () => {
    storeState.conversations = SAMPLE_CONVERSATIONS;
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await user.type(
      screen.getByPlaceholderText(/search conversations/i),
      'nonsense',
    );

    expect(
      await screen.findByText(/no conversations match/i),
    ).toBeInTheDocument();
  });
});

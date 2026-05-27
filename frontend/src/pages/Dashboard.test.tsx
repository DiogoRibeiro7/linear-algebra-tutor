import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conversation, User } from '@/services/api';
import { renderWithProviders } from '@/test/utils';

const mockGetConversations = vi.fn();
const mockCreateConversation = vi.fn();
const mockUpdateConversation = vi.fn();
vi.mock('@/services/api', () => ({
  chatAPI: {
    getConversations: () => mockGetConversations(),
    createConversation: (title?: string) => mockCreateConversation(title),
    updateConversation: (id: number, patch: { pinned?: boolean; title?: string }) =>
      mockUpdateConversation(id, patch),
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
  {
    id: 1,
    title: 'Vectors intro',
    pinned: false,
    hint_level: 'medium',
    topic: null,
    created_at: '2026-05-25T10:00:00Z',
    message_count: 3,
  },
  {
    id: 2,
    title: 'Matrix multiplication',
    pinned: false,
    hint_level: 'medium',
    topic: null,
    created_at: '2026-05-25T11:00:00Z',
    message_count: 7,
  },
  {
    id: 3,
    title: 'Eigenvalues',
    pinned: false,
    hint_level: 'medium',
    topic: null,
    created_at: '2026-05-25T12:00:00Z',
    message_count: 1,
  },
];

describe('Dashboard', () => {
  beforeEach(() => {
    resetStore();
    mockGetConversations.mockReset();
    mockCreateConversation.mockReset();
    mockUpdateConversation.mockReset();
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

  it('calls updateConversation with pinned=true when the pin button is clicked', async () => {
    storeState.conversations = SAMPLE_CONVERSATIONS;
    mockUpdateConversation.mockResolvedValueOnce({
      ...SAMPLE_CONVERSATIONS[1],
      pinned: true,
    });
    // userEvent's pointer-events check trips on opacity-0; fireEvent
    // dispatches the click directly which mirrors the JS-level behavior
    // we actually care about.
    renderWithProviders(<Dashboard />);

    // Exact-match name to avoid /pin conversation/i also matching "Unpin
    // conversation" via substring.
    const pinButtons = screen.getAllByRole('button', { name: 'Pin conversation' });
    fireEvent.click(pinButtons[1]); // "Matrix multiplication"

    await waitFor(() => {
      expect(mockUpdateConversation).toHaveBeenCalledWith(2, { pinned: true });
    });
  });

  it('renders a filled pin and Unpin label for already-pinned rows', () => {
    storeState.conversations = [
      { ...SAMPLE_CONVERSATIONS[0], pinned: true },
      SAMPLE_CONVERSATIONS[1],
    ];
    renderWithProviders(<Dashboard />);

    expect(
      screen.getByRole('button', { name: 'Unpin conversation' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Pin conversation' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides the hint-level select until a conversation is selected', () => {
    storeState.conversations = SAMPLE_CONVERSATIONS;
    storeState.currentConversation = null;
    renderWithProviders(<Dashboard />);
    expect(screen.queryByLabelText(/hint level/i)).not.toBeInTheDocument();
  });

  it('shows the active conversation hint level and PATCHes on change', async () => {
    storeState.conversations = SAMPLE_CONVERSATIONS;
    storeState.currentConversation = {
      ...SAMPLE_CONVERSATIONS[0],
      hint_level: 'medium',
    topic: null,
    };
    mockUpdateConversation.mockResolvedValueOnce({
      ...SAMPLE_CONVERSATIONS[0],
      hint_level: 'low',
    });

    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    const select = screen.getByLabelText(/hint level/i) as HTMLSelectElement;
    expect(select.value).toBe('medium');

    await user.selectOptions(select, 'low');

    await waitFor(() => {
      expect(mockUpdateConversation).toHaveBeenCalledWith(1, {
        hint_level: 'low',
      });
    });
  });

  it('PATCHes the topic on blur when the value has changed', async () => {
    storeState.conversations = SAMPLE_CONVERSATIONS;
    storeState.currentConversation = SAMPLE_CONVERSATIONS[0];
    mockUpdateConversation.mockResolvedValueOnce({
      ...SAMPLE_CONVERSATIONS[0],
      topic: 'vectors',
    });

    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    const input = screen.getByLabelText(/^topic$/i) as HTMLInputElement;
    await user.type(input, 'vectors');
    await user.tab(); // fires onBlur

    await waitFor(() => {
      expect(mockUpdateConversation).toHaveBeenCalledWith(1, {
        topic: 'vectors',
      });
    });
  });

  it('sends topic=null when the input is cleared', async () => {
    storeState.conversations = SAMPLE_CONVERSATIONS;
    storeState.currentConversation = {
      ...SAMPLE_CONVERSATIONS[0],
      topic: 'vectors',
    };
    mockUpdateConversation.mockResolvedValueOnce({
      ...SAMPLE_CONVERSATIONS[0],
      topic: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    const input = screen.getByLabelText(/^topic$/i) as HTMLInputElement;
    expect(input.value).toBe('vectors');
    await user.clear(input);
    await user.tab();

    await waitFor(() => {
      expect(mockUpdateConversation).toHaveBeenCalledWith(1, { topic: null });
    });
  });

  it('does not PATCH topic on blur when the value is unchanged', async () => {
    storeState.conversations = SAMPLE_CONVERSATIONS;
    storeState.currentConversation = {
      ...SAMPLE_CONVERSATIONS[0],
      topic: 'vectors',
    };

    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    const input = screen.getByLabelText(/^topic$/i) as HTMLInputElement;
    input.focus();
    await user.tab(); // blur without typing

    expect(mockUpdateConversation).not.toHaveBeenCalled();
  });
});

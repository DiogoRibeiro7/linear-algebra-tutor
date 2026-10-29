import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isTutorConversation, type TutorConversation } from './models';

const fake = vi.hoisted(() => ({
  stored: new Map<string, unknown>(),
  complete: vi.fn(),
}));

vi.mock('./runtime', () => ({
  connectAnnaRuntime: vi.fn(async () => ({
    llm: { complete: fake.complete },
    storage: {
      get: async ({ key }: { key: string }) => ({ value: fake.stored.get(key) }),
      set: async ({ key, value }: { key: string; value: unknown }) => {
        fake.stored.set(key, value);
      },
      delete: async ({ key }: { key: string }) => {
        fake.stored.delete(key);
      },
      list: async ({ prefix = '', cursor, limit = 100 }: {
        prefix?: string; cursor?: string; limit?: number;
      }) => {
        const keys = [...fake.stored.keys()].filter((key) => key.startsWith(prefix)).sort();
        const offset = Number(cursor ?? 0);
        const page = keys.slice(offset, offset + limit);
        return {
          items: page.map((key) => ({ key })),
          next_cursor: offset + limit < keys.length ? String(offset + limit) : null,
        };
      },
    },
  })),
}));

vi.mock('./retrieval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./retrieval')>();
  return {
    ...actual,
    loadCourseChunks: vi.fn(async () => [{
      id: 'vectors#1', source: 'vectors.md', type: 'course_material',
      topic: 'vectors', chapter: null,
      content: 'A vector has magnitude and direction.',
    }]),
  };
});

import { AnnaApp } from './AnnaApp';

describe('Anna tutoring window', () => {
  beforeEach(() => {
    fake.stored.clear();
    fake.complete.mockReset().mockResolvedValue({
      role: 'assistant',
      content: { type: 'text', text: 'How would you find the magnitude?' },
      model: 'mock',
      stopReason: 'endTurn',
    });
  });

  it('saves a generated explanation and restores it in a new window', async () => {
    const user = userEvent.setup();
    const window = render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    await user.type(screen.getByRole('textbox', { name: 'Ask a linear algebra question' }),
      'What is a vector magnitude?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();
    expect(fake.complete).toHaveBeenCalledOnce();
    expect(screen.getAllByText('What is a vector magnitude?')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Retry answer' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Retrieved materials (1)'));
    await user.click(screen.getByText('View passage 1'));
    expect(screen.getByText('A vector has magnitude and direction.')).toBeInTheDocument();

    window.unmount();
    render(<AnnaApp />);
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();
    await user.click(screen.getByText('Retrieved materials (1)'));
    expect(screen.getByText('View passage 1')).toBeInTheDocument();
  });

  it('fills a draft from a starter without calling the model or saving a student turn', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));

    const suggested = screen.getByRole('group', { name: 'Suggested starting questions' });
    expect(suggested.querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByText('Edit the question if needed; nothing is sent until you press Send.'))
      .toBeInTheDocument();
    const question = 'How can I solve a 2×2 linear system using elimination?';
    await user.click(screen.getByRole('button', { name: question }));

    const composer = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });
    expect(composer).toHaveValue(question);
    expect(composer).toHaveFocus();
    expect(screen.queryByRole('group', { name: 'Suggested starting questions' })).not.toBeInTheDocument();
    expect(fake.complete).not.toHaveBeenCalled();
    expect([...fake.stored.values()].filter(isTutorConversation)[0].messages).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();
    expect(fake.complete).toHaveBeenCalledOnce();
    expect(fake.complete.mock.calls[0][0].messages[0].content).toContain(question);
    expect(screen.queryByRole('group', { name: 'Suggested starting questions' })).not.toBeInTheDocument();
  });

  it('changes starter questions with the chosen course topic and keeps free-form entry', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));

    await user.selectOptions(screen.getByLabelText('Topic'), 'vectors');
    const question = 'Why does the dot product help identify perpendicular vectors?';
    expect(await screen.findByRole('button', { name: question })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'What makes an eigenvector special?' }))
      .not.toBeInTheDocument();
    expect(fake.complete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: question }));
    const composer = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });
    await user.clear(composer);
    expect(screen.getByRole('group', { name: 'Suggested starting questions' })).toBeInTheDocument();
    await user.type(composer, 'How do I normalize a vector?');
    expect(screen.queryByRole('group', { name: 'Suggested starting questions' })).not.toBeInTheDocument();
    expect(fake.complete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();
    const saved = [...fake.stored.values()].filter(isTutorConversation);
    expect(saved[0].topic).toBe('vectors');
    expect(saved[0].messages[0].content).toBe('How do I normalize a vector?');
  });

  it('accepts multiline matrix questions and sends on Enter without losing line breaks', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    const composer = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });
    expect(composer).toHaveAttribute('maxlength', '4000');

    await user.click(composer);
    await user.type(composer, 'Find the rank of this matrix:');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(composer, '1 2');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(composer, '3 4');
    const problem = 'Find the rank of this matrix:\n1 2\n3 4';

    expect(composer).toHaveValue(problem);
    expect(fake.complete).not.toHaveBeenCalled();
    expect(screen.getByText('Enter to send · Shift+Enter for a new line. Check mathematical steps independently.'))
      .toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();
    expect(fake.complete).toHaveBeenCalledOnce();
    expect(fake.complete.mock.calls[0][0].messages[0].content).toContain(problem);

    const saved = [...fake.stored.values()].filter(isTutorConversation);
    expect(saved).toHaveLength(1);
    expect(saved[0].messages[0].content).toBe(problem);
    expect(saved[0].title).toBe('Find the rank of this matrix: 1 2 3 4');
  });

  it('keeps an IME composition Enter from submitting a partial equation', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    const composer = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });
    await user.type(composer, 'matrix');

    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter', isComposing: true });
    expect(fake.complete).not.toHaveBeenCalled();
    expect(composer).toHaveValue('matrix');
  });

  it('revises a failed multiline LaTeX question without adding another student turn', async () => {
    const user = userEvent.setup();
    fake.complete.mockRejectedValueOnce(new Error('Model unavailable'));
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    const composer = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });
    const original = 'Compute the determinant:\n$A = \\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}$';
    fireEvent.change(composer, { target: { value: original } });
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Model unavailable')).toBeInTheDocument();

    const first = [...fake.stored.values()].filter(isTutorConversation)[0].messages[0];
    await user.click(screen.getByRole('button', { name: 'Edit question' }));
    expect(composer).toHaveValue(original);
    const revised = original.replace('1 & 2', '2 & 1');
    fireEvent.change(composer, { target: { value: revised } });
    await user.click(screen.getByRole('button', { name: 'Resend' }));
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();

    const saved = [...fake.stored.values()].filter(isTutorConversation);
    expect(saved[0].messages).toHaveLength(2);
    expect(saved[0].messages[0]).toMatchObject({ id: first.id, content: revised });
    expect(fake.complete.mock.calls[1][0].messages[0].content).toContain(revised);
    expect(saved[0].title).not.toContain('\n');
  });

  it('changes hint levels without leaving the conversation', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    await user.selectOptions(screen.getByLabelText('Hints'), 'low');
    expect(screen.getByLabelText('Hints')).toHaveValue('low');
  });

  it('recovers a previously saved chat that was missing from the index', async () => {
    const recovered: TutorConversation = {
      id: 'orphan', title: 'Recovered lesson',
      created_at: '2026-10-28T12:00:00Z',
      updated_at: '2026-10-28T12:00:00Z',
      hint_level: 'medium', topic: 'vectors', messages: [],
    };
    fake.stored.set('linear-algebra-tutor/v1/conversations/orphan', recovered);

    render(<AnnaApp />);
    expect(await screen.findByRole('heading', { name: 'Recovered lesson' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recovered lesson' })).toHaveAttribute('aria-current', 'page');
    expect(fake.stored.get('linear-algebra-tutor/v1/index')).toEqual([{
      id: 'orphan', title: 'Recovered lesson', updated_at: recovered.updated_at,
    }]);
  });

  it('removes a missing conversation from the index before choosing the active chat', async () => {
    fake.stored.set('linear-algebra-tutor/v1/index', [{
      id: 'deleted', title: 'Deleted lesson', updated_at: '2026-10-28T12:00:00Z',
    }]);

    render(<AnnaApp />);
    expect(await screen.findByRole('button', { name: 'Start learning' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deleted lesson' })).not.toBeInTheDocument();
    expect(fake.stored.get('linear-algebra-tutor/v1/index')).toEqual([]);
  });

  it('opens and dismisses the compact-window conversation drawer with keyboard support', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);

    const menu = await screen.findByRole('button', { name: 'Open conversations' });
    const navigation = screen.getByRole('complementary', { name: 'Conversations' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveAttribute('aria-controls', 'anna-conversations');
    expect(navigation).toHaveClass('hidden');

    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(navigation).toHaveClass('flex');
    expect(screen.getByRole('button', { name: 'Close conversations' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(navigation).toHaveClass('hidden');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(menu).toHaveFocus();

    await user.click(menu);
    await user.click(screen.getByRole('button', { name: 'Close navigation overlay' }));
    expect(navigation).toHaveClass('hidden');
    expect(menu).toHaveFocus();
  });

  it('closes compact navigation after creating or selecting a conversation', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);

    const menu = await screen.findByRole('button', { name: 'Open conversations' });
    const navigation = screen.getByRole('complementary', { name: 'Conversations' });
    await user.click(menu);
    await user.click(screen.getByRole('button', { name: 'Create conversation' }));
    expect(navigation).toHaveClass('hidden');
    expect(screen.getByLabelText('Ask a linear algebra question')).toBeEnabled();

    await user.click(menu);
    await user.click(screen.getByRole('button', { name: 'Create conversation' }));
    expect(navigation).toHaveClass('hidden');
    await user.click(menu);
    const savedChats = screen.getByRole('navigation', { name: 'Saved chats' });
    const conversations = savedChats.querySelectorAll('button');
    expect(conversations).toHaveLength(2);
    await user.click(conversations[1]);
    expect(navigation).toHaveClass('hidden');
    expect(menu).toHaveFocus();
  });

  it('retries a failed model call without duplicating the saved student question', async () => {
    const user = userEvent.setup();
    fake.complete.mockRejectedValueOnce(new Error('Anna LLM temporarily unavailable'));
    render(<AnnaApp />);

    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    await user.type(screen.getByRole('textbox', { name: 'Ask a linear algebra question' }),
      'What is a vector magnitude?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Anna LLM temporarily unavailable')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Retry answer' })).toBeInTheDocument();
    expect(screen.getByText('Retrying may use another Anna model call.')).toBeInTheDocument();
    expect(screen.getByLabelText('Ask a linear algebra question')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Retry answer' }));
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();
    expect(fake.complete).toHaveBeenCalledTimes(2);
    expect(fake.complete.mock.calls[1][0].messages).toHaveLength(1);
    expect(screen.getAllByText('What is a vector magnitude?')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Retry answer' })).not.toBeInTheDocument();

    const saved = [...fake.stored.values()].filter(isTutorConversation);
    expect(saved).toHaveLength(1);
    expect(saved[0].messages.map(({ role }) => role)).toEqual(['user', 'assistant']);
  });

  it('revises an unanswered question in place without losing it on cancel', async () => {
    const user = userEvent.setup();
    fake.complete.mockRejectedValueOnce(new Error('Model temporarily unavailable'));
    render(<AnnaApp />);

    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    const input = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });
    await user.type(input, 'What is a vector?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Model temporarily unavailable')).toBeInTheDocument();

    const original = [...fake.stored.values()].filter(isTutorConversation)[0].messages[0];
    await user.click(screen.getByRole('button', { name: 'Edit question' }));
    expect(input).toBeEnabled();
    expect(input).toHaveValue('What is a vector?');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Retry answer' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel edit' }));
    expect(input).toBeDisabled();
    expect([...fake.stored.values()].filter(isTutorConversation)[0].messages).toEqual([original]);

    await user.click(screen.getByRole('button', { name: 'Edit question' }));
    await user.clear(input);
    await user.type(input, 'How do I calculate vector magnitude?');
    await user.click(screen.getByRole('button', { name: 'Resend' }));
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();
    expect(fake.complete).toHaveBeenCalledTimes(2);
    expect(fake.complete.mock.calls[1][0].messages).toHaveLength(1);
    expect(fake.complete.mock.calls[1][0].messages[0].content)
      .toContain('How do I calculate vector magnitude?');

    const saved = [...fake.stored.values()].filter(isTutorConversation);
    expect(saved).toHaveLength(1);
    expect(saved[0].messages.map(({ role }) => role)).toEqual(['user', 'assistant']);
    expect(saved[0].messages[0]).toMatchObject({
      id: original.id,
      content: 'How do I calculate vector magnitude?',
    });
    expect(saved[0].title).toBe('How do I calculate vector magnitude?');
  });

  it('can retry a revised question after a second interrupted model call', async () => {
    const user = userEvent.setup();
    fake.complete.mockRejectedValueOnce(new Error('First failure'));
    fake.complete.mockRejectedValueOnce(new Error('Second failure'));
    const window = render(<AnnaApp />);

    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    const input = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });
    await user.type(input, 'What is a vector?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('First failure')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit question' }));
    await user.clear(input);
    await user.type(input, 'Can you explain eigenvectors?');
    await user.click(screen.getByRole('button', { name: 'Resend' }));
    expect(await screen.findByText('Second failure')).toBeInTheDocument();

    window.unmount();
    render(<AnnaApp />);
    expect(await screen.findByRole('button', { name: 'Retry answer' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask a linear algebra question' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry answer' }));
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();

    const saved = [...fake.stored.values()].filter(isTutorConversation);
    expect(saved).toHaveLength(1);
    expect(saved[0].messages.map(({ role }) => role)).toEqual(['user', 'assistant']);
    expect(saved[0].messages[0].content).toBe('Can you explain eigenvectors?');
    expect(fake.complete).toHaveBeenCalledTimes(3);
  });

  it('revises only the latest failed turn and retains earlier answered turns', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    const input = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });

    await user.type(input, 'What is a vector?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();

    fake.complete.mockRejectedValueOnce(new Error('Model unavailable'));
    await user.type(input, 'And what about eigenvalues?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Model unavailable')).toBeInTheDocument();
    const pending = [...fake.stored.values()].filter(isTutorConversation)[0].messages[2];

    await user.click(screen.getByRole('button', { name: 'Edit question' }));
    await user.clear(input);
    await user.type(input, 'How can I compute eigenvalues?');
    await user.click(screen.getByRole('button', { name: 'Resend' }));

    const saved = [...fake.stored.values()].filter(isTutorConversation);
    expect(saved[0].title).toBe('What is a vector?');
    expect(saved[0].messages.map(({ role }) => role))
      .toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(saved[0].messages[2]).toMatchObject({
      id: pending.id,
      content: 'How can I compute eigenvalues?',
    });
    expect(fake.complete.mock.calls[2][0].messages).toHaveLength(3);
    expect(fake.complete.mock.calls[2][0].messages[2].content)
      .toContain('How can I compute eigenvalues?');
  });

  it('clears the revision draft when switching to a new conversation', async () => {
    const user = userEvent.setup();
    fake.complete.mockRejectedValueOnce(new Error('Model unavailable'));
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    const input = screen.getByRole('textbox', { name: 'Ask a linear algebra question' });
    await user.type(input, 'What is a vector?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Model unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit question' }));
    await user.type(input, ' More context');
    await user.click(screen.getByRole('button', { name: 'Create conversation' }));
    expect(input).toHaveValue('');
    expect(input).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument();

    const saved = [...fake.stored.values()].filter(isTutorConversation);
    const original = saved.find(({ messages }) => messages.length === 1);
    expect(original?.messages[0].content).toBe('What is a vector?');
  });

  it('offers recovery after reopening a conversation with an unanswered question', async () => {
    const user = userEvent.setup();
    fake.complete.mockRejectedValueOnce(new Error('Model request interrupted'));
    const window = render(<AnnaApp />);

    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    await user.type(screen.getByRole('textbox', { name: 'Ask a linear algebra question' }),
      'What is a vector magnitude?');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Model request interrupted')).toBeInTheDocument();

    window.unmount();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Retry answer' }));
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();

    const saved = [...fake.stored.values()].filter(isTutorConversation);
    expect(saved).toHaveLength(1);
    expect(saved[0].messages.map(({ role }) => role)).toEqual(['user', 'assistant']);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isTutorConversation } from './models';

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

  it('changes hint levels without leaving the conversation', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    await user.selectOptions(screen.getByLabelText('Hints'), 'low');
    expect(screen.getByLabelText('Hints')).toHaveValue('low');
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

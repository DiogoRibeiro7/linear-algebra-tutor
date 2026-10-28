import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

    window.unmount();
    render(<AnnaApp />);
    expect(await screen.findByText('How would you find the magnitude?')).toBeInTheDocument();
  });

  it('changes hint levels without leaving the conversation', async () => {
    const user = userEvent.setup();
    render(<AnnaApp />);
    await user.click(await screen.findByRole('button', { name: 'Start learning' }));
    await user.selectOptions(screen.getByLabelText('Hints'), 'low');
    expect(screen.getByLabelText('Hints')).toHaveValue('low');
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MessageMetadata } from '@/services/api';
import { MessageBubble } from './MessageBubble';

function assistantMessage(sources: NonNullable<MessageMetadata['sources']>) {
  return {
    role: 'assistant' as const,
    content: 'What would you try next?',
    created_at: '2026-10-28T12:00:00Z',
    metadata: { sources },
  };
}

describe('MessageBubble course evidence', () => {
  it('renders the referenced source excerpt with mathematical notation', async () => {
    const user = userEvent.setup();
    render(<MessageBubble message={assistantMessage([{
      source: 'vectors.md', type: 'course_material', chunk_ids: ['vectors.md#1@current'],
    }])} sourceEvidence={new Map([['vectors.md#1@current', {
      source: 'vectors.md', content: 'The norm is $\\|v\\|_2$.',
    }]])} />);

    await user.click(screen.getByText('Retrieved materials (1)'));
    await user.click(screen.getByText('View passage 1'));
    expect(document.querySelector('.katex')).toBeInTheDocument();
  });

  it('shows only the currently indexed passage matching the saved source file', async () => {
    const user = userEvent.setup();
    const evidence = new Map([['chapter#1@current', {
      source: 'matrices.md', content: 'An unrelated matrix example',
    }]]);
    render(<MessageBubble
      message={assistantMessage([{
        source: 'vectors.md', type: 'course_material',
        chunk_ids: ['chapter#1@current'],
      }])}
      sourceEvidence={evidence}
    />);

    await user.click(screen.getByText('Retrieved materials (1)'));
    expect(screen.getByText('Passage 1 is unavailable in this course version.')).toBeInTheDocument();
    expect(screen.queryByText('An unrelated matrix example')).not.toBeInTheDocument();
    expect(screen.queryByText('View passage 1')).not.toBeInTheDocument();
  });

  it('does not resolve a stale passage ID to a newer version of the same file', async () => {
    const user = userEvent.setup();
    render(<MessageBubble message={assistantMessage([{
      source: 'vectors.md', type: 'course_material', chunk_ids: ['vectors.md#1@old'],
    }])} sourceEvidence={new Map([['vectors.md#1@new', {
      source: 'vectors.md', content: 'Different lesson after an edit',
    }]])} />);

    await user.click(screen.getByText('Retrieved materials (1)'));
    expect(screen.getByText('Passage 1 is unavailable in this course version.')).toBeInTheDocument();
    expect(screen.queryByText('Different lesson after an edit')).not.toBeInTheDocument();
  });

  it('keeps older Anna references usable as filenames without passage IDs', async () => {
    const user = userEvent.setup();
    render(<MessageBubble message={assistantMessage([{
      source: 'vectors.md', type: 'course_material',
    }])} sourceEvidence={new Map()} />);

    await user.click(screen.getByText('Retrieved materials (1)'));
    expect(screen.getByText('vectors.md (course_material)')).toBeInTheDocument();
    expect(screen.queryByText('View passage 1')).not.toBeInTheDocument();
  });

  it('preserves the standalone tutor source list without Anna evidence', async () => {
    const user = userEvent.setup();
    render(<MessageBubble message={assistantMessage([{
      source: 'vectors.md', type: 'course_material',
    }])} />);

    await user.click(screen.getByText('Sources (1)'));
    expect(screen.getByText('vectors.md (course_material)')).toBeInTheDocument();
  });
});

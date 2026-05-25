import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MathRenderer } from './MathRenderer';

describe('MathRenderer', () => {
  it('renders plain markdown as HTML', () => {
    render(<MathRenderer content="Hello **world**" />);
    const strong = screen.getByText('world');
    expect(strong.tagName).toBe('STRONG');
  });

  it('renders code blocks inside <pre>', () => {
    const content = '```python\nimport numpy as np\n```';
    const { container } = render(<MathRenderer content={content} />);
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('import numpy as np');
  });

  it('renders LaTeX math via KaTeX', () => {
    const { container } = render(<MathRenderer content="Pythagoras: $a^2 + b^2 = c^2$" />);
    // rehype-katex wraps inline math in <span class="katex">
    const katex = container.querySelector('.katex');
    expect(katex).not.toBeNull();
  });
});

# Contributing to Linear Algebra AI Tutor

Thank you for your interest in contributing! This project aims to provide high-quality AI-powered education for Linear Algebra students.

## How to Contribute

### Reporting Issues

- Check existing issues first to avoid duplicates
- Use the issue template when available
- Include:
  - Clear description of the problem
  - Steps to reproduce
  - Expected vs actual behavior
  - Screenshots if relevant
  - Environment (OS, Python/Node versions)

### Suggesting Features

- Open an issue with the "enhancement" label
- Describe the use case and benefit
- Consider implementation complexity
- Be open to discussion and feedback

### Code Contributions

1. **Fork the repository**
   ```bash
   gh repo fork diogoribeiro7/linear-algebra-tutor
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation
   - Keep commits focused and atomic

4. **Test thoroughly**
   ```bash
   # Backend tests
   cd backend
   pytest
   
   # Frontend tests
   cd frontend
   yarn test
   ```

5. **Submit a pull request**
   - Reference related issues
   - Describe what changed and why
   - Include screenshots for UI changes
   - Ensure CI passes

## Development Setup

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed setup instructions.

Quick start:
```bash
./setup.sh
# Edit .env with ANTHROPIC_API_KEY
python scripts/generate_embeddings.py
```

## Code Style

### Python (Backend)
- Follow PEP 8
- Use type hints
- Format with Black
- Lint with Ruff
- Maximum line length: 100 characters

```python
# Good
def process_message(content: str, user_id: int) -> dict[str, any]:
    """Process a user message and return response."""
    ...

# Bad
def process_message(content, user_id):
    ...
```

### TypeScript (Frontend)
- Use TypeScript strict mode
- Follow ESLint rules
- Functional components with hooks
- Props interfaces for all components

```typescript
// Good
interface MessageProps {
  content: string;
  timestamp: Date;
}

export function Message({ content, timestamp }: MessageProps) {
  ...
}

// Bad
export function Message(props: any) {
  ...
}
```

## Testing Guidelines

### Backend
- Unit tests for services
- Integration tests for API endpoints
- Mock external services (Claude API)
- Aim for >80% coverage

```python
def test_tutor_service():
    """Test tutor service generates appropriate responses."""
    service = TutorService()
    response = await service.answer_question("What is a vector?")
    assert "magnitude" in response.lower()
    assert "direction" in response.lower()
```

### Frontend
- Component tests with React Testing Library
- Integration tests for user flows
- Mock API calls

```typescript
test('sends message when form submitted', async () => {
  render(<ChatInterface />);
  const input = screen.getByPlaceholderText(/ask a question/i);
  fireEvent.change(input, { target: { value: 'What is a matrix?' } });
  fireEvent.submit(input);
  await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
});
```

## Documentation

- Update README.md for user-facing changes
- Update DEVELOPMENT.md for technical changes
- Add docstrings to all functions/classes
- Include code examples where helpful

## Commit Messages

Follow conventional commits:

```
feat: add problem bank feature
fix: correct LaTeX rendering issue
docs: update installation instructions
test: add tests for RAG system
refactor: simplify conversation management
```

## Pull Request Process

1. Update documentation
2. Add/update tests
3. Ensure CI passes
4. Request review from maintainers
5. Address feedback promptly
6. Squash commits if requested

## Questions?

- Open a discussion on GitHub
- Email: dfr@esmad.ipp.pt
- Check existing documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

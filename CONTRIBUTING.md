# Contributing to Athena

Thank you for your interest in contributing to Athena! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Security Considerations](#security-considerations)

## How to Contribute

We welcome contributions in the following areas:

- Bug fixes and security improvements
- New malware analysis techniques
- WASM module enhancements
- Documentation improvements
- Test coverage expansion
- UI/UX improvements

### Getting Started

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following our code style guidelines
4. Write tests for your changes
5. Submit a pull request

## Development Setup

### Prerequisites

- Rust 1.75 or later
- Node.js 18+ and npm
- Docker (for container sandboxing)
- Git

### Initial Setup

Use the provided setup script for automated environment configuration:

```bash
./scripts/athena setup
```

This script will:
- Install Rust toolchains and components
- Install Node.js dependencies
- Build WASM modules
- Set up development environment

### Manual Setup

If you prefer manual setup:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install WASM target
rustup target add wasm32-wasip1

# Install Node dependencies
cd athena-v2
npm install

# Build WASM modules
cd ../wasm-modules/core
for module in analysis-engine crypto deobfuscator file-processor network pattern-matcher sandbox; do
    cd $module
    cargo component build --release
    cd ..
done
```

### Development Commands

```bash
# Run in development mode
cd athena-v2
npm run tauri:dev

# Build for production
npm run tauri:build

# Run Rust tests
cd athena-v2/src-tauri
cargo test

# Run frontend tests
cd athena-v2
npm test

# Run security lints
cd athena-v2/src-tauri
cargo clippy -- -D warnings
```

## Pull Request Process

1. **Update Documentation**: Ensure README.md and relevant docs are updated
2. **Add Tests**: All new features must include tests
3. **Update Changelog**: Add your changes to CHANGELOG.md under [Unreleased]
4. **Follow Code Style**: Run linters and formatters before committing
5. **Security Review**: Ensure your changes don't introduce security vulnerabilities
6. **Create PR**: Submit PR against `main` branch with clear description

### PR Title Format

Use conventional commits format:

- `feat: Add new malware detection technique`
- `fix: Resolve memory leak in WASM sandbox`
- `docs: Update installation instructions`
- `test: Add tests for ELF parser`
- `refactor: Simplify circuit breaker logic`
- `security: Fix path traversal vulnerability`

### PR Description Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Security improvement
- [ ] Documentation update
- [ ] Refactoring

## Testing
Describe the tests you ran and their results

## Security Impact
Describe any security implications of this change

## Checklist
- [ ] Code follows project style guidelines
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No security vulnerabilities introduced
```

## Code Style

Athena follows strict code style guidelines documented in `.claude/rules/`.

### Rust Backend

See [.claude/rules/rust-backend.md](/.claude/rules/rust-backend.md) for complete guidelines.

**Key Rules:**

- Use `Result<T, E>` for all fallible operations
- Never use `.unwrap()` in production code
- Use `thiserror` for custom error types
- All Tauri commands return `Result<T, String>`
- Validate file paths to prevent directory traversal
- Use `Arc<Mutex<T>>` for shared mutable state

**Example:**

```rust
#[tauri::command]
pub async fn analyze_file(
    path: String,
    state: State<'_, Arc<Mutex<AnalysisState>>>,
) -> Result<AnalysisResult, String> {
    // Validate path
    let validated_path = validate_path(&path)?;

    // Perform analysis
    let result = perform_analysis(&validated_path)
        .await
        .map_err(|e| format!("Analysis failed: {}", e))?;

    Ok(result)
}
```

### TypeScript Frontend

See [.claude/rules/typescript-frontend.md](/.claude/rules/typescript-frontend.md) for complete guidelines.

**Key Rules:**

- No `any` types without justification
- Use `createSignal` for reactive primitives
- Use `createStore` for complex objects
- Always cleanup effects with `onCleanup`
- Use try-catch for all Tauri command invocations
- Show loading states for async operations

**Example:**

```typescript
const [results, setResults] = createSignal<AnalysisResult | null>(null);
const [loading, setLoading] = createSignal(false);

async function runAnalysis(path: string) {
    setLoading(true);
    try {
        const result = await invoke<AnalysisResult>('analyze_file', { path });
        setResults(result);
    } catch (error) {
        console.error('Analysis failed:', error);
        showErrorToast(String(error));
    } finally {
        setLoading(false);
    }
}
```

### Formatting

```bash
# Format Rust code
cargo fmt

# Format TypeScript code
npm run format

# Run linters
cargo clippy -- -D warnings
npm run lint
```

## Testing Requirements

All contributions must include appropriate tests.

### Test Coverage Requirements

- New features: 80%+ test coverage
- Bug fixes: Test demonstrating the bug + fix
- Security fixes: Multiple test cases including edge cases

### Rust Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_validation() {
        let base = PathBuf::from("/tmp/athena");

        // Valid path
        assert!(validate_path("/tmp/athena/file.bin", &base).is_ok());

        // Path traversal attempt
        assert!(validate_path("/tmp/athena/../etc/passwd", &base).is_err());
    }

    #[tokio::test]
    async fn test_analysis_command() {
        let result = analyze_file("test.bin".to_string(), /* state */)
            .await
            .unwrap();

        assert!(result.threats.is_empty());
    }
}
```

### Frontend Tests

```typescript
import { render } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';

describe('AnalysisPanel', () => {
    it('shows loading state during analysis', async () => {
        const { getByTestId } = render(() => <AnalysisPanel />);

        // Trigger analysis
        fireEvent.click(getByTestId('analyze-button'));

        // Check loading state
        expect(getByTestId('loading-spinner')).toBeInTheDocument();
    });
});
```

### WASM Module Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pattern_matching() {
        let engine = create_test_engine();
        let data = b"test malware signature";

        let matches = engine.scan(data).unwrap();

        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].rule_name, "TestRule");
    }
}
```

### Running Tests

```bash
# All Rust tests
cd athena-v2/src-tauri && cargo test

# WASM module tests
cd wasm-modules && cargo test --all

# Frontend tests
cd athena-v2 && npm test

# Integration tests
cd athena-v2 && npm run test:integration
```

## Security Considerations

Athena is a malware analysis platform. Security is paramount.

See [.claude/rules/security.md](/.claude/rules/security.md) for complete guidelines.

### Critical Security Rules

1. **Never execute malware outside sandbox**: All malware samples must run only in WASM or container isolation
2. **Validate all input**: Assume all binary files are malicious
3. **No secrets in code**: Use environment variables for API keys
4. **Path validation**: Prevent directory traversal attacks
5. **Resource limits**: Enforce memory and CPU limits in WASM modules

### Security Checklist for PRs

- [ ] No execution of untrusted code outside sandbox
- [ ] All file paths validated against traversal
- [ ] User input sanitized before use
- [ ] No API keys or secrets in code
- [ ] Binary file formats validated before parsing
- [ ] WASM resource limits enforced
- [ ] No innerHTML with unsanitized content
- [ ] Error messages don't leak sensitive info

### Reporting Security Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

Instead:
1. Email security details to project maintainers
2. Include steps to reproduce
3. Wait for confirmation before disclosure
4. Allow 90 days for patching before public disclosure

### Security Testing

Run security audits before submitting:

```bash
# Rust dependency audit
cargo audit

# NPM dependency audit
npm audit

# Security linters
cargo clippy -- -D warnings -W clippy::unwrap_used
```

## Questions?

- Open an issue for general questions
- Join our discussions for design discussions
- Check existing issues before creating new ones

Thank you for contributing to Athena!

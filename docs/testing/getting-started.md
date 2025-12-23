# Getting Started with Testing

## Prerequisites

- **Node.js** 18+ installed
- **Rust** 1.75+ installed
- **Tauri CLI** 2.0 installed
- All dependencies installed in `athena-v2/`

## Project Structure

```
athena-v2/
├── src/                          # Frontend source (SolidJS + TypeScript)
│   ├── components/solid/         # SolidJS components
│   │   └── analysis/*.test.tsx   # Component tests (Vitest)
│   ├── services/                 # TypeScript services
│   └── test-setup.ts             # Vitest configuration
├── src-tauri/                    # Backend source (Rust)
│   └── src/
│       ├── commands/             # Tauri command handlers
│       │   └── mod.rs (with #[cfg(test)])
│       ├── ai_providers/         # AI integration
│       └── workflow/             # Job system
└── wasm-modules/core/            # WASM analysis modules
    ├── analysis-engine/
    ├── deobfuscator/
    ├── file-processor/
    └── network/
```

## Running Tests

### Frontend Tests (Vitest)

```bash
# Navigate to athena-v2
cd /Users/kali/Athena/Athena/athena-v2

# Run all frontend tests
npm test

# Run tests in watch mode (re-run on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test file
npx vitest src/components/solid/analysis/YaraScanner.test.tsx

# Run tests matching a pattern
npx vitest --reporter=verbose src/services
```

### Rust Backend Tests

```bash
# Navigate to Tauri backend
cd /Users/kali/Athena/Athena/athena-v2/src-tauri

# Run all Rust tests
cargo test

# Run tests with output visible
cargo test -- --nocapture

# Run specific test
cargo test test_analyze_file

# Run tests in specific module
cargo test commands::file_analysis

# Run tests in parallel (default)
cargo test --jobs 4

# Run in single-threaded mode (for debugging)
cargo test -- --test-threads=1
```

### WASM Module Tests

```bash
# Test specific WASM module
cd /Users/kali/Athena/Athena/athena-v2/wasm-modules/core/deobfuscator
cargo test

# Test all WASM modules
cd /Users/kali/Athena/Athena/athena-v2/wasm-modules/core
cargo test --all

# Test with specific features
cargo test --features advanced-analysis

# Run integration tests only
cargo test --test '*'
```

## Test Organization

### Frontend Test Structure

```typescript
// Component test example
import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YaraScanner } from './YaraScanner';

describe('YaraScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render scanner interface', () => {
    render(() => <YaraScanner />);
    expect(screen.getByText(/YARA Scanner/i)).toBeInTheDocument();
  });

  it('should validate rule syntax', async () => {
    const { user } = render(() => <YaraScanner />);
    const ruleInput = screen.getByRole('textbox');

    await user.type(ruleInput, 'rule test { condition: true }');
    await user.click(screen.getByText('Validate'));

    expect(screen.getByText(/Valid/i)).toBeInTheDocument();
  });
});
```

### Backend Test Structure

```rust
// Tauri command test example
#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::MockRuntime;

    #[tokio::test]
    async fn test_analyze_file() {
        let result = analyze_file("test.exe".to_string()).await;
        assert!(result.is_ok());

        let analysis = result.unwrap();
        assert!(analysis.file_hash.len() > 0);
        assert!(analysis.file_type == "PE");
    }

    #[tokio::test]
    async fn test_invalid_file() {
        let result = analyze_file("nonexistent.exe".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }
}
```

### WASM Module Test Structure

```rust
// WASM module test example
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deobfuscate_string() {
        let input = "encrypted_string";
        let result = deobfuscate(input);

        assert!(result.is_some());
        assert_eq!(result.unwrap(), "decrypted_string");
    }

    #[test]
    fn test_detect_control_flow_flattening() {
        let bytecode = include_bytes!("../test_data/flattened.bin");
        let result = detect_cff(bytecode);

        assert!(result.is_flattened);
        assert!(result.dispatcher_blocks.len() > 0);
    }
}
```

## Writing Your First Test

### 1. Frontend Component Test

Create `src/components/solid/MyComponent.test.tsx`:

```typescript
import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(() => <MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

Run it:
```bash
cd athena-v2
npx vitest src/components/solid/MyComponent.test.tsx
```

### 2. TypeScript Service Test

Create `src/services/myService.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { myService } from './myService';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('myService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process data correctly', async () => {
    const result = await myService.process({ data: 'test' });
    expect(result).toBeDefined();
  });
});
```

### 3. Rust Backend Test

Add to `src-tauri/src/commands/mod.rs`:

```rust
#[tauri::command]
pub fn my_command(input: String) -> Result<String, String> {
    Ok(format!("Processed: {}", input))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_my_command() {
        let result = my_command("test".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Processed: test");
    }
}
```

Run it:
```bash
cd athena-v2/src-tauri
cargo test test_my_command
```

## Common Test Patterns

### Testing Tauri Commands (Frontend)

```typescript
import { invoke } from '@tauri-apps/api/core';
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core');

it('should call analyze_file command', async () => {
  const mockInvoke = vi.mocked(invoke);
  mockInvoke.mockResolvedValue({ hash: 'abc123', type: 'PE' });

  const result = await invoke('analyze_file', { path: 'test.exe' });

  expect(mockInvoke).toHaveBeenCalledWith('analyze_file', { path: 'test.exe' });
  expect(result.hash).toBe('abc123');
});
```

### Testing Async Operations (Rust)

```rust
#[tokio::test]
async fn test_async_command() {
    let result = async_command().await;
    assert!(result.is_ok());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn test_concurrent_operations() {
    let futures = vec![
        tokio::spawn(async { operation1().await }),
        tokio::spawn(async { operation2().await }),
    ];

    let results = futures::future::join_all(futures).await;
    assert!(results.iter().all(|r| r.is_ok()));
}
```

### Testing Reactive State (SolidJS)

```typescript
import { createSignal } from 'solid-js';
import { render, screen } from '@solidjs/testing-library';

it('should update when signal changes', async () => {
  const [count, setCount] = createSignal(0);

  render(() => (
    <div>
      <span>Count: {count()}</span>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  ));

  const button = screen.getByText('Increment');
  expect(screen.getByText('Count: 0')).toBeInTheDocument();

  await userEvent.click(button);
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

## Test Configuration

### Vitest Config (`athena-v2/vitest.config.ts`)

```typescript
import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    }
  }
});
```

### Test Setup (`athena-v2/src/test-setup.ts`)

```typescript
import { expect, afterEach } from 'vitest';
import { cleanup } from '@solidjs/testing-library';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});
```

## Debugging Tests

### Frontend Debug Mode

```bash
# Run with Node debugger
node --inspect-brk ./node_modules/.bin/vitest

# Then attach Chrome DevTools to chrome://inspect
```

### Rust Debug Mode

```bash
# Run tests with debug output
RUST_LOG=debug cargo test -- --nocapture

# Run specific test with full backtrace
RUST_BACKTRACE=full cargo test test_name -- --exact
```

### Print Debug Output

```typescript
// In Vitest tests
it('debug test', () => {
  console.log('Debug output:', someValue);
  // Or use screen.debug() for component output
  const { container } = render(() => <Component />);
  screen.debug(container);
});
```

```rust
// In Rust tests
#[test]
fn debug_test() {
    let value = compute_something();
    println!("Debug output: {:?}", value); // Requires -- --nocapture
    dbg!(&value); // Always prints
}
```

## Next Steps

- Read [Component Testing](./component-testing.md) for SolidJS patterns
- Check [Service Testing](./service-testing.md) for TypeScript services
- Review [API Testing](./api-testing.md) for Tauri IPC patterns
- See [Troubleshooting](./troubleshooting.md) for common issues

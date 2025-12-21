# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainers directly
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

### Scope

The following are in scope for security reports:

- Athena desktop application (Tauri)
- WASM security modules
- API integrations (OpenAI, Claude, DeepSeek)
- Container isolation mechanisms
- Malware sample handling

### Out of Scope

- Third-party dependencies (report to upstream)
- Social engineering attacks
- Physical security
- Denial of service (unless easily exploitable)

## Security Best Practices

### For Users

1. **API Keys**: Store API keys in environment variables, never in code
2. **Malware Samples**: Only analyze samples in isolated environments
3. **Container Isolation**: Always enable container isolation for dynamic analysis
4. **Updates**: Keep Athena updated to receive security patches

### For Developers

1. **No Secrets in Code**: Never commit API keys, passwords, or tokens
2. **Input Validation**: Validate all user input, especially file uploads
3. **WASM Sandboxing**: All analysis runs in Wasmtime with resource limits
4. **Dependency Audits**: Run `cargo audit` and `npm audit` regularly

## Security Features

### Built-in Protections

- **WASM Sandboxing**: All binary analysis runs in isolated WASM environment
- **Container Isolation**: Optional Docker containers for dynamic analysis
- **Memory Limits**: Configurable resource limits for analysis operations
- **API Rate Limiting**: Built-in rate limiting for AI provider calls
- **Circuit Breaker**: Automatic failover for provider outages

### File Handling

- Magic byte validation before processing
- Size limits on uploaded files (default: 100MB)
- Temporary file cleanup after analysis
- No execution of uploaded files outside sandbox

## Dependency Security

We use automated tools to monitor dependencies:

- **Dependabot**: Automated dependency updates
- **cargo audit**: Rust security advisories
- **npm audit**: Node.js security advisories

## Acknowledgments

We appreciate responsible security researchers who help keep Athena secure.

# Athena v2 Test Files

## ⚠️ IMPORTANT SAFETY NOTICE

These are **SAFE TEST FILES** that simulate malware characteristics for testing purposes only. They do NOT contain actual malicious code and are designed specifically for testing Athena's detection capabilities.

## Purpose

These test files help verify that Athena's analysis modules can:
- Detect suspicious patterns and behaviors
- Handle various file formats correctly
- Process files within memory limits
- Recover gracefully from errors

## Test File Categories

### 1. Executables (`/executables`)
- **test-suspicious-strings.txt**: Contains common malware strings and patterns
- **test-pe-header.bin**: Simulated PE file header for format detection

### 2. Scripts (`/scripts`)
- **test-obfuscated.js**: JavaScript with obfuscation patterns
- **test-powershell.ps1**: PowerShell with suspicious commands (commented out)

### 3. Documents (`/documents`)
- **test-macro-patterns.txt**: Simulates Office document with macro indicators

### 4. Archives (`/archives`)
- **test-encrypted.txt**: Simulates encrypted archive patterns

### 5. Special Tests
- **test-large-file.bin**: Tests 50MB file size handling (under 100MB limit)

## How to Use

1. **Start Athena v2**: `npm run tauri dev` from athena-v2 directory
2. **Drag and drop** test files onto the upload area
3. **Monitor results** in each analysis module
4. **Verify** no actual malware alerts are triggered

## Expected Results

Each analyzer should detect various suspicious patterns:
- **Static Analysis**: Suspicious strings, imports, and structures
- **YARA Scanner**: Pattern matches for test signatures
- **AI Ensemble**: Behavioral anomaly detection
- **Network Analysis**: Simulated C2 patterns
- **Threat Intelligence**: Mock IOC matches

## Testing Checklist

- [ ] All test files load without crashing
- [ ] WASM modules process files successfully
- [ ] Memory usage stays within limits
- [ ] Error boundaries catch any issues
- [ ] Logging service records all operations
- [ ] No real malware signatures triggered
- [ ] Large file (50MB) processes correctly
- [ ] UI remains responsive during analysis

## Notes

- These files are designed to trigger detection without being harmful
- All dangerous operations are commented out or simulated
- Test in an isolated environment if extra cautious
- Report any crashes or unexpected behavior
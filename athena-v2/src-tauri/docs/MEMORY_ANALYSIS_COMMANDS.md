# Memory Analysis Commands

**Status:** ✅ IMPLEMENTED - Fully Complete
**Module:** `/athena-v2/src-tauri/src/commands/memory_analysis.rs`
**Commands:** 2 (get_memory_regions, extract_strings_from_dump)

This document describes the memory analysis Tauri commands available in Athena v2.

## Commands

### `get_memory_regions`

Get memory regions from a process dump or memory map file.

**Signature:**
```rust
#[tauri::command]
pub async fn get_memory_regions(file_path: String) -> Result<Vec<MemoryRegion>, String>
```

**Parameters:**
- `file_path` (String): Path to memory dump or `/proc/[pid]/maps` file

**Returns:**
- `Result<Vec<MemoryRegion>, String>`: List of memory regions or error message

**MemoryRegion Structure:**
```typescript
interface MemoryRegion {
    start_address: number;
    end_address: number;
    size: number;
    permissions: string;  // e.g., "r-xp", "rw-p"
    region_type: string;  // "stack", "heap", "shared_library", etc.
    mapped_file: string | null;
}
```

**Supported Formats:**
- Linux `/proc/[pid]/maps` format
- Raw memory dumps (basic region detection)

**Example Usage (TypeScript):**
```typescript
import { invoke } from '@tauri-apps/api/core';

// Analyze memory map file
const regions = await invoke<MemoryRegion[]>('get_memory_regions', {
    filePath: '/tmp/memory_map.txt'
});

console.log(`Found ${regions.length} memory regions`);

// Find stack region
const stack = regions.find(r => r.region_type === 'stack');
if (stack) {
    console.log(`Stack: 0x${stack.start_address.toString(16)} - 0x${stack.end_address.toString(16)}`);
    console.log(`Size: ${(stack.size / 1024 / 1024).toFixed(2)} MB`);
}

// List all loaded libraries
const libraries = regions.filter(r => r.region_type === 'shared_library');
const uniqueLibs = [...new Set(libraries.map(r => r.mapped_file))];
console.log('Loaded libraries:', uniqueLibs);
```

**Region Types:**
- `stack`: Thread stack
- `heap`: Process heap
- `shared_library`: Shared library (.so files)
- `mapped_file`: Memory-mapped file
- `vdso`: Virtual Dynamic Shared Object
- `vvar`: Virtual variables
- `anonymous`: Anonymous mapping
- `data`: Generic data region (for raw dumps)
- `unknown`: Unknown region type

**Errors:**
- File not found
- File too large (>500MB)
- Failed to parse file

---

### `extract_strings_from_dump`

Extract ASCII and Unicode strings from a memory dump file.

**Signature:**
```rust
#[tauri::command]
pub async fn extract_strings_from_dump(
    file_path: String,
    min_length: usize,
    encoding: String,
) -> Result<Vec<ExtractedString>, String>
```

**Parameters:**
- `file_path` (String): Path to memory dump file
- `min_length` (number): Minimum string length (default: 4)
- `encoding` (String): `"ascii"`, `"unicode"`, or `"both"`

**Returns:**
- `Result<Vec<ExtractedString>, String>`: Extracted strings or error message

**ExtractedString Structure:**
```typescript
interface ExtractedString {
    offset: number;
    value: string;
    encoding: string;  // "ascii" or "unicode"
    suspicious: boolean;
    category: string | null;  // "url", "file_path", "registry", "ip_address", "email"
}
```

**Example Usage (TypeScript):**
```typescript
import { invoke } from '@tauri-apps/api/core';

// Extract all strings (ASCII and Unicode)
const strings = await invoke<ExtractedString[]>('extract_strings_from_dump', {
    filePath: '/tmp/memory_dump.bin',
    minLength: 4,
    encoding: 'both'
});

console.log(`Found ${strings.length} strings`);

// Filter suspicious strings
const suspicious = strings.filter(s => s.suspicious);
console.log(`Suspicious strings: ${suspicious.length}`);

// Group by category
const byCategory = strings.reduce((acc, s) => {
    if (s.category) {
        acc[s.category] = (acc[s.category] || 0) + 1;
    }
    return acc;
}, {} as Record<string, number>);

console.log('String categories:', byCategory);

// Find URLs
const urls = strings.filter(s => s.category === 'url');
console.log('URLs found:', urls.map(s => s.value));

// Find IP addresses
const ips = strings.filter(s => s.category === 'ip_address');
console.log('IP addresses:', ips.map(s => s.value));

// Find file paths
const paths = strings.filter(s => s.category === 'file_path');
console.log('File paths:', paths.map(s => s.value));
```

**Suspicious String Detection:**

The command automatically flags strings as suspicious if they contain:
- Common malware-related terms: `cmd.exe`, `powershell`, `regsvr32`, `payload`, `shellcode`, `inject`, `backdoor`, `trojan`, `keylog`, `ransomware`
- System paths: `\system32\`, `\windows\`, `temp\`
- Credentials: `password`, `passwd`, `credential`, `admin`
- Network protocols: `http://`, `https://`, `ftp://`
- Script extensions: `.exe`, `.dll`, `.bat`, `.vbs`, `.ps1`
- Long Base64-like strings (>20 chars, >95% alphanumeric + +/=)
- Long hex strings (>32 chars, all hex digits)

**String Categories:**
- `url`: HTTP/HTTPS/FTP URLs
- `file_path`: Windows file paths with `.exe`, `.dll`, `.sys`
- `registry`: Registry keys (e.g., `HKEY_`, `\Software\`)
- `ip_address`: IPv4 addresses
- `email`: Email addresses

**Encoding Types:**
- `ascii`: Printable ASCII characters (32-126, plus tab/LF/CR)
- `unicode`: UTF-16 LE (Little Endian) strings

**Errors:**
- File not found
- File too large (>500MB)
- Invalid encoding (must be "ascii", "unicode", or "both")
- Failed to read file

**Performance Notes:**
- Strings are deduplicated (consecutive identical strings within 10 bytes)
- Strings are sorted by offset for easier analysis
- Maximum string length is capped at 512 characters
- Minimum recommended length is 4 characters

---

## Example Frontend Component

```tsx
import { Component, createSignal } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

interface MemoryRegion {
    start_address: number;
    end_address: number;
    size: number;
    permissions: string;
    region_type: string;
    mapped_file: string | null;
}

interface ExtractedString {
    offset: number;
    value: string;
    encoding: string;
    suspicious: boolean;
    category: string | null;
}

const MemoryAnalyzer: Component = () => {
    const [regions, setRegions] = createSignal<MemoryRegion[]>([]);
    const [strings, setStrings] = createSignal<ExtractedString[]>([]);
    const [loading, setLoading] = createSignal(false);

    const analyzeMemoryMap = async (filePath: string) => {
        setLoading(true);
        try {
            const result = await invoke<MemoryRegion[]>('get_memory_regions', {
                filePath
            });
            setRegions(result);
        } catch (error) {
            console.error('Memory region analysis failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const extractStrings = async (filePath: string) => {
        setLoading(true);
        try {
            const result = await invoke<ExtractedString[]>('extract_strings_from_dump', {
                filePath,
                minLength: 4,
                encoding: 'both'
            });
            setStrings(result);
        } catch (error) {
            console.error('String extraction failed:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h2>Memory Analysis</h2>

            {/* Memory Regions */}
            <section>
                <h3>Memory Regions ({regions().length})</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Start</th>
                            <th>End</th>
                            <th>Size</th>
                            <th>Perms</th>
                            <th>Type</th>
                            <th>Mapped File</th>
                        </tr>
                    </thead>
                    <tbody>
                        {regions().map(region => (
                            <tr>
                                <td>0x{region.start_address.toString(16)}</td>
                                <td>0x{region.end_address.toString(16)}</td>
                                <td>{(region.size / 1024).toFixed(1)} KB</td>
                                <td>{region.permissions}</td>
                                <td>{region.region_type}</td>
                                <td>{region.mapped_file || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {/* Extracted Strings */}
            <section>
                <h3>Extracted Strings ({strings().length})</h3>
                <div>
                    Suspicious: {strings().filter(s => s.suspicious).length}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Offset</th>
                            <th>Value</th>
                            <th>Encoding</th>
                            <th>Category</th>
                            <th>Suspicious</th>
                        </tr>
                    </thead>
                    <tbody>
                        {strings().map(str => (
                            <tr class={str.suspicious ? 'suspicious' : ''}>
                                <td>0x{str.offset.toString(16)}</td>
                                <td>{str.value}</td>
                                <td>{str.encoding}</td>
                                <td>{str.category || '-'}</td>
                                <td>{str.suspicious ? '⚠️' : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
};

export default MemoryAnalyzer;
```

---

## Security Considerations

### File Size Limits
Both commands enforce a maximum file size of 500MB to prevent memory exhaustion attacks.

### Path Validation
File paths are validated to prevent directory traversal attacks (handled by Tauri's security model).

### String Length Limits
- Minimum: 4 characters (configurable)
- Maximum: 512 characters (prevents memory issues with malformed data)

### Encoding Validation
Only "ascii", "unicode", and "both" encodings are accepted. Invalid values return an error.

### Suspicious Pattern Detection
Strings are automatically flagged if they match common malware patterns, helping analysts identify potential indicators of compromise (IOCs).

---

## Testing

Run the integration tests:
```bash
cd athena-v2/src-tauri
cargo test --test memory_analysis_integration_test
```

Unit tests are included in the module:
```bash
cargo test --bin athena-v2 memory_analysis::tests
```

---

## Future Enhancements

Potential improvements for future versions:

1. **Binary pattern detection**: Identify shellcode patterns, encryption keys
2. **Memory diffing**: Compare two memory dumps to find changes
3. **Process tree reconstruction**: Build process tree from memory artifacts
4. **Yara scanning**: Scan extracted strings with Yara rules
5. **Export to CSV/JSON**: Export results in various formats
6. **Volatility integration**: Parse Volatility plugin output
7. **Windows memory dumps**: Support for Windows minidumps and full dumps
8. **Symbol resolution**: Resolve addresses to symbols using debug info

---

## Related Commands

- `analyze_file`: File format analysis
- `disassemble_file`: Disassembly of executable regions
- `analyze_memory_with_volatility`: Volatility memory forensics
- `scan_file_with_yara`: Yara rule scanning

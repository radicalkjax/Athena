// Example usage of memory analysis commands
//
// This file demonstrates how to use the memory analysis commands
// outside of the Tauri context (for testing/debugging).
//
// Note: These commands are designed to be called from the frontend via Tauri IPC.
// This example shows the underlying logic for reference.

use std::fs::File;
use std::io::Write;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Memory Analysis Commands Example\n");

    // Example 1: Create a test /proc/maps file
    let test_maps = create_test_proc_maps()?;
    println!("✓ Created test /proc/maps file: {:?}", test_maps);

    // Example 2: Create a test memory dump
    let test_dump = create_test_memory_dump()?;
    println!("✓ Created test memory dump: {:?}\n", test_dump);

    println!("=== Example Usage ===\n");

    println!("1. Get Memory Regions:");
    println!("   Command: get_memory_regions");
    println!("   File: {:?}", test_maps);
    println!("   Expected: List of memory regions with addresses, permissions, types\n");

    println!("2. Extract Strings (ASCII):");
    println!("   Command: extract_strings_from_dump");
    println!("   File: {:?}", test_dump);
    println!("   Encoding: ascii");
    println!("   Min Length: 4");
    println!("   Expected: ASCII strings like 'Hello World', 'cmd.exe', URLs\n");

    println!("3. Extract Strings (Unicode):");
    println!("   Command: extract_strings_from_dump");
    println!("   File: {:?}", test_dump);
    println!("   Encoding: unicode");
    println!("   Min Length: 4");
    println!("   Expected: UTF-16 LE strings\n");

    println!("4. Extract All Strings:");
    println!("   Command: extract_strings_from_dump");
    println!("   File: {:?}", test_dump);
    println!("   Encoding: both");
    println!("   Min Length: 4");
    println!("   Expected: Both ASCII and Unicode strings\n");

    println!("=== Frontend Usage (TypeScript) ===\n");
    println!("import {{ invoke }} from '@tauri-apps/api/core';");
    println!();
    println!("// Get memory regions");
    println!("const regions = await invoke<MemoryRegion[]>('get_memory_regions', {{");
    println!("    filePath: '/path/to/memory_map.txt'");
    println!("}});");
    println!();
    println!("// Extract strings");
    println!("const strings = await invoke<ExtractedString[]>('extract_strings_from_dump', {{");
    println!("    filePath: '/path/to/memory_dump.bin',");
    println!("    minLength: 4,");
    println!("    encoding: 'both'");
    println!("}});");
    println!();
    println!("// Filter suspicious strings");
    println!("const suspicious = strings.filter(s => s.suspicious);");
    println!("console.log('Suspicious:', suspicious.length);");
    println!();

    println!("=== Expected Output Examples ===\n");
    println!("Memory Regions:");
    println!("  - 0x7f1234567000-0x7f123456a000 (12KB) r-xp [shared_library] /lib/libc.so.6");
    println!("  - 0x7fffd1234000-0x7fffd1255000 (132KB) rw-p [stack]");
    println!("  - 0x7fffd1258000-0x7fffd125a000 (8KB) r-xp [vdso]");
    println!();
    println!("Extracted Strings:");
    println!("  - 'Hello World' @ 0x0000 [ascii] (not suspicious)");
    println!("  - 'http://malware.com/payload' @ 0x0010 [ascii] (SUSPICIOUS) [url]");
    println!("  - 'cmd.exe /c del *.*' @ 0x002B [ascii] (SUSPICIOUS)");
    println!("  - 'Unicode' @ 0x0040 [unicode] (not suspicious)");
    println!();

    // Cleanup
    std::fs::remove_file(&test_maps).ok();
    std::fs::remove_file(&test_dump).ok();
    println!("✓ Cleaned up test files");

    Ok(())
}

fn create_test_proc_maps() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let temp_dir = std::env::temp_dir();
    let test_file = temp_dir.join("example_proc_maps.txt");

    let mut file = File::create(&test_file)?;
    writeln!(file, "7f1234567000-7f123456a000 r-xp 00001000 08:01 123456 /lib/x86_64-linux-gnu/libc.so.6")?;
    writeln!(file, "7f123456a000-7f123476a000 ---p 0000b000 08:01 123456 /lib/x86_64-linux-gnu/libc.so.6")?;
    writeln!(file, "7f123476a000-7f123476e000 r--p 0020b000 08:01 123456 /lib/x86_64-linux-gnu/libc.so.6")?;
    writeln!(file, "7f123476e000-7f1234770000 rw-p 0020f000 08:01 123456 /lib/x86_64-linux-gnu/libc.so.6")?;
    writeln!(file, "7fffd1234000-7fffd1255000 rw-p 00000000 00:00 0 [stack]")?;
    writeln!(file, "7fffd1255000-7fffd1258000 r--p 00000000 00:00 0 [vvar]")?;
    writeln!(file, "7fffd1258000-7fffd125a000 r-xp 00000000 00:00 0 [vdso]")?;

    Ok(test_file)
}

fn create_test_memory_dump() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let temp_dir = std::env::temp_dir();
    let test_file = temp_dir.join("example_memory_dump.bin");

    let mut file = File::create(&test_file)?;

    // Write some ASCII strings
    file.write_all(b"Hello World\x00\x00\x00")?;
    file.write_all(b"http://malware.com/payload\x00")?;
    file.write_all(b"\x00\x00\x00\x00")?;
    file.write_all(b"cmd.exe /c del *.*\x00")?;
    file.write_all(b"\x00\x00")?;

    // Write some Unicode strings (UTF-16 LE)
    file.write_all(b"U\x00n\x00i\x00c\x00o\x00d\x00e\x00\x00\x00")?;

    // Write random data
    file.write_all(&[0xFF, 0xFE, 0x12, 0x34, 0x56, 0x78])?;

    // Write an IP address
    file.write_all(b"192.168.1.100\x00")?;

    // Write a registry key
    file.write_all(b"HKEY_LOCAL_MACHINE\\Software\\Microsoft\x00")?;

    Ok(test_file)
}

use anyhow::Result;
use goblin::{elf, mach, pe, Object};
use serde::{Deserialize, Serialize};
use sha2::Digest;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};
use flate2::write::GzEncoder;
use flate2::Compression;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce, Key
};
use crate::signature_verify::{verify_pe_signature, verify_elf_signature, SignatureInfo};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileAnalysisResult {
    pub file_info: FileInfo,
    pub format_info: FormatInfo,
    pub sections: Vec<Section>,
    pub imports: Vec<Import>,
    pub exports: Vec<Export>,
    pub strings: Vec<ExtractedString>,
    pub entropy: f64,
    pub hashes: FileHashes,
    pub signatures: Vec<Signature>,
    pub anomalies: Vec<Anomaly>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub name: String,
    pub size: u64,
    pub mime_type: String,
    pub magic_bytes: String,
    pub creation_time: Option<u64>,
    pub modification_time: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum FormatInfo {
    PE {
        machine: String,
        characteristics: u16,
        subsystem: String,
        timestamp: u32,
        entry_point: u64,
        image_base: u64,
        is_dll: bool,
        is_signed: bool,
        signature_info: Option<SignatureInfo>,
    },
    ELF {
        class: String,
        data: String,
        version: u8,
        os_abi: String,
        abi_version: u8,
        machine: String,
        entry_point: u64,
        interpreter: Option<String>,
        signature_info: Option<SignatureInfo>,
    },
    MachO {
        cpu_type: String,
        cpu_subtype: String,
        file_type: String,
        flags: u32,
        entry_point: Option<u64>,
        is_fat: bool,
        architectures: Vec<String>,
    },
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Section {
    pub name: String,
    pub virtual_address: u64,
    pub virtual_size: u64,
    pub raw_size: u64,
    pub entropy: f64,
    pub characteristics: Vec<String>,
    pub suspicious: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Import {
    pub library: String,
    pub functions: Vec<String>,
    pub suspicious: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Export {
    pub name: String,
    pub ordinal: Option<u16>,
    pub address: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtractedString {
    pub value: String,
    pub offset: u64,
    pub encoding: String,
    pub suspicious: bool,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileHashes {
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
    pub ssdeep: Option<String>,
    pub imphash: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Signature {
    pub name: String,
    pub severity: String,
    pub description: String,
    pub matched_bytes: Option<Vec<u8>>,
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Anomaly {
    pub category: String,
    pub description: String,
    pub severity: String,
    pub details: HashMap<String, serde_json::Value>,
}

pub fn calculate_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let mut frequency = [0u64; 256];
    for &byte in data {
        frequency[byte as usize] += 1;
    }

    let len = data.len() as f64;
    let mut entropy = 0.0;

    for &count in &frequency {
        if count > 0 {
            let probability = count as f64 / len;
            entropy -= probability * probability.log2();
        }
    }

    entropy
}

pub fn extract_strings(data: &[u8], min_length: usize) -> Vec<ExtractedString> {
    let mut strings = Vec::new();
    let mut current_string = Vec::new();
    let mut current_offset = 0;

    for (offset, &byte) in data.iter().enumerate() {
        if byte.is_ascii_graphic() || byte == b' ' {
            if current_string.is_empty() {
                current_offset = offset;
            }
            current_string.push(byte);
        } else if !current_string.is_empty() {
            if current_string.len() >= min_length {
                if let Ok(s) = String::from_utf8(current_string.clone()) {
                    let suspicious = is_suspicious_string(&s);
                    let category = categorize_string(&s);
                    
                    strings.push(ExtractedString {
                        value: s,
                        offset: current_offset as u64,
                        encoding: "ASCII".to_string(),
                        suspicious,
                        category,
                    });
                }
            }
            current_string.clear();
        }
    }

    // Check for UTF-16 strings
    let mut i = 0;
    while i < data.len() - 1 {
        if data[i].is_ascii_graphic() && data[i + 1] == 0 {
            let mut utf16_string = Vec::new();
            let start_offset = i;
            
            while i < data.len() - 1 && data[i].is_ascii_graphic() && data[i + 1] == 0 {
                utf16_string.push(data[i]);
                i += 2;
            }
            
            if utf16_string.len() >= min_length {
                if let Ok(s) = String::from_utf8(utf16_string) {
                    let suspicious = is_suspicious_string(&s);
                    let category = categorize_string(&s);
                    
                    strings.push(ExtractedString {
                        value: s,
                        offset: start_offset as u64,
                        encoding: "UTF-16LE".to_string(),
                        suspicious,
                        category,
                    });
                }
            }
        }
        i += 1;
    }

    strings
}

fn is_suspicious_string(s: &str) -> bool {
    let suspicious_patterns = [
        "cmd.exe", "powershell", "wscript", "cscript",
        "reg add", "schtasks", "netsh", "bcdedit",
        "vssadmin", "wbadmin", "cipher", "del /f",
        "format", "crypto", "ransom", "bitcoin",
        "wallet", "onion", ".exe", ".dll", ".bat",
        "HKEY_", "\\CurrentVersion\\Run", "\\Services\\",
        "CreateRemoteThread", "VirtualAlloc", "WriteProcessMemory",
        "SetWindowsHook", "GetAsyncKeyState", "GetKeyState",
    ];

    let s_lower = s.to_lowercase();
    suspicious_patterns.iter().any(|pattern| s_lower.contains(pattern))
}

fn categorize_string(s: &str) -> Option<String> {
    if s.starts_with("http://") || s.starts_with("https://") {
        Some("URL".to_string())
    } else if s.contains('@') && s.contains('.') {
        Some("Email".to_string())
    } else if s.starts_with("\\\\") || (s.len() > 3 && &s[1..3] == ":\\") {
        Some("Path".to_string())
    } else if s.starts_with("HKEY_") || s.starts_with("HKLM\\") || s.starts_with("HKCU\\") {
        Some("Registry".to_string())
    } else if s.ends_with(".exe") || s.ends_with(".dll") || s.ends_with(".sys") {
        Some("Executable".to_string())
    } else {
        None
    }
}

pub fn calculate_hashes(data: &[u8]) -> FileHashes {
    let md5 = format!("{:x}", md5::compute(data));
    let sha1 = format!("{:x}", sha1::Sha1::digest(data));
    let sha256 = format!("{:x}", sha2::Sha256::digest(data));

    // Calculate ssdeep fuzzy hash
    let ssdeep = ssdeep::hash(data).ok();

    FileHashes {
        md5,
        sha1,
        sha256,
        ssdeep,
        imphash: None, // Will be calculated in parse_pe if applicable
    }
}

#[tauri::command]
pub async fn analyze_file(file_path: String) -> Result<FileAnalysisResult, String> {
    let path = Path::new(&file_path);
    
    // Read file metadata
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    
    // Read file contents
    let mut file = File::open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Calculate file entropy
    let entropy = calculate_entropy(&buffer);
    
    // Calculate hashes
    let hashes = calculate_hashes(&buffer);
    
    // Extract strings
    let strings = extract_strings(&buffer, 6);
    
    // Get MIME type
    let mime_type = mime_guess::from_path(&path)
        .first_or_octet_stream()
        .to_string();
    
    // Get magic bytes
    let magic_bytes = if buffer.len() >= 16 {
        hex::encode(&buffer[..16])
    } else {
        hex::encode(&buffer)
    };
    
    let file_info = FileInfo {
        name: path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        size: metadata.len(),
        mime_type,
        magic_bytes,
        creation_time: None,
        modification_time: None,
    };
    
    // Parse binary format
    let (format_info, sections, imports, exports, anomalies, imphash) = match Object::parse(&buffer) {
        Ok(Object::PE(pe)) => {
            let (fi, s, i, e, a, ih) = parse_pe(pe, &buffer, path);
            (fi, s, i, e, a, ih)
        },
        Ok(Object::Elf(elf)) => {
            let (fi, s, i, e, a) = parse_elf(elf, &buffer, path);
            (fi, s, i, e, a, None)
        },
        Ok(Object::Mach(mach)) => {
            let (fi, s, i, e, a) = parse_mach(mach, &buffer);
            (fi, s, i, e, a, None)
        },
        _ => (FormatInfo::Unknown, Vec::new(), Vec::new(), Vec::new(), Vec::new(), None),
    };

    // Update hashes with imphash if available
    let mut final_hashes = hashes;
    if let Some(ih) = imphash {
        final_hashes.imphash = Some(ih);
    }
    
    // Detect signatures using pattern matching
    let signatures = detect_signatures(&buffer);
    
    Ok(FileAnalysisResult {
        file_info,
        format_info,
        sections,
        imports,
        exports,
        strings,
        entropy,
        hashes: final_hashes,
        signatures,
        anomalies,
    })
}

fn parse_pe(pe: pe::PE, data: &[u8], path: &Path) -> (FormatInfo, Vec<Section>, Vec<Import>, Vec<Export>, Vec<Anomaly>, Option<String>) {
    let anomalies = Vec::new();

    // Verify digital signature
    let signature_info = verify_pe_signature(path, data).ok();
    let is_signed = signature_info.as_ref().map(|s| s.is_signed).unwrap_or(false);

    // Calculate imphash from imports
    let mut imphash_data = Vec::new();

    // Extract PE header info
    let format_info = FormatInfo::PE {
        machine: format!("{:?}", pe.header.coff_header.machine),
        characteristics: pe.header.coff_header.characteristics,
        subsystem: format!("{:?}", pe.header.optional_header.map(|h| h.windows_fields.subsystem).unwrap_or_default()),
        timestamp: pe.header.coff_header.time_date_stamp,
        entry_point: pe.entry as u64,
        image_base: pe.image_base as u64,
        is_dll: pe.is_lib,
        is_signed,
        signature_info,
    };
    
    // Parse sections
    let mut sections = Vec::new();
    for section in &pe.sections {
        let section_data = &data[section.pointer_to_raw_data as usize..
            (section.pointer_to_raw_data + section.size_of_raw_data) as usize];
        let section_entropy = calculate_entropy(section_data);
        
        let suspicious = section_entropy > 7.0 || 
            section.characteristics & 0x80000000 != 0 || // IMAGE_SCN_MEM_WRITE
            section.name().unwrap_or("").starts_with(".UPX");
        
        // Parse section characteristics flags
        let mut characteristics = Vec::new();
        let flags = section.characteristics;

        if flags & 0x00000020 != 0 { characteristics.push("CODE".to_string()); }
        if flags & 0x00000040 != 0 { characteristics.push("INITIALIZED_DATA".to_string()); }
        if flags & 0x00000080 != 0 { characteristics.push("UNINITIALIZED_DATA".to_string()); }
        if flags & 0x02000000 != 0 { characteristics.push("DISCARDABLE".to_string()); }
        if flags & 0x04000000 != 0 { characteristics.push("NOT_CACHED".to_string()); }
        if flags & 0x08000000 != 0 { characteristics.push("NOT_PAGED".to_string()); }
        if flags & 0x10000000 != 0 { characteristics.push("SHARED".to_string()); }
        if flags & 0x20000000 != 0 { characteristics.push("EXECUTE".to_string()); }
        if flags & 0x40000000 != 0 { characteristics.push("READ".to_string()); }
        if flags & 0x80000000 != 0 { characteristics.push("WRITE".to_string()); }

        sections.push(Section {
            name: section.name().unwrap_or("").to_string(),
            virtual_address: section.virtual_address as u64,
            virtual_size: section.virtual_size as u64,
            raw_size: section.size_of_raw_data as u64,
            entropy: section_entropy,
            characteristics,
            suspicious,
        });
    }
    
    // Parse imports and calculate imphash
    // Group imports by DLL using a HashMap
    let mut libs_map: HashMap<String, Vec<String>> = HashMap::new();

    for import in &pe.imports {
        let library = import.dll.to_lowercase();
        let function_name = import.name.to_string().to_lowercase();

        // Add to library's function list
        libs_map.entry(library.clone())
            .or_insert_with(Vec::new)
            .push(function_name.clone());

        // Add to imphash data: library.function format
        imphash_data.push(format!("{}.{}", library, function_name));
    }

    // Convert HashMap to Import structs
    let mut imports = Vec::new();
    for (library, functions) in libs_map {
        let suspicious = is_suspicious_import(&library, &functions);
        imports.push(Import {
            library,
            functions,
            suspicious,
        });
    }

    // Calculate imphash as MD5 of sorted, comma-separated library.function pairs
    let imphash = if !imphash_data.is_empty() {
        imphash_data.sort();
        let imphash_string = imphash_data.join(",");
        Some(format!("{:x}", md5::compute(imphash_string.as_bytes())))
    } else {
        None
    };

    // Parse exports
    let mut exports = Vec::new();
    for export in pe.exports {
        if let Some(name) = export.name {
            exports.push(Export {
                name: name.to_string(),
                ordinal: None, // goblin exports don't have ordinal field
                address: export.rva as u64,
            });
        }
    }

    (format_info, sections, imports, exports, anomalies, imphash)
}

fn parse_elf(elf: elf::Elf, data: &[u8], path: &Path) -> (FormatInfo, Vec<Section>, Vec<Import>, Vec<Export>, Vec<Anomaly>) {
    // Verify digital signature (GPG/PGP)
    let signature_info = verify_elf_signature(path, data).ok();

    // Parse OS ABI from ELF header
    let os_abi = match elf.header.e_ident[7] {
        0 => "SYSV",
        1 => "HP-UX",
        2 => "NetBSD",
        3 => "Linux",
        4 => "GNU Hurd",
        6 => "Solaris",
        7 => "AIX",
        8 => "IRIX",
        9 => "FreeBSD",
        10 => "Tru64",
        11 => "Novell Modesto",
        12 => "OpenBSD",
        13 => "OpenVMS",
        14 => "NonStop Kernel",
        15 => "AROS",
        16 => "FenixOS",
        17 => "Nuxi CloudABI",
        _ => "Unknown",
    }.to_string();

    let abi_version = elf.header.e_ident[8];

    let format_info = FormatInfo::ELF {
        class: if elf.is_64 { "ELF64" } else { "ELF32" }.to_string(),
        data: if elf.little_endian { "Little Endian" } else { "Big Endian" }.to_string(),
        version: elf.header.e_version as u8,
        os_abi,
        abi_version,
        machine: format!("{:?}", elf.header.e_machine),
        entry_point: elf.entry,
        interpreter: elf.interpreter.map(|s| s.to_string()),
        signature_info,
    };

    // Parse sections
    let mut sections = Vec::new();
    for section in &elf.section_headers {
        if let Some(name) = elf.shdr_strtab.get_at(section.sh_name) {
            let section_offset = section.sh_offset as usize;
            let section_size = section.sh_size as usize;

            let section_data = if section_offset + section_size <= data.len() {
                &data[section_offset..section_offset + section_size]
            } else {
                &[]
            };

            let section_entropy = if !section_data.is_empty() {
                calculate_entropy(section_data)
            } else {
                0.0
            };

            // Check for suspicious sections
            let suspicious = section_entropy > 7.0 ||
                name.starts_with(".upx") ||
                (section.sh_flags & 0x2 != 0 && section.sh_flags & 0x4 != 0); // WRITE + EXEC

            let mut characteristics = Vec::new();
            if section.sh_flags & 0x1 != 0 { characteristics.push("WRITE".to_string()); }
            if section.sh_flags & 0x2 != 0 { characteristics.push("ALLOC".to_string()); }
            if section.sh_flags & 0x4 != 0 { characteristics.push("EXEC".to_string()); }

            sections.push(Section {
                name: name.to_string(),
                virtual_address: section.sh_addr,
                virtual_size: section.sh_size,
                raw_size: section.sh_size,
                entropy: section_entropy,
                characteristics,
                suspicious,
            });
        }
    }

    // Parse dynamic imports (imported libraries and functions)
    let mut imports = Vec::new();
    let mut libs_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();

    for sym in &elf.dynsyms {
        if let Some(name) = elf.dynstrtab.get_at(sym.st_name) {
            if sym.is_import() {
                // Group by library (we don't have library info from ELF directly, so use "unknown")
                libs_map.entry("libc.so.6".to_string())
                    .or_insert_with(Vec::new)
                    .push(name.to_string());
            }
        }
    }

    for (library, functions) in libs_map {
        let suspicious = is_suspicious_import(&library, &functions);
        imports.push(Import {
            library,
            functions,
            suspicious,
        });
    }

    // Parse exports (exported symbols)
    let mut exports = Vec::new();
    for sym in &elf.syms {
        if let Some(name) = elf.strtab.get_at(sym.st_name) {
            if sym.is_function() && sym.st_value != 0 {
                exports.push(Export {
                    name: name.to_string(),
                    ordinal: None,
                    address: sym.st_value,
                });
            }
        }
    }

    let anomalies = Vec::new();

    (format_info, sections, imports, exports, anomalies)
}

fn parse_mach(mach: mach::Mach, data: &[u8]) -> (FormatInfo, Vec<Section>, Vec<Import>, Vec<Export>, Vec<Anomaly>) {
    // Validate we have file data for analysis
    let file_size = data.len();

    let (cpu_type, cpu_subtype, file_type, flags, entry_point, is_fat, architectures, binary_opt) = match mach {
        mach::Mach::Binary(binary) => {
            let cpu = format!("{:?}", binary.header.cputype);
            let subtype = format!("{:?}", binary.header.cpusubtype);
            let ftype = format!("{:?}", binary.header.filetype);
            let flags = binary.header.flags;
            (cpu, subtype, ftype, flags, Some(binary.entry), false, Vec::new(), Some(binary))
        },
        mach::Mach::Fat(fat) => {
            // Parse architectures from Fat binary
            let mut archs = Vec::new();

            // Get the fat architecture headers
            if let Ok(fat_arches) = fat.arches() {
                for arch in fat_arches {
                    // Format CPU type and subtype for readability
                    let arch_str = format!("{:?}/{:?}", arch.cputype, arch.cpusubtype);
                    archs.push(arch_str);
                }
            }

            // If we couldn't parse architectures, provide a default
            if archs.is_empty() {
                archs.push("Multiple architectures".to_string());
            }

            // Try to parse the first architecture for detailed analysis
            let first_binary = fat.into_iter().next().and_then(|res| res.ok()).and_then(|single_arch| {
                match single_arch {
                    mach::SingleArch::MachO(macho) => Some(macho),
                    _ => None,
                }
            });

            ("Multiple".to_string(), "Multiple".to_string(), "Fat Binary".to_string(), 0, None, true, archs, first_binary)
        }
    };

    let format_info = FormatInfo::MachO {
        cpu_type,
        cpu_subtype,
        file_type,
        flags,
        entry_point,
        is_fat,
        architectures,
    };

    // Parse sections, imports, exports for single binary
    let mut sections = Vec::new();
    let mut imports = Vec::new();
    let mut exports = Vec::new();

    if let Some(binary) = binary_opt {
        // Parse sections
        for segment in &binary.segments {
            for (section, section_data) in segment.sections().ok().iter().flatten() {
                let section_entropy = if !section_data.is_empty() {
                    calculate_entropy(section_data)
                } else {
                    0.0
                };

                let suspicious = section_entropy > 7.0;
                let mut characteristics = Vec::new();

                if section.flags & 0x1 != 0 { characteristics.push("REGULAR".to_string()); }
                if section.flags & 0x2 != 0 { characteristics.push("ZEROFILL".to_string()); }

                sections.push(Section {
                    name: section.name().unwrap_or("").to_string(),
                    virtual_address: section.addr,
                    virtual_size: section.size,
                    raw_size: section.size,
                    entropy: section_entropy,
                    characteristics,
                    suspicious,
                });
            }
        }

        // Parse imports
        if let Ok(imports_data) = binary.imports() {
            let mut libs_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();

            for import in imports_data {
                let lib_name = import.dylib;  // dylib is &str, not Option
                let func_name = import.name;

                libs_map.entry(lib_name.to_string())
                    .or_insert_with(Vec::new)
                    .push(func_name.to_string());
            }

            for (library, functions) in libs_map {
                let suspicious = is_suspicious_import(&library, &functions);
                imports.push(Import {
                    library,
                    functions,
                    suspicious,
                });
            }
        }

        // Parse exports
        if let Ok(exports_data) = binary.exports() {
            for export in exports_data {
                exports.push(Export {
                    name: export.name.to_string(),
                    ordinal: None,
                    address: export.offset as u64,
                });
            }
        }
    }

    // Check for anomalies using file size validation
    let mut anomalies = Vec::new();
    if file_size < 1024 {
        anomalies.push(Anomaly {
            category: "File Size".to_string(),
            description: format!("Very small Mach-O file ({} bytes)", file_size),
            severity: "low".to_string(),
            details: HashMap::from([
                ("file_size".to_string(), serde_json::json!(file_size)),
            ]),
        });
    }

    (format_info, sections, imports, exports, anomalies)
}

#[allow(dead_code)]
fn is_suspicious_import(library: &str, functions: &[String]) -> bool {
    let suspicious_libs = ["ntdll.dll", "kernel32.dll", "advapi32.dll"];
    let suspicious_funcs = [
        "VirtualAlloc", "VirtualProtect", "WriteProcessMemory",
        "CreateRemoteThread", "SetWindowsHookEx", "GetAsyncKeyState",
        "RegSetValueEx", "CreateService", "OpenProcess",
    ];
    
    if suspicious_libs.iter().any(|&lib| library.eq_ignore_ascii_case(lib)) {
        return functions.iter().any(|func| 
            suspicious_funcs.iter().any(|&sf| func.contains(sf))
        );
    }
    
    false
}

fn detect_signatures(data: &[u8]) -> Vec<Signature> {
    let mut signatures = Vec::new();
    
    // Check for common packers
    if data.windows(3).any(|w| w == b"UPX") {
        signatures.push(Signature {
            name: "UPX Packer".to_string(),
            severity: "medium".to_string(),
            description: "File appears to be packed with UPX".to_string(),
            matched_bytes: Some(b"UPX".to_vec()),
            offset: None,
        });
    }
    
    // Check for anti-debugging techniques
    if data.windows(4).any(|w| w == b"\xCC\xCC\xCC\xCC") {
        signatures.push(Signature {
            name: "INT3 Instructions".to_string(),
            severity: "low".to_string(),
            description: "Multiple INT3 breakpoint instructions detected".to_string(),
            matched_bytes: Some(b"\xCC\xCC\xCC\xCC".to_vec()),
            offset: None,
        });
    }
    
    signatures
}

#[tauri::command]
pub async fn generate_pdf_report(data: serde_json::Value, output_path: String) -> Result<(), String> {
    use printpdf::*;
    use std::fs::File;
    use std::io::BufWriter;
    
    let (doc, page1, layer1) = PdfDocument::new("Athena Security Analysis Report", Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc.add_builtin_font(BuiltinFont::Helvetica).map_err(|e| e.to_string())?;
    
    let current_layer = doc.get_page(page1).get_layer(layer1);
    
    // Add title
    current_layer.begin_text_section();
    current_layer.set_font(&font, 24.0);
    current_layer.set_text_cursor(Mm(10.0), Mm(280.0));
    current_layer.write_text("Athena Security Analysis Report", &font);
    current_layer.end_text_section();
    
    // Add content from data
    let y_position = 250.0;
    current_layer.begin_text_section();
    current_layer.set_font(&font, 12.0);
    
    if let Some(metadata) = data.get("metadata") {
        current_layer.set_text_cursor(Mm(10.0), Mm(y_position));
        current_layer.write_text(&format!("Generated: {}", metadata.get("exportDate").and_then(|v| v.as_str()).unwrap_or("Unknown")), &font);
    }
    
    current_layer.end_text_section();
    
    // Save the PDF
    let file = File::create(&output_path).map_err(|e| e.to_string())?;
    let mut writer = BufWriter::new(file);
    doc.save(&mut writer).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn generate_excel_report(data: serde_json::Value, output_path: String) -> Result<(), String> {
    use xlsxwriter::*;
    
    let workbook = Workbook::new(&output_path).map_err(|e| e.to_string())?;
    let mut sheet = workbook.add_worksheet(Some("Analysis Results")).map_err(|e| e.to_string())?;
    
    // Add headers with simple formatting
    sheet.write_string(0, 0, "Section", None).map_err(|e| e.to_string())?;
    sheet.write_string(0, 1, "Data", None).map_err(|e| e.to_string())?;
    
    // Add data rows
    let mut row = 1;
    if let Some(obj) = data.as_object() {
        for (key, value) in obj {
            sheet.write_string(row, 0, key, None).map_err(|e| e.to_string())?;
            sheet.write_string(row, 1, &serde_json::to_string_pretty(value).unwrap_or_default(), None).map_err(|e| e.to_string())?;
            row += 1;
        }
    }
    
    workbook.close().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn encrypt_export_data(data: String, password: String) -> Result<String, String> {
    use rand::rngs::OsRng;
    use rand::RngCore;
    
    // Generate salt
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    
    // Create a 32-byte key from password using simple KDF
    let mut key_bytes = [0u8; 32];
    use sha2::{Sha256, Digest as Sha2Digest};
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.update(&salt);
    let hash = hasher.finalize();
    key_bytes.copy_from_slice(&hash);
    
    let key = Key::<Aes256Gcm>::from(key_bytes);
    let cipher = Aes256Gcm::new(&key);

    // Generate nonce (12 bytes for GCM)
    let nonce_bytes: [u8; 12] = *b"unique nonce";
    let nonce = Nonce::from(nonce_bytes);
    
    // Encrypt data
    let ciphertext = cipher.encrypt(&nonce, data.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Combine salt, nonce, and ciphertext
    let mut result = Vec::new();
    result.extend_from_slice(&salt);
    result.extend_from_slice(&nonce);
    result.extend_from_slice(&ciphertext);
    
    Ok(general_purpose::STANDARD.encode(result))
}

#[tauri::command]
pub async fn compress_export_data(data: serde_json::Value) -> Result<Vec<u8>, String> {
    let json_string = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(json_string.as_bytes()).map_err(|e| e.to_string())?;
    encoder.finish().map_err(|e| e.to_string())
}
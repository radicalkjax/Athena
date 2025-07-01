use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Deserialize)]
pub struct FileProcessInput {
    pub data: String, // Base64 encoded data
    pub length: usize,
}

#[derive(Serialize, Deserialize)]
pub struct FileProcessResult {
    pub success: bool,
    pub file_type: FileType,
    pub format_info: FormatInfo,
    pub headers: Vec<Header>,
    pub sections: Vec<Section>,
    pub resources: Vec<Resource>,
    pub metadata: Metadata,
    pub anomalies: Vec<Anomaly>,
}

#[derive(Serialize, Deserialize)]
pub struct FileType {
    pub detected_type: String,
    pub mime_type: String,
    pub confidence: f64,
    pub magic_bytes: Vec<u8>,
}

#[derive(Serialize, Deserialize)]
pub struct FormatInfo {
    pub format: String,
    pub version: Option<String>,
    pub architecture: Option<String>,
    pub endianness: Option<String>,
    pub bit_width: Option<u32>,
}

#[derive(Serialize, Deserialize)]
pub struct Header {
    pub name: String,
    pub offset: usize,
    pub size: usize,
    pub raw_data: Vec<u8>,
    pub parsed_fields: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
pub struct Section {
    pub name: String,
    pub virtual_address: u64,
    pub virtual_size: u64,
    pub raw_address: u64,
    pub raw_size: u64,
    pub characteristics: u32,
    pub entropy: f64,
    pub suspicious: bool,
}

#[derive(Serialize, Deserialize)]
pub struct Resource {
    pub name: String,
    pub resource_type: String,
    pub offset: usize,
    pub size: usize,
    pub language: Option<String>,
    pub hash: String,
}

#[derive(Serialize, Deserialize)]
pub struct Metadata {
    pub file_size: usize,
    pub creation_time: Option<String>,
    pub modification_time: Option<String>,
    pub company_name: Option<String>,
    pub product_name: Option<String>,
    pub file_version: Option<String>,
    pub internal_name: Option<String>,
    pub original_filename: Option<String>,
    pub file_description: Option<String>,
    pub certificates: Vec<Certificate>,
}

#[derive(Serialize, Deserialize)]
pub struct Certificate {
    pub subject: String,
    pub issuer: String,
    pub serial_number: String,
    pub valid_from: String,
    pub valid_to: String,
    pub is_valid: bool,
}

#[derive(Serialize, Deserialize)]
pub struct Anomaly {
    pub anomaly_type: String,
    pub description: String,
    pub severity: String,
    pub offset: Option<usize>,
}

#[wasm_bindgen]
pub fn process_file(input: &str) -> String {
    parse_format(input)
}

#[wasm_bindgen]
pub fn parse_format(input: &str) -> String {
    let parsed_input: Result<FileProcessInput, _> = serde_json::from_str(input);
    
    match parsed_input {
        Ok(input_data) => {
            // Decode base64 data
            let data = match general_purpose::STANDARD.decode(&input_data.data) {
                Ok(d) => d,
                Err(_) => {
                    return create_error_result("Failed to decode base64 data");
                }
            };
            
            // Detect file type
            let file_type = detect_file_type(&data);
            
            // Process based on detected type
            let result = match file_type.detected_type.as_str() {
                "PE" => process_pe_file(&data, file_type),
                "ELF" => process_elf_file(&data, file_type),
                "Mach-O" => process_macho_file(&data, file_type),
                "PDF" => process_pdf_file(&data, file_type),
                "ZIP" => process_zip_file(&data, file_type),
                "Office" => process_office_file(&data, file_type),
                _ => process_generic_file(&data, file_type),
            };
            
            serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
        }
        Err(_) => {
            create_error_result("Failed to parse input")
        }
    }
}

fn create_error_result(error: &str) -> String {
    let result = FileProcessResult {
        success: false,
        file_type: FileType {
            detected_type: "Unknown".to_string(),
            mime_type: "application/octet-stream".to_string(),
            confidence: 0.0,
            magic_bytes: vec![],
        },
        format_info: FormatInfo {
            format: "Unknown".to_string(),
            version: None,
            architecture: None,
            endianness: None,
            bit_width: None,
        },
        headers: vec![],
        sections: vec![],
        resources: vec![],
        metadata: Metadata {
            file_size: 0,
            creation_time: None,
            modification_time: None,
            company_name: None,
            product_name: None,
            file_version: None,
            internal_name: None,
            original_filename: None,
            file_description: None,
            certificates: vec![],
        },
        anomalies: vec![Anomaly {
            anomaly_type: "Error".to_string(),
            description: error.to_string(),
            severity: "high".to_string(),
            offset: None,
        }],
    };
    
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

fn detect_file_type(data: &[u8]) -> FileType {
    if data.len() < 4 {
        return FileType {
            detected_type: "Unknown".to_string(),
            mime_type: "application/octet-stream".to_string(),
            confidence: 0.0,
            magic_bytes: data.to_vec(),
        };
    }
    
    let magic = &data[0..4.min(data.len())];
    
    // PE files (MZ header)
    if data.len() >= 2 && &data[0..2] == b"MZ" {
        return FileType {
            detected_type: "PE".to_string(),
            mime_type: "application/x-dosexec".to_string(),
            confidence: 0.95,
            magic_bytes: magic.to_vec(),
        };
    }
    
    // ELF files
    if data.len() >= 4 && &data[0..4] == b"\x7FELF" {
        return FileType {
            detected_type: "ELF".to_string(),
            mime_type: "application/x-elf".to_string(),
            confidence: 1.0,
            magic_bytes: magic.to_vec(),
        };
    }
    
    // Mach-O files
    if data.len() >= 4 {
        let magic_32 = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
        if magic_32 == 0xFEEDFACE || magic_32 == 0xFEEDFACF || 
           magic_32 == 0xCEFAEDFE || magic_32 == 0xCFFAEDFE {
            return FileType {
                detected_type: "Mach-O".to_string(),
                mime_type: "application/x-mach-binary".to_string(),
                confidence: 1.0,
                magic_bytes: magic.to_vec(),
            };
        }
    }
    
    // PDF files
    if data.len() >= 4 && &data[0..4] == b"%PDF" {
        return FileType {
            detected_type: "PDF".to_string(),
            mime_type: "application/pdf".to_string(),
            confidence: 1.0,
            magic_bytes: magic.to_vec(),
        };
    }
    
    // ZIP files (including Office documents)
    if data.len() >= 4 && &data[0..2] == b"PK" {
        // Check if it's an Office document
        if is_office_document(data) {
            return FileType {
                detected_type: "Office".to_string(),
                mime_type: "application/vnd.ms-office".to_string(),
                confidence: 0.9,
                magic_bytes: magic.to_vec(),
            };
        }
        
        return FileType {
            detected_type: "ZIP".to_string(),
            mime_type: "application/zip".to_string(),
            confidence: 0.95,
            magic_bytes: magic.to_vec(),
        };
    }
    
    FileType {
        detected_type: "Unknown".to_string(),
        mime_type: "application/octet-stream".to_string(),
        confidence: 0.0,
        magic_bytes: magic.to_vec(),
    }
}

fn process_pe_file(data: &[u8], file_type: FileType) -> FileProcessResult {
    let mut headers = Vec::new();
    let mut sections = Vec::new();
    let mut anomalies = Vec::new();
    
    // Parse DOS header
    if data.len() < 64 {
        anomalies.push(Anomaly {
            anomaly_type: "Truncated".to_string(),
            description: "File too small for valid PE".to_string(),
            severity: "high".to_string(),
            offset: Some(0),
        });
        
        return create_basic_result(file_type, headers, sections, anomalies, data.len());
    }
    
    let dos_header_data = &data[0..64];
    let e_lfanew = u32::from_le_bytes([
        dos_header_data[60], dos_header_data[61], 
        dos_header_data[62], dos_header_data[63]
    ]) as usize;
    
    headers.push(Header {
        name: "DOS Header".to_string(),
        offset: 0,
        size: 64,
        raw_data: dos_header_data.to_vec(),
        parsed_fields: serde_json::json!({
            "e_magic": format!("{:04X}", u16::from_le_bytes([data[0], data[1]])),
            "e_lfanew": e_lfanew,
        }),
    });
    
    // Parse PE header
    if e_lfanew + 24 > data.len() {
        anomalies.push(Anomaly {
            anomaly_type: "Invalid Offset".to_string(),
            description: "PE header offset points outside file".to_string(),
            severity: "high".to_string(),
            offset: Some(60),
        });
        
        return create_basic_result(file_type, headers, sections, anomalies, data.len());
    }
    
    let pe_signature = &data[e_lfanew..e_lfanew + 4];
    if pe_signature != b"PE\0\0" {
        anomalies.push(Anomaly {
            anomaly_type: "Invalid Signature".to_string(),
            description: "Invalid PE signature".to_string(),
            severity: "high".to_string(),
            offset: Some(e_lfanew),
        });
    }
    
    // Parse COFF header
    let coff_offset = e_lfanew + 4;
    if coff_offset + 20 <= data.len() {
        let coff_data = &data[coff_offset..coff_offset + 20];
        let machine = u16::from_le_bytes([coff_data[0], coff_data[1]]);
        let num_sections = u16::from_le_bytes([coff_data[2], coff_data[3]]);
        
        headers.push(Header {
            name: "COFF Header".to_string(),
            offset: coff_offset,
            size: 20,
            raw_data: coff_data.to_vec(),
            parsed_fields: serde_json::json!({
                "Machine": format!("{:04X}", machine),
                "NumberOfSections": num_sections,
                "Architecture": match machine {
                    0x014c => "x86",
                    0x8664 => "x64",
                    0x01c0 => "ARM",
                    0xaa64 => "ARM64",
                    _ => "Unknown",
                },
            }),
        });
        
        // Parse sections
        let section_table_offset = coff_offset + 20 + 224; // Skip optional header for now
        if section_table_offset + (num_sections as usize * 40) <= data.len() {
            for i in 0..num_sections {
                let section_offset = section_table_offset + (i as usize * 40);
                let section_data = &data[section_offset..section_offset + 40];
                
                let name = String::from_utf8_lossy(&section_data[0..8])
                    .trim_end_matches('\0')
                    .to_string();
                let virtual_size = u32::from_le_bytes([
                    section_data[8], section_data[9], section_data[10], section_data[11]
                ]) as u64;
                let virtual_address = u32::from_le_bytes([
                    section_data[12], section_data[13], section_data[14], section_data[15]
                ]) as u64;
                let raw_size = u32::from_le_bytes([
                    section_data[16], section_data[17], section_data[18], section_data[19]
                ]) as u64;
                let raw_address = u32::from_le_bytes([
                    section_data[20], section_data[21], section_data[22], section_data[23]
                ]) as u64;
                let characteristics = u32::from_le_bytes([
                    section_data[36], section_data[37], section_data[38], section_data[39]
                ]);
                
                // Calculate entropy for the section
                let entropy = if raw_address as usize + raw_size as usize <= data.len() {
                    calculate_entropy(&data[raw_address as usize..(raw_address + raw_size) as usize])
                } else {
                    0.0
                };
                
                // Check for suspicious characteristics
                let suspicious = is_suspicious_section(&name, characteristics, entropy);
                
                sections.push(Section {
                    name,
                    virtual_address,
                    virtual_size,
                    raw_address,
                    raw_size,
                    characteristics,
                    entropy,
                    suspicious,
                });
            }
        }
    }
    
    // Extract resources
    let resources = extract_pe_resources(data, &sections);
    
    // Extract metadata
    let metadata = extract_pe_metadata(data, e_lfanew);
    
    FileProcessResult {
        success: true,
        file_type,
        format_info: FormatInfo {
            format: "PE".to_string(),
            version: Some("PE32+".to_string()),
            architecture: Some("x64".to_string()),
            endianness: Some("Little".to_string()),
            bit_width: Some(64),
        },
        headers,
        sections,
        resources,
        metadata,
        anomalies,
    }
}

fn process_elf_file(data: &[u8], file_type: FileType) -> FileProcessResult {
    let mut headers = Vec::new();
    let sections = Vec::new();
    let mut anomalies = Vec::new();
    
    if data.len() < 64 {
        anomalies.push(Anomaly {
            anomaly_type: "Truncated".to_string(),
            description: "File too small for valid ELF".to_string(),
            severity: "high".to_string(),
            offset: Some(0),
        });
        
        return create_basic_result(file_type, headers, sections, anomalies, data.len());
    }
    
    // Parse ELF header
    let elf_class = data[4];
    let elf_data = data[5];
    let elf_version = data[6];
    let elf_abi = data[7];
    
    headers.push(Header {
        name: "ELF Header".to_string(),
        offset: 0,
        size: 64,
        raw_data: data[0..64].to_vec(),
        parsed_fields: serde_json::json!({
            "Class": if elf_class == 1 { "32-bit" } else { "64-bit" },
            "Data": if elf_data == 1 { "Little Endian" } else { "Big Endian" },
            "Version": elf_version,
            "ABI": elf_abi,
        }),
    });
    
    FileProcessResult {
        success: true,
        file_type,
        format_info: FormatInfo {
            format: "ELF".to_string(),
            version: Some(format!("Version {}", elf_version)),
            architecture: Some(if elf_class == 1 { "32-bit" } else { "64-bit" }.to_string()),
            endianness: Some(if elf_data == 1 { "Little" } else { "Big" }.to_string()),
            bit_width: Some(if elf_class == 1 { 32 } else { 64 }),
        },
        headers,
        sections,
        resources: vec![],
        metadata: Metadata {
            file_size: data.len(),
            creation_time: None,
            modification_time: None,
            company_name: None,
            product_name: None,
            file_version: None,
            internal_name: None,
            original_filename: None,
            file_description: None,
            certificates: vec![],
        },
        anomalies,
    }
}

fn process_macho_file(data: &[u8], file_type: FileType) -> FileProcessResult {
    // Simplified Mach-O processing
    create_basic_result(file_type, vec![], vec![], vec![], data.len())
}

fn process_pdf_file(data: &[u8], file_type: FileType) -> FileProcessResult {
    let mut anomalies = Vec::new();
    
    // Check for common PDF exploits
    let text = String::from_utf8_lossy(data);
    if text.contains("/JavaScript") || text.contains("/JS") {
        anomalies.push(Anomaly {
            anomaly_type: "JavaScript".to_string(),
            description: "PDF contains JavaScript code".to_string(),
            severity: "medium".to_string(),
            offset: None,
        });
    }
    
    if text.contains("/Launch") || text.contains("/EmbeddedFile") {
        anomalies.push(Anomaly {
            anomaly_type: "Embedded Content".to_string(),
            description: "PDF contains embedded files or launch actions".to_string(),
            severity: "medium".to_string(),
            offset: None,
        });
    }
    
    create_basic_result(file_type, vec![], vec![], anomalies, data.len())
}

fn process_zip_file(data: &[u8], file_type: FileType) -> FileProcessResult {
    // Simplified ZIP processing
    create_basic_result(file_type, vec![], vec![], vec![], data.len())
}

fn process_office_file(data: &[u8], file_type: FileType) -> FileProcessResult {
    let mut anomalies = Vec::new();
    
    // Check for macros (simplified)
    if contains_pattern(data, b"vbaProject.bin") {
        anomalies.push(Anomaly {
            anomaly_type: "Macros".to_string(),
            description: "Document contains VBA macros".to_string(),
            severity: "medium".to_string(),
            offset: None,
        });
    }
    
    create_basic_result(file_type, vec![], vec![], anomalies, data.len())
}

fn process_generic_file(data: &[u8], file_type: FileType) -> FileProcessResult {
    create_basic_result(file_type, vec![], vec![], vec![], data.len())
}

fn create_basic_result(
    file_type: FileType,
    headers: Vec<Header>,
    sections: Vec<Section>,
    anomalies: Vec<Anomaly>,
    file_size: usize,
) -> FileProcessResult {
    FileProcessResult {
        success: true,
        file_type,
        format_info: FormatInfo {
            format: "Generic".to_string(),
            version: None,
            architecture: None,
            endianness: None,
            bit_width: None,
        },
        headers,
        sections,
        resources: vec![],
        metadata: Metadata {
            file_size,
            creation_time: None,
            modification_time: None,
            company_name: None,
            product_name: None,
            file_version: None,
            internal_name: None,
            original_filename: None,
            file_description: None,
            certificates: vec![],
        },
        anomalies,
    }
}

fn is_office_document(data: &[u8]) -> bool {
    // Check for Office-specific files in ZIP
    let office_files: Vec<&[u8]> = vec![
        b"[Content_Types].xml",
        b"docProps/",
        b"word/document.xml",
        b"xl/workbook.xml",
        b"ppt/presentation.xml",
    ];
    
    office_files.iter().any(|&pattern| contains_pattern(data, pattern))
}

fn is_suspicious_section(name: &str, characteristics: u32, entropy: f64) -> bool {
    // Check for suspicious section names
    let suspicious_names = vec![".upx", ".aspack", ".vmprotect", ".themida"];
    if suspicious_names.iter().any(|&s| name.starts_with(s)) {
        return true;
    }
    
    // Check for writable + executable sections
    const IMAGE_SCN_MEM_EXECUTE: u32 = 0x20000000;
    const IMAGE_SCN_MEM_WRITE: u32 = 0x80000000;
    if characteristics & IMAGE_SCN_MEM_EXECUTE != 0 && characteristics & IMAGE_SCN_MEM_WRITE != 0 {
        return true;
    }
    
    // High entropy sections might be packed
    entropy > 7.5
}

fn extract_pe_resources(_data: &[u8], _sections: &[Section]) -> Vec<Resource> {
    // Simplified resource extraction
    vec![]
}

fn extract_pe_metadata(data: &[u8], _pe_offset: usize) -> Metadata {
    Metadata {
        file_size: data.len(),
        creation_time: None,
        modification_time: None,
        company_name: None,
        product_name: None,
        file_version: None,
        internal_name: None,
        original_filename: None,
        file_description: None,
        certificates: vec![],
    }
}

fn contains_pattern(data: &[u8], pattern: &[u8]) -> bool {
    data.windows(pattern.len()).any(|w| w == pattern)
}

fn calculate_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    
    let mut freq = [0u64; 256];
    for &byte in data {
        freq[byte as usize] += 1;
    }
    
    let len = data.len() as f64;
    let mut entropy = 0.0;
    
    for &count in &freq {
        if count > 0 {
            let p = count as f64 / len;
            entropy -= p * p.log2();
        }
    }
    
    entropy
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "1.0.0".to_string()
}
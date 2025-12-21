/// YARA Module System
/// Provides PE, ELF, and Hash modules for YARA rule conditions
///
/// Based on YARA module research from DeepWiki

use std::collections::HashMap;
use serde::{Serialize, Deserialize};

/// Module context for YARA rule evaluation
#[derive(Clone, Debug)]
pub struct ModuleContext {
    pub pe_module: Option<PEModule>,
    pub elf_module: Option<ELFModule>,
    pub hash_module: Option<HashModule>,
    pub math_module: Option<MathModule>,
    pub magic_module: Option<MagicModule>,
    pub time_module: TimeModule,
    pub file_data: Vec<u8>,
}

impl ModuleContext {
    pub fn new(file_data: Vec<u8>) -> Self {
        Self {
            pe_module: None,
            elf_module: None,
            hash_module: None,
            math_module: None,
            magic_module: None,
            time_module: TimeModule::new(),
            file_data,
        }
    }

    /// Parse file and initialize appropriate modules
    pub fn initialize(&mut self) -> Result<(), String> {
        // Auto-detect file type and initialize modules
        if self.file_data.len() >= 2 && &self.file_data[0..2] == b"MZ" {
            // PE file
            self.pe_module = Some(PEModule::parse(&self.file_data)?);
        } else if self.file_data.len() >= 4 && &self.file_data[0..4] == b"\x7FELF" {
            // ELF file
            self.elf_module = Some(ELFModule::parse(&self.file_data)?);
        }

        // Always initialize hash, math, and magic modules
        self.hash_module = Some(HashModule::compute(&self.file_data));
        self.math_module = Some(MathModule::compute(&self.file_data));
        self.magic_module = Some(MagicModule::detect(&self.file_data));

        Ok(())
    }

    /// Evaluate a module expression (e.g., "pe.entry_point == 0x1000")
    pub fn evaluate_expression(&self, expr: &str) -> Result<bool, String> {
        let parts: Vec<&str> = expr.splitn(2, '.').collect();
        if parts.len() != 2 {
            return Err(format!("Invalid module expression: {}", expr));
        }

        let module_name = parts[0];
        let condition = parts[1];

        match module_name {
            "pe" => {
                if let Some(pe) = &self.pe_module {
                    pe.evaluate_condition(condition)
                } else {
                    Ok(false) // PE module not available
                }
            }
            "elf" => {
                if let Some(elf) = &self.elf_module {
                    elf.evaluate_condition(condition)
                } else {
                    Ok(false) // ELF module not available
                }
            }
            "hash" => {
                if let Some(hash) = &self.hash_module {
                    hash.evaluate_condition(condition)
                } else {
                    Ok(false)
                }
            }
            "math" => {
                if let Some(math) = &self.math_module {
                    math.evaluate_condition(condition)
                } else {
                    Ok(false)
                }
            }
            "magic" => {
                if let Some(magic) = &self.magic_module {
                    magic.evaluate_condition(condition)
                } else {
                    Ok(false)
                }
            }
            "time" => {
                self.time_module.evaluate_condition(condition)
            }
            _ => Err(format!("Unknown module: {}", module_name)),
        }
    }
}

/// PE Module - provides PE file metadata
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PEModule {
    pub machine: u16,
    pub number_of_sections: u16,
    pub timestamp: u32,
    pub characteristics: u16,
    pub entry_point: u32,
    pub image_base: u64,
    pub sections: Vec<PESection>,
    pub imports: Vec<String>,
    pub exports: Vec<String>,
    pub number_of_resources: usize,
    pub is_dll: bool,
    pub is_64bit: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PESection {
    pub name: String,
    pub virtual_address: u32,
    pub virtual_size: u32,
    pub raw_size: u32,
    pub characteristics: u32,
}

impl PEModule {
    pub fn parse(data: &[u8]) -> Result<Self, String> {
        // Simplified PE parsing - would use goblin in production
        if data.len() < 64 {
            return Err("File too small to be PE".to_string());
        }

        // Read DOS header
        let e_lfanew = u32::from_le_bytes([
            data[0x3c], data[0x3d], data[0x3e], data[0x3f]
        ]) as usize;

        if e_lfanew + 24 > data.len() {
            return Err("Invalid PE header offset".to_string());
        }

        // Read COFF header
        let machine = u16::from_le_bytes([
            data[e_lfanew + 4], data[e_lfanew + 5]
        ]);

        let number_of_sections = u16::from_le_bytes([
            data[e_lfanew + 6], data[e_lfanew + 7]
        ]);

        let timestamp = u32::from_le_bytes([
            data[e_lfanew + 8], data[e_lfanew + 9],
            data[e_lfanew + 10], data[e_lfanew + 11]
        ]);

        let characteristics = u16::from_le_bytes([
            data[e_lfanew + 22], data[e_lfanew + 23]
        ]);

        let is_dll = (characteristics & 0x2000) != 0;
        let is_64bit = machine == 0x8664;

        // Read optional header
        let opt_hdr_offset = e_lfanew + 24;
        let entry_point = if opt_hdr_offset + 16 <= data.len() {
            u32::from_le_bytes([
                data[opt_hdr_offset + 16], data[opt_hdr_offset + 17],
                data[opt_hdr_offset + 18], data[opt_hdr_offset + 19]
            ])
        } else {
            0
        };

        let image_base = if is_64bit && opt_hdr_offset + 32 <= data.len() {
            u64::from_le_bytes([
                data[opt_hdr_offset + 24], data[opt_hdr_offset + 25],
                data[opt_hdr_offset + 26], data[opt_hdr_offset + 27],
                data[opt_hdr_offset + 28], data[opt_hdr_offset + 29],
                data[opt_hdr_offset + 30], data[opt_hdr_offset + 31]
            ])
        } else if opt_hdr_offset + 28 <= data.len() {
            u32::from_le_bytes([
                data[opt_hdr_offset + 24], data[opt_hdr_offset + 25],
                data[opt_hdr_offset + 26], data[opt_hdr_offset + 27]
            ]) as u64
        } else {
            0
        };

        Ok(Self {
            machine,
            number_of_sections,
            timestamp,
            characteristics,
            entry_point,
            image_base,
            sections: Vec::new(),
            imports: Vec::new(),
            exports: Vec::new(),
            number_of_resources: 0,
            is_dll,
            is_64bit,
        })
    }

    pub fn evaluate_condition(&self, condition: &str) -> Result<bool, String> {
        // Parse conditions like "entry_point == 0x1000"
        if condition.contains("==") {
            let parts: Vec<&str> = condition.split("==").map(|s| s.trim()).collect();
            if parts.len() != 2 {
                return Err(format!("Invalid condition: {}", condition));
            }

            let field = parts[0];
            let value_str = parts[1];

            match field {
                "entry_point" => {
                    let expected = parse_number(value_str)?;
                    Ok(self.entry_point as u64 == expected)
                }
                "machine" => {
                    let expected = parse_number(value_str)? as u16;
                    Ok(self.machine == expected)
                }
                "number_of_sections" => {
                    let expected = parse_number(value_str)? as u16;
                    Ok(self.number_of_sections == expected)
                }
                "is_dll" => {
                    Ok(self.is_dll)
                }
                "is_64bit" => {
                    Ok(self.is_64bit)
                }
                _ => Err(format!("Unknown PE field: {}", field)),
            }
        } else if condition.contains('>') {
            let parts: Vec<&str> = condition.split('>').map(|s| s.trim()).collect();
            if parts.len() != 2 {
                return Err(format!("Invalid condition: {}", condition));
            }

            let field = parts[0];
            let value_str = parts[1];

            match field {
                "number_of_sections" => {
                    let expected = parse_number(value_str)? as u16;
                    Ok(self.number_of_sections > expected)
                }
                _ => Err(format!("Unknown PE field: {}", field)),
            }
        } else {
            // Boolean field
            match condition {
                "is_dll" => Ok(self.is_dll),
                "is_64bit" => Ok(self.is_64bit),
                _ => Err(format!("Unknown PE condition: {}", condition)),
            }
        }
    }
}

/// ELF Module - provides ELF file metadata
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ELFModule {
    pub class: u8,           // 1 = 32-bit, 2 = 64-bit
    pub data: u8,            // Endianness
    pub machine: u16,
    pub entry_point: u64,
    pub number_of_sections: usize,
    pub is_64bit: bool,
}

impl ELFModule {
    pub fn parse(data: &[u8]) -> Result<Self, String> {
        if data.len() < 64 {
            return Err("File too small to be ELF".to_string());
        }

        let class = data[4]; // EI_CLASS
        let data_encoding = data[5]; // EI_DATA
        let is_64bit = class == 2;

        let machine = u16::from_le_bytes([data[18], data[19]]);

        let entry_point = if is_64bit && data.len() >= 32 {
            u64::from_le_bytes([
                data[24], data[25], data[26], data[27],
                data[28], data[29], data[30], data[31]
            ])
        } else if data.len() >= 28 {
            u32::from_le_bytes([
                data[24], data[25], data[26], data[27]
            ]) as u64
        } else {
            0
        };

        Ok(Self {
            class,
            data: data_encoding,
            machine,
            entry_point,
            number_of_sections: 0,
            is_64bit,
        })
    }

    pub fn evaluate_condition(&self, condition: &str) -> Result<bool, String> {
        if condition.contains("==") {
            let parts: Vec<&str> = condition.split("==").map(|s| s.trim()).collect();
            if parts.len() != 2 {
                return Err(format!("Invalid condition: {}", condition));
            }

            let field = parts[0];
            let value_str = parts[1];

            match field {
                "machine" => {
                    let expected = parse_number(value_str)? as u16;
                    Ok(self.machine == expected)
                }
                "entry_point" => {
                    let expected = parse_number(value_str)?;
                    Ok(self.entry_point == expected)
                }
                _ => Err(format!("Unknown ELF field: {}", field)),
            }
        } else {
            match condition {
                "is_64bit" => Ok(self.is_64bit),
                _ => Err(format!("Unknown ELF condition: {}", condition)),
            }
        }
    }
}

/// Hash Module - provides file hash computation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HashModule {
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
}

impl HashModule {
    pub fn compute(data: &[u8]) -> Self {
        use sha2::{Sha256, Digest};

        // Compute SHA256
        let mut hasher = Sha256::new();
        hasher.update(data);
        let sha256 = format!("{:x}", hasher.finalize());

        // For now, use placeholder for MD5/SHA1
        // In production, would use proper crypto libraries
        Self {
            md5: String::new(),
            sha1: String::new(),
            sha256,
        }
    }

    pub fn evaluate_condition(&self, condition: &str) -> Result<bool, String> {
        if condition.contains("==") {
            let parts: Vec<&str> = condition.split("==").map(|s| s.trim()).collect();
            if parts.len() != 2 {
                return Err(format!("Invalid condition: {}", condition));
            }

            let field = parts[0];
            let value_str = parts[1].trim_matches('"');

            match field {
                "md5" => Ok(self.md5 == value_str),
                "sha1" => Ok(self.sha1 == value_str),
                "sha256" => Ok(self.sha256 == value_str),
                _ => Err(format!("Unknown hash field: {}", field)),
            }
        } else {
            Err(format!("Invalid hash condition: {}", condition))
        }
    }
}

fn parse_number(s: &str) -> Result<u64, String> {
    if s.starts_with("0x") || s.starts_with("0X") {
        u64::from_str_radix(&s[2..], 16)
            .map_err(|e| format!("Invalid hex number: {}", e))
    } else {
        s.parse::<u64>()
            .map_err(|e| format!("Invalid number: {}", e))
    }
}

/// Math Module - provides mathematical/statistical operations
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MathModule {
    pub mean: f64,
    pub deviation: f64,
    pub serial_correlation: f64,
}

impl MathModule {
    pub fn compute(data: &[u8]) -> Self {
        // Handle empty data to avoid division by zero
        if data.is_empty() {
            return Self {
                mean: 0.0,
                deviation: 0.0,
                serial_correlation: 0.0,
            };
        }

        let mean = data.iter().map(|&b| b as f64).sum::<f64>() / data.len() as f64;

        let variance = data.iter()
            .map(|&b| (b as f64 - mean).powi(2))
            .sum::<f64>() / data.len() as f64;
        let deviation = variance.sqrt();

        // Serial correlation (simplified)
        let mut correlation = 0.0;
        if data.len() > 1 {
            for i in 0..data.len() - 1 {
                correlation += (data[i] as f64 - mean) * (data[i + 1] as f64 - mean);
            }
            // Avoid division by zero when variance is 0
            if variance > 0.0 {
                correlation /= (data.len() - 1) as f64 * variance;
            }
        }

        Self {
            mean,
            deviation,
            serial_correlation: correlation,
        }
    }

    pub fn evaluate_condition(&self, condition: &str) -> Result<bool, String> {
        // Supports conditions like "mean > 100", "deviation < 50"
        if condition.contains('>') {
            let parts: Vec<&str> = condition.split('>').map(|s| s.trim()).collect();
            if parts.len() != 2 {
                return Err(format!("Invalid condition: {}", condition));
            }

            let field = parts[0];
            let value: f64 = parts[1].parse()
                .map_err(|e| format!("Invalid number: {}", e))?;

            match field {
                "mean" => Ok(self.mean > value),
                "deviation" => Ok(self.deviation > value),
                _ => Err(format!("Unknown math field: {}", field)),
            }
        } else {
            Err(format!("Invalid math condition: {}", condition))
        }
    }
}

/// Magic Module - file type identification
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MagicModule {
    pub file_type: String,
    pub mime_type: String,
}

impl MagicModule {
    pub fn detect(data: &[u8]) -> Self {
        let (file_type, mime_type) = if data.len() >= 2 && &data[0..2] == b"MZ" {
            ("PE", "application/x-msdownload")
        } else if data.len() >= 4 && &data[0..4] == b"\x7FELF" {
            ("ELF", "application/x-executable")
        } else if data.len() >= 4 && &data[0..4] == b"%PDF" {
            ("PDF", "application/pdf")
        } else if data.len() >= 2 && &data[0..2] == b"PK" {
            ("ZIP", "application/zip")
        } else {
            ("unknown", "application/octet-stream")
        };

        Self {
            file_type: file_type.to_string(),
            mime_type: mime_type.to_string(),
        }
    }

    pub fn evaluate_condition(&self, condition: &str) -> Result<bool, String> {
        if condition.contains("==") {
            let parts: Vec<&str> = condition.split("==").map(|s| s.trim()).collect();
            if parts.len() != 2 {
                return Err(format!("Invalid condition: {}", condition));
            }

            let field = parts[0];
            let value_str = parts[1].trim_matches('"');

            match field {
                "type" => Ok(self.file_type == value_str),
                "mime_type" => Ok(self.mime_type == value_str),
                _ => Err(format!("Unknown magic field: {}", field)),
            }
        } else {
            Err(format!("Invalid magic condition: {}", condition))
        }
    }
}

/// Time Module - time-related operations
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TimeModule {
    pub now: u64,
}

impl TimeModule {
    pub fn new() -> Self {
        use std::time::{SystemTime, UNIX_EPOCH};

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        Self { now }
    }

    pub fn evaluate_condition(&self, condition: &str) -> Result<bool, String> {
        if condition.contains('>') {
            let parts: Vec<&str> = condition.split('>').map(|s| s.trim()).collect();
            if parts.len() != 2 {
                return Err(format!("Invalid condition: {}", condition));
            }

            if parts[0] == "now" {
                let value: u64 = parts[1].parse()
                    .map_err(|e| format!("Invalid number: {}", e))?;
                Ok(self.now > value)
            } else {
                Err(format!("Unknown time field: {}", parts[0]))
            }
        } else {
            Err(format!("Invalid time condition: {}", condition))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_context() {
        let mut ctx = ModuleContext::new(vec![]);
        assert!(ctx.pe_module.is_none());
        assert!(ctx.elf_module.is_none());
    }

    #[test]
    fn test_pe_detection() {
        let mut pe_data = vec![0u8; 64];
        pe_data[0] = b'M';
        pe_data[1] = b'Z';
        pe_data[0x3c] = 64; // e_lfanew

        let mut ctx = ModuleContext::new(pe_data);
        ctx.initialize().ok();
        assert!(ctx.pe_module.is_some());
    }

    #[test]
    fn test_elf_detection() {
        let mut elf_data = vec![0u8; 64];
        elf_data[0] = 0x7F;
        elf_data[1] = b'E';
        elf_data[2] = b'L';
        elf_data[3] = b'F';

        let mut ctx = ModuleContext::new(elf_data);
        ctx.initialize().ok();
        assert!(ctx.elf_module.is_some());
    }

    #[test]
    fn test_hash_module() {
        let data = b"test data";
        let hash_mod = HashModule::compute(data);
        assert!(!hash_mod.sha256.is_empty());
    }

    #[test]
    fn test_parse_number() {
        assert_eq!(parse_number("0x1000").unwrap(), 4096);
        assert_eq!(parse_number("1234").unwrap(), 1234);
        assert_eq!(parse_number("0xFFFF").unwrap(), 65535);
    }

    #[test]
    fn test_math_module_empty_data() {
        // Test that MathModule handles empty data without division by zero
        let math_mod = MathModule::compute(&[]);
        assert_eq!(math_mod.mean, 0.0);
        assert_eq!(math_mod.deviation, 0.0);
        assert_eq!(math_mod.serial_correlation, 0.0);
    }

    #[test]
    fn test_math_module_normal_data() {
        // Test that MathModule computes stats correctly for normal data
        let data = b"test data with some content";
        let math_mod = MathModule::compute(data);
        assert!(math_mod.mean > 0.0);
        assert!(math_mod.deviation >= 0.0);
    }

    #[test]
    fn test_math_module_zero_variance() {
        // Test that MathModule handles data with zero variance (all same values)
        let data = vec![42u8; 100];
        let math_mod = MathModule::compute(&data);
        assert_eq!(math_mod.mean, 42.0);
        assert_eq!(math_mod.deviation, 0.0);
        assert_eq!(math_mod.serial_correlation, 0.0);
    }
}

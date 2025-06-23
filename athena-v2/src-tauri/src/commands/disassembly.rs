use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Serialize, Deserialize)]
pub struct DisassemblyResult {
    instructions: Vec<Instruction>,
    functions: Vec<Function>,
    strings: Vec<ExtractedString>,
    entry_point: Option<u64>,
    architecture: String,
    sections: Vec<Section>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Instruction {
    address: u64,
    bytes: String,
    mnemonic: String,
    operands: String,
    size: usize,
    is_jump: bool,
    is_call: bool,
    jump_target: Option<u64>,
}

#[derive(Serialize, Deserialize)]
pub struct Function {
    name: String,
    address: u64,
    size: usize,
    instructions_count: usize,
    calls: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ExtractedString {
    address: u64,
    value: String,
    section: String,
}

#[derive(Serialize, Deserialize)]
pub struct Section {
    name: String,
    address: u64,
    size: u64,
    flags: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ControlFlowBlock {
    id: String,
    start_address: u64,
    end_address: u64,
    instructions: Vec<Instruction>,
    successors: Vec<String>,
    predecessors: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ControlFlowGraph {
    blocks: Vec<ControlFlowBlock>,
    entry_block: String,
}

fn extract_strings_from_data(data: &[u8], min_length: usize) -> Vec<ExtractedString> {
    let mut strings = Vec::new();
    let mut current_string = Vec::new();
    let mut start_offset = 0;

    for (offset, &byte) in data.iter().enumerate() {
        if byte >= 0x20 && byte < 0x7F {
            if current_string.is_empty() {
                start_offset = offset;
            }
            current_string.push(byte);
        } else if !current_string.is_empty() {
            if current_string.len() >= min_length {
                if let Ok(s) = String::from_utf8(current_string.clone()) {
                    strings.push(ExtractedString {
                        address: start_offset as u64,
                        value: s,
                        section: "data".to_string(),
                    });
                }
            }
            current_string.clear();
        }
    }

    // Check final string
    if current_string.len() >= min_length {
        if let Ok(s) = String::from_utf8(current_string) {
            strings.push(ExtractedString {
                address: start_offset as u64,
                value: s,
                section: "data".to_string(),
            });
        }
    }

    strings
}

// For now, provide a simplified mock implementation
// In production, this would use capstone for real disassembly
#[tauri::command]
pub async fn disassemble_file(file_path: String, offset: Option<u64>, length: Option<usize>) -> Result<DisassemblyResult, String> {
    let data = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Mock instructions for demonstration
    let mut instructions = Vec::new();
    let start = offset.unwrap_or(0) as usize;
    let len = length.unwrap_or(100).min(data.len() - start);
    
    // Create some mock assembly instructions
    for i in (0..len).step_by(4) {
        let addr = start as u64 + i as u64;
        let bytes = data[start + i..start + i + 4.min(len - i)]
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<_>>()
            .join(" ");
        
        // Simple pattern matching for common x86 instructions
        let (mnemonic, operands, is_jump, is_call) = match data.get(start + i) {
            Some(0xe8) => ("call", "0x1000", false, true),
            Some(0xe9) => ("jmp", "0x2000", true, false),
            Some(0x74) => ("je", "0x3000", true, false),
            Some(0x75) => ("jne", "0x4000", true, false),
            Some(0x90) => ("nop", "", false, false),
            Some(0xc3) => ("ret", "", false, false),
            Some(0x55) => ("push", "rbp", false, false),
            Some(0x89) => ("mov", "rsp, rbp", false, false),
            _ => ("db", bytes.as_str(), false, false),
        };
        
        instructions.push(Instruction {
            address: addr,
            bytes: bytes.clone(),
            mnemonic: mnemonic.to_string(),
            operands: operands.to_string(),
            size: 4.min(len - i),
            is_jump,
            is_call,
            jump_target: if is_jump || is_call { Some(addr + 0x1000) } else { None },
        });
    }
    
    // Mock functions
    let functions = vec![
        Function {
            name: "main".to_string(),
            address: start as u64,
            size: 100,
            instructions_count: 25,
            calls: vec!["sub_1000".to_string(), "sub_2000".to_string()],
        },
        Function {
            name: "sub_1000".to_string(),
            address: start as u64 + 0x1000,
            size: 50,
            instructions_count: 12,
            calls: vec![],
        },
    ];
    
    // Extract strings
    let strings = extract_strings_from_data(&data, 4);
    
    // Mock sections
    let sections = vec![
        Section {
            name: ".text".to_string(),
            address: 0x1000,
            size: 0x5000,
            flags: "rx".to_string(),
        },
        Section {
            name: ".data".to_string(),
            address: 0x6000,
            size: 0x2000,
            flags: "rw".to_string(),
        },
        Section {
            name: ".rodata".to_string(),
            address: 0x8000,
            size: 0x1000,
            flags: "r".to_string(),
        },
    ];
    
    Ok(DisassemblyResult {
        instructions,
        functions,
        strings: strings.into_iter().take(50).collect(), // Limit strings for performance
        entry_point: Some(0x1000),
        architecture: "x86_64".to_string(),
        sections,
    })
}

#[tauri::command]
pub async fn get_control_flow_graph(_file_path: String, function_address: u64) -> Result<ControlFlowGraph, String> {
    // Mock CFG for demonstration
    let blocks = vec![
        ControlFlowBlock {
            id: format!("block_0x{:x}", function_address),
            start_address: function_address,
            end_address: function_address + 20,
            instructions: vec![
                Instruction {
                    address: function_address,
                    bytes: "55".to_string(),
                    mnemonic: "push".to_string(),
                    operands: "rbp".to_string(),
                    size: 1,
                    is_jump: false,
                    is_call: false,
                    jump_target: None,
                },
                Instruction {
                    address: function_address + 1,
                    bytes: "48 89 e5".to_string(),
                    mnemonic: "mov".to_string(),
                    operands: "rbp, rsp".to_string(),
                    size: 3,
                    is_jump: false,
                    is_call: false,
                    jump_target: None,
                },
                Instruction {
                    address: function_address + 4,
                    bytes: "74 10".to_string(),
                    mnemonic: "je".to_string(),
                    operands: "0x16".to_string(),
                    size: 2,
                    is_jump: true,
                    is_call: false,
                    jump_target: Some(function_address + 0x16),
                },
            ],
            successors: vec![
                format!("block_0x{:x}", function_address + 6),
                format!("block_0x{:x}", function_address + 0x16),
            ],
            predecessors: vec![],
        },
        ControlFlowBlock {
            id: format!("block_0x{:x}", function_address + 6),
            start_address: function_address + 6,
            end_address: function_address + 0x16,
            instructions: vec![
                Instruction {
                    address: function_address + 6,
                    bytes: "b8 01 00 00 00".to_string(),
                    mnemonic: "mov".to_string(),
                    operands: "eax, 1".to_string(),
                    size: 5,
                    is_jump: false,
                    is_call: false,
                    jump_target: None,
                },
                Instruction {
                    address: function_address + 0x0b,
                    bytes: "e9 10 00 00 00".to_string(),
                    mnemonic: "jmp".to_string(),
                    operands: "0x20".to_string(),
                    size: 5,
                    is_jump: true,
                    is_call: false,
                    jump_target: Some(function_address + 0x20),
                },
            ],
            successors: vec![format!("block_0x{:x}", function_address + 0x20)],
            predecessors: vec![format!("block_0x{:x}", function_address)],
        },
        ControlFlowBlock {
            id: format!("block_0x{:x}", function_address + 0x16),
            start_address: function_address + 0x16,
            end_address: function_address + 0x20,
            instructions: vec![
                Instruction {
                    address: function_address + 0x16,
                    bytes: "b8 00 00 00 00".to_string(),
                    mnemonic: "mov".to_string(),
                    operands: "eax, 0".to_string(),
                    size: 5,
                    is_jump: false,
                    is_call: false,
                    jump_target: None,
                },
            ],
            successors: vec![format!("block_0x{:x}", function_address + 0x20)],
            predecessors: vec![format!("block_0x{:x}", function_address)],
        },
        ControlFlowBlock {
            id: format!("block_0x{:x}", function_address + 0x20),
            start_address: function_address + 0x20,
            end_address: function_address + 0x25,
            instructions: vec![
                Instruction {
                    address: function_address + 0x20,
                    bytes: "5d".to_string(),
                    mnemonic: "pop".to_string(),
                    operands: "rbp".to_string(),
                    size: 1,
                    is_jump: false,
                    is_call: false,
                    jump_target: None,
                },
                Instruction {
                    address: function_address + 0x21,
                    bytes: "c3".to_string(),
                    mnemonic: "ret".to_string(),
                    operands: "".to_string(),
                    size: 1,
                    is_jump: false,
                    is_call: false,
                    jump_target: None,
                },
            ],
            successors: vec![],
            predecessors: vec![
                format!("block_0x{:x}", function_address + 6),
                format!("block_0x{:x}", function_address + 0x16),
            ],
        },
    ];
    
    Ok(ControlFlowGraph {
        entry_block: format!("block_0x{:x}", function_address),
        blocks,
    })
}
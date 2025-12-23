use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::{Arc, Mutex};
use tauri::State;
use tauri::path::SafePathBuf;
use crate::commands::wasm_runtime::WasmRuntime;
use crate::metrics::{DISASSEMBLY_DURATION, INSTRUCTIONS_DISASSEMBLED};

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

const DISASSEMBLER_MODULE: &str = "disassembler";

#[tauri::command]
pub async fn disassemble_file(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    file_path: SafePathBuf,
    offset: Option<u64>,
    length: Option<usize>,
) -> Result<DisassemblyResult, String> {
    let metrics_start = std::time::Instant::now();
    let data = fs::read(file_path.as_ref()).map_err(|e| format!("Failed to read file: {}", e))?;

    let start = offset.unwrap_or(0);
    let len = length.unwrap_or(100);

    // Call WASM disassembler module
    let disasm_options = serde_json::json!({
        "arch": "x64",
        "syntax": "intel",
        "show_bytes": true,
        "max_instructions": len
    });

    let args = vec![
        serde_json::json!(data),
        serde_json::json!(start),
        disasm_options
    ];

    let result = crate::commands::wasm_runtime::execute_wasm_function(
        runtime,
        DISASSEMBLER_MODULE.to_string(),
        "disassembler#disassemble".to_string(),
        args,
    ).await?;

    // Parse WASM result
    if !result.success {
        return Err(result.error.unwrap_or("Disassembly failed".to_string()));
    }

    let output_str = result.output.as_ref()
        .ok_or("No output from disassembler")?;
    let wasm_output: serde_json::Value = serde_json::from_str(output_str)
        .map_err(|e| format!("Failed to parse disassembly output: {}", e))?;

    // Convert WASM instructions to our format
    let mut instructions = Vec::new();
    if let Some(wasm_insns) = wasm_output.as_array() {
        for insn in wasm_insns {
            instructions.push(Instruction {
                address: insn["offset"].as_u64().unwrap_or(0),
                bytes: insn["bytes"].as_array()
                    .map(|bytes| bytes.iter()
                        .filter_map(|b| b.as_u64())
                        .map(|b| format!("{:02x}", b))
                        .collect::<Vec<_>>()
                        .join(" "))
                    .unwrap_or_default(),
                mnemonic: insn["mnemonic"].as_str().unwrap_or("").to_string(),
                operands: insn["operands"].as_str().unwrap_or("").to_string(),
                size: insn["length"].as_u64().unwrap_or(0) as usize,
                is_jump: insn["is_branch"].as_bool().unwrap_or(false),
                is_call: insn["is_call"].as_bool().unwrap_or(false),
                jump_target: insn["branch_target"].as_u64(),
            });
        }
    }

    // Extract strings from binary
    let strings = extract_strings_from_data(&data, 4);

    // Basic sections (would ideally come from file-processor WASM module)
    let sections = vec![
        Section {
            name: ".text".to_string(),
            address: 0x1000,
            size: data.len() as u64,
            flags: "rx".to_string(),
        },
    ];

    // Basic function detection (would ideally use find-functions from WASM)
    let functions = vec![
        Function {
            name: "entry".to_string(),
            address: start,
            size: instructions.len() * 4,
            instructions_count: instructions.len(),
            calls: instructions.iter()
                .filter(|i| i.is_call)
                .filter_map(|i| i.jump_target)
                .map(|addr| format!("sub_{:x}", addr))
                .collect(),
        },
    ];

    let architecture = "x86_64".to_string();

    // Record disassembly metrics
    INSTRUCTIONS_DISASSEMBLED
        .with_label_values(&[&architecture])
        .observe(instructions.len() as f64);

    DISASSEMBLY_DURATION
        .with_label_values(&[&architecture, "success"])
        .observe(metrics_start.elapsed().as_secs_f64());

    Ok(DisassemblyResult {
        instructions,
        functions,
        strings: strings.into_iter().take(50).collect(),
        entry_point: Some(start),
        architecture,
        sections,
    })
}

#[tauri::command]
pub async fn get_control_flow_graph(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    file_path: SafePathBuf,
    function_address: u64,
) -> Result<ControlFlowGraph, String> {
    let data = fs::read(file_path.as_ref()).map_err(|e| format!("Failed to read file: {}", e))?;

    // Call WASM disassembler for CFG analysis
    let args = vec![
        serde_json::json!(data),
        serde_json::json!(function_address),
        serde_json::json!("x64")
    ];

    let result = crate::commands::wasm_runtime::execute_wasm_function(
        runtime,
        DISASSEMBLER_MODULE.to_string(),
        "disassembler#analyze-control-flow".to_string(),
        args,
    ).await?;

    if !result.success {
        return Err(result.error.unwrap_or("CFG analysis failed".to_string()));
    }

    let output_str = result.output.as_ref()
        .ok_or("No output from CFG analysis")?;
    let wasm_blocks: Vec<serde_json::Value> = serde_json::from_str(output_str)
        .map_err(|e| format!("Failed to parse CFG output: {}", e))?;

    // Convert WASM blocks to our format
    let mut blocks = Vec::new();
    for block in wasm_blocks {
        let block_start = block["start_offset"].as_u64().unwrap_or(0);
        let mut instructions = Vec::new();

        if let Some(insns) = block["instructions"].as_array() {
            for insn in insns {
                instructions.push(Instruction {
                    address: insn["offset"].as_u64().unwrap_or(0),
                    bytes: insn["bytes"].as_array()
                        .map(|bytes| bytes.iter()
                            .filter_map(|b| b.as_u64())
                            .map(|b| format!("{:02x}", b))
                            .collect::<Vec<_>>()
                            .join(" "))
                        .unwrap_or_default(),
                    mnemonic: insn["mnemonic"].as_str().unwrap_or("").to_string(),
                    operands: insn["operands"].as_str().unwrap_or("").to_string(),
                    size: insn["length"].as_u64().unwrap_or(0) as usize,
                    is_jump: insn["is_branch"].as_bool().unwrap_or(false),
                    is_call: insn["is_call"].as_bool().unwrap_or(false),
                    jump_target: insn["branch_target"].as_u64(),
                });
            }
        }

        blocks.push(ControlFlowBlock {
            id: format!("block_0x{:x}", block_start),
            start_address: block_start,
            end_address: block["end_offset"].as_u64().unwrap_or(0),
            instructions,
            successors: block["successors"].as_array()
                .map(|succ| succ.iter()
                    .filter_map(|s| s.as_u64())
                    .map(|addr| format!("block_0x{:x}", addr))
                    .collect())
                .unwrap_or_default(),
            predecessors: block["predecessors"].as_array()
                .map(|pred| pred.iter()
                    .filter_map(|p| p.as_u64())
                    .map(|addr| format!("block_0x{:x}", addr))
                    .collect())
                .unwrap_or_default(),
        });
    }

    Ok(ControlFlowGraph {
        entry_block: format!("block_0x{:x}", function_address),
        blocks,
    })
}

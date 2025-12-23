/// ARM/ARM64 Disassembly Module
/// Uses yaxpeax-arm for pure Rust ARM instruction decoding
/// Supports both ARM (32-bit) and AArch64 (64-bit)

use yaxpeax_arch::{Arch, Decoder, LengthedInstruction, U8Reader};
use yaxpeax_arm::armv7::ARMv7;
use yaxpeax_arm::armv8::a64::ARMv8;

use crate::disasm::{
    DisassembledInstruction, ConstantOffsets, Syntax,
};

/// Disassemble ARM (32-bit) code
pub fn disassemble_arm(
    code: &[u8],
    base_address: u64,
    max_instructions: u32,
    _syntax: &Syntax,
) -> Result<Vec<DisassembledInstruction>, String> {
    let mut result = Vec::new();
    let mut reader = U8Reader::new(code);
    let decoder = <ARMv7 as Arch>::Decoder::default();
    let mut offset = 0u64;
    let mut count = 0u32;

    while count < max_instructions {
        match decoder.decode(&mut reader) {
            Ok(instr) => {
                let instr_len = instr.len().to_const() as u32;
                let instr_bytes = if (offset as usize + instr_len as usize) <= code.len() {
                    code[offset as usize..(offset as usize + instr_len as usize)].to_vec()
                } else {
                    break;
                };

                let full_text = format!("{}", instr);
                let disasm = convert_arm_instruction(
                    &full_text,
                    base_address + offset,
                    instr_bytes,
                    instr_len,
                    false, // is_arm64
                );
                result.push(disasm);

                offset += instr_len as u64;
                count += 1;
            }
            Err(_) => break,
        }
    }

    Ok(result)
}

/// Disassemble ARM64/AArch64 code
pub fn disassemble_arm64(
    code: &[u8],
    base_address: u64,
    max_instructions: u32,
    _syntax: &Syntax,
) -> Result<Vec<DisassembledInstruction>, String> {
    let mut result = Vec::new();
    let mut reader = U8Reader::new(code);
    let decoder = <ARMv8 as Arch>::Decoder::default();
    let mut offset = 0u64;
    let mut count = 0u32;

    while count < max_instructions {
        match decoder.decode(&mut reader) {
            Ok(instr) => {
                let instr_len = instr.len().to_const() as u32;
                let instr_bytes = if (offset as usize + instr_len as usize) <= code.len() {
                    code[offset as usize..(offset as usize + instr_len as usize)].to_vec()
                } else {
                    break;
                };

                let full_text = format!("{}", instr);
                let disasm = convert_arm_instruction(
                    &full_text,
                    base_address + offset,
                    instr_bytes,
                    instr_len,
                    true, // is_arm64
                );
                result.push(disasm);

                offset += instr_len as u64;
                count += 1;
            }
            Err(_) => break,
        }
    }

    Ok(result)
}

/// Convert ARM/ARM64 instruction text to DisassembledInstruction
fn convert_arm_instruction(
    full_text: &str,
    address: u64,
    bytes: Vec<u8>,
    length: u32,
    is_arm64: bool,
) -> DisassembledInstruction {
    let mnemonic = extract_mnemonic(full_text);
    let operands = extract_operands(full_text, &mnemonic);

    // Determine instruction type from mnemonic
    let (is_branch, is_call, is_return) = analyze_flow_control(&mnemonic, is_arm64);
    let is_privileged = is_privileged_instruction(&mnemonic);
    let is_stack = is_stack_instruction(&mnemonic);

    // Compute operand info before moving operands
    let op_count = if operands.is_empty() { 0 } else { operands.split(',').count() as u32 };
    let operand_kinds: Vec<String> = if operands.is_empty() {
        Vec::new()
    } else {
        operands.split(',').map(|s| categorize_operand(s.trim())).collect()
    };

    DisassembledInstruction {
        offset: address,
        bytes,
        mnemonic: mnemonic.clone(),
        operands,
        full_text: full_text.to_string(),
        is_branch,
        is_call,
        is_return,
        is_privileged,
        branch_target: None, // Would require operand parsing
        length,
        used_registers: Vec::new(),
        used_memory: Vec::new(),
        memory_size: 0,
        constant_offsets: ConstantOffsets {
            has_displacement: false,
            displacement_offset: 0,
            displacement_size: 0,
            has_immediate: false,
            immediate_offset: 0,
            immediate_size: 0,
            has_immediate2: false,
            immediate_offset2: 0,
            immediate_size2: 0,
        },
        cpuid_features: vec![if is_arm64 { "ARM64" } else { "ARM" }.to_string()],
        rflags_read: 0,
        rflags_written: 0,
        rflags_cleared: 0,
        rflags_set: 0,
        rflags_undefined: 0,
        rflags_modified: 0,
        is_stack_instruction: is_stack,
        stack_pointer_increment: 0,
        fpu_writes_top: false,
        fpu_increment: 0,
        fpu_conditional: false,
        condition_code: String::new(),
        op_code_string: mnemonic,
        instruction_string: full_text.to_string(),
        encoding: if is_arm64 { "A64".to_string() } else { "A32".to_string() },
        op_count,
        operand_kinds,
    }
}

/// Categorize operand type (register, immediate, memory, etc.)
fn categorize_operand(operand: &str) -> String {
    let operand_upper = operand.to_uppercase();
    if operand.is_empty() {
        "None".to_string()
    } else if operand.starts_with('#') || operand.starts_with("0x") || operand.chars().all(|c| c.is_ascii_digit()) {
        "Immediate".to_string()
    } else if operand.starts_with('[') {
        "Memory".to_string()
    } else if operand_upper.starts_with('R') || operand_upper.starts_with('X') ||
              operand_upper.starts_with('W') || operand_upper.starts_with('S') ||
              operand_upper.starts_with('D') || operand_upper.starts_with('Q') ||
              operand_upper == "SP" || operand_upper == "LR" || operand_upper == "PC" {
        "Register".to_string()
    } else {
        "Unknown".to_string()
    }
}

/// Check if instruction modifies stack pointer
fn is_stack_instruction(mnemonic: &str) -> bool {
    let mnemonic_upper = mnemonic.to_uppercase();
    matches!(
        mnemonic_upper.as_str(),
        "PUSH" | "POP" | "STM" | "LDM" | "STMDB" | "LDMIA" |
        "STP" | "LDP" | "STR" | "LDR"
    ) || mnemonic_upper.contains("SP")
}

/// Extract mnemonic from full instruction text
fn extract_mnemonic(full_text: &str) -> String {
    full_text
        .split_whitespace()
        .next()
        .unwrap_or("unknown")
        .to_uppercase()
}

/// Extract operands from full instruction text
fn extract_operands(full_text: &str, mnemonic: &str) -> String {
    let mnemonic_lower = mnemonic.to_lowercase();
    if let Some(idx) = full_text.to_lowercase().find(&mnemonic_lower) {
        let after_mnemonic = &full_text[idx + mnemonic_lower.len()..];
        after_mnemonic.trim().to_string()
    } else {
        String::new()
    }
}

/// Analyze flow control based on mnemonic
fn analyze_flow_control(mnemonic: &str, is_arm64: bool) -> (bool, bool, bool) {
    let mnemonic_upper = mnemonic.to_uppercase();

    // Branch instructions (including conditional variants)
    let is_branch = mnemonic_upper.starts_with('B') && (
        mnemonic_upper == "B" ||
        mnemonic_upper == "BL" ||
        mnemonic_upper == "BX" ||
        mnemonic_upper == "BLX" ||
        mnemonic_upper == "BR" ||
        mnemonic_upper == "BLR" ||
        mnemonic_upper.starts_with("B.") ||  // ARM64 conditional: B.EQ, B.NE, etc.
        // ARM conditional branches: BEQ, BNE, BCS, BCC, BMI, BPL, BVS, BVC, BHI, BLS, BGE, BLT, BGT, BLE, BAL
        (mnemonic_upper.len() == 3 && mnemonic_upper.starts_with('B')) ||
        mnemonic_upper == "CBZ" ||
        mnemonic_upper == "CBNZ" ||
        mnemonic_upper == "TBZ" ||
        mnemonic_upper == "TBNZ"
    );

    // Call instructions
    let is_call = mnemonic_upper == "BL" || mnemonic_upper == "BLX" || mnemonic_upper == "BLR";

    // Return instructions
    let is_return = if is_arm64 {
        mnemonic_upper == "RET" || mnemonic_upper == "ERET"
    } else {
        // ARM32: BX LR is typical return, or POP with PC
        mnemonic_upper == "BX" || mnemonic_upper == "POP"
    };

    (is_branch, is_call, is_return)
}

/// Check if instruction is privileged
fn is_privileged_instruction(mnemonic: &str) -> bool {
    let mnemonic_upper = mnemonic.to_uppercase();
    matches!(
        mnemonic_upper.as_str(),
        "MSR" | "MRS" | "SYS" | "SYSL" | "DC" | "IC" | "AT" | "TLBI" |
        "HVC" | "SMC" | "ERET" | "DCPS1" | "DCPS2" | "DCPS3" |
        "CPS" | "SETEND" | "SRS" | "RFE"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arm_disassembly() {
        // ARM MOV R0, #1 (little-endian): e3 a0 00 01
        let code = [0x01, 0x00, 0xa0, 0xe3];
        let result = disassemble_arm(&code, 0x1000, 10, &Syntax::Intel);
        assert!(result.is_ok());
        let instrs = result.unwrap();
        assert!(!instrs.is_empty());
        assert_eq!(instrs[0].offset, 0x1000);
        assert_eq!(instrs[0].length, 4);
    }

    #[test]
    fn test_arm64_disassembly() {
        // ARM64 MOV X0, #1: d2 80 00 20
        let code = [0x20, 0x00, 0x80, 0xd2];
        let result = disassemble_arm64(&code, 0x1000, 10, &Syntax::Intel);
        assert!(result.is_ok());
        let instrs = result.unwrap();
        assert!(!instrs.is_empty());
        assert_eq!(instrs[0].offset, 0x1000);
        assert_eq!(instrs[0].length, 4);
    }

    #[test]
    fn test_arm_branch_detection() {
        // Test branch detection from mnemonic
        let (is_branch, is_call, is_return) = analyze_flow_control("BL", false);
        assert!(is_branch);
        assert!(is_call);
        assert!(!is_return);

        let (is_branch, is_call, is_return) = analyze_flow_control("BEQ", false);
        assert!(is_branch);
        assert!(!is_call);
        assert!(!is_return);
    }

    #[test]
    fn test_arm64_ret_detection() {
        let (is_branch, is_call, is_return) = analyze_flow_control("RET", true);
        assert!(!is_branch);
        assert!(!is_call);
        assert!(is_return);
    }

    #[test]
    fn test_privileged_detection() {
        assert!(is_privileged_instruction("MSR"));
        assert!(is_privileged_instruction("HVC"));
        assert!(!is_privileged_instruction("MOV"));
        assert!(!is_privileged_instruction("ADD"));
    }

    #[test]
    fn test_extract_mnemonic() {
        assert_eq!(extract_mnemonic("mov x0, #1"), "MOV");
        assert_eq!(extract_mnemonic("bl 0x1000"), "BL");
        assert_eq!(extract_mnemonic("ldr x1, [x2]"), "LDR");
    }
}

use capstone::prelude::*;
use crate::disasm::{DisassembledInstruction, UsedRegister, UsedMemory, ConstantOffsets};

pub struct ArmDisassembler;

impl ArmDisassembler {
    /// Disassemble ARM 32-bit code
    pub fn disassemble_arm32(
        code: &[u8],
        offset: u64,
        max_instructions: u32,
    ) -> Result<Vec<DisassembledInstruction>, String> {
        let cs = Capstone::new()
            .arm()
            .mode(arch::arm::ArchMode::Arm)
            .detail(true)
            .build()
            .map_err(|e| format!("Failed to create ARM disassembler: {}", e))?;

        Self::disassemble_with_capstone(&cs, code, offset, max_instructions)
    }

    /// Disassemble ARM64 (AArch64) code
    pub fn disassemble_arm64(
        code: &[u8],
        offset: u64,
        max_instructions: u32,
    ) -> Result<Vec<DisassembledInstruction>, String> {
        let cs = Capstone::new()
            .arm64()
            .mode(arch::arm64::ArchMode::Arm)
            .detail(true)
            .build()
            .map_err(|e| format!("Failed to create ARM64 disassembler: {}", e))?;

        Self::disassemble_with_capstone(&cs, code, offset, max_instructions)
    }

    fn disassemble_with_capstone(
        cs: &Capstone,
        code: &[u8],
        offset: u64,
        max_instructions: u32,
    ) -> Result<Vec<DisassembledInstruction>, String> {
        let insns = cs
            .disasm_count(code, offset, max_instructions as usize)
            .map_err(|e| format!("Disassembly failed: {}", e))?;

        let mut result = Vec::new();

        for insn in insns.iter() {
            let detail = cs.insn_detail(&insn)
                .map_err(|e| format!("Failed to get instruction details: {}", e))?;

            let mnemonic = insn.mnemonic().unwrap_or("").to_string();
            let operands = insn.op_str().unwrap_or("").to_string();
            let full_text = if operands.is_empty() {
                mnemonic.clone()
            } else {
                format!("{} {}", mnemonic, operands)
            };

            // ARM instruction analysis
            let arch_detail = detail.arch_detail();

            // Flow control analysis
            let (is_branch, is_call, is_return) = Self::analyze_flow_control(&mnemonic);

            // Branch target calculation (simplified - would need more detail parsing)
            let branch_target = None; // Capstone provides this in operands, requires parsing

            // Get instruction bytes
            let bytes = insn.bytes().to_vec();
            let length = bytes.len() as u32;

            // Register and memory analysis (ARM-specific)
            let (used_registers, used_memory) = Self::analyze_operands(&arch_detail);

            result.push(DisassembledInstruction {
                offset: insn.address(),
                bytes,
                mnemonic: mnemonic.clone(),
                operands: operands.clone(),
                full_text: full_text.clone(),
                is_branch,
                is_call,
                is_return,
                is_privileged: false, // Would need ARM privilege level detection
                branch_target,
                length,
                used_registers,
                used_memory,
                memory_size: 0, // Would need to parse from operands
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
                cpuid_features: Vec::new(), // ARM uses different feature detection
                rflags_read: 0,
                rflags_written: 0,
                rflags_cleared: 0,
                rflags_set: 0,
                rflags_undefined: 0,
                rflags_modified: 0,
                is_stack_instruction: mnemonic.contains("push") || mnemonic.contains("pop"),
                stack_pointer_increment: 0,
                fpu_writes_top: false,
                fpu_increment: 0,
                fpu_conditional: false,
                condition_code: Self::extract_condition_code(&mnemonic),
                op_code_string: mnemonic.clone(),
                instruction_string: full_text.clone(),
                encoding: "ARM".to_string(),
                op_count: 0, // Would need to count operands
                operand_kinds: Vec::new(),
            });
        }

        Ok(result)
    }

    fn analyze_flow_control(mnemonic: &str) -> (bool, bool, bool) {
        let lower = mnemonic.to_lowercase();

        // Branch instructions
        let is_branch = lower.starts_with('b') && !lower.starts_with("bl");

        // Call instructions (branch with link)
        let is_call = lower.starts_with("bl") || lower == "blx";

        // Return instructions
        let is_return = lower == "ret" ||
                       lower == "bx lr" ||
                       lower.starts_with("pop") && lower.contains("pc");

        (is_branch, is_call, is_return)
    }

    fn extract_condition_code(mnemonic: &str) -> String {
        // ARM condition codes: EQ, NE, CS/HS, CC/LO, MI, PL, VS, VC, HI, LS, GE, LT, GT, LE, AL
        let conditions = ["eq", "ne", "cs", "hs", "cc", "lo", "mi", "pl",
                         "vs", "vc", "hi", "ls", "ge", "lt", "gt", "le", "al"];

        let lower = mnemonic.to_lowercase();
        for cond in &conditions {
            if lower.ends_with(cond) {
                return cond.to_uppercase();
            }
        }

        "AL".to_string() // Always (unconditional)
    }

    fn analyze_operands(arch_detail: &ArchDetail) -> (Vec<UsedRegister>, Vec<UsedMemory>) {
        let used_registers = Vec::new();
        let used_memory = Vec::new();

        // ARM register analysis
        // Note: This is simplified - full implementation would parse operands in detail
        match arch_detail {
            ArchDetail::ArmDetail(_) => {
                // ARM-specific register tracking would go here
            }
            ArchDetail::Arm64Detail(_) => {
                // ARM64-specific register tracking would go here
            }
            _ => {}
        }

        (used_registers, used_memory)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_arm32_disassembly() {
        // Simple ARM instruction: mov r0, #0 (E3A00000)
        let code = [0x00, 0x00, 0xA0, 0xE3];
        let result = ArmDisassembler::disassemble_arm32(&code, 0, 1);
        assert!(result.is_ok());
        let instrs = result.unwrap();
        assert_eq!(instrs.len(), 1);
        assert!(instrs[0].mnemonic.contains("mov"));
    }

    #[test]
    fn test_arm64_disassembly() {
        // Simple ARM64 instruction: mov x0, #0 (D2800000)
        let code = [0x00, 0x00, 0x80, 0xD2];
        let result = ArmDisassembler::disassemble_arm64(&code, 0, 1);
        assert!(result.is_ok());
        let instrs = result.unwrap();
        assert_eq!(instrs.len(), 1);
    }

    #[test]
    fn test_flow_control_detection() {
        assert_eq!(ArmDisassembler::analyze_flow_control("b"), (true, false, false));
        assert_eq!(ArmDisassembler::analyze_flow_control("bl"), (false, true, false));
        assert_eq!(ArmDisassembler::analyze_flow_control("ret"), (false, false, true));
    }

    #[test]
    fn test_condition_code_extraction() {
        assert_eq!(ArmDisassembler::extract_condition_code("beq"), "EQ");
        assert_eq!(ArmDisassembler::extract_condition_code("bne"), "NE");
        assert_eq!(ArmDisassembler::extract_condition_code("mov"), "AL");
    }
}

/// Lightweight Emulation Engine for Malware Analysis
/// Provides symbolic/concrete execution for unpacking and behavior analysis
///
/// Key capabilities:
/// - Execute x86/x64 instructions
/// - Track memory and register state
/// - Detect self-modifying code
/// - Extract unpacked payloads
/// - Trace API calls

use std::collections::HashMap;
use crate::disasm::{DisassembledInstruction, Architecture, Syntax};

/// Maximum memory state size (10MB limit to prevent DoS)
const MAX_MEMORY_STATE: usize = 10 * 1024 * 1024;

/// Emulator state
pub struct Emulator {
    /// Register state (name -> value)
    registers: HashMap<String, u64>,
    /// Memory state (address -> byte)
    memory: HashMap<u64, u8>,
    /// Instruction pointer
    ip: u64,
    /// Stack pointer
    sp: u64,
    /// Flags register
    flags: u64,
    /// Execution trace
    trace: Vec<TraceEntry>,
    /// Maximum instructions to execute (prevent infinite loops)
    max_instructions: usize,
    /// Current instruction count
    instruction_count: usize,
    /// API call hooks
    api_hooks: HashMap<u64, String>,
    /// Modified memory regions (for unpacking detection)
    modified_regions: Vec<MemoryRegion>,
}

#[derive(Clone, Debug)]
pub struct TraceEntry {
    pub address: u64,
    pub instruction: String,
    pub registers_before: HashMap<String, u64>,
    pub registers_after: HashMap<String, u64>,
    pub memory_writes: Vec<(u64, u8)>,
}

#[derive(Clone, Debug)]
pub struct MemoryRegion {
    pub start: u64,
    pub end: u64,
    pub was_code: bool,
    pub is_executable: bool,
}

#[derive(Debug)]
pub struct EmulationResult {
    pub executed_instructions: usize,
    pub final_registers: HashMap<String, u64>,
    pub modified_memory: Vec<(u64, Vec<u8>)>,
    pub api_calls: Vec<ApiCall>,
    pub unpacked_code: Option<Vec<u8>>,
    pub trace: Vec<TraceEntry>,
}

#[derive(Clone, Debug)]
pub struct ApiCall {
    pub address: u64,
    pub name: String,
    pub arguments: Vec<u64>,
    pub return_value: Option<u64>,
}

impl Emulator {
    pub fn new(entry_point: u64, stack_base: u64) -> Self {
        let mut registers = HashMap::new();

        // Initialize x64 registers
        registers.insert("rax".to_string(), 0);
        registers.insert("rbx".to_string(), 0);
        registers.insert("rcx".to_string(), 0);
        registers.insert("rdx".to_string(), 0);
        registers.insert("rsi".to_string(), 0);
        registers.insert("rdi".to_string(), 0);
        registers.insert("rbp".to_string(), stack_base);
        registers.insert("rsp".to_string(), stack_base);
        registers.insert("r8".to_string(), 0);
        registers.insert("r9".to_string(), 0);
        registers.insert("r10".to_string(), 0);
        registers.insert("r11".to_string(), 0);
        registers.insert("r12".to_string(), 0);
        registers.insert("r13".to_string(), 0);
        registers.insert("r14".to_string(), 0);
        registers.insert("r15".to_string(), 0);

        Self {
            registers,
            memory: HashMap::new(),
            ip: entry_point,
            sp: stack_base,
            flags: 0,
            trace: Vec::new(),
            max_instructions: 100000, // Safety limit
            instruction_count: 0,
            api_hooks: HashMap::new(),
            modified_regions: Vec::new(),
        }
    }

    /// Load code into memory
    pub fn load_code(&mut self, base_address: u64, code: &[u8]) -> Result<(), String> {
        // Check if loading this code would exceed memory limit
        if self.memory.len() + code.len() > MAX_MEMORY_STATE {
            return Err(format!(
                "Emulator memory limit exceeded: would reach {} bytes (max: {})",
                self.memory.len() + code.len(),
                MAX_MEMORY_STATE
            ));
        }

        for (i, &byte) in code.iter().enumerate() {
            self.memory.insert(base_address + i as u64, byte);
        }

        Ok(())
    }

    /// Add API hook for emulation
    pub fn add_api_hook(&mut self, address: u64, name: String) {
        self.api_hooks.insert(address, name);
    }

    /// Emulate execution
    pub fn emulate(&mut self, code: &[u8], base_address: u64) -> Result<EmulationResult, String> {
        self.load_code(base_address, code)?;

        let mut api_calls = Vec::new();
        let mut modified_memory = Vec::new();

        while self.instruction_count < self.max_instructions {
            // Check for API call hooks
            if let Some(api_name) = self.api_hooks.get(&self.ip) {
                let call = self.handle_api_call(api_name.clone())?;
                api_calls.push(call);
                self.instruction_count += 1;
                continue;
            }

            // Fetch instruction bytes
            let instr_bytes = self.fetch_instruction()?;

            // Disassemble instruction
            let instructions = crate::disasm::Disassembler::disassemble(
                &instr_bytes,
                self.ip,
                Architecture::X8664,
                Syntax::Intel,
                1,
            )?;

            if instructions.is_empty() {
                break; // End of code
            }

            let instr = &instructions[0];

            // Save state before execution
            let regs_before = self.registers.clone();

            // Execute instruction
            let memory_writes = self.execute_instruction(instr)?;

            // Save state after execution
            let regs_after = self.registers.clone();

            // Record trace
            self.trace.push(TraceEntry {
                address: instr.offset,
                instruction: instr.full_text.clone(),
                registers_before: regs_before,
                registers_after: regs_after,
                memory_writes: memory_writes.clone(),
            });

            // Track modified memory
            if !memory_writes.is_empty() {
                for (addr, byte) in memory_writes {
                    modified_memory.push((addr, vec![byte]));
                }
            }

            // Update IP
            if !instr.is_branch && !instr.is_call && !instr.is_return {
                self.ip += instr.length as u64;
            }

            self.instruction_count += 1;

            // Stop on return
            if instr.is_return {
                break;
            }
        }

        // Detect unpacked code
        let unpacked_code = self.detect_unpacked_code();

        Ok(EmulationResult {
            executed_instructions: self.instruction_count,
            final_registers: self.registers.clone(),
            modified_memory,
            api_calls,
            unpacked_code,
            trace: self.trace.clone(),
        })
    }

    fn fetch_instruction(&self) -> Result<Vec<u8>, String> {
        let mut bytes = Vec::new();

        // Fetch up to 15 bytes (max x86 instruction length)
        for i in 0..15 {
            if let Some(&byte) = self.memory.get(&(self.ip + i)) {
                bytes.push(byte);
            } else {
                break;
            }
        }

        if bytes.is_empty() {
            return Err("No instruction bytes at IP".to_string());
        }

        Ok(bytes)
    }

    fn execute_instruction(&mut self, instr: &DisassembledInstruction) -> Result<Vec<(u64, u8)>, String> {
        let mut memory_writes = Vec::new();
        let mnemonic = instr.mnemonic.to_lowercase();

        // Simplified execution - expand based on needs
        match mnemonic.as_str() {
            m if m.starts_with("mov") => {
                self.execute_mov(&instr.operands)?;
            }
            m if m.starts_with("push") => {
                memory_writes.extend(self.execute_push(&instr.operands)?);
            }
            m if m.starts_with("pop") => {
                self.execute_pop(&instr.operands)?;
            }
            m if m.starts_with("add") => {
                self.execute_add(&instr.operands)?;
            }
            m if m.starts_with("sub") => {
                self.execute_sub(&instr.operands)?;
            }
            m if m.starts_with("xor") => {
                self.execute_xor(&instr.operands)?;
            }
            m if m.starts_with("call") => {
                self.execute_call(instr)?;
            }
            m if m.starts_with("ret") => {
                self.execute_ret()?;
            }
            m if m.starts_with("jmp") => {
                self.execute_jmp(instr)?;
            }
            m if m.starts_with("j") => {
                // Conditional jump
                self.execute_conditional_jump(instr)?;
            }
            _ => {
                // Unknown instruction - skip
            }
        }

        Ok(memory_writes)
    }

    fn execute_mov(&mut self, operands: &str) -> Result<(), String> {
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Ok(());
        }

        let value = self.get_value(parts[1])?;
        self.set_value(parts[0], value)?;
        Ok(())
    }

    fn execute_push(&mut self, operands: &str) -> Result<Vec<(u64, u8)>, String> {
        let value = self.get_value(operands)?;
        self.sp -= 8;
        self.registers.insert("rsp".to_string(), self.sp);

        // Write to memory with bounds check
        let mut writes = Vec::new();
        for i in 0..8 {
            // Check memory limit before writing
            if self.memory.len() >= MAX_MEMORY_STATE {
                return Err("Emulator memory limit exceeded during push".to_string());
            }
            let byte = ((value >> (i * 8)) & 0xFF) as u8;
            self.memory.insert(self.sp + i, byte);
            writes.push((self.sp + i, byte));
        }
        Ok(writes)
    }

    fn execute_pop(&mut self, operands: &str) -> Result<(), String> {
        let value = self.read_memory_u64(self.sp)?;
        self.sp += 8;
        self.registers.insert("rsp".to_string(), self.sp);
        self.set_value(operands, value)?;
        Ok(())
    }

    fn execute_add(&mut self, operands: &str) -> Result<(), String> {
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Ok(());
        }

        let left = self.get_value(parts[0])?;
        let right = self.get_value(parts[1])?;
        let result = left.wrapping_add(right);
        self.set_value(parts[0], result)?;
        Ok(())
    }

    fn execute_sub(&mut self, operands: &str) -> Result<(), String> {
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Ok(());
        }

        let left = self.get_value(parts[0])?;
        let right = self.get_value(parts[1])?;
        let result = left.wrapping_sub(right);
        self.set_value(parts[0], result)?;
        Ok(())
    }

    fn execute_xor(&mut self, operands: &str) -> Result<(), String> {
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Ok(());
        }

        let left = self.get_value(parts[0])?;
        let right = self.get_value(parts[1])?;
        let result = left ^ right;
        self.set_value(parts[0], result)?;
        Ok(())
    }

    fn execute_call(&mut self, instr: &DisassembledInstruction) -> Result<(), String> {
        if let Some(target) = instr.branch_target {
            // Push return address
            self.sp -= 8;
            let return_addr = instr.offset + instr.length as u64;
            for i in 0..8 {
                // Check memory limit before writing
                if self.memory.len() >= MAX_MEMORY_STATE {
                    return Err("Emulator memory limit exceeded during call".to_string());
                }
                let byte = ((return_addr >> (i * 8)) & 0xFF) as u8;
                self.memory.insert(self.sp + i, byte);
            }
            self.registers.insert("rsp".to_string(), self.sp);

            // Jump to target
            self.ip = target;
        }
        Ok(())
    }

    fn execute_ret(&mut self) -> Result<(), String> {
        let return_addr = self.read_memory_u64(self.sp)?;
        self.sp += 8;
        self.registers.insert("rsp".to_string(), self.sp);
        self.ip = return_addr;
        Ok(())
    }

    fn execute_jmp(&mut self, instr: &DisassembledInstruction) -> Result<(), String> {
        if let Some(target) = instr.branch_target {
            self.ip = target;
        }
        Ok(())
    }

    fn execute_conditional_jump(&mut self, instr: &DisassembledInstruction) -> Result<(), String> {
        // Simplified: assume condition is true 50% of the time
        // Full implementation would track flags properly
        if let Some(target) = instr.branch_target {
            // For now, always take the branch (helps with unpacking)
            self.ip = target;
        }
        Ok(())
    }

    fn handle_api_call(&mut self, api_name: String) -> Result<ApiCall, String> {
        // Extract arguments from registers (Windows x64 calling convention)
        let args = vec![
            *self.registers.get("rcx").unwrap_or(&0),
            *self.registers.get("rdx").unwrap_or(&0),
            *self.registers.get("r8").unwrap_or(&0),
            *self.registers.get("r9").unwrap_or(&0),
        ];

        // Simulate return value
        let return_value = Some(0);
        self.registers.insert("rax".to_string(), 0);

        // Move to next instruction (simulated)
        self.ip += 5; // Typical call instruction length

        Ok(ApiCall {
            address: self.ip,
            name: api_name,
            arguments: args,
            return_value,
        })
    }

    fn get_value(&self, operand: &str) -> Result<u64, String> {
        let operand = operand.trim();

        // Try as hex constant
        if operand.starts_with("0x") {
            if let Ok(val) = u64::from_str_radix(&operand[2..], 16) {
                return Ok(val);
            }
        }

        // Try as decimal
        if let Ok(val) = operand.parse::<u64>() {
            return Ok(val);
        }

        // Try as register
        if let Some(&val) = self.registers.get(operand) {
            return Ok(val);
        }

        // Default to 0
        Ok(0)
    }

    fn set_value(&mut self, operand: &str, value: u64) -> Result<(), String> {
        let operand = operand.trim();

        // Assume it's a register for now
        self.registers.insert(operand.to_string(), value);
        Ok(())
    }

    fn read_memory_u64(&self, addr: u64) -> Result<u64, String> {
        let mut value = 0u64;
        for i in 0..8 {
            if let Some(&byte) = self.memory.get(&(addr + i)) {
                value |= (byte as u64) << (i * 8);
            }
        }
        Ok(value)
    }

    fn detect_unpacked_code(&self) -> Option<Vec<u8>> {
        // Look for newly written executable code
        // This is a simplified heuristic - real implementation would be more sophisticated

        // Collect all memory writes from the trace
        let mut write_map: HashMap<u64, u8> = HashMap::new();

        for trace_entry in &self.trace {
            for &(address, byte) in &trace_entry.memory_writes {
                write_map.insert(address, byte);
            }
        }

        if write_map.is_empty() {
            return None;
        }

        // Find contiguous regions
        let mut addresses: Vec<u64> = write_map.keys().copied().collect();
        addresses.sort_unstable();

        let mut regions: Vec<(u64, Vec<u8>)> = Vec::new();
        let mut current_start = addresses[0];
        let mut current_bytes = Vec::new();

        for &addr in &addresses {
            // If address is within 16 bytes of last address, consider it part of same region
            // (allows for small gaps in writes)
            if current_bytes.is_empty() || addr <= current_start + (current_bytes.len() as u64) + 16 {
                // Fill any gaps with zeros
                while current_start + (current_bytes.len() as u64) < addr {
                    current_bytes.push(0);
                }

                if let Some(&byte) = write_map.get(&addr) {
                    current_bytes.push(byte);
                }
            } else {
                // Start new region
                if !current_bytes.is_empty() {
                    regions.push((current_start, current_bytes.clone()));
                }
                current_start = addr;
                current_bytes = vec![*write_map.get(&addr).unwrap_or(&0)];
            }
        }

        // Add last region
        if !current_bytes.is_empty() {
            regions.push((current_start, current_bytes));
        }

        // Find the largest region that looks like executable code
        let mut best_region: Option<Vec<u8>> = None;
        let mut best_score = 0;

        for (_start, bytes) in regions {
            if bytes.len() < 16 {
                // Too small to be meaningful code
                continue;
            }

            // Score based on size and presence of common x86/x64 code patterns
            let mut score = bytes.len();

            // Check for common instruction patterns
            if self.has_code_patterns(&bytes) {
                score *= 2; // Double score if it looks like code
            }

            if score > best_score {
                best_score = score;
                best_region = Some(bytes);
            }
        }

        best_region
    }

    fn has_code_patterns(&self, bytes: &[u8]) -> bool {
        if bytes.len() < 4 {
            return false;
        }

        let mut pattern_count = 0;

        // Check for common x86/x64 instruction sequences
        for i in 0..bytes.len().saturating_sub(3) {
            match &bytes[i..i+2] {
                // Common function prologs
                [0x55, 0x48] => pattern_count += 1, // push rbp; rex.W
                [0x48, 0x89] => pattern_count += 1, // mov (rex.W prefix)
                [0x48, 0x8B] => pattern_count += 1, // mov (rex.W prefix)

                // Common x86 instructions
                [0x83, 0xEC] => pattern_count += 1, // sub esp, imm8
                [0x89, 0xE5] => pattern_count += 1, // mov ebp, esp
                [0x55, 0x89] => pattern_count += 1, // push ebp; mov
                [0xC3, _] => pattern_count += 1,    // ret
                [0xC2, _] => pattern_count += 1,    // ret imm16

                // Common jump/call patterns
                [0xE8, _] => pattern_count += 1,    // call rel32
                [0xE9, _] => pattern_count += 1,    // jmp rel32
                [0x74, _] => pattern_count += 1,    // jz rel8
                [0x75, _] => pattern_count += 1,    // jnz rel8

                // XOR patterns (common in unpacking)
                [0x31, _] => pattern_count += 1,    // xor
                [0x33, _] => pattern_count += 1,    // xor

                _ => {}
            }
        }

        // If we found at least 5 code patterns, it likely is code
        pattern_count >= 5
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_emulator_basic() {
        let mut emu = Emulator::new(0x1000, 0x10000);

        // Test basic register operations
        emu.registers.insert("rax".to_string(), 5);
        emu.registers.insert("rbx".to_string(), 10);

        assert_eq!(emu.registers.get("rax"), Some(&5));
        assert_eq!(emu.registers.get("rbx"), Some(&10));
    }

    #[test]
    fn test_memory_operations() {
        let mut emu = Emulator::new(0x1000, 0x10000);

        // Write to memory
        emu.memory.insert(0x2000, 0x42);
        emu.memory.insert(0x2001, 0x43);

        assert_eq!(emu.memory.get(&0x2000), Some(&0x42));
        assert_eq!(emu.memory.get(&0x2001), Some(&0x43));
    }

    #[test]
    fn test_detect_unpacked_code_no_writes() {
        let emu = Emulator::new(0x1000, 0x10000);

        // No memory writes should return None
        let result = emu.detect_unpacked_code();
        assert!(result.is_none());
    }

    #[test]
    fn test_detect_unpacked_code_with_writes() {
        let mut emu = Emulator::new(0x1000, 0x10000);

        // Simulate memory writes with executable code pattern
        // Common x86/x64 function prolog: push rbp; mov rbp, rsp; sub rsp, 0x20
        let code_pattern = vec![
            (0x2000, 0x55u8),       // push rbp
            (0x2001, 0x48),         // REX.W prefix
            (0x2002, 0x89),         // mov
            (0x2003, 0xE5),         // rbp, rsp
            (0x2004, 0x48),         // REX.W prefix
            (0x2005, 0x83),         // sub
            (0x2006, 0xEC),         // rsp
            (0x2007, 0x20),         // 0x20
            (0x2008, 0x48),         // REX.W prefix
            (0x2009, 0x8B),         // mov
            (0x200A, 0x05),         // [rip+X]
            (0x200B, 0x00),
            (0x200C, 0x00),
            (0x200D, 0x00),
            (0x200E, 0x00),
            (0x200F, 0xC3),         // ret
        ];

        // Create trace entry with memory writes
        let trace_entry = TraceEntry {
            address: 0x1000,
            instruction: "unpack loop".to_string(),
            registers_before: HashMap::new(),
            registers_after: HashMap::new(),
            memory_writes: code_pattern,
        };

        emu.trace.push(trace_entry);

        // Should detect the unpacked code
        let result = emu.detect_unpacked_code();
        assert!(result.is_some());

        let unpacked = result.unwrap();
        assert!(unpacked.len() >= 16);
        assert_eq!(unpacked[0], 0x55); // push rbp
        assert_eq!(unpacked[1], 0x48); // REX.W prefix
    }

    #[test]
    fn test_has_code_patterns() {
        let emu = Emulator::new(0x1000, 0x10000);

        // Test with real x86 code pattern
        let code = vec![
            0x55,       // push rbp
            0x48, 0x89, 0xE5,  // mov rbp, rsp
            0x48, 0x83, 0xEC, 0x20,  // sub rsp, 0x20
            0x48, 0x8B, 0x05, 0x00, 0x00, 0x00, 0x00,  // mov rax, [rip+X]
            0xC3,       // ret
        ];

        assert!(emu.has_code_patterns(&code));

        // Test with non-code data
        let data = vec![0x00; 32];
        assert!(!emu.has_code_patterns(&data));

        // Test with too small buffer
        let small = vec![0x55, 0x48];
        assert!(!emu.has_code_patterns(&small));
    }

    #[test]
    fn test_detect_unpacked_code_multiple_regions() {
        let mut emu = Emulator::new(0x1000, 0x10000);

        // Create two regions: one with non-code data (larger), one with executable code
        let mut region1 = Vec::new();
        for i in 0..20 {
            region1.push((0x2000 + i, 0x00u8)); // Just zeros, no code patterns
        }

        let region2 = vec![
            (0x3000, 0x55u8),       // push rbp
            (0x3001, 0x48),         // REX.W
            (0x3002, 0x89),         // mov
            (0x3003, 0xE5),         // rbp, rsp
            (0x3004, 0x48),         // REX.W
            (0x3005, 0x83),         // sub
            (0x3006, 0xEC),         // rsp
            (0x3007, 0x20),         // 0x20
            (0x3008, 0xE8),         // call
            (0x3009, 0x00),
            (0x300A, 0x00),
            (0x300B, 0x00),
            (0x300C, 0x00),
            (0x300D, 0xC3),         // ret
            (0x300E, 0x48),         // REX.W
            (0x300F, 0x89),         // mov
            (0x3010, 0xE5),         // rbp, rsp
            (0x3011, 0x48),         // REX.W
            (0x3012, 0x83),         // sub
            (0x3013, 0xEC),         // rsp
        ];

        let trace1 = TraceEntry {
            address: 0x1000,
            instruction: "write data".to_string(),
            registers_before: HashMap::new(),
            registers_after: HashMap::new(),
            memory_writes: region1,
        };

        let trace2 = TraceEntry {
            address: 0x1010,
            instruction: "write code".to_string(),
            registers_before: HashMap::new(),
            registers_after: HashMap::new(),
            memory_writes: region2,
        };

        emu.trace.push(trace1);
        emu.trace.push(trace2);

        // Should detect region2 (the one with code patterns) as it has higher score
        let result = emu.detect_unpacked_code();
        assert!(result.is_some());

        let unpacked = result.unwrap();
        // Region2 has code patterns so should be selected despite region1 being present
        assert!(unpacked.len() >= 16);
        assert_eq!(unpacked[0], 0x55); // push rbp
    }
}

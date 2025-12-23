use iced_x86::{
    Decoder, DecoderOptions, Formatter, Instruction as IcedInstruction,
    IntelFormatter, GasFormatter, MasmFormatter, NasmFormatter,
    FlowControl, OpKind, InstructionInfoFactory, OpAccess, MemorySize
};
use std::collections::{HashMap, HashSet};
use crate::arm_disasm;

#[derive(Clone, Copy)]
pub enum Architecture {
    X8632,
    X8664,
    Arm,
    Arm64,
}

#[derive(Clone, Copy)]
pub enum Syntax {
    Intel,
    Att,
    Masm,
    Nasm,
}

#[derive(Clone)]
pub struct UsedRegister {
    pub register: String,
    pub access: RegisterAccess,
}

#[derive(Clone, Copy)]
pub enum RegisterAccess {
    None,
    Read,
    Write,
    ReadWrite,
    CondRead,
    CondWrite,
}

#[derive(Clone)]
pub struct UsedMemory {
    pub segment: String,
    pub base: String,
    pub index: String,
    pub scale: u32,
    pub displacement: i64,
    pub size: u32,
    pub access: MemoryAccess,
}

#[derive(Clone, Copy)]
pub enum MemoryAccess {
    None,
    Read,
    Write,
    ReadWrite,
    CondRead,
    CondWrite,
}

#[derive(Clone)]
pub struct ConstantOffsets {
    pub has_displacement: bool,
    pub displacement_offset: u32,
    pub displacement_size: u32,
    pub has_immediate: bool,
    pub immediate_offset: u32,
    pub immediate_size: u32,
    pub has_immediate2: bool,
    pub immediate_offset2: u32,
    pub immediate_size2: u32,
}

#[derive(Clone)]
pub struct DisassembledInstruction {
    pub offset: u64,
    pub bytes: Vec<u8>,
    pub mnemonic: String,
    pub operands: String,
    pub full_text: String,
    pub is_branch: bool,
    pub is_call: bool,
    pub is_return: bool,
    pub is_privileged: bool,
    pub branch_target: Option<u64>,
    pub length: u32,
    // Register analysis
    pub used_registers: Vec<UsedRegister>,
    // Memory analysis
    pub used_memory: Vec<UsedMemory>,
    pub memory_size: u32,
    // Constant offsets
    pub constant_offsets: ConstantOffsets,
    // CPU features
    pub cpuid_features: Vec<String>,
    // RFLAGS
    pub rflags_read: u32,
    pub rflags_written: u32,
    pub rflags_cleared: u32,
    pub rflags_set: u32,
    pub rflags_undefined: u32,
    pub rflags_modified: u32,
    // Stack tracking
    pub is_stack_instruction: bool,
    pub stack_pointer_increment: i32,
    // FPU stack tracking
    pub fpu_writes_top: bool,
    pub fpu_increment: i32,
    pub fpu_conditional: bool,
    // Condition code
    pub condition_code: String,
    // OpCode info
    pub op_code_string: String,
    pub instruction_string: String,
    pub encoding: String,
    // Operand info
    pub op_count: u32,
    pub operand_kinds: Vec<String>,
}

pub struct BasicBlock {
    pub start_offset: u64,
    pub end_offset: u64,
    pub instructions: Vec<DisassembledInstruction>,
    pub successors: Vec<u64>,
    pub predecessors: Vec<u64>,
}

pub struct FunctionInfo {
    pub start_offset: u64,
    pub end_offset: Option<u64>,
    pub name: Option<String>,
    pub basic_blocks: Vec<BasicBlock>,
    pub calls_to: Vec<u64>,
    pub called_from: Vec<u64>,
}

pub struct Disassembler;

impl Disassembler {
    pub fn disassemble(
        code: &[u8],
        offset: u64,
        arch: Architecture,
        syntax: Syntax,
        max_instructions: u32,
    ) -> Result<Vec<DisassembledInstruction>, String> {
        let mut result = Vec::new();
        let mut info_factory = InstructionInfoFactory::new();

        match arch {
            Architecture::X8632 => {
                let mut decoder = Decoder::with_ip(32, code, offset, DecoderOptions::NONE);
                let mut instr = IcedInstruction::default();
                let mut count = 0;

                while decoder.can_decode() && count < max_instructions {
                    decoder.decode_out(&mut instr);
                    let const_offsets = decoder.get_constant_offsets(&instr);
                    result.push(Self::convert_instruction(&instr, &syntax, code, offset, &mut info_factory, &const_offsets));
                    count += 1;
                }
            }
            Architecture::X8664 => {
                let mut decoder = Decoder::with_ip(64, code, offset, DecoderOptions::NONE);
                let mut instr = IcedInstruction::default();
                let mut count = 0;

                while decoder.can_decode() && count < max_instructions {
                    decoder.decode_out(&mut instr);
                    let const_offsets = decoder.get_constant_offsets(&instr);
                    result.push(Self::convert_instruction(&instr, &syntax, code, offset, &mut info_factory, &const_offsets));
                    count += 1;
                }
            }
            Architecture::Arm => {
                return arm_disasm::disassemble_arm(code, offset, max_instructions, &syntax);
            }
            Architecture::Arm64 => {
                return arm_disasm::disassemble_arm64(code, offset, max_instructions, &syntax);
            }
        }

        Ok(result)
    }

    fn convert_instruction(
        instr: &IcedInstruction,
        syntax: &Syntax,
        code: &[u8],
        offset: u64,
        info_factory: &mut InstructionInfoFactory,
        const_offsets: &iced_x86::ConstantOffsets,
    ) -> DisassembledInstruction {
        // Format instruction text
        let mut output = String::new();
        match syntax {
            Syntax::Intel => {
                let mut formatter = IntelFormatter::new();
                formatter.format(instr, &mut output);
            }
            Syntax::Att => {
                let mut formatter = GasFormatter::new();
                formatter.format(instr, &mut output);
            }
            Syntax::Masm => {
                let mut formatter = MasmFormatter::new();
                formatter.format(instr, &mut output);
            }
            Syntax::Nasm => {
                let mut formatter = NasmFormatter::new();
                formatter.format(instr, &mut output);
            }
        }

        let mnemonic = format!("{:?}", instr.mnemonic());

        // Flow control analysis
        let flow_control = instr.flow_control();
        let is_branch = matches!(
            flow_control,
            FlowControl::UnconditionalBranch
                | FlowControl::ConditionalBranch
                | FlowControl::IndirectBranch
        );
        let is_call = matches!(
            flow_control,
            FlowControl::Call | FlowControl::IndirectCall
        );
        let is_return = matches!(flow_control, FlowControl::Return);
        let is_privileged = instr.is_privileged();

        // Branch target
        let branch_target = if is_branch || is_call {
            if instr.op0_kind() == OpKind::NearBranch16
                || instr.op0_kind() == OpKind::NearBranch32
                || instr.op0_kind() == OpKind::NearBranch64
            {
                Some(instr.near_branch_target())
            } else {
                None
            }
        } else {
            None
        };

        // Get instruction bytes
        let instr_len = instr.len();
        let bytes = code
            .get((instr.ip() - offset) as usize..(instr.ip() - offset + instr_len as u64) as usize)
            .unwrap_or(&[])
            .to_vec();

        // Get detailed instruction info
        let info = info_factory.info(instr);

        // Extract register usage
        let used_registers: Vec<UsedRegister> = info
            .used_registers()
            .iter()
            .map(|reg_info| UsedRegister {
                register: format!("{:?}", reg_info.register()),
                access: Self::convert_op_access(reg_info.access()),
            })
            .collect();

        // Extract memory usage
        let used_memory: Vec<UsedMemory> = info
            .used_memory()
            .iter()
            .map(|mem_info| UsedMemory {
                segment: format!("{:?}", mem_info.segment()),
                base: format!("{:?}", mem_info.base()),
                index: format!("{:?}", mem_info.index()),
                scale: mem_info.scale(),
                displacement: mem_info.displacement() as i64,
                size: Self::memory_size_to_bytes(mem_info.memory_size()),
                access: Self::convert_memory_access(mem_info.access()),
            })
            .collect();

        // Memory size
        let memory_size = Self::memory_size_to_bytes(instr.memory_size());

        // Constant offsets for finding immediate values and string references
        let constant_offsets = ConstantOffsets {
            has_displacement: const_offsets.has_displacement(),
            displacement_offset: const_offsets.displacement_offset() as u32,
            displacement_size: const_offsets.displacement_size() as u32,
            has_immediate: const_offsets.has_immediate(),
            immediate_offset: const_offsets.immediate_offset() as u32,
            immediate_size: const_offsets.immediate_size() as u32,
            has_immediate2: const_offsets.has_immediate2(),
            immediate_offset2: const_offsets.immediate_offset2() as u32,
            immediate_size2: const_offsets.immediate_size2() as u32,
        };

        // CPUID features
        let cpuid_features: Vec<String> = instr
            .cpuid_features()
            .iter()
            .map(|f| format!("{:?}", f))
            .collect();

        // RFLAGS analysis
        let rflags_read = instr.rflags_read();
        let rflags_written = instr.rflags_written();
        let rflags_cleared = instr.rflags_cleared();
        let rflags_set = instr.rflags_set();
        let rflags_undefined = instr.rflags_undefined();
        let rflags_modified = instr.rflags_modified();

        // Stack tracking
        let is_stack_instruction = instr.is_stack_instruction();
        let stack_pointer_increment = instr.stack_pointer_increment();

        // FPU stack tracking
        let fpu_info = instr.fpu_stack_increment_info();
        let fpu_writes_top = fpu_info.writes_top();
        let fpu_increment = fpu_info.increment();
        let fpu_conditional = fpu_info.conditional();

        // Condition code
        let condition_code = format!("{:?}", instr.condition_code());

        // OpCode info
        let op_code = instr.op_code();
        let op_code_string = op_code.op_code_string().to_string();
        let instruction_string = op_code.instruction_string().to_string();
        let encoding = format!("{:?}", instr.encoding());

        // Operand info
        let op_count = instr.op_count();
        let operand_kinds: Vec<String> = (0..op_count)
            .map(|i| format!("{:?}", instr.op_kind(i)))
            .collect();

        DisassembledInstruction {
            offset: instr.ip(),
            bytes,
            mnemonic,
            operands: output.clone(),
            full_text: output,
            is_branch,
            is_call,
            is_return,
            is_privileged,
            branch_target,
            length: instr_len as u32,
            used_registers,
            used_memory,
            memory_size,
            constant_offsets,
            cpuid_features,
            rflags_read,
            rflags_written,
            rflags_cleared,
            rflags_set,
            rflags_undefined,
            rflags_modified,
            is_stack_instruction,
            stack_pointer_increment,
            fpu_writes_top,
            fpu_increment,
            fpu_conditional,
            condition_code,
            op_code_string,
            instruction_string,
            encoding,
            op_count,
            operand_kinds,
        }
    }

    fn convert_op_access(access: OpAccess) -> RegisterAccess {
        match access {
            OpAccess::None => RegisterAccess::None,
            OpAccess::Read => RegisterAccess::Read,
            OpAccess::Write => RegisterAccess::Write,
            OpAccess::ReadWrite => RegisterAccess::ReadWrite,
            OpAccess::CondRead => RegisterAccess::CondRead,
            OpAccess::CondWrite => RegisterAccess::CondWrite,
            _ => RegisterAccess::None,
        }
    }

    fn convert_memory_access(access: OpAccess) -> MemoryAccess {
        match access {
            OpAccess::None => MemoryAccess::None,
            OpAccess::Read => MemoryAccess::Read,
            OpAccess::Write => MemoryAccess::Write,
            OpAccess::ReadWrite => MemoryAccess::ReadWrite,
            OpAccess::CondRead => MemoryAccess::CondRead,
            OpAccess::CondWrite => MemoryAccess::CondWrite,
            _ => MemoryAccess::None,
        }
    }

    fn memory_size_to_bytes(mem_size: MemorySize) -> u32 {
        match mem_size {
            MemorySize::Unknown => 0,
            MemorySize::UInt8 | MemorySize::Int8 => 1,
            MemorySize::UInt16 | MemorySize::Int16 => 2,
            MemorySize::UInt32 | MemorySize::Int32 => 4,
            MemorySize::UInt64 | MemorySize::Int64 => 8,
            MemorySize::UInt128 | MemorySize::Int128 => 16,
            MemorySize::UInt256 | MemorySize::Int256 => 32,
            MemorySize::UInt512 | MemorySize::Int512 => 64,
            _ => {
                // For other types, try to use the byte count if available
                0
            }
        }
    }

    pub fn analyze_control_flow(
        code: &[u8],
        entry_point: u64,
        arch: Architecture,
    ) -> Result<Vec<BasicBlock>, String> {
        // Disassemble instructions
        let instructions = Self::disassemble(code, entry_point, arch, Syntax::Intel, 10000)?;

        if instructions.is_empty() {
            return Ok(Vec::new());
        }

        // Find all basic block start addresses
        let mut block_starts: HashSet<u64> = HashSet::new();
        block_starts.insert(entry_point);

        for (idx, instr) in instructions.iter().enumerate() {
            // Target of branch/call starts a new block
            if instr.is_branch || instr.is_call {
                if let Some(target) = instr.branch_target {
                    block_starts.insert(target);
                }
                // Instruction after branch/call starts a new block (if not unconditional jump)
                if !instr.is_return && idx + 1 < instructions.len() {
                    // For conditional branches, the next instruction is reachable
                    // For unconditional branches (jmp), it's not
                    let is_conditional = instr.mnemonic.to_lowercase().starts_with("j") &&
                        instr.mnemonic.to_lowercase() != "jmp";

                    if instr.is_call || is_conditional {
                        block_starts.insert(instructions[idx + 1].offset);
                    }
                }
            }

            // Instruction after return starts a new block
            if instr.is_return && idx + 1 < instructions.len() {
                block_starts.insert(instructions[idx + 1].offset);
            }
        }

        // Create basic blocks
        let mut sorted_starts: Vec<u64> = block_starts.into_iter().collect();
        sorted_starts.sort_unstable();

        let mut blocks = Vec::new();

        for (i, &start) in sorted_starts.iter().enumerate() {
            let end = if i + 1 < sorted_starts.len() {
                sorted_starts[i + 1]
            } else {
                instructions
                    .last()
                    .map(|i| i.offset + i.bytes.len() as u64)
                    .unwrap_or(start)
            };

            let block_instructions: Vec<DisassembledInstruction> = instructions
                .iter()
                .filter(|i| i.offset >= start && i.offset < end)
                .cloned()
                .collect();

            if !block_instructions.is_empty() {
                let mut successors = Vec::new();

                if let Some(last) = block_instructions.last() {
                    if last.is_branch {
                        // Add branch target
                        if let Some(target) = last.branch_target {
                            successors.push(target);
                        }
                        // Conditional branches also have fallthrough
                        let is_conditional = last.mnemonic.to_lowercase().starts_with("j") &&
                            last.mnemonic.to_lowercase() != "jmp";
                        if is_conditional && i + 1 < sorted_starts.len() {
                            successors.push(sorted_starts[i + 1]);
                        }
                    } else if last.is_call {
                        // Calls continue to next instruction
                        if i + 1 < sorted_starts.len() {
                            successors.push(sorted_starts[i + 1]);
                        }
                    } else if !last.is_return {
                        // Fallthrough to next block
                        if i + 1 < sorted_starts.len() {
                            successors.push(sorted_starts[i + 1]);
                        }
                    }
                }

                blocks.push(BasicBlock {
                    start_offset: start,
                    end_offset: end,
                    instructions: block_instructions,
                    successors,
                    predecessors: Vec::new(),
                });
            }
        }

        // Calculate predecessors
        for i in 0..blocks.len() {
            let successors = blocks[i].successors.clone();
            let block_start = blocks[i].start_offset;

            for succ in successors {
                if let Some(pos) = blocks.iter().position(|b| b.start_offset == succ) {
                    blocks[pos].predecessors.push(block_start);
                }
            }
        }

        Ok(blocks)
    }

    pub fn find_functions(
        code: &[u8],
        entry_points: &[u64],
        arch: Architecture,
    ) -> Result<Vec<FunctionInfo>, String> {
        let mut functions = Vec::new();
        let mut all_calls: HashMap<u64, Vec<u64>> = HashMap::new(); // target -> callers

        for &entry in entry_points {
            let blocks = Self::analyze_control_flow(code, entry, arch)?;

            // Collect all calls made by this function
            let calls_to: Vec<u64> = blocks
                .iter()
                .flat_map(|b| &b.instructions)
                .filter(|i| i.is_call)
                .filter_map(|i| i.branch_target)
                .collect();

            // Track callers for each target
            for &target in &calls_to {
                all_calls.entry(target).or_insert_with(Vec::new).push(entry);
            }

            let end_offset = blocks.last().map(|b| b.end_offset);

            functions.push(FunctionInfo {
                start_offset: entry,
                end_offset,
                name: None,
                basic_blocks: blocks,
                calls_to,
                called_from: Vec::new(),
            });
        }

        // Populate called_from relationships
        for func in &mut functions {
            if let Some(callers) = all_calls.get(&func.start_offset) {
                func.called_from = callers.clone();
            }
        }

        Ok(functions)
    }

    pub fn find_xrefs(
        code: &[u8],
        target_address: u64,
        arch: Architecture,
    ) -> Result<Vec<u64>, String> {
        // Disassemble all code and find references to target
        let instructions = Self::disassemble(code, 0, arch, Syntax::Intel, 100000)?;

        let xrefs: Vec<u64> = instructions
            .iter()
            .filter(|i| {
                if let Some(target) = i.branch_target {
                    target == target_address
                } else {
                    false
                }
            })
            .map(|i| i.offset)
            .collect();

        Ok(xrefs)
    }
}

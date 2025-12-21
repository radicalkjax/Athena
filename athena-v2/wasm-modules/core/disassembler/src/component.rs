// Component Model implementation for athena:disassembler

wit_bindgen::generate!({
    world: "disassembler-component",
    path: "wit",
});

use crate::disasm::{Disassembler, Architecture, Syntax};

const VERSION: &str = "0.1.0";

struct Component;

impl exports::athena::disassembler::disassembler::Guest for Component {
    fn disassemble(
        code: Vec<u8>,
        offset: u64,
        options: exports::athena::disassembler::disassembler::DisasmOptions,
    ) -> Result<Vec<exports::athena::disassembler::disassembler::Instruction>, String> {
        let arch = convert_architecture_from_wit(options.arch);
        let syntax = convert_syntax_from_wit(options.syntax);

        let instructions = Disassembler::disassemble(
            &code,
            offset,
            arch,
            syntax,
            options.max_instructions,
        )?;

        Ok(instructions.into_iter().map(|instr| {
            convert_instruction_to_wit(instr)
        }).collect())
    }

    fn analyze_control_flow(
        code: Vec<u8>,
        entry_point: u64,
        arch: exports::athena::disassembler::disassembler::Architecture,
    ) -> Result<Vec<exports::athena::disassembler::disassembler::BasicBlock>, String> {
        let arch = convert_architecture_from_wit(arch);
        let blocks = Disassembler::analyze_control_flow(&code, entry_point, arch)?;

        Ok(blocks.into_iter().map(|block| {
            let instructions = block.instructions.into_iter().map(|instr| {
                convert_instruction_to_wit(instr)
            }).collect();

            exports::athena::disassembler::disassembler::BasicBlock {
                start_offset: block.start_offset,
                end_offset: block.end_offset,
                instructions,
                successors: block.successors,
                predecessors: block.predecessors,
            }
        }).collect())
    }

    fn find_functions(
        code: Vec<u8>,
        entry_points: Vec<u64>,
        arch: exports::athena::disassembler::disassembler::Architecture,
    ) -> Result<Vec<exports::athena::disassembler::disassembler::FunctionInfo>, String> {
        let arch = convert_architecture_from_wit(arch);
        let functions = Disassembler::find_functions(&code, &entry_points, arch)?;

        Ok(functions.into_iter().map(|func| {
            let basic_blocks = func.basic_blocks.into_iter().map(|block| {
                let instructions = block.instructions.into_iter().map(|instr| {
                    convert_instruction_to_wit(instr)
                }).collect();

                exports::athena::disassembler::disassembler::BasicBlock {
                    start_offset: block.start_offset,
                    end_offset: block.end_offset,
                    instructions,
                    successors: block.successors,
                    predecessors: block.predecessors,
                }
            }).collect();

            exports::athena::disassembler::disassembler::FunctionInfo {
                start_offset: func.start_offset,
                end_offset: func.end_offset,
                name: func.name,
                basic_blocks,
                calls_to: func.calls_to,
                called_from: func.called_from,
            }
        }).collect())
    }

    fn find_xrefs(
        code: Vec<u8>,
        target_address: u64,
        arch: exports::athena::disassembler::disassembler::Architecture,
    ) -> Result<Vec<u64>, String> {
        let arch = convert_architecture_from_wit(arch);
        Disassembler::find_xrefs(&code, target_address, arch)
    }

    fn get_version() -> String {
        VERSION.to_string()
    }
}

// Helper conversion functions

fn convert_architecture_from_wit(arch: exports::athena::disassembler::disassembler::Architecture) -> Architecture {
    use exports::athena::disassembler::disassembler::Architecture as WitArch;

    match arch {
        WitArch::X86 => Architecture::X8632,
        WitArch::X64 => Architecture::X8664,
        WitArch::Arm => Architecture::Arm,
        WitArch::Arm64 => Architecture::Arm64,
    }
}

fn convert_syntax_from_wit(syntax: exports::athena::disassembler::disassembler::Syntax) -> Syntax {
    use exports::athena::disassembler::disassembler::Syntax as WitSyntax;

    match syntax {
        WitSyntax::Intel => Syntax::Intel,
        WitSyntax::Att => Syntax::Att,
        WitSyntax::Masm => Syntax::Masm,
        WitSyntax::Nasm => Syntax::Nasm,
    }
}

fn convert_instruction_to_wit(
    instr: crate::disasm::DisassembledInstruction,
) -> exports::athena::disassembler::disassembler::Instruction {
    use exports::athena::disassembler::disassembler;

    let used_registers = instr.used_registers.into_iter().map(|reg| {
        disassembler::UsedRegister {
            register: reg.register,
            access: convert_register_access_to_wit(reg.access),
        }
    }).collect();

    let used_memory = instr.used_memory.into_iter().map(|mem| {
        disassembler::UsedMemory {
            segment: mem.segment,
            base: mem.base,
            index: mem.index,
            scale: mem.scale,
            displacement: mem.displacement,
            size: mem.size,
            access: convert_memory_access_to_wit(mem.access),
        }
    }).collect();

    let constant_offsets = disassembler::ConstantOffsets {
        has_displacement: instr.constant_offsets.has_displacement,
        displacement_offset: instr.constant_offsets.displacement_offset,
        displacement_size: instr.constant_offsets.displacement_size,
        has_immediate: instr.constant_offsets.has_immediate,
        immediate_offset: instr.constant_offsets.immediate_offset,
        immediate_size: instr.constant_offsets.immediate_size,
        has_immediate2: instr.constant_offsets.has_immediate2,
        immediate_offset2: instr.constant_offsets.immediate_offset2,
        immediate_size2: instr.constant_offsets.immediate_size2,
    };

    disassembler::Instruction {
        offset: instr.offset,
        bytes: instr.bytes,
        mnemonic: instr.mnemonic,
        operands: instr.operands,
        full_text: instr.full_text,
        is_branch: instr.is_branch,
        is_call: instr.is_call,
        is_return: instr.is_return,
        is_privileged: instr.is_privileged,
        branch_target: instr.branch_target,
        length: instr.length,
        used_registers,
        used_memory,
        memory_size: instr.memory_size,
        constant_offsets,
        cpuid_features: instr.cpuid_features,
        rflags_read: instr.rflags_read,
        rflags_written: instr.rflags_written,
        rflags_cleared: instr.rflags_cleared,
        rflags_set: instr.rflags_set,
        rflags_undefined: instr.rflags_undefined,
        rflags_modified: instr.rflags_modified,
        is_stack_instruction: instr.is_stack_instruction,
        stack_pointer_increment: instr.stack_pointer_increment,
        fpu_writes_top: instr.fpu_writes_top,
        fpu_increment: instr.fpu_increment,
        fpu_conditional: instr.fpu_conditional,
        condition_code: instr.condition_code,
        op_code_string: instr.op_code_string,
        instruction_string: instr.instruction_string,
        encoding: instr.encoding,
        op_count: instr.op_count,
        operand_kinds: instr.operand_kinds,
    }
}

fn convert_register_access_to_wit(
    access: crate::disasm::RegisterAccess,
) -> exports::athena::disassembler::disassembler::RegisterAccess {
    use exports::athena::disassembler::disassembler::RegisterAccess as WitAccess;

    match access {
        crate::disasm::RegisterAccess::None => WitAccess::None,
        crate::disasm::RegisterAccess::Read => WitAccess::Read,
        crate::disasm::RegisterAccess::Write => WitAccess::Write,
        crate::disasm::RegisterAccess::ReadWrite => WitAccess::ReadWrite,
        crate::disasm::RegisterAccess::CondRead => WitAccess::CondRead,
        crate::disasm::RegisterAccess::CondWrite => WitAccess::CondWrite,
    }
}

fn convert_memory_access_to_wit(
    access: crate::disasm::MemoryAccess,
) -> exports::athena::disassembler::disassembler::MemoryAccess {
    use exports::athena::disassembler::disassembler::MemoryAccess as WitAccess;

    match access {
        crate::disasm::MemoryAccess::None => WitAccess::None,
        crate::disasm::MemoryAccess::Read => WitAccess::Read,
        crate::disasm::MemoryAccess::Write => WitAccess::Write,
        crate::disasm::MemoryAccess::ReadWrite => WitAccess::ReadWrite,
        crate::disasm::MemoryAccess::CondRead => WitAccess::CondRead,
        crate::disasm::MemoryAccess::CondWrite => WitAccess::CondWrite,
    }
}

export!(Component);

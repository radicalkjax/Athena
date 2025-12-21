// Component Model implementation for athena:analysis-engine

wit_bindgen::generate!({
    world: "analysis-engine-component",
    path: "wit",
});

use crate::patterns::{PatternMatcher, PatternCategory, PatternSeverity};
use crate::deobfuscator::Deobfuscator;
use crate::disasm::{Disassembler, Architecture, Syntax};
use sha2::{Digest, Sha256};

const ENGINE_VERSION: &str = "0.1.0";

// ============================================================================
// Component struct - implements all interfaces
// ============================================================================

struct Component;

// ============================================================================
// Analyzer Interface Implementation
// ============================================================================

impl exports::athena::analysis_engine::analyzer::Guest for Component {
    fn analyze(content: Vec<u8>) -> Result<exports::athena::analysis_engine::analyzer::AnalysisResult, String> {
        // Security: Validate input size
        const MAX_INPUT_SIZE: usize = 100 * 1024 * 1024; // 100MB
        if content.len() > MAX_INPUT_SIZE {
            return Err(format!("Input too large: {} bytes exceeds maximum of {} bytes", content.len(), MAX_INPUT_SIZE));
        }

        let start_time = std::time::SystemTime::now();

        // Pattern matching
        let pattern_matcher = PatternMatcher::new();
        let pattern_matches = pattern_matcher.scan(&content);

        // Deobfuscation attempt
        let deobfuscator = Deobfuscator::new();
        let text_content = String::from_utf8_lossy(&content).into_owned();
        let deob_result = deobfuscator.deobfuscate(&text_content);
        let deobfuscation_result = if deob_result.confidence > 0.0 {
            Some(deob_result.deobfuscated)
        } else {
            None
        };

        // Calculate severity
        let severity = calculate_severity(&pattern_matches);

        // Build threat information
        let threats: Vec<exports::athena::analysis_engine::analyzer::ThreatInfo> = pattern_matches.iter().map(|m| {
            let confidence = match m.pattern.severity {
                PatternSeverity::Critical => 0.95,
                PatternSeverity::High => 0.85,
                PatternSeverity::Medium => 0.70,
                PatternSeverity::Low => 0.50,
            };

            exports::athena::analysis_engine::analyzer::ThreatInfo {
                threat_type: format!("{:?}", m.pattern.category),
                confidence,
                description: m.pattern.description.clone(),
                indicators: vec![m.pattern.name.clone()],
            }
        }).collect();

        // Calculate file hash
        let mut hasher = Sha256::new();
        hasher.update(&content);
        let file_hash = hex::encode(hasher.finalize());

        // Calculate analysis time
        let analysis_time_ms = start_time.elapsed()
            .map(|d| d.as_millis() as u32)
            .unwrap_or(0);

        Ok(exports::athena::analysis_engine::analyzer::AnalysisResult {
            severity,
            threats,
            deobfuscated_content: deobfuscation_result,
            metadata: exports::athena::analysis_engine::analyzer::AnalysisMetadata {
                file_hash,
                analysis_time_ms,
                engine_version: ENGINE_VERSION.to_string(),
            },
        })
    }

    fn get_version() -> String {
        ENGINE_VERSION.to_string()
    }
}

// ============================================================================
// Pattern Matcher Interface Implementation
// ============================================================================

impl exports::athena::analysis_engine::pattern_matcher::Guest for Component {
    fn scan(content: Vec<u8>) -> Vec<exports::athena::analysis_engine::pattern_matcher::PatternMatch> {
        let pattern_matcher = PatternMatcher::new();
        let matches = pattern_matcher.scan(&content);

        matches.into_iter().map(|m| {
            exports::athena::analysis_engine::pattern_matcher::PatternMatch {
                category: convert_category_to_wit(m.pattern.category),
                severity: convert_severity_to_wit(m.pattern.severity),
                name: m.pattern.name,
                description: m.pattern.description,
                offset: m.offset as u64,
                length: m.length as u64,
                matched_data: m.context,
            }
        }).collect()
    }
}

// ============================================================================
// Deobfuscator Interface Implementation
// ============================================================================

impl exports::athena::analysis_engine::deobfuscator::Guest for Component {
    fn deobfuscate(
        content: String,
        _options: Option<exports::athena::analysis_engine::deobfuscator::DeobfuscationOptions>,
    ) -> Result<exports::athena::analysis_engine::deobfuscator::DeobfuscationResult, String> {
        let deobfuscator = Deobfuscator::new();
        let result = deobfuscator.deobfuscate(&content);

        let techniques_applied: Vec<String> = result.techniques_found.iter()
            .map(|t| format!("{:?}", t))
            .collect();

        Ok(exports::athena::analysis_engine::deobfuscator::DeobfuscationResult {
            deobfuscated: result.deobfuscated,
            techniques_applied,
            confidence: result.confidence,
        })
    }

    fn is_obfuscated(content: String) -> bool {
        let deobfuscator = Deobfuscator::new();
        let result = deobfuscator.deobfuscate(&content);
        result.confidence > 0.3
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

fn calculate_severity(matches: &[crate::patterns::PatternMatch]) -> exports::athena::analysis_engine::analyzer::Severity {
    use exports::athena::analysis_engine::analyzer::Severity;

    if matches.is_empty() {
        return Severity::Low;
    }

    let has_critical = matches.iter().any(|m| matches!(m.pattern.severity, PatternSeverity::Critical));
    let has_high = matches.iter().any(|m| matches!(m.pattern.severity, PatternSeverity::High));
    let high_count = matches.iter().filter(|m| matches!(m.pattern.severity, PatternSeverity::High | PatternSeverity::Critical)).count();

    if has_critical || high_count >= 3 {
        Severity::Critical
    } else if has_high || high_count >= 1 {
        Severity::High
    } else if matches.len() >= 3 {
        Severity::Medium
    } else {
        Severity::Low
    }
}

fn convert_category_to_wit(category: PatternCategory) -> exports::athena::analysis_engine::pattern_matcher::PatternCategory {
    use exports::athena::analysis_engine::pattern_matcher::PatternCategory as WitCategory;

    match category {
        PatternCategory::Obfuscation => WitCategory::Obfuscation,
        PatternCategory::Exploit => WitCategory::Exploit,
        PatternCategory::Backdoor => WitCategory::Persistence,
        PatternCategory::Dropper => WitCategory::Evasion,
        PatternCategory::Trojan => WitCategory::SuspiciousApi,
        PatternCategory::Ransomware => WitCategory::DataExfiltration,
        PatternCategory::CryptoMiner => WitCategory::SuspiciousApi,
        PatternCategory::Phishing => WitCategory::CredentialTheft,
    }
}

fn convert_severity_to_wit(severity: PatternSeverity) -> exports::athena::analysis_engine::pattern_matcher::PatternSeverity {
    use exports::athena::analysis_engine::pattern_matcher::PatternSeverity as WitSeverity;

    match severity {
        PatternSeverity::Low => WitSeverity::Low,
        PatternSeverity::Medium => WitSeverity::Medium,
        PatternSeverity::High => WitSeverity::High,
        PatternSeverity::Critical => WitSeverity::Critical,
    }
}

// ============================================================================
// Disassembler Interface Implementation
// ============================================================================

impl exports::athena::analysis_engine::disassembler::Guest for Component {
    fn disassemble(
        code: Vec<u8>,
        offset: u64,
        options: exports::athena::analysis_engine::disassembler::DisasmOptions,
    ) -> Result<Vec<exports::athena::analysis_engine::disassembler::Instruction>, String> {
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
        arch: exports::athena::analysis_engine::disassembler::Architecture,
    ) -> Result<Vec<exports::athena::analysis_engine::disassembler::BasicBlock>, String> {
        let arch = convert_architecture_from_wit(arch);
        let blocks = Disassembler::analyze_control_flow(&code, entry_point, arch)?;

        Ok(blocks.into_iter().map(|block| {
            let instructions = block.instructions.into_iter().map(|instr| {
                convert_instruction_to_wit(instr)
            }).collect();

            exports::athena::analysis_engine::disassembler::BasicBlock {
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
        arch: exports::athena::analysis_engine::disassembler::Architecture,
    ) -> Result<Vec<exports::athena::analysis_engine::disassembler::FunctionInfo>, String> {
        let arch = convert_architecture_from_wit(arch);
        let functions = Disassembler::find_functions(&code, &entry_points, arch)?;

        Ok(functions.into_iter().map(|func| {
            let basic_blocks = func.basic_blocks.into_iter().map(|block| {
                let instructions = block.instructions.into_iter().map(|instr| {
                    convert_instruction_to_wit(instr)
                }).collect();

                exports::athena::analysis_engine::disassembler::BasicBlock {
                    start_offset: block.start_offset,
                    end_offset: block.end_offset,
                    instructions,
                    successors: block.successors,
                    predecessors: block.predecessors,
                }
            }).collect();

            exports::athena::analysis_engine::disassembler::FunctionInfo {
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
        arch: exports::athena::analysis_engine::disassembler::Architecture,
    ) -> Result<Vec<u64>, String> {
        let arch = convert_architecture_from_wit(arch);
        Disassembler::find_xrefs(&code, target_address, arch)
    }
}

// ============================================================================
// Disassembler Helper Functions
// ============================================================================

fn convert_architecture_from_wit(arch: exports::athena::analysis_engine::disassembler::Architecture) -> Architecture {
    use exports::athena::analysis_engine::disassembler::Architecture as WitArch;

    match arch {
        WitArch::X86 => Architecture::X8632,
        WitArch::X64 => Architecture::X8664,
        WitArch::Arm => Architecture::Arm,
        WitArch::Arm64 => Architecture::Arm64,
    }
}

fn convert_syntax_from_wit(syntax: exports::athena::analysis_engine::disassembler::Syntax) -> Syntax {
    use exports::athena::analysis_engine::disassembler::Syntax as WitSyntax;

    match syntax {
        WitSyntax::Intel => Syntax::Intel,
        WitSyntax::Att => Syntax::Att,
        WitSyntax::Masm => Syntax::Masm,
        WitSyntax::Nasm => Syntax::Nasm,
    }
}

// ============================================================================
// Instruction Conversion Functions
// ============================================================================

fn convert_instruction_to_wit(
    instr: crate::disasm::DisassembledInstruction,
) -> exports::athena::analysis_engine::disassembler::Instruction {
    use exports::athena::analysis_engine::disassembler;

    // Convert register usage
    let used_registers = instr.used_registers.into_iter().map(|reg| {
        disassembler::UsedRegister {
            register: reg.register,
            access: convert_register_access_to_wit(reg.access),
        }
    }).collect();

    // Convert memory usage
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

    // Convert constant offsets
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
) -> exports::athena::analysis_engine::disassembler::RegisterAccess {
    use exports::athena::analysis_engine::disassembler::RegisterAccess as WitAccess;

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
) -> exports::athena::analysis_engine::disassembler::MemoryAccess {
    use exports::athena::analysis_engine::disassembler::MemoryAccess as WitAccess;

    match access {
        crate::disasm::MemoryAccess::None => WitAccess::None,
        crate::disasm::MemoryAccess::Read => WitAccess::Read,
        crate::disasm::MemoryAccess::Write => WitAccess::Write,
        crate::disasm::MemoryAccess::ReadWrite => WitAccess::ReadWrite,
        crate::disasm::MemoryAccess::CondRead => WitAccess::CondRead,
        crate::disasm::MemoryAccess::CondWrite => WitAccess::CondWrite,
    }
}

// ============================================================================
// Export Component Implementations
// ============================================================================

export!(Component);

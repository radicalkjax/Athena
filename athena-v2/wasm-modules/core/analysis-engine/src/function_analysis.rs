/// Function Analysis and Parameter Recovery
/// Analyzes calling conventions and control flow to identify function signatures
///
/// Supports:
/// - x64 Windows calling convention (fastcall)
/// - x64 System V ABI (Linux/macOS)
/// - x86 cdecl, stdcall, fastcall
/// - Stack frame analysis
/// - Return value detection

use std::collections::{HashMap, HashSet};
use crate::decompiler::{IRStmt, IRValue, IRVar};
use crate::type_inference::{TypeInference, InferredType};

#[derive(Clone, Debug)]
pub struct FunctionSignature {
    pub name: String,
    pub address: u64,
    pub parameters: Vec<Parameter>,
    pub return_type: InferredType,
    pub calling_convention: CallingConvention,
    pub stack_frame_size: u32,
    pub is_variadic: bool,
}

#[derive(Clone, Debug)]
pub struct Parameter {
    pub name: String,
    pub param_type: InferredType,
    pub location: ParameterLocation,
    pub index: usize,
}

#[derive(Clone, Debug, PartialEq)]
pub enum ParameterLocation {
    Register(String),
    Stack(i32),  // Offset from stack pointer
    Mixed(String, i32),  // Passed in register, spilled to stack
}

#[derive(Clone, Debug, PartialEq)]
pub enum CallingConvention {
    /// Windows x64: rcx, rdx, r8, r9, then stack
    WindowsFastcall,
    /// System V x64 (Linux/macOS): rdi, rsi, rdx, rcx, r8, r9, then stack
    SystemVAmd64,
    /// x86 cdecl: all stack, caller cleans up
    Cdecl,
    /// x86 stdcall: all stack, callee cleans up
    Stdcall,
    /// x86 fastcall: ecx, edx, then stack
    X86Fastcall,
    /// Unknown/custom
    Unknown,
}

pub struct FunctionAnalyzer {
    /// Detected function signatures
    signatures: HashMap<u64, FunctionSignature>,
    /// Type inference engine
    type_inference: TypeInference,
}

impl FunctionAnalyzer {
    pub fn new() -> Self {
        Self {
            signatures: HashMap::new(),
            type_inference: TypeInference::new(),
        }
    }

    /// Analyze a function and recover its signature
    pub fn analyze_function(
        &mut self,
        address: u64,
        name: String,
        statements: &[IRStmt],
        architecture: Architecture,
    ) -> Result<FunctionSignature, String> {
        // Infer types first
        self.type_inference.infer_types(statements);

        // Detect calling convention
        let calling_convention = self.detect_calling_convention(statements, architecture);

        // Find parameters based on calling convention
        let parameters = self.recover_parameters(statements, &calling_convention)?;

        // Detect return type
        let return_type = self.detect_return_type(statements);

        // Calculate stack frame size
        let stack_frame_size = self.calculate_stack_frame_size(statements);

        // Check if variadic (uses va_start, va_arg, etc.)
        let is_variadic = self.is_variadic_function(statements);

        let signature = FunctionSignature {
            name,
            address,
            parameters,
            return_type,
            calling_convention,
            stack_frame_size,
            is_variadic,
        };

        self.signatures.insert(address, signature.clone());
        Ok(signature)
    }

    fn detect_calling_convention(
        &self,
        statements: &[IRStmt],
        architecture: Architecture,
    ) -> CallingConvention {
        match architecture {
            Architecture::X8664 => {
                // Check which registers are used for parameters
                let used_regs = self.find_parameter_registers(statements);

                // Windows x64: rcx, rdx, r8, r9
                if used_regs.contains("rcx") || used_regs.contains("r8") || used_regs.contains("r9") {
                    CallingConvention::WindowsFastcall
                }
                // System V: rdi, rsi, rdx, rcx, r8, r9
                else if used_regs.contains("rdi") || used_regs.contains("rsi") {
                    CallingConvention::SystemVAmd64
                } else {
                    CallingConvention::Unknown
                }
            }
            Architecture::X86 => {
                // Check for stack parameters vs register parameters
                let stack_params = self.count_stack_parameters(statements);
                let reg_params = self.find_parameter_registers(statements);

                if reg_params.contains("ecx") || reg_params.contains("edx") {
                    CallingConvention::X86Fastcall
                } else if stack_params > 0 {
                    // Distinguish cdecl vs stdcall based on cleanup
                    // For now, default to cdecl
                    CallingConvention::Cdecl
                } else {
                    CallingConvention::Unknown
                }
            }
            _ => CallingConvention::Unknown,
        }
    }

    fn find_parameter_registers(&self, statements: &[IRStmt]) -> HashSet<String> {
        let mut used_regs = HashSet::new();

        // Look at the first few statements to find which registers are read
        // before being written (these are parameters)
        let mut written_regs = HashSet::new();

        for stmt in statements.iter().take(20) {
            match stmt {
                IRStmt::Assign { dest, value } => {
                    // Check if value reads registers not yet written
                    self.collect_read_registers(value, &written_regs, &mut used_regs);
                    written_regs.insert(dest.name.clone());
                }
                IRStmt::Store { address, value, .. } => {
                    self.collect_read_registers(address, &written_regs, &mut used_regs);
                    self.collect_read_registers(value, &written_regs, &mut used_regs);
                }
                IRStmt::Call { args, .. } => {
                    for arg in args {
                        self.collect_read_registers(arg, &written_regs, &mut used_regs);
                    }
                }
                _ => {}
            }
        }

        used_regs
    }

    fn collect_read_registers(
        &self,
        value: &IRValue,
        written_regs: &HashSet<String>,
        used_regs: &mut HashSet<String>,
    ) {
        match value {
            IRValue::Var(v) => {
                if !written_regs.contains(&v.name) && self.is_register(&v.name) {
                    used_regs.insert(v.name.clone());
                }
            }
            IRValue::Expr(expr) => {
                for operand in &expr.operands {
                    self.collect_read_registers(operand, written_regs, used_regs);
                }
            }
            _ => {}
        }
    }

    fn is_register(&self, name: &str) -> bool {
        matches!(
            name,
            // x64 registers
            "rax" | "rbx" | "rcx" | "rdx" | "rsi" | "rdi" | "rbp" | "rsp" |
            "r8" | "r9" | "r10" | "r11" | "r12" | "r13" | "r14" | "r15" |
            // x86 registers
            "eax" | "ebx" | "ecx" | "edx" | "esi" | "edi" | "ebp" | "esp"
        )
    }

    fn recover_parameters(
        &self,
        statements: &[IRStmt],
        calling_convention: &CallingConvention,
    ) -> Result<Vec<Parameter>, String> {
        let mut parameters = Vec::new();

        match calling_convention {
            CallingConvention::WindowsFastcall => {
                // Windows x64: rcx, rdx, r8, r9, then stack
                let param_regs = vec!["rcx", "rdx", "r8", "r9"];
                for (i, reg) in param_regs.iter().enumerate() {
                    if self.is_register_used_as_param(statements, reg) {
                        let param_type = self.type_inference.get_type(reg)
                            .cloned()
                            .unwrap_or(InferredType::Unknown);

                        parameters.push(Parameter {
                            name: format!("param_{}", i + 1),
                            param_type,
                            location: ParameterLocation::Register(reg.to_string()),
                            index: i,
                        });
                    }
                }

                // TODO: Add stack parameters
            }
            CallingConvention::SystemVAmd64 => {
                // System V x64: rdi, rsi, rdx, rcx, r8, r9, then stack
                let param_regs = vec!["rdi", "rsi", "rdx", "rcx", "r8", "r9"];
                for (i, reg) in param_regs.iter().enumerate() {
                    if self.is_register_used_as_param(statements, reg) {
                        let param_type = self.type_inference.get_type(reg)
                            .cloned()
                            .unwrap_or(InferredType::Unknown);

                        parameters.push(Parameter {
                            name: format!("param_{}", i + 1),
                            param_type,
                            location: ParameterLocation::Register(reg.to_string()),
                            index: i,
                        });
                    }
                }

                // TODO: Add stack parameters
            }
            CallingConvention::X86Fastcall => {
                // x86 fastcall: ecx, edx, then stack
                let param_regs = vec!["ecx", "edx"];
                for (i, reg) in param_regs.iter().enumerate() {
                    if self.is_register_used_as_param(statements, reg) {
                        let param_type = self.type_inference.get_type(reg)
                            .cloned()
                            .unwrap_or(InferredType::Unknown);

                        parameters.push(Parameter {
                            name: format!("param_{}", i + 1),
                            param_type,
                            location: ParameterLocation::Register(reg.to_string()),
                            index: i,
                        });
                    }
                }
            }
            CallingConvention::Cdecl | CallingConvention::Stdcall => {
                // All parameters on stack
                let stack_param_count = self.count_stack_parameters(statements);
                for i in 0..stack_param_count {
                    let offset = 4 + (i as i32 * 4); // 4 bytes after return address
                    parameters.push(Parameter {
                        name: format!("param_{}", i + 1),
                        param_type: InferredType::Unknown,
                        location: ParameterLocation::Stack(offset),
                        index: i,
                    });
                }
            }
            CallingConvention::Unknown => {
                // Try to detect from usage
                let used_regs = self.find_parameter_registers(statements);
                for (i, reg) in used_regs.iter().enumerate() {
                    let param_type = self.type_inference.get_type(reg)
                        .cloned()
                        .unwrap_or(InferredType::Unknown);

                    parameters.push(Parameter {
                        name: format!("param_{}", i + 1),
                        param_type,
                        location: ParameterLocation::Register(reg.clone()),
                        index: i,
                    });
                }
            }
        }

        Ok(parameters)
    }

    fn is_register_used_as_param(&self, statements: &[IRStmt], reg: &str) -> bool {
        let mut written = false;

        // Check if register is read before being written
        for stmt in statements.iter().take(20) {
            match stmt {
                IRStmt::Assign { dest, value } => {
                    if self.value_uses_register(value, reg) && !written {
                        return true;
                    }
                    if dest.name == reg {
                        written = true;
                    }
                }
                IRStmt::Store { address, value, .. } => {
                    if (self.value_uses_register(address, reg) || self.value_uses_register(value, reg))
                        && !written
                    {
                        return true;
                    }
                }
                _ => {}
            }
        }

        false
    }

    fn value_uses_register(&self, value: &IRValue, reg: &str) -> bool {
        match value {
            IRValue::Var(v) => v.name == reg,
            IRValue::Expr(expr) => expr.operands.iter().any(|op| self.value_uses_register(op, reg)),
            _ => false,
        }
    }

    fn count_stack_parameters(&self, statements: &[IRStmt]) -> usize {
        let mut max_offset = 0;

        for stmt in statements.iter().take(20) {
            if let IRStmt::Assign { value, .. } = stmt {
                if let IRValue::Expr(expr) = value {
                    // Look for [ebp+offset] or [rsp+offset] patterns
                    if expr.operands.len() == 2 {
                        if let (IRValue::Var(v), IRValue::Const(offset)) =
                            (&expr.operands[0], &expr.operands[1])
                        {
                            if (v.name == "ebp" || v.name == "rbp") && *offset > 0 {
                                max_offset = max_offset.max(*offset);
                            }
                        }
                    }
                }
            }
        }

        (max_offset / 4) as usize // Assume 4-byte parameters
    }

    fn detect_return_type(&self, statements: &[IRStmt]) -> InferredType {
        // Look for return statements
        for stmt in statements.iter().rev().take(10) {
            if let IRStmt::Return { value } = stmt {
                if let Some(val) = value {
                    if let IRValue::Var(v) = val {
                        // Check if it's rax/eax (common return registers)
                        if v.name == "rax" || v.name == "eax" {
                            return self.type_inference.get_type(&v.name)
                                .cloned()
                                .unwrap_or(InferredType::Integer(crate::type_inference::IntegerType::I32));
                        }
                    }
                }
            }
        }

        InferredType::Void
    }

    fn calculate_stack_frame_size(&self, statements: &[IRStmt]) -> u32 {
        let mut max_stack_usage = 0u32;

        // Look for stack pointer adjustments
        for stmt in statements {
            if let IRStmt::Assign { dest, value } = stmt {
                if dest.name == "rsp" || dest.name == "esp" {
                    if let IRValue::Expr(expr) = value {
                        // Look for sub rsp, immediate
                        if expr.operands.len() == 2 {
                            if let IRValue::Const(size) = &expr.operands[1] {
                                max_stack_usage = max_stack_usage.max(size.abs() as u32);
                            }
                        }
                    }
                }
            }
        }

        max_stack_usage
    }

    fn is_variadic_function(&self, statements: &[IRStmt]) -> bool {
        // Look for va_start, va_arg, va_end usage
        // These typically manifest as specific instruction patterns
        for stmt in statements {
            if let IRStmt::Call { target, .. } = stmt {
                if let IRValue::Var(v) = target {
                    if v.name.contains("va_start") || v.name.contains("va_arg") {
                        return true;
                    }
                }
            }
        }
        false
    }

    pub fn get_signature(&self, address: u64) -> Option<&FunctionSignature> {
        self.signatures.get(&address)
    }

    pub fn format_signature(&self, sig: &FunctionSignature) -> String {
        let return_type = self.type_inference.format_type(&sig.return_type);

        let params: Vec<String> = sig.parameters.iter()
            .map(|p| {
                let type_str = self.type_inference.format_type(&p.param_type);
                format!("{} {}", type_str, p.name)
            })
            .collect();

        let params_str = if sig.is_variadic {
            format!("{}, ...", params.join(", "))
        } else {
            params.join(", ")
        };

        format!("{} {}({})", return_type, sig.name, params_str)
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Architecture {
    X86,
    X8664,
    ARM,
    ARM64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_windows_fastcall_detection() {
        let analyzer = FunctionAnalyzer::new();
        let statements = vec![];

        let convention = analyzer.detect_calling_convention(&statements, Architecture::X8664);
        // Would need actual statements to properly test
        assert!(matches!(convention, CallingConvention::Unknown));
    }

    #[test]
    fn test_is_register() {
        let analyzer = FunctionAnalyzer::new();
        assert!(analyzer.is_register("rax"));
        assert!(analyzer.is_register("rcx"));
        assert!(analyzer.is_register("eax"));
        assert!(!analyzer.is_register("var_1"));
    }
}

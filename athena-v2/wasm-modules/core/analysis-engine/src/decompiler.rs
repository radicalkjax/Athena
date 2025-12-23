/// Simplified Decompiler for Athena
/// Converts assembly instructions to C-like pseudocode
///
/// Architecture inspired by Ghidra's P-code approach but simplified:
/// 1. Assembly → IR (Intermediate Representation)
/// 2. SSA construction & data-flow analysis
/// 3. Expression simplification
/// 4. Control structure recovery
/// 5. C pseudocode generation

use std::collections::{HashMap, HashSet};
use crate::disasm::{DisassembledInstruction, BasicBlock};
use crate::function_analysis::CallingConvention;

/// Intermediate Representation Operation
#[derive(Clone, Debug)]
pub enum IROp {
    // Arithmetic
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Neg,

    // Bitwise
    And,
    Or,
    Xor,
    Not,
    Shl,  // Shift left
    Shr,  // Shift right logical
    Sar,  // Shift right arithmetic

    // Comparison
    Eq,   // Equal
    Ne,   // Not equal
    Lt,   // Less than
    Le,   // Less than or equal
    Gt,   // Greater than
    Ge,   // Greater than or equal

    // Memory
    Load,
    Store,

    // Control flow
    Branch,          // Unconditional
    BranchCond,      // Conditional
    Call,
    Return,

    // Data movement
    Move,
    Phi,    // SSA phi node

    // Special
    Nop,
}

/// Variable in IR (like Ghidra's Varnode)
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct IRVar {
    pub name: String,
    pub size: u32,      // Size in bytes
    pub version: u32,   // SSA version
    pub is_temp: bool,  // Temporary variable
}

impl IRVar {
    pub fn new(name: String, size: u32) -> Self {
        Self {
            name,
            size,
            version: 0,
            is_temp: false,
        }
    }

    pub fn temp(id: u32, size: u32) -> Self {
        Self {
            name: format!("t{}", id),
            size,
            version: 0,
            is_temp: true,
        }
    }

    pub fn with_version(&self, version: u32) -> Self {
        let mut v = self.clone();
        v.version = version;
        v
    }
}

/// IR Value (variable, constant, or expression)
#[derive(Clone, Debug)]
pub enum IRValue {
    Var(IRVar),
    Const(i64),
    Expr(Box<IRExpr>),
}

/// IR Expression
#[derive(Clone, Debug)]
pub struct IRExpr {
    pub op: IROp,
    pub operands: Vec<IRValue>,
    pub size: u32,  // Result size in bytes
}

impl IRExpr {
    pub fn binary(op: IROp, left: IRValue, right: IRValue, size: u32) -> Self {
        Self {
            op,
            operands: vec![left, right],
            size,
        }
    }

    pub fn unary(op: IROp, operand: IRValue, size: u32) -> Self {
        Self {
            op,
            operands: vec![operand],
            size,
        }
    }
}

/// IR Statement
#[derive(Clone, Debug)]
pub enum IRStmt {
    Assign {
        dest: IRVar,
        value: IRValue,
    },
    Store {
        address: IRValue,
        value: IRValue,
        size: u32,
    },
    Branch {
        target: u64,
    },
    BranchCond {
        condition: IRValue,
        true_target: u64,
        false_target: u64,
    },
    Call {
        target: IRValue,
        args: Vec<IRValue>,
        result: Option<IRVar>,
    },
    Return {
        value: Option<IRValue>,
    },
}

/// IR Basic Block
#[derive(Clone, Debug)]
pub struct IRBlock {
    pub address: u64,
    pub statements: Vec<IRStmt>,
    pub successors: Vec<u64>,
    pub predecessors: Vec<u64>,
}

/// High-level statement for C output
#[derive(Clone, Debug)]
pub enum CStatement {
    Assignment {
        var: String,
        expr: String,
    },
    If {
        condition: String,
        then_block: Vec<CStatement>,
        else_block: Option<Vec<CStatement>>,
    },
    While {
        condition: String,
        body: Vec<CStatement>,
    },
    DoWhile {
        body: Vec<CStatement>,
        condition: String,
    },
    Return {
        expr: Option<String>,
    },
    Call {
        function: String,
        args: Vec<String>,
        result_var: Option<String>,
    },
    Comment {
        text: String,
    },
}

/// Maximum number of basic blocks to prevent excessive memory usage
const MAX_BASIC_BLOCKS: usize = 100000;

/// Maximum total instructions across all blocks
const MAX_TOTAL_INSTRUCTIONS: usize = 1000000;

/// Decompiler
pub struct Decompiler {
    temp_counter: u32,
    var_versions: HashMap<String, u32>,
}

impl Decompiler {
    pub fn new() -> Self {
        Self {
            temp_counter: 0,
            var_versions: HashMap::new(),
        }
    }

    /// Main decompilation entry point
    pub fn decompile(&mut self, blocks: &[BasicBlock]) -> Result<String, String> {
        if blocks.is_empty() {
            return Ok("// No code to decompile".to_string());
        }

        // Security: Validate input size to prevent excessive memory usage
        if blocks.len() > MAX_BASIC_BLOCKS {
            return Err(format!(
                "Too many basic blocks for decompilation: {} (max: {})",
                blocks.len(),
                MAX_BASIC_BLOCKS
            ));
        }

        // Count total instructions across all blocks
        let total_instructions: usize = blocks.iter()
            .map(|b| b.instructions.len())
            .sum();

        if total_instructions > MAX_TOTAL_INSTRUCTIONS {
            return Err(format!(
                "Too many instructions for decompilation: {} (max: {})",
                total_instructions,
                MAX_TOTAL_INSTRUCTIONS
            ));
        }

        // Step 1: Convert assembly to IR
        let ir_blocks = self.convert_to_ir(blocks)?;

        // Step 2: Build SSA form (simplified)
        // TODO: Full SSA with phi nodes

        // Step 3: Simplify expressions
        let simplified_blocks = self.simplify_ir(ir_blocks)?;

        // Step 4: Recover control structures
        let statements = self.recover_control_structures(&simplified_blocks)?;

        // Step 5: Generate C pseudocode
        let code = self.generate_c_code(&statements);

        Ok(code)
    }

    /// Convert assembly basic blocks to IR
    fn convert_to_ir(&mut self, blocks: &[BasicBlock]) -> Result<Vec<IRBlock>, String> {
        let mut ir_blocks = Vec::new();

        for block in blocks {
            let mut statements = Vec::new();

            for instr in &block.instructions {
                // Convert individual instruction to IR
                let ir_stmts = self.instruction_to_ir(instr)?;
                statements.extend(ir_stmts);
            }

            ir_blocks.push(IRBlock {
                address: block.start_offset,
                statements,
                successors: block.successors.clone(),
                predecessors: block.predecessors.clone(),
            });
        }

        Ok(ir_blocks)
    }

    /// Convert single assembly instruction to IR statements
    fn instruction_to_ir(&mut self, instr: &DisassembledInstruction) -> Result<Vec<IRStmt>, String> {
        let mut stmts = Vec::new();
        let mnemonic = instr.mnemonic.to_lowercase();

        // Comprehensive x86/x64 instruction mapping
        match mnemonic.as_str() {
            // Data movement
            m if m.starts_with("mov") => {
                stmts.push(self.create_move_stmt(&instr.operands)?);
            }
            m if m.starts_with("lea") => {
                // Load Effective Address
                stmts.push(self.create_lea_stmt(&instr.operands)?);
            }
            m if m.starts_with("push") => {
                stmts.push(self.create_push_stmt(&instr.operands)?);
            }
            m if m.starts_with("pop") => {
                stmts.push(self.create_pop_stmt(&instr.operands)?);
            }
            m if m.starts_with("xchg") => {
                stmts.extend(self.create_exchange_stmt(&instr.operands)?);
            }

            // Arithmetic
            m if m.starts_with("add") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Add)?);
            }
            m if m.starts_with("sub") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Sub)?);
            }
            m if m.starts_with("imul") || m.starts_with("mul") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Mul)?);
            }
            m if m.starts_with("idiv") || m.starts_with("div") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Div)?);
            }
            m if m.starts_with("inc") => {
                stmts.push(self.create_unary_inc_stmt(&instr.operands)?);
            }
            m if m.starts_with("dec") => {
                stmts.push(self.create_unary_dec_stmt(&instr.operands)?);
            }
            m if m.starts_with("neg") => {
                stmts.push(self.create_unary_op_stmt(&instr.operands, IROp::Neg)?);
            }

            // Bitwise operations
            m if m.starts_with("and") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::And)?);
            }
            m if m.starts_with("or") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Or)?);
            }
            m if m.starts_with("xor") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Xor)?);
            }
            m if m.starts_with("not") => {
                stmts.push(self.create_unary_op_stmt(&instr.operands, IROp::Not)?);
            }
            m if m.starts_with("shl") || m.starts_with("sal") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Shl)?);
            }
            m if m.starts_with("shr") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Shr)?);
            }
            m if m.starts_with("sar") => {
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Sar)?);
            }
            m if m.starts_with("rol") || m.starts_with("ror") => {
                // Rotate operations - treat as shift for now
                stmts.push(self.create_binary_op_stmt(&instr.operands, IROp::Shl)?);
            }

            // Comparison and test
            m if m.starts_with("cmp") => {
                stmts.push(self.create_compare_stmt(&instr.operands)?);
            }
            m if m.starts_with("test") => {
                stmts.push(self.create_test_stmt(&instr.operands)?);
            }

            // Control flow
            m if m.starts_with("call") => {
                stmts.push(self.create_call_stmt(instr)?);
            }
            m if m.starts_with("ret") => {
                stmts.push(self.create_return_stmt(&instr.operands)?);
            }
            m if m.starts_with("j") => {
                // Jump instructions
                if let Some(target) = instr.branch_target {
                    if mnemonic == "jmp" {
                        stmts.push(IRStmt::Branch { target });
                    } else {
                        // Conditional jump
                        stmts.push(self.create_conditional_branch(instr, target)?);
                    }
                }
            }

            // String operations
            m if m.starts_with("movs") || m.starts_with("stos") ||
                 m.starts_with("lods") || m.starts_with("scas") || m.starts_with("cmps") => {
                // String operations - simplified
                stmts.push(self.create_string_op_comment(m)?);
            }

            // Zero/Sign extension
            m if m.starts_with("movzx") => {
                stmts.push(self.create_move_stmt(&instr.operands)?);
            }
            m if m.starts_with("movsx") || m.starts_with("movsxd") => {
                stmts.push(self.create_move_stmt(&instr.operands)?);
            }

            // Conditional move
            m if m.starts_with("cmov") => {
                stmts.push(self.create_conditional_move_stmt(&instr.operands, m)?);
            }

            // Set on condition
            m if m.starts_with("set") => {
                stmts.push(self.create_setcc_stmt(&instr.operands, m)?);
            }

            // No operation
            "nop" | "fnop" => {
                // Skip nop
            }

            // Leave (function epilogue)
            "leave" => {
                // mov rsp, rbp; pop rbp
                stmts.push(self.create_leave_stmt()?);
            }

            // CDQ/CQO (sign extension)
            "cdq" | "cqo" | "cwd" => {
                stmts.push(self.create_sign_extend_stmt()?);
            }

            _ => {
                // Unknown instruction - add as comment
                stmts.push(self.create_unknown_instr_comment(&instr.full_text)?);
            }
        }

        Ok(stmts)
    }

    fn create_move_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        // Parse "dest, src"
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Err(format!("Invalid move operands: {}", operands));
        }

        let dest = IRVar::new(parts[0].to_string(), 8); // Assume 8 bytes for now
        let src = self.parse_value(parts[1])?;

        Ok(IRStmt::Assign { dest, value: src })
    }

    fn create_binary_op_stmt(&mut self, operands: &str, op: IROp) -> Result<IRStmt, String> {
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Err(format!("Invalid binary op operands: {}", operands));
        }

        let dest = IRVar::new(parts[0].to_string(), 8);
        let left = IRValue::Var(dest.clone());
        let right = self.parse_value(parts[1])?;

        let expr = IRExpr::binary(op, left, right, 8);

        Ok(IRStmt::Assign {
            dest,
            value: IRValue::Expr(Box::new(expr)),
        })
    }

    fn create_call_stmt(&mut self, instr: &DisassembledInstruction) -> Result<IRStmt, String> {
        let target = if let Some(addr) = instr.branch_target {
            IRValue::Const(addr as i64)
        } else {
            // Indirect call - parse from operands
            self.parse_value(&instr.operands)?
        };

        // Parse arguments based on detected calling convention
        let args = self.parse_call_arguments(instr)?;

        // Determine return value register (typically rax/eax)
        let result = self.determine_return_register();

        Ok(IRStmt::Call {
            target,
            args,
            result: Some(result),
        })
    }

    /// Parse function call arguments based on calling convention
    fn parse_call_arguments(&mut self, _instr: &DisassembledInstruction) -> Result<Vec<IRValue>, String> {
        // Detect architecture from register names that might be used
        let calling_convention = self.detect_calling_convention();

        let mut args = Vec::new();

        match calling_convention {
            CallingConvention::WindowsFastcall => {
                // Windows x64: rcx, rdx, r8, r9, then stack (right-to-left)
                // We add the register parameters
                args.push(IRValue::Var(IRVar::new("rcx".to_string(), 8)));
                args.push(IRValue::Var(IRVar::new("rdx".to_string(), 8)));
                args.push(IRValue::Var(IRVar::new("r8".to_string(), 8)));
                args.push(IRValue::Var(IRVar::new("r9".to_string(), 8)));
            }
            CallingConvention::SystemVAmd64 => {
                // System V AMD64 (Linux/macOS): rdi, rsi, rdx, rcx, r8, r9, then stack
                args.push(IRValue::Var(IRVar::new("rdi".to_string(), 8)));
                args.push(IRValue::Var(IRVar::new("rsi".to_string(), 8)));
                args.push(IRValue::Var(IRVar::new("rdx".to_string(), 8)));
                args.push(IRValue::Var(IRVar::new("rcx".to_string(), 8)));
                args.push(IRValue::Var(IRVar::new("r8".to_string(), 8)));
                args.push(IRValue::Var(IRVar::new("r9".to_string(), 8)));
            }
            CallingConvention::X86Fastcall => {
                // x86 fastcall: ecx, edx, then stack
                args.push(IRValue::Var(IRVar::new("ecx".to_string(), 4)));
                args.push(IRValue::Var(IRVar::new("edx".to_string(), 4)));
            }
            CallingConvention::Cdecl | CallingConvention::Stdcall => {
                // x86 cdecl/stdcall: all arguments on stack
                // Stack args would need more context to parse accurately
                // For now, we leave args empty and add a comment about stack args
            }
            CallingConvention::Unknown => {
                // Unknown convention - leave args empty
            }
        }

        Ok(args)
    }

    /// Determine the return value register based on calling convention
    fn determine_return_register(&self) -> IRVar {
        // Detect architecture from context
        let calling_convention = self.detect_calling_convention();

        match calling_convention {
            CallingConvention::WindowsFastcall | CallingConvention::SystemVAmd64 => {
                // x64: return value in rax
                IRVar::new("rax".to_string(), 8)
            }
            CallingConvention::X86Fastcall | CallingConvention::Cdecl | CallingConvention::Stdcall => {
                // x86: return value in eax
                IRVar::new("eax".to_string(), 4)
            }
            CallingConvention::Unknown => {
                // Default to rax for unknown
                IRVar::new("rax".to_string(), 8)
            }
        }
    }

    /// Detect calling convention from context
    /// This is a simplified heuristic - in a full implementation, we'd track
    /// this from the binary metadata or function prologue analysis
    fn detect_calling_convention(&self) -> CallingConvention {
        // Heuristic: Check if we've seen any x64 or x86 registers in var_versions
        let has_x64_regs = self.var_versions.keys().any(|k| {
            k.starts_with('r') && (k.len() == 3 || k == "rax" || k == "rbx" || k == "rcx" || k == "rdx")
        });

        let has_x86_regs = self.var_versions.keys().any(|k| {
            k.starts_with('e') && k.len() == 3
        });

        // Check for System V specific registers (rdi, rsi)
        let has_sysv_regs = self.var_versions.keys().any(|k| {
            k == "rdi" || k == "rsi"
        });

        if has_x64_regs {
            if has_sysv_regs {
                CallingConvention::SystemVAmd64
            } else {
                CallingConvention::WindowsFastcall
            }
        } else if has_x86_regs {
            // For x86, default to cdecl (most common)
            CallingConvention::Cdecl
        } else {
            // If we can't determine, default to System V AMD64 (most common on modern systems)
            CallingConvention::SystemVAmd64
        }
    }

    fn create_conditional_branch(&mut self, instr: &DisassembledInstruction, target: u64) -> Result<IRStmt, String> {
        // Create condition based on jump type
        let condition = self.parse_jump_condition(&instr.mnemonic)?;

        // Calculate fallthrough address
        let fallthrough = instr.offset + instr.length as u64;

        Ok(IRStmt::BranchCond {
            condition,
            true_target: target,
            false_target: fallthrough,
        })
    }

    fn parse_value(&mut self, s: &str) -> Result<IRValue, String> {
        let s = s.trim();

        // Try to parse as number (hex or decimal)
        if s.starts_with("0x") {
            if let Ok(val) = i64::from_str_radix(&s[2..], 16) {
                return Ok(IRValue::Const(val));
            }
        } else if let Ok(val) = s.parse::<i64>() {
            return Ok(IRValue::Const(val));
        }

        // Otherwise treat as variable/register
        Ok(IRValue::Var(IRVar::new(s.to_string(), 8)))
    }

    fn parse_jump_condition(&mut self, mnemonic: &str) -> Result<IRValue, String> {
        // Map x86 condition codes to IR expressions
        // Simplified - full implementation would track flags properly
        let condition_name = match mnemonic.to_lowercase().as_str() {
            "je" | "jz" => "ZF",
            "jne" | "jnz" => "!ZF",
            "jl" | "jnge" => "SF != OF",
            "jle" | "jng" => "ZF || (SF != OF)",
            "jg" | "jnle" => "!ZF && (SF == OF)",
            "jge" | "jnl" => "SF == OF",
            "ja" | "jnbe" => "!CF && !ZF",
            "jae" | "jnb" | "jnc" => "!CF",
            "jb" | "jnae" | "jc" => "CF",
            "jbe" | "jna" => "CF || ZF",
            _ => "condition",
        };

        Ok(IRValue::Var(IRVar::new(condition_name.to_string(), 1)))
    }

    // Additional instruction handlers

    fn create_lea_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        // lea dest, [memory_expr]
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Err(format!("Invalid LEA operands: {}", operands));
        }

        let dest = IRVar::new(parts[0].to_string(), 8);
        // For LEA, we compute the address, not load from it
        let address_expr = self.parse_value(parts[1])?;

        Ok(IRStmt::Assign {
            dest,
            value: address_expr,
        })
    }

    fn create_push_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        let value = self.parse_value(operands)?;
        let sp = IRVar::new("rsp".to_string(), 8);

        // push value is: rsp = rsp - 8; [rsp] = value
        Ok(IRStmt::Assign {
            dest: sp.clone(),
            value: IRValue::Expr(Box::new(IRExpr::binary(
                IROp::Sub,
                IRValue::Var(sp),
                IRValue::Const(8),
                8,
            ))),
        })
    }

    fn create_pop_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        let dest = IRVar::new(operands.trim().to_string(), 8);
        let sp = IRVar::new("rsp".to_string(), 8);

        // pop dest is: dest = [rsp]; rsp = rsp + 8
        Ok(IRStmt::Assign {
            dest,
            value: IRValue::Var(sp.clone()),
        })
    }

    fn create_exchange_stmt(&mut self, operands: &str) -> Result<Vec<IRStmt>, String> {
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Err(format!("Invalid XCHG operands: {}", operands));
        }

        let temp = self.next_temp();
        let var1 = IRVar::new(parts[0].to_string(), 8);
        let var2 = IRVar::new(parts[1].to_string(), 8);

        Ok(vec![
            IRStmt::Assign {
                dest: temp.clone(),
                value: IRValue::Var(var1.clone()),
            },
            IRStmt::Assign {
                dest: var1,
                value: IRValue::Var(var2.clone()),
            },
            IRStmt::Assign {
                dest: var2,
                value: IRValue::Var(temp),
            },
        ])
    }

    fn create_unary_inc_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        let dest = IRVar::new(operands.trim().to_string(), 8);
        let expr = IRExpr::binary(
            IROp::Add,
            IRValue::Var(dest.clone()),
            IRValue::Const(1),
            8,
        );

        Ok(IRStmt::Assign {
            dest,
            value: IRValue::Expr(Box::new(expr)),
        })
    }

    fn create_unary_dec_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        let dest = IRVar::new(operands.trim().to_string(), 8);
        let expr = IRExpr::binary(
            IROp::Sub,
            IRValue::Var(dest.clone()),
            IRValue::Const(1),
            8,
        );

        Ok(IRStmt::Assign {
            dest,
            value: IRValue::Expr(Box::new(expr)),
        })
    }

    fn create_unary_op_stmt(&mut self, operands: &str, op: IROp) -> Result<IRStmt, String> {
        let dest = IRVar::new(operands.trim().to_string(), 8);
        let expr = IRExpr::unary(op, IRValue::Var(dest.clone()), 8);

        Ok(IRStmt::Assign {
            dest,
            value: IRValue::Expr(Box::new(expr)),
        })
    }

    fn create_compare_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        // cmp a, b sets flags based on a - b
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Err(format!("Invalid CMP operands: {}", operands));
        }

        let left = self.parse_value(parts[0])?;
        let right = self.parse_value(parts[1])?;
        let flags = IRVar::new("FLAGS".to_string(), 8);

        let expr = IRExpr::binary(IROp::Sub, left, right, 8);

        Ok(IRStmt::Assign {
            dest: flags,
            value: IRValue::Expr(Box::new(expr)),
        })
    }

    fn create_test_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        // test a, b sets flags based on a & b
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Err(format!("Invalid TEST operands: {}", operands));
        }

        let left = self.parse_value(parts[0])?;
        let right = self.parse_value(parts[1])?;
        let flags = IRVar::new("FLAGS".to_string(), 8);

        let expr = IRExpr::binary(IROp::And, left, right, 8);

        Ok(IRStmt::Assign {
            dest: flags,
            value: IRValue::Expr(Box::new(expr)),
        })
    }

    fn create_return_stmt(&mut self, operands: &str) -> Result<IRStmt, String> {
        if operands.is_empty() {
            Ok(IRStmt::Return { value: None })
        } else {
            // ret with immediate (pop value)
            Ok(IRStmt::Return { value: None })
        }
    }

    fn create_string_op_comment(&mut self, mnemonic: &str) -> Result<IRStmt, String> {
        // String operations are complex - add as comment for now
        let comment_var = IRVar::new(format!("/* {} operation */", mnemonic), 0);
        Ok(IRStmt::Assign {
            dest: comment_var,
            value: IRValue::Const(0),
        })
    }

    fn create_conditional_move_stmt(&mut self, operands: &str, mnemonic: &str) -> Result<IRStmt, String> {
        // cmovcc dest, src - conditionally move based on flags
        let parts: Vec<&str> = operands.split(',').map(|s| s.trim()).collect();
        if parts.len() != 2 {
            return Err(format!("Invalid CMOV operands: {}", operands));
        }

        let dest = IRVar::new(parts[0].to_string(), 8);
        let src = self.parse_value(parts[1])?;

        // Simplified: just do the move (would need condition tracking)
        Ok(IRStmt::Assign { dest, value: src })
    }

    fn create_setcc_stmt(&mut self, operands: &str, mnemonic: &str) -> Result<IRStmt, String> {
        // setcc dest - set byte to 0 or 1 based on condition
        let dest = IRVar::new(operands.trim().to_string(), 1);
        let condition = self.parse_jump_condition(&mnemonic.replace("set", "j"))?;

        Ok(IRStmt::Assign {
            dest,
            value: condition,
        })
    }

    fn create_leave_stmt(&mut self) -> Result<IRStmt, String> {
        // leave = mov rsp, rbp; pop rbp
        let rsp = IRVar::new("rsp".to_string(), 8);
        let rbp = IRVar::new("rbp".to_string(), 8);

        Ok(IRStmt::Assign {
            dest: rsp,
            value: IRValue::Var(rbp),
        })
    }

    fn create_sign_extend_stmt(&mut self) -> Result<IRStmt, String> {
        // CDQ: sign-extend eax to edx:eax
        let rdx = IRVar::new("rdx".to_string(), 8);
        let rax = IRVar::new("rax".to_string(), 8);

        Ok(IRStmt::Assign {
            dest: rdx,
            value: IRValue::Var(rax),
        })
    }

    fn create_unknown_instr_comment(&mut self, instr_text: &str) -> Result<IRStmt, String> {
        let comment = IRVar::new(format!("/* {} */", instr_text), 0);
        Ok(IRStmt::Assign {
            dest: comment,
            value: IRValue::Const(0),
        })
    }

    /// Simplify IR expressions
    fn simplify_ir(&self, mut blocks: Vec<IRBlock>) -> Result<Vec<IRBlock>, String> {
        // Pass 1: Constant folding and propagation
        for block in &mut blocks {
            for stmt in &mut block.statements {
                self.simplify_statement(stmt);
            }
        }

        // Pass 2: Dead code elimination (remove assignments to unused variables)
        // TODO: Implement full DCE with liveness analysis

        Ok(blocks)
    }

    fn simplify_statement(&self, stmt: &mut IRStmt) {
        match stmt {
            IRStmt::Assign { dest: _, value } => {
                self.simplify_value(value);
            }
            IRStmt::Store { address, value, size: _ } => {
                self.simplify_value(address);
                self.simplify_value(value);
            }
            IRStmt::BranchCond { condition, true_target: _, false_target: _ } => {
                self.simplify_value(condition);
            }
            IRStmt::Call { target, args, result: _ } => {
                self.simplify_value(target);
                for arg in args {
                    self.simplify_value(arg);
                }
            }
            IRStmt::Return { value } => {
                if let Some(v) = value {
                    self.simplify_value(v);
                }
            }
            _ => {}
        }
    }

    fn simplify_value(&self, value: &mut IRValue) {
        if let IRValue::Expr(expr) = value {
            self.simplify_expr(expr);

            // After simplifying, check if we can fold to a constant
            if let Some(const_val) = self.try_fold_constant(expr) {
                *value = IRValue::Const(const_val);
            }
        }
    }

    fn simplify_expr(&self, expr: &mut IRExpr) {
        // Simplify operands first (bottom-up)
        for operand in &mut expr.operands {
            self.simplify_value(operand);
        }

        // Now try to simplify this expression
        // Handle identity operations
        if expr.operands.len() == 2 {
            match expr.op {
                IROp::Add => {
                    // x + 0 = x
                    if matches!(&expr.operands[1], IRValue::Const(0)) {
                        // Replace expr with first operand
                        // (This is tricky in Rust - would need to restructure)
                    }
                }
                IROp::Sub => {
                    // x - 0 = x
                    if matches!(&expr.operands[1], IRValue::Const(0)) {
                        // Replace with first operand
                    }
                }
                IROp::Mul => {
                    // x * 1 = x
                    if matches!(&expr.operands[1], IRValue::Const(1)) {
                        // Replace with first operand
                    }
                    // x * 0 = 0
                    if matches!(&expr.operands[1], IRValue::Const(0)) {
                        expr.operands.clear();
                        expr.operands.push(IRValue::Const(0));
                    }
                }
                IROp::And => {
                    // x & 0 = 0
                    if matches!(&expr.operands[1], IRValue::Const(0)) {
                        expr.operands.clear();
                        expr.operands.push(IRValue::Const(0));
                    }
                    // x & -1 = x
                    if matches!(&expr.operands[1], IRValue::Const(-1)) {
                        // Replace with first operand
                    }
                }
                IROp::Or => {
                    // x | 0 = x
                    if matches!(&expr.operands[1], IRValue::Const(0)) {
                        // Replace with first operand
                    }
                }
                IROp::Xor => {
                    // x ^ 0 = x
                    if matches!(&expr.operands[1], IRValue::Const(0)) {
                        // Replace with first operand
                    }
                    // x ^ x = 0 (if both operands are same variable)
                    if let (IRValue::Var(v1), IRValue::Var(v2)) = (&expr.operands[0], &expr.operands[1]) {
                        if v1.name == v2.name {
                            expr.operands.clear();
                            expr.operands.push(IRValue::Const(0));
                        }
                    }
                }
                _ => {}
            }
        }
    }

    fn try_fold_constant(&self, expr: &IRExpr) -> Option<i64> {
        // Only fold if all operands are constants
        let constants: Vec<i64> = expr.operands.iter()
            .filter_map(|op| {
                if let IRValue::Const(c) = op {
                    Some(*c)
                } else {
                    None
                }
            })
            .collect();

        if constants.len() != expr.operands.len() {
            return None; // Not all operands are constants
        }

        // Perform constant folding based on operation
        match expr.op {
            IROp::Add if constants.len() == 2 => Some(constants[0].wrapping_add(constants[1])),
            IROp::Sub if constants.len() == 2 => Some(constants[0].wrapping_sub(constants[1])),
            IROp::Mul if constants.len() == 2 => Some(constants[0].wrapping_mul(constants[1])),
            IROp::Div if constants.len() == 2 && constants[1] != 0 => Some(constants[0] / constants[1]),
            IROp::Mod if constants.len() == 2 && constants[1] != 0 => Some(constants[0] % constants[1]),
            IROp::And if constants.len() == 2 => Some(constants[0] & constants[1]),
            IROp::Or if constants.len() == 2 => Some(constants[0] | constants[1]),
            IROp::Xor if constants.len() == 2 => Some(constants[0] ^ constants[1]),
            IROp::Shl if constants.len() == 2 => Some(constants[0] << (constants[1] & 63)),
            IROp::Shr if constants.len() == 2 => Some((constants[0] as u64 >> (constants[1] & 63)) as i64),
            IROp::Sar if constants.len() == 2 => Some(constants[0] >> (constants[1] & 63)),
            IROp::Eq if constants.len() == 2 => Some(if constants[0] == constants[1] { 1 } else { 0 }),
            IROp::Ne if constants.len() == 2 => Some(if constants[0] != constants[1] { 1 } else { 0 }),
            IROp::Lt if constants.len() == 2 => Some(if constants[0] < constants[1] { 1 } else { 0 }),
            IROp::Le if constants.len() == 2 => Some(if constants[0] <= constants[1] { 1 } else { 0 }),
            IROp::Gt if constants.len() == 2 => Some(if constants[0] > constants[1] { 1 } else { 0 }),
            IROp::Ge if constants.len() == 2 => Some(if constants[0] >= constants[1] { 1 } else { 0 }),
            IROp::Neg if constants.len() == 1 => Some(-constants[0]),
            IROp::Not if constants.len() == 1 => Some(!constants[0]),
            _ => None,
        }
    }

    /// Recover high-level control structures from IR
    fn recover_control_structures(&self, blocks: &[IRBlock]) -> Result<Vec<CStatement>, String> {
        if blocks.is_empty() {
            return Ok(Vec::new());
        }

        // Build a map of block addresses
        let block_map: HashMap<u64, &IRBlock> = blocks.iter()
            .map(|b| (b.address, b))
            .collect();

        // Track visited blocks to avoid infinite loops
        let mut visited = HashSet::new();

        // Start from first block
        self.recover_block_structure(blocks[0].address, &block_map, &mut visited)
    }

    fn recover_block_structure(
        &self,
        block_addr: u64,
        block_map: &HashMap<u64, &IRBlock>,
        visited: &mut HashSet<u64>,
    ) -> Result<Vec<CStatement>, String> {
        if visited.contains(&block_addr) {
            return Ok(Vec::new());
        }
        visited.insert(block_addr);

        let block = block_map.get(&block_addr)
            .ok_or_else(|| format!("Block not found: 0x{:x}", block_addr))?;

        let mut statements = Vec::new();

        // Convert block statements to C
        for (i, stmt) in block.statements.iter().enumerate() {
            let is_last = i == block.statements.len() - 1;

            match stmt {
                IRStmt::BranchCond { condition, true_target, false_target } if is_last => {
                    // This is a conditional branch - create if/else structure
                    let then_block = self.recover_block_structure(*true_target, block_map, visited)?;
                    let else_block = if *false_target != block_addr {
                        Some(self.recover_block_structure(*false_target, block_map, visited)?)
                    } else {
                        None
                    };

                    statements.push(CStatement::If {
                        condition: self.value_to_string(condition),
                        then_block,
                        else_block: else_block.filter(|b| !b.is_empty()),
                    });
                }
                IRStmt::Branch { target } if is_last => {
                    // Unconditional branch
                    // Check if this forms a loop (back-edge)
                    if *target < block_addr && !visited.contains(target) {
                        // This looks like a loop back-edge
                        // Try to detect the loop condition by analyzing the loop body
                        let loop_condition = self.find_loop_condition(*target, block_addr, block_map);
                        let loop_body = self.recover_block_structure(*target, block_map, visited)?;
                        statements.push(CStatement::While {
                            condition: loop_condition,
                            body: loop_body,
                        });
                    } else if !visited.contains(target) {
                        // Forward jump - continue to next block
                        let next_stmts = self.recover_block_structure(*target, block_map, visited)?;
                        statements.extend(next_stmts);
                    }
                }
                _ => {
                    // Regular statement
                    statements.push(self.ir_stmt_to_c(stmt)?);
                }
            }
        }

        // Handle fallthrough to successor if no explicit branch
        if !block.statements.is_empty() {
            if !matches!(block.statements.last(), Some(IRStmt::Branch { .. }) | Some(IRStmt::BranchCond { .. }) | Some(IRStmt::Return { .. })) {
                // No explicit control flow - check for single successor
                if block.successors.len() == 1 && !visited.contains(&block.successors[0]) {
                    let next_stmts = self.recover_block_structure(block.successors[0], block_map, visited)?;
                    statements.extend(next_stmts);
                }
            }
        }

        Ok(statements)
    }

    /// Find the loop condition by analyzing blocks in the loop range
    /// Looks for conditional branches that exit the loop
    fn find_loop_condition(
        &self,
        loop_start: u64,
        loop_end: u64,
        block_map: &HashMap<u64, &IRBlock>,
    ) -> String {
        // Search all blocks in the loop range for conditional exits
        for addr in loop_start..=loop_end {
            if let Some(block) = block_map.get(&addr) {
                // Look at the last statement in the block
                if let Some(last_stmt) = block.statements.last() {
                    if let IRStmt::BranchCond { condition, true_target, false_target } = last_stmt {
                        // Check if this is a loop exit condition
                        // (one branch goes outside the loop range)
                        let true_exits = *true_target < loop_start || *true_target > loop_end;
                        let false_exits = *false_target < loop_start || *false_target > loop_end;

                        if true_exits && !false_exits {
                            // True branch exits the loop, so the loop continues when condition is false
                            // Return the negated condition
                            return self.negate_condition(&self.value_to_string(condition));
                        } else if false_exits && !true_exits {
                            // False branch exits the loop, so the loop continues when condition is true
                            return self.value_to_string(condition);
                        }
                    }
                }
            }
        }

        // No explicit condition found - default to infinite loop
        "true".to_string()
    }

    /// Negate a condition string for loop continuation
    fn negate_condition(&self, condition: &str) -> String {
        // Handle common patterns first (more specific matches)
        match condition {
            // Complex conditions
            "!CF && !ZF" => "CF || ZF".to_string(),
            "CF || ZF" => "!CF && !ZF".to_string(),
            "ZF || (SF != OF)" => "!ZF && (SF == OF)".to_string(),
            "!ZF && (SF == OF)" => "ZF || (SF != OF)".to_string(),
            "SF != OF" => "SF == OF".to_string(),
            "SF == OF" => "SF != OF".to_string(),

            // Simple flags
            "ZF" => "!ZF".to_string(),
            "CF" => "!CF".to_string(),
            "!ZF" => "ZF".to_string(),
            "!CF" => "CF".to_string(),

            // Generic negation
            _ => {
                // Handle simple negation (single flag with ! prefix)
                if condition.starts_with('!') && !condition.contains("&&") && !condition.contains("||") {
                    // Simple flag negation - remove the !
                    condition[1..].to_string()
                } else {
                    // Complex condition - wrap in parentheses with !
                    format!("!({})", condition)
                }
            }
        }
    }

    /// Convert IR statement to C statement
    fn ir_stmt_to_c(&self, stmt: &IRStmt) -> Result<CStatement, String> {
        match stmt {
            IRStmt::Assign { dest, value } => {
                Ok(CStatement::Assignment {
                    var: self.var_to_string(dest),
                    expr: self.value_to_string(value),
                })
            }
            IRStmt::Return { value } => {
                Ok(CStatement::Return {
                    expr: value.as_ref().map(|v| self.value_to_string(v)),
                })
            }
            IRStmt::Call { target, args, result } => {
                Ok(CStatement::Call {
                    function: self.value_to_string(target),
                    args: args.iter().map(|a| self.value_to_string(a)).collect(),
                    result_var: result.as_ref().map(|r| self.var_to_string(r)),
                })
            }
            _ => Ok(CStatement::Comment {
                text: format!("// {:?}", stmt),
            }),
        }
    }

    /// Generate final C pseudocode
    fn generate_c_code(&self, statements: &[CStatement]) -> String {
        let mut output = String::new();
        output.push_str("void function() {\n");

        for stmt in statements {
            output.push_str(&self.format_c_statement(stmt, 1));
        }

        output.push_str("}\n");
        output
    }

    fn format_c_statement(&self, stmt: &CStatement, indent: usize) -> String {
        let indent_str = "  ".repeat(indent);

        match stmt {
            CStatement::Assignment { var, expr } => {
                format!("{}{} = {};\n", indent_str, var, expr)
            }
            CStatement::Return { expr } => {
                if let Some(e) = expr {
                    format!("{}return {};\n", indent_str, e)
                } else {
                    format!("{}return;\n", indent_str)
                }
            }
            CStatement::Call { function, args, result_var } => {
                let call = format!("{}({})", function, args.join(", "));
                if let Some(var) = result_var {
                    format!("{}{} = {};\n", indent_str, var, call)
                } else {
                    format!("{}{};\n", indent_str, call)
                }
            }
            CStatement::If { condition, then_block, else_block } => {
                let mut result = format!("{}if ({}) {{\n", indent_str, condition);
                for s in then_block {
                    result.push_str(&self.format_c_statement(s, indent + 1));
                }
                result.push_str(&format!("{}}}", indent_str));
                if let Some(else_stmts) = else_block {
                    result.push_str(" else {\n");
                    for s in else_stmts {
                        result.push_str(&self.format_c_statement(s, indent + 1));
                    }
                    result.push_str(&format!("{}}}", indent_str));
                }
                result.push('\n');
                result
            }
            CStatement::While { condition, body } => {
                let mut result = format!("{}while ({}) {{\n", indent_str, condition);
                for s in body {
                    result.push_str(&self.format_c_statement(s, indent + 1));
                }
                result.push_str(&format!("{}}}\n", indent_str));
                result
            }
            CStatement::DoWhile { body, condition } => {
                let mut result = format!("{}do {{\n", indent_str);
                for s in body {
                    result.push_str(&self.format_c_statement(s, indent + 1));
                }
                result.push_str(&format!("{}}} while ({});\n", indent_str, condition));
                result
            }
            CStatement::Comment { text } => {
                format!("{}{}\n", indent_str, text)
            }
        }
    }

    fn var_to_string(&self, var: &IRVar) -> String {
        if var.version > 0 {
            format!("{}_{}", var.name, var.version)
        } else {
            var.name.clone()
        }
    }

    fn value_to_string(&self, value: &IRValue) -> String {
        match value {
            IRValue::Var(v) => self.var_to_string(v),
            IRValue::Const(c) => {
                if *c < 0 {
                    format!("{}", c)
                } else if *c > 255 {
                    format!("0x{:x}", c)
                } else {
                    format!("{}", c)
                }
            }
            IRValue::Expr(e) => self.expr_to_string(e),
        }
    }

    fn expr_to_string(&self, expr: &IRExpr) -> String {
        let op_str = match expr.op {
            IROp::Add => "+",
            IROp::Sub => "-",
            IROp::Mul => "*",
            IROp::Div => "/",
            IROp::Mod => "%",
            IROp::And => "&",
            IROp::Or => "|",
            IROp::Xor => "^",
            IROp::Shl => "<<",
            IROp::Shr | IROp::Sar => ">>",
            IROp::Eq => "==",
            IROp::Ne => "!=",
            IROp::Lt => "<",
            IROp::Le => "<=",
            IROp::Gt => ">",
            IROp::Ge => ">=",
            IROp::Not => "!",
            IROp::Neg => "-",
            _ => "?",
        };

        if expr.operands.len() == 2 {
            format!("({} {} {})",
                self.value_to_string(&expr.operands[0]),
                op_str,
                self.value_to_string(&expr.operands[1]))
        } else if expr.operands.len() == 1 {
            format!("({}{})", op_str, self.value_to_string(&expr.operands[0]))
        } else {
            "???".to_string()
        }
    }

    fn next_temp(&mut self) -> IRVar {
        let id = self.temp_counter;
        self.temp_counter += 1;
        IRVar::temp(id, 8)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decompiler_basic() {
        let mut decompiler = Decompiler::new();
        let blocks = vec![];
        let result = decompiler.decompile(&blocks);
        assert!(result.is_ok());
    }

    #[test]
    fn test_loop_condition_detection() {
        let decompiler = Decompiler::new();

        // Create a simple loop structure:
        // Block 0x100: conditional branch (ZF check)
        // Block 0x110: loop body, jumps back to 0x100
        let block1 = IRBlock {
            address: 0x100,
            statements: vec![
                IRStmt::BranchCond {
                    condition: IRValue::Var(IRVar::new("ZF".to_string(), 1)),
                    true_target: 0x200,  // Exit loop when ZF is set
                    false_target: 0x110, // Continue to loop body
                },
            ],
            successors: vec![0x200, 0x110],
            predecessors: vec![],
        };

        let block2 = IRBlock {
            address: 0x110,
            statements: vec![
                IRStmt::Branch { target: 0x100 }, // Jump back to loop start
            ],
            successors: vec![0x100],
            predecessors: vec![0x100],
        };

        let block_map: HashMap<u64, &IRBlock> = vec![
            (0x100, &block1),
            (0x110, &block2),
        ].into_iter().collect();

        // Find the loop condition
        let condition = decompiler.find_loop_condition(0x100, 0x110, &block_map);

        // Should detect that we continue the loop when !ZF
        assert_eq!(condition, "!ZF");
    }

    #[test]
    fn test_negate_condition() {
        let decompiler = Decompiler::new();

        // Test simple flag negation
        assert_eq!(decompiler.negate_condition("ZF"), "!ZF");
        assert_eq!(decompiler.negate_condition("!ZF"), "ZF");

        // Test complex conditions
        assert_eq!(decompiler.negate_condition("SF != OF"), "SF == OF");
        assert_eq!(decompiler.negate_condition("!CF && !ZF"), "CF || ZF");

        // Test generic condition
        assert_eq!(decompiler.negate_condition("custom_condition"), "!(custom_condition)");
    }

    #[test]
    fn test_loop_with_multiple_conditions() {
        let decompiler = Decompiler::new();

        // Test a loop with counter (jl instruction - less than check)
        // Simulating: for (i = 0; i < 10; i++) { ... }
        let loop_header = IRBlock {
            address: 0x1000,
            statements: vec![
                IRStmt::BranchCond {
                    condition: IRValue::Var(IRVar::new("SF != OF".to_string(), 1)),
                    true_target: 0x1010, // Continue loop (i < 10)
                    false_target: 0x2000, // Exit loop (i >= 10)
                },
            ],
            successors: vec![0x1010, 0x2000],
            predecessors: vec![],
        };

        let loop_body = IRBlock {
            address: 0x1010,
            statements: vec![
                IRStmt::Branch { target: 0x1000 }, // Jump back
            ],
            successors: vec![0x1000],
            predecessors: vec![0x1000],
        };

        let block_map: HashMap<u64, &IRBlock> = vec![
            (0x1000, &loop_header),
            (0x1010, &loop_body),
        ].into_iter().collect();

        // Find the loop condition
        let condition = decompiler.find_loop_condition(0x1000, 0x1010, &block_map);

        // Should detect that we continue when SF != OF (less than)
        assert_eq!(condition, "SF != OF");
    }
}

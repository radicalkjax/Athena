/// Type Inference System for Decompiler
/// Infers types of variables based on usage patterns
///
/// Inspired by Ghidra's type propagation system

use std::collections::HashMap;
use crate::decompiler::{IRVar, IRValue, IRExpr, IROp, IRStmt};

#[derive(Clone, Debug, PartialEq)]
pub enum InferredType {
    Unknown,
    Integer(IntegerType),
    Pointer(Box<InferredType>),
    Array(Box<InferredType>, Option<usize>),
    Struct(String),
    Function(Vec<InferredType>, Box<InferredType>),
    Void,
}

#[derive(Clone, Debug, PartialEq)]
pub enum IntegerType {
    I8,
    U8,
    I16,
    U16,
    I32,
    U32,
    I64,
    U64,
    Bool,
}

pub struct TypeInference {
    /// Variable -> Type mapping
    type_map: HashMap<String, InferredType>,
    /// Constraints collected during analysis
    constraints: Vec<TypeConstraint>,
}

#[derive(Clone, Debug)]
struct TypeConstraint {
    var: String,
    constraint_type: ConstraintType,
}

#[derive(Clone, Debug)]
enum ConstraintType {
    /// Used in pointer dereference
    IsPointer,
    /// Used in comparison with 0/null
    IsPointerOrInt,
    /// Used in arithmetic
    IsInteger,
    /// Used as boolean (in conditions)
    IsBool,
    /// Used with specific size
    HasSize(u32),
    /// Used in function call as parameter
    FunctionParam(usize),
    /// Used as return value
    ReturnValue,
}

impl TypeInference {
    pub fn new() -> Self {
        Self {
            type_map: HashMap::new(),
            constraints: Vec::new(),
        }
    }

    /// Infer types from IR statements
    pub fn infer_types(&mut self, statements: &[IRStmt]) {
        // Pass 1: Collect constraints
        for stmt in statements {
            self.collect_constraints(stmt);
        }

        // Pass 2: Solve constraints
        self.solve_constraints();
    }

    fn collect_constraints(&mut self, stmt: &IRStmt) {
        match stmt {
            IRStmt::Assign { dest, value } => {
                // Infer type from value
                let value_type = self.infer_value_type(value);
                self.set_type(&dest.name, value_type);

                // If this is a size-specific assignment, add constraint
                self.constraints.push(TypeConstraint {
                    var: dest.name.clone(),
                    constraint_type: ConstraintType::HasSize(dest.size),
                });
            }
            IRStmt::Store { address, value, size } => {
                // address must be a pointer
                if let IRValue::Var(v) = address {
                    self.constraints.push(TypeConstraint {
                        var: v.name.clone(),
                        constraint_type: ConstraintType::IsPointer,
                    });
                }

                // Infer type of value being stored
                let value_type = self.infer_value_type(value);
                if let IRValue::Var(v) = value {
                    self.set_type(&v.name, value_type);
                }
            }
            IRStmt::BranchCond { condition, .. } => {
                // Condition is boolean
                if let IRValue::Var(v) = condition {
                    self.constraints.push(TypeConstraint {
                        var: v.name.clone(),
                        constraint_type: ConstraintType::IsBool,
                    });
                }
            }
            IRStmt::Call { args, result, .. } => {
                // Function parameters
                for (i, arg) in args.iter().enumerate() {
                    if let IRValue::Var(v) = arg {
                        self.constraints.push(TypeConstraint {
                            var: v.name.clone(),
                            constraint_type: ConstraintType::FunctionParam(i),
                        });
                    }
                }

                // Return value
                if let Some(ret_var) = result {
                    self.constraints.push(TypeConstraint {
                        var: ret_var.name.clone(),
                        constraint_type: ConstraintType::ReturnValue,
                    });
                }
            }
            IRStmt::Return { value } => {
                if let Some(v) = value {
                    if let IRValue::Var(var) = v {
                        self.constraints.push(TypeConstraint {
                            var: var.name.clone(),
                            constraint_type: ConstraintType::ReturnValue,
                        });
                    }
                }
            }
            _ => {}
        }
    }

    fn infer_value_type(&self, value: &IRValue) -> InferredType {
        match value {
            IRValue::Const(c) => {
                // Infer type from constant value
                if *c == 0 || *c == 1 {
                    InferredType::Integer(IntegerType::Bool)
                } else if *c >= 0 && *c <= 255 {
                    InferredType::Integer(IntegerType::U8)
                } else if *c >= -128 && *c <= 127 {
                    InferredType::Integer(IntegerType::I8)
                } else if *c as u64 > 0x1000 {
                    // Looks like an address
                    InferredType::Pointer(Box::new(InferredType::Unknown))
                } else {
                    InferredType::Integer(IntegerType::I32)
                }
            }
            IRValue::Var(v) => {
                // Look up existing type
                self.type_map.get(&v.name).cloned()
                    .unwrap_or_else(|| self.infer_from_size(v.size))
            }
            IRValue::Expr(expr) => {
                self.infer_expr_type(expr)
            }
        }
    }

    fn infer_expr_type(&self, expr: &IRExpr) -> InferredType {
        match expr.op {
            // Arithmetic operations -> integer
            IROp::Add | IROp::Sub | IROp::Mul | IROp::Div | IROp::Mod => {
                // Check if this is pointer arithmetic
                if expr.operands.len() == 2 {
                    let left_type = self.infer_value_type(&expr.operands[0]);
                    if matches!(left_type, InferredType::Pointer(_)) {
                        return left_type; // Pointer + integer = pointer
                    }
                }
                self.infer_from_size(expr.size)
            }

            // Bitwise operations -> integer
            IROp::And | IROp::Or | IROp::Xor | IROp::Not |
            IROp::Shl | IROp::Shr | IROp::Sar => {
                self.infer_from_size(expr.size)
            }

            // Comparison operations -> bool
            IROp::Eq | IROp::Ne | IROp::Lt | IROp::Le | IROp::Gt | IROp::Ge => {
                InferredType::Integer(IntegerType::Bool)
            }

            // Negation -> integer
            IROp::Neg => {
                self.infer_from_size(expr.size)
            }

            // Load -> depends on pointer type
            IROp::Load => {
                if !expr.operands.is_empty() {
                    if let IRValue::Var(v) = &expr.operands[0] {
                        if let Some(InferredType::Pointer(inner)) = self.type_map.get(&v.name) {
                            return (**inner).clone();
                        }
                    }
                }
                self.infer_from_size(expr.size)
            }

            _ => InferredType::Unknown,
        }
    }

    fn infer_from_size(&self, size: u32) -> InferredType {
        match size {
            1 => InferredType::Integer(IntegerType::U8),
            2 => InferredType::Integer(IntegerType::U16),
            4 => InferredType::Integer(IntegerType::U32),
            8 => InferredType::Integer(IntegerType::U64),
            _ => InferredType::Unknown,
        }
    }

    fn solve_constraints(&mut self) {
        // Apply constraints to refine types
        // Clone constraints to avoid borrow checker issues
        let constraints = self.constraints.clone();

        for constraint in &constraints {
            let current_type = self.type_map.get(&constraint.var).cloned()
                .unwrap_or(InferredType::Unknown);

            let new_type = match &constraint.constraint_type {
                ConstraintType::IsPointer => {
                    InferredType::Pointer(Box::new(InferredType::Unknown))
                }
                ConstraintType::IsPointerOrInt => {
                    if let Some(val) = self.is_likely_pointer(&constraint.var) {
                        if val {
                            InferredType::Pointer(Box::new(InferredType::Unknown))
                        } else {
                            current_type
                        }
                    } else {
                        current_type
                    }
                }
                ConstraintType::IsInteger => {
                    if matches!(current_type, InferredType::Unknown) {
                        InferredType::Integer(IntegerType::I32)
                    } else {
                        current_type
                    }
                }
                ConstraintType::IsBool => {
                    InferredType::Integer(IntegerType::Bool)
                }
                ConstraintType::HasSize(size) => {
                    self.infer_from_size(*size)
                }
                ConstraintType::FunctionParam(_) => {
                    // Could look up function signature
                    current_type
                }
                ConstraintType::ReturnValue => {
                    current_type
                }
            };

            self.set_type(&constraint.var, new_type);
        }
    }

    fn is_likely_pointer(&self, _var: &str) -> Option<bool> {
        // Heuristic: check if value is in typical address range
        // TODO: Implement based on actual values
        None
    }

    fn set_type(&mut self, var: &str, typ: InferredType) {
        // Only update if new type is more specific
        if let Some(existing) = self.type_map.get(var) {
            if !matches!(existing, InferredType::Unknown) && matches!(typ, InferredType::Unknown) {
                return; // Don't overwrite known type with unknown
            }
        }
        self.type_map.insert(var.to_string(), typ);
    }

    pub fn get_type(&self, var: &str) -> Option<&InferredType> {
        self.type_map.get(var)
    }

    pub fn format_type(&self, typ: &InferredType) -> String {
        match typ {
            InferredType::Unknown => "void".to_string(),
            InferredType::Integer(it) => match it {
                IntegerType::I8 => "int8_t".to_string(),
                IntegerType::U8 => "uint8_t".to_string(),
                IntegerType::I16 => "int16_t".to_string(),
                IntegerType::U16 => "uint16_t".to_string(),
                IntegerType::I32 => "int32_t".to_string(),
                IntegerType::U32 => "uint32_t".to_string(),
                IntegerType::I64 => "int64_t".to_string(),
                IntegerType::U64 => "uint64_t".to_string(),
                IntegerType::Bool => "bool".to_string(),
            },
            InferredType::Pointer(inner) => {
                format!("{}*", self.format_type(inner))
            }
            InferredType::Array(inner, Some(size)) => {
                format!("{}[{}]", self.format_type(inner), size)
            }
            InferredType::Array(inner, None) => {
                format!("{}[]", self.format_type(inner))
            }
            InferredType::Struct(name) => {
                format!("struct {}", name)
            }
            InferredType::Function(args, ret) => {
                let arg_types: Vec<String> = args.iter()
                    .map(|a| self.format_type(a))
                    .collect();
                format!("{}({})", self.format_type(ret), arg_types.join(", "))
            }
            InferredType::Void => "void".to_string(),
        }
    }

    pub fn get_all_types(&self) -> &HashMap<String, InferredType> {
        &self.type_map
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_from_size() {
        let ti = TypeInference::new();

        assert!(matches!(ti.infer_from_size(1), InferredType::Integer(IntegerType::U8)));
        assert!(matches!(ti.infer_from_size(4), InferredType::Integer(IntegerType::U32)));
        assert!(matches!(ti.infer_from_size(8), InferredType::Integer(IntegerType::U64)));
    }

    #[test]
    fn test_format_type() {
        let ti = TypeInference::new();

        assert_eq!(ti.format_type(&InferredType::Integer(IntegerType::I32)), "int32_t");
        assert_eq!(ti.format_type(&InferredType::Integer(IntegerType::Bool)), "bool");
        assert_eq!(
            ti.format_type(&InferredType::Pointer(Box::new(InferredType::Integer(IntegerType::U8)))),
            "uint8_t*"
        );
    }
}

/// Static Single Assignment (SSA) Form Implementation
/// Converts IR to SSA form with phi nodes for improved data-flow analysis
///
/// Inspired by Ghidra and Binary Ninja's SSA implementations
/// References:
/// - "Efficiently Computing Static Single Assignment Form and the Control Dependence Graph"
///   by Cytron et al.
/// - Binary Ninja's SSA system

use std::collections::{HashMap, HashSet, VecDeque};
use crate::decompiler::{IRStmt, IRValue, IRVar, IRExpr, IROp};

#[derive(Clone, Debug)]
pub struct SSAFunction {
    pub name: String,
    pub address: u64,
    pub blocks: Vec<SSABlock>,
    pub variables: HashMap<String, SSAVariable>,
    pub cfg: ControlFlowGraph,
}

#[derive(Clone, Debug)]
pub struct SSABlock {
    pub id: usize,
    pub address: u64,
    pub statements: Vec<SSAStatement>,
    pub predecessors: Vec<usize>,
    pub successors: Vec<usize>,
    pub dominance_frontier: HashSet<usize>,
}

#[derive(Clone, Debug)]
pub enum SSAStatement {
    /// Regular assignment: var_v1 = expr
    Assign {
        dest: SSAVar,
        value: SSAValue,
    },
    /// Phi node: var_v3 = phi(var_v1, var_v2)
    Phi {
        dest: SSAVar,
        sources: Vec<(usize, SSAVar)>, // (block_id, variable)
    },
    /// Memory store
    Store {
        address: SSAValue,
        value: SSAValue,
        size: u32,
    },
    /// Conditional branch
    BranchCond {
        condition: SSAValue,
        true_target: usize,
        false_target: usize,
    },
    /// Unconditional branch
    Branch {
        target: usize,
    },
    /// Function call
    Call {
        target: SSAValue,
        args: Vec<SSAValue>,
        result: Option<SSAVar>,
    },
    /// Return
    Return {
        value: Option<SSAValue>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct SSAVar {
    pub name: String,
    pub version: usize, // SSA version number
    pub size: u32,
}

#[derive(Clone, Debug)]
pub enum SSAValue {
    Const(i64),
    Var(SSAVar),
    Expr(SSAExpr),
}

#[derive(Clone, Debug)]
pub struct SSAExpr {
    pub op: IROp,
    pub operands: Vec<SSAValue>,
    pub size: u32,
}

#[derive(Clone, Debug)]
pub struct SSAVariable {
    pub base_name: String,
    pub versions: Vec<usize>,
    pub current_version: usize,
}

#[derive(Clone, Debug)]
pub struct ControlFlowGraph {
    pub blocks: Vec<usize>,
    pub entry_block: usize,
    pub edges: Vec<(usize, usize)>,
    pub dominators: HashMap<usize, HashSet<usize>>,
    pub immediate_dominators: HashMap<usize, usize>,
    pub dominance_frontiers: HashMap<usize, HashSet<usize>>,
}

pub struct SSABuilder {
    current_versions: HashMap<String, usize>,
    variable_defs: HashMap<String, HashSet<usize>>, // var -> blocks where defined
    phi_nodes: HashMap<usize, Vec<(String, SSAVar)>>, // block -> phi nodes to insert
}

impl SSABuilder {
    pub fn new() -> Self {
        Self {
            current_versions: HashMap::new(),
            variable_defs: HashMap::new(),
            phi_nodes: HashMap::new(),
        }
    }

    /// Convert IR function to SSA form
    pub fn convert_to_ssa(
        &mut self,
        blocks: Vec<(u64, Vec<IRStmt>)>,
    ) -> Result<SSAFunction, String> {
        // Step 1: Build basic blocks from IR
        let mut ssa_blocks = self.build_blocks(blocks)?;

        // Step 2: Build Control Flow Graph
        let cfg = self.build_cfg(&ssa_blocks)?;

        // Step 3: Calculate dominance frontiers
        let mut cfg_with_dom = cfg;
        self.calculate_dominance(&mut cfg_with_dom, &ssa_blocks)?;

        // Step 4: Insert phi nodes
        self.insert_phi_nodes(&mut ssa_blocks, &cfg_with_dom)?;

        // Step 5: Rename variables
        self.rename_variables(&mut ssa_blocks, &cfg_with_dom)?;

        // Step 6: Build variable metadata
        let variables = self.build_variable_metadata(&ssa_blocks);

        Ok(SSAFunction {
            name: "function".to_string(),
            address: 0,
            blocks: ssa_blocks,
            variables,
            cfg: cfg_with_dom,
        })
    }

    fn build_blocks(
        &mut self,
        ir_blocks: Vec<(u64, Vec<IRStmt>)>,
    ) -> Result<Vec<SSABlock>, String> {
        let mut blocks = Vec::new();

        for (id, (address, statements)) in ir_blocks.into_iter().enumerate() {
            let mut ssa_stmts = Vec::new();

            for stmt in statements {
                match stmt {
                    IRStmt::Assign { dest, value } => {
                        let ssa_dest = self.new_version(&dest.name, dest.size);
                        let ssa_value = self.convert_ir_value_to_ssa(&value);

                        ssa_stmts.push(SSAStatement::Assign {
                            dest: ssa_dest,
                            value: ssa_value,
                        });

                        // Track where this variable is defined
                        self.variable_defs
                            .entry(dest.name.clone())
                            .or_insert_with(HashSet::new)
                            .insert(id);
                    }
                    IRStmt::Store { address, value, size } => {
                        ssa_stmts.push(SSAStatement::Store {
                            address: self.convert_ir_value_to_ssa(&address),
                            value: self.convert_ir_value_to_ssa(&value),
                            size,
                        });
                    }
                    IRStmt::BranchCond { condition, true_target, false_target } => {
                        ssa_stmts.push(SSAStatement::BranchCond {
                            condition: self.convert_ir_value_to_ssa(&condition),
                            true_target: true_target as usize,
                            false_target: false_target as usize,
                        });
                    }
                    IRStmt::Branch { target } => {
                        ssa_stmts.push(SSAStatement::Branch {
                            target: target as usize,
                        });
                    }
                    IRStmt::Call { target, args, result } => {
                        let ssa_result = result.as_ref().map(|v| {
                            let var = self.new_version(&v.name, v.size);
                            self.variable_defs
                                .entry(v.name.clone())
                                .or_insert_with(HashSet::new)
                                .insert(id);
                            var
                        });

                        ssa_stmts.push(SSAStatement::Call {
                            target: self.convert_ir_value_to_ssa(&target),
                            args: args.iter().map(|a| self.convert_ir_value_to_ssa(a)).collect(),
                            result: ssa_result,
                        });
                    }
                    IRStmt::Return { value } => {
                        ssa_stmts.push(SSAStatement::Return {
                            value: value.as_ref().map(|v| self.convert_ir_value_to_ssa(v)),
                        });
                    }
                    _ => {}
                }
            }

            blocks.push(SSABlock {
                id,
                address,
                statements: ssa_stmts,
                predecessors: Vec::new(),
                successors: Vec::new(),
                dominance_frontier: HashSet::new(),
            });
        }

        // Build predecessor/successor relationships
        for block in &mut blocks {
            let id = block.id;
            for stmt in &block.statements {
                match stmt {
                    SSAStatement::Branch { target } => {
                        block.successors.push(*target);
                    }
                    SSAStatement::BranchCond { true_target, false_target, .. } => {
                        block.successors.push(*true_target);
                        block.successors.push(*false_target);
                    }
                    _ => {}
                }
            }
        }

        // Update predecessors
        for block_id in 0..blocks.len() {
            let successors = blocks[block_id].successors.clone();
            for succ in successors {
                if succ < blocks.len() {
                    blocks[succ].predecessors.push(block_id);
                }
            }
        }

        Ok(blocks)
    }

    fn new_version(&mut self, name: &str, size: u32) -> SSAVar {
        let version = self.current_versions.entry(name.to_string()).or_insert(0);
        *version += 1;

        SSAVar {
            name: name.to_string(),
            version: *version,
            size,
        }
    }

    fn convert_ir_value_to_ssa(&self, value: &IRValue) -> SSAValue {
        match value {
            IRValue::Const(c) => SSAValue::Const(*c),
            IRValue::Var(v) => {
                let version = self.current_versions.get(&v.name).cloned().unwrap_or(0);
                SSAValue::Var(SSAVar {
                    name: v.name.clone(),
                    version,
                    size: v.size,
                })
            }
            IRValue::Expr(expr) => {
                SSAValue::Expr(SSAExpr {
                    op: expr.op.clone(),
                    operands: expr.operands.iter().map(|op| self.convert_ir_value_to_ssa(op)).collect(),
                    size: expr.size,
                })
            }
        }
    }

    fn build_cfg(&self, blocks: &[SSABlock]) -> Result<ControlFlowGraph, String> {
        let mut edges = Vec::new();

        for block in blocks {
            for &succ in &block.successors {
                edges.push((block.id, succ));
            }
        }

        Ok(ControlFlowGraph {
            blocks: (0..blocks.len()).collect(),
            entry_block: 0,
            edges,
            dominators: HashMap::new(),
            immediate_dominators: HashMap::new(),
            dominance_frontiers: HashMap::new(),
        })
    }

    fn calculate_dominance(
        &self,
        cfg: &mut ControlFlowGraph,
        blocks: &[SSABlock],
    ) -> Result<(), String> {
        // Calculate dominators using iterative algorithm
        let n = blocks.len();
        let mut dom: HashMap<usize, HashSet<usize>> = HashMap::new();

        // Initialize: entry dominates only itself, all others dominate everything
        for i in 0..n {
            if i == cfg.entry_block {
                let mut set = HashSet::new();
                set.insert(i);
                dom.insert(i, set);
            } else {
                dom.insert(i, (0..n).collect());
            }
        }

        // Iterate until convergence
        let mut changed = true;
        while changed {
            changed = false;

            for block_id in 0..n {
                if block_id == cfg.entry_block {
                    continue;
                }

                // dom(n) = {n} ∪ (∩ dom(p) for all predecessors p)
                let preds = &blocks[block_id].predecessors;
                if preds.is_empty() {
                    continue;
                }

                let mut new_dom: HashSet<usize> = dom[&preds[0]].clone();
                for &pred in &preds[1..] {
                    new_dom = new_dom.intersection(&dom[&pred]).cloned().collect();
                }
                new_dom.insert(block_id);

                if new_dom != dom[&block_id] {
                    dom.insert(block_id, new_dom);
                    changed = true;
                }
            }
        }

        // Calculate immediate dominators
        for i in 0..n {
            let dominators = &dom[&i];
            let mut strict_doms: Vec<usize> = dominators.iter()
                .filter(|&&d| d != i)
                .cloned()
                .collect();

            if !strict_doms.is_empty() {
                // Find the closest dominator
                strict_doms.sort_by_key(|&d| dom[&d].len());
                strict_doms.reverse();

                if let Some(&idom) = strict_doms.first() {
                    cfg.immediate_dominators.insert(i, idom);
                }
            }
        }

        // Calculate dominance frontiers
        for i in 0..n {
            for &succ in &blocks[i].successors {
                let mut runner = i;
                while !dom[&succ].contains(&runner) || runner == succ {
                    cfg.dominance_frontiers
                        .entry(runner)
                        .or_insert_with(HashSet::new)
                        .insert(succ);

                    if let Some(&idom) = cfg.immediate_dominators.get(&runner) {
                        runner = idom;
                    } else {
                        break;
                    }
                }
            }
        }

        cfg.dominators = dom;
        Ok(())
    }

    fn insert_phi_nodes(
        &mut self,
        blocks: &mut Vec<SSABlock>,
        cfg: &ControlFlowGraph,
    ) -> Result<(), String> {
        // For each variable, insert phi nodes at dominance frontiers
        for (var_name, def_blocks) in &self.variable_defs {
            let mut work_list: VecDeque<usize> = def_blocks.iter().cloned().collect();
            let mut processed: HashSet<usize> = HashSet::new();

            while let Some(block_id) = work_list.pop_front() {
                if let Some(df) = cfg.dominance_frontiers.get(&block_id) {
                    for &frontier in df {
                        if !processed.contains(&frontier) {
                            processed.insert(frontier);

                            // Insert phi node
                            let phi_var = SSAVar {
                                name: var_name.clone(),
                                version: 0, // Will be renamed later
                                size: 4, // Default size
                            };

                            self.phi_nodes
                                .entry(frontier)
                                .or_insert_with(Vec::new)
                                .push((var_name.clone(), phi_var));

                            work_list.push_back(frontier);
                        }
                    }
                }
            }
        }

        // Insert phi nodes into blocks
        for (block_id, phi_list) in &self.phi_nodes {
            if let Some(block) = blocks.get_mut(*block_id) {
                for (_, phi_var) in phi_list {
                    // Create phi sources from predecessors
                    let sources: Vec<(usize, SSAVar)> = block.predecessors.iter()
                        .map(|&pred| {
                            (pred, SSAVar {
                                name: phi_var.name.clone(),
                                version: 0, // Will be renamed
                                size: phi_var.size,
                            })
                        })
                        .collect();

                    block.statements.insert(0, SSAStatement::Phi {
                        dest: phi_var.clone(),
                        sources,
                    });
                }
            }
        }

        Ok(())
    }

    fn rename_variables(
        &mut self,
        blocks: &mut Vec<SSABlock>,
        cfg: &ControlFlowGraph,
    ) -> Result<(), String> {
        let mut stacks: HashMap<String, Vec<usize>> = HashMap::new();
        let mut visited: HashSet<usize> = HashSet::new();

        self.rename_block(cfg.entry_block, blocks, cfg, &mut stacks, &mut visited)?;

        Ok(())
    }

    fn rename_block(
        &mut self,
        block_id: usize,
        blocks: &mut Vec<SSABlock>,
        cfg: &ControlFlowGraph,
        stacks: &mut HashMap<String, Vec<usize>>,
        visited: &mut HashSet<usize>,
    ) -> Result<(), String> {
        if visited.contains(&block_id) || block_id >= blocks.len() {
            return Ok(());
        }
        visited.insert(block_id);

        // Track what we pushed on stacks for later cleanup
        let mut pushed: Vec<String> = Vec::new();

        // Process phi nodes first
        for stmt in &mut blocks[block_id].statements {
            if let SSAStatement::Phi { dest, .. } = stmt {
                let version = stacks.entry(dest.name.clone())
                    .or_insert_with(Vec::new)
                    .len() + 1;
                dest.version = version;
                stacks.get_mut(&dest.name).unwrap().push(version);
                pushed.push(dest.name.clone());
            }
        }

        // Process other statements
        for stmt in &mut blocks[block_id].statements {
            match stmt {
                SSAStatement::Assign { dest, value } => {
                    // Rename uses in value
                    self.rename_value(value, stacks);

                    // Assign new version to dest
                    let version = stacks.entry(dest.name.clone())
                        .or_insert_with(Vec::new)
                        .len() + 1;
                    dest.version = version;
                    stacks.get_mut(&dest.name).unwrap().push(version);
                    pushed.push(dest.name.clone());
                }
                SSAStatement::Store { address, value, .. } => {
                    self.rename_value(address, stacks);
                    self.rename_value(value, stacks);
                }
                SSAStatement::BranchCond { condition, .. } => {
                    self.rename_value(condition, stacks);
                }
                SSAStatement::Call { target, args, result } => {
                    self.rename_value(target, stacks);
                    for arg in args {
                        self.rename_value(arg, stacks);
                    }
                    if let Some(res) = result {
                        let version = stacks.entry(res.name.clone())
                            .or_insert_with(Vec::new)
                            .len() + 1;
                        res.version = version;
                        stacks.get_mut(&res.name).unwrap().push(version);
                        pushed.push(res.name.clone());
                    }
                }
                SSAStatement::Return { value } => {
                    if let Some(v) = value {
                        self.rename_value(v, stacks);
                    }
                }
                _ => {}
            }
        }

        // Rename phi sources in successor blocks
        for &succ in &blocks[block_id].successors.clone() {
            if succ < blocks.len() {
                for stmt in &mut blocks[succ].statements {
                    if let SSAStatement::Phi { sources, .. } = stmt {
                        for (pred_id, source_var) in sources {
                            if *pred_id == block_id {
                                if let Some(stack) = stacks.get(&source_var.name) {
                                    if let Some(&version) = stack.last() {
                                        source_var.version = version;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Recursively process successors
        for &succ in &blocks[block_id].successors.clone() {
            self.rename_block(succ, blocks, cfg, stacks, visited)?;
        }

        // Pop stacks
        for var_name in pushed {
            if let Some(stack) = stacks.get_mut(&var_name) {
                stack.pop();
            }
        }

        Ok(())
    }

    fn rename_value(&self, value: &mut SSAValue, stacks: &HashMap<String, Vec<usize>>) {
        match value {
            SSAValue::Var(var) => {
                if let Some(stack) = stacks.get(&var.name) {
                    if let Some(&version) = stack.last() {
                        var.version = version;
                    }
                }
            }
            SSAValue::Expr(expr) => {
                for operand in &mut expr.operands {
                    self.rename_value(operand, stacks);
                }
            }
            _ => {}
        }
    }

    fn build_variable_metadata(&self, blocks: &[SSABlock]) -> HashMap<String, SSAVariable> {
        let mut variables: HashMap<String, SSAVariable> = HashMap::new();

        for block in blocks {
            for stmt in &block.statements {
                match stmt {
                    SSAStatement::Assign { dest, .. } | SSAStatement::Phi { dest, .. } => {
                        let var = variables.entry(dest.name.clone())
                            .or_insert_with(|| SSAVariable {
                                base_name: dest.name.clone(),
                                versions: Vec::new(),
                                current_version: 0,
                            });

                        if !var.versions.contains(&dest.version) {
                            var.versions.push(dest.version);
                            var.current_version = var.current_version.max(dest.version);
                        }
                    }
                    _ => {}
                }
            }
        }

        variables
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssa_builder() {
        let mut builder = SSABuilder::new();
        // Test will be expanded with actual IR
        assert_eq!(builder.current_versions.len(), 0);
    }

    #[test]
    fn test_phi_node_creation() {
        let phi_var = SSAVar {
            name: "x".to_string(),
            version: 3,
            size: 4,
        };
        assert_eq!(phi_var.name, "x");
        assert_eq!(phi_var.version, 3);
    }
}

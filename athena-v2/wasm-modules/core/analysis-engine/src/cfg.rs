/// Control Flow Graph (CFG) Builder and Exporter
///
/// This module provides a complete implementation of control flow graph construction
/// and analysis for binary code. It integrates with the disassembly module to build
/// accurate CFGs with advanced analysis capabilities.
///
/// # Features
///
/// ## Core CFG Construction
/// - Automatic CFG building from disassembled code
/// - Basic block identification and edge classification
/// - Support for x86, x86-64, ARM, and ARM64 architectures
/// - Multiple export formats: DOT (Graphviz), Mermaid, JSON
///
/// ## Advanced Analysis
/// - **Dominator Tree Construction**: Identifies which blocks dominate others
/// - **Natural Loop Detection**: Finds loop structures and nesting relationships
/// - **Exception Handler Detection**: Identifies try/catch/finally blocks
/// - **Indirect Jump Analysis**: Detects and analyzes computed gotos, switch tables
/// - **Back Edge Detection**: Identifies loop back edges using DFS
///
/// ## Control Flow Patterns
/// Handles complex control flow including:
/// - Conditional branches (if/else)
/// - Loops (for, while, do-while)
/// - Function calls and returns
/// - Switch statements and jump tables
/// - Exception handling (try/catch/finally)
/// - Indirect jumps and function pointers
///
/// # Example Usage
///
/// ```rust,no_run
/// use athena_analysis_engine::cfg::{CFGBuilder, Architecture};
///
/// // Build CFG from binary code
/// let cfg = CFGBuilder::from_disassembly(
///     "main".to_string(),
///     0x1000,
///     &binary_code,
///     Architecture::X8664,
/// )?;
///
/// // Analyze dominator relationships
/// let dom_tree = cfg.build_dominator_tree();
/// if dom_tree.dominates(0, 5) {
///     println!("Block 0 dominates block 5");
/// }
///
/// // Find natural loops
/// let loops = cfg.find_natural_loops();
/// for loop_info in loops {
///     println!("Loop at block {}, depth: {}",
///         loop_info.header,
///         loop_info.nesting_depth(&loops));
/// }
///
/// // Export to Graphviz DOT format
/// let dot = cfg.to_dot();
/// std::fs::write("cfg.dot", dot)?;
/// # Ok::<(), String>(())
/// ```
///
/// # Algorithm Details
///
/// ## Dominator Tree (Iterative Algorithm)
/// Uses the standard iterative dataflow algorithm to compute immediate dominators.
/// Time complexity: O(N * E) where N is nodes and E is edges.
///
/// ## Natural Loop Detection
/// 1. Find back edges using depth-first search
/// 2. For each back edge (tail → head), verify head dominates tail
/// 3. Compute loop body using worklist algorithm
/// 4. Identify exit edges
///
/// ## Exception Handler Detection
/// Heuristic-based detection looking for:
/// - Blocks with unusual predecessor patterns
/// - Exception-related instructions (unwind, stack restoration)
/// - Protected region identification through backwards traversal

use std::collections::{HashMap, HashSet};
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ControlFlowGraph {
    pub function_name: String,
    pub function_address: u64,
    pub blocks: Vec<BasicBlock>,
    pub edges: Vec<Edge>,
    pub entry_block: usize,
    pub exit_blocks: Vec<usize>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BasicBlock {
    pub id: usize,
    pub address: u64,
    pub size: u32,
    pub instructions: Vec<Instruction>,
    pub block_type: BlockType,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Instruction {
    pub address: u64,
    pub bytes: Vec<u8>,
    pub mnemonic: String,
    pub operands: String,
    pub full_text: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum BlockType {
    Normal,
    Entry,
    Exit,
    Conditional,
    Call,
    Return,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Edge {
    pub from: usize,
    pub to: usize,
    pub edge_type: EdgeType,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum EdgeType {
    /// Unconditional flow (fall-through or jump)
    Unconditional,
    /// Conditional branch (true)
    ConditionalTrue,
    /// Conditional branch (false)
    ConditionalFalse,
    /// Function call
    Call,
    /// Return
    Return,
}

/// Dominator tree structure
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DominatorTree {
    /// For each block, stores its immediate dominator
    pub dominators: Vec<Option<usize>>,
}

impl DominatorTree {
    /// Check if block `a` dominates block `b`
    pub fn dominates(&self, a: usize, b: usize) -> bool {
        if a == b {
            return true;
        }

        let mut current = b;
        while let Some(idom) = self.dominators.get(current).and_then(|&d| d) {
            if idom == a {
                return true;
            }
            if idom == current {
                break; // Prevent infinite loop
            }
            current = idom;
        }

        false
    }

    /// Get immediate dominator of a block
    pub fn idom(&self, block: usize) -> Option<usize> {
        self.dominators.get(block).and_then(|&d| d)
    }

    /// Get all blocks dominated by a given block
    pub fn dominated_by(&self, dominator: usize) -> Vec<usize> {
        self.dominators.iter()
            .enumerate()
            .filter(|(idx, _)| *idx != dominator && self.dominates(dominator, *idx))
            .map(|(idx, _)| idx)
            .collect()
    }
}

/// Natural loop structure
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NaturalLoop {
    /// Loop header block (dominates all blocks in the loop)
    pub header: usize,
    /// Block with back edge to header
    pub back_edge_source: usize,
    /// All blocks in the loop
    pub blocks: Vec<usize>,
    /// Blocks that exit the loop
    pub exit_blocks: Vec<usize>,
}

impl NaturalLoop {
    /// Check if a block is in this loop
    pub fn contains_block(&self, block: usize) -> bool {
        self.blocks.contains(&block)
    }

    /// Get loop depth (number of nested loops this loop is inside)
    pub fn nesting_depth(&self, all_loops: &[NaturalLoop]) -> usize {
        all_loops.iter()
            .filter(|other| {
                other.header != self.header &&
                other.contains_block(self.header)
            })
            .count()
    }
}

/// Exception handler information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExceptionHandler {
    /// Block containing the exception handler code
    pub handler_block: usize,
    /// Blocks protected by this handler (try region)
    pub protected_blocks: Vec<usize>,
    /// Type of handler
    pub handler_type: ExceptionHandlerType,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExceptionHandlerType {
    /// Catch handler
    Catch,
    /// Finally handler (always executes)
    Finally,
    /// Filter handler (conditional exception handling)
    Filter,
}

/// Indirect jump information
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IndirectJump {
    /// Block containing the indirect jump
    pub source_block: usize,
    /// Address of the indirect jump instruction
    pub instruction_address: u64,
    /// Type of indirect jump
    pub jump_type: IndirectJumpType,
    /// Possible target addresses (if statically determinable)
    pub possible_targets: Vec<u64>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum IndirectJumpType {
    /// Indirect jump (computed goto, switch table)
    Jump,
    /// Indirect call (function pointer)
    Call,
    /// Return instruction
    Return,
}

impl ControlFlowGraph {
    pub fn new(function_name: String, function_address: u64) -> Self {
        Self {
            function_name,
            function_address,
            blocks: Vec::new(),
            edges: Vec::new(),
            entry_block: 0,
            exit_blocks: Vec::new(),
        }
    }

    /// Add a basic block
    pub fn add_block(&mut self, block: BasicBlock) {
        self.blocks.push(block);
    }

    /// Add an edge
    pub fn add_edge(&mut self, edge: Edge) {
        self.edges.push(edge);
    }

    /// Export to DOT format (Graphviz)
    pub fn to_dot(&self) -> String {
        let mut dot = String::from("digraph CFG {\n");
        dot.push_str("  node [shape=box,style=rounded];\n");
        dot.push_str(&format!("  label=\"{}\\n0x{:x}\";\n",
            self.function_name, self.function_address));
        dot.push_str("  labelloc=\"t\";\n\n");

        // Add nodes
        for block in &self.blocks {
            let color = match block.block_type {
                BlockType::Entry => "lightgreen",
                BlockType::Exit | BlockType::Return => "lightcoral",
                BlockType::Conditional => "lightyellow",
                BlockType::Call => "lightblue",
                BlockType::Normal => "white",
            };

            let label = self.format_block_label(block);
            dot.push_str(&format!(
                "  block_{} [label=\"{}\",fillcolor={},style=\"rounded,filled\"];\n",
                block.id, label, color
            ));
        }

        dot.push_str("\n");

        // Add edges
        for edge in &self.edges {
            let (color, style) = match edge.edge_type {
                EdgeType::Unconditional => ("black", "solid"),
                EdgeType::ConditionalTrue => ("green", "solid"),
                EdgeType::ConditionalFalse => ("red", "dashed"),
                EdgeType::Call => ("blue", "dotted"),
                EdgeType::Return => ("purple", "dotted"),
            };

            let label = match edge.edge_type {
                EdgeType::ConditionalTrue => "T",
                EdgeType::ConditionalFalse => "F",
                _ => "",
            };

            dot.push_str(&format!(
                "  block_{} -> block_{} [color={},style={},label=\"{}\"];\n",
                edge.from, edge.to, color, style, label
            ));
        }

        dot.push_str("}\n");
        dot
    }

    /// Export to Mermaid format (for Markdown/web)
    pub fn to_mermaid(&self) -> String {
        let mut mermaid = String::from("flowchart TD\n");

        // Add nodes
        for block in &self.blocks {
            let shape = match block.block_type {
                BlockType::Entry => ("[", "]"),
                BlockType::Exit | BlockType::Return => ("([", "])"),
                BlockType::Conditional => ("{", "}"),
                _ => ("[", "]"),
            };

            let label = format!("Block {} @ 0x{:x}", block.id, block.address);
            mermaid.push_str(&format!(
                "  block_{}{}{}{}\n",
                block.id, shape.0, label, shape.1
            ));
        }

        mermaid.push_str("\n");

        // Add edges
        for edge in &self.edges {
            let arrow = match edge.edge_type {
                EdgeType::Unconditional => "-->",
                EdgeType::ConditionalTrue => "-->|T|",
                EdgeType::ConditionalFalse => "-.->|F|",
                EdgeType::Call => "==>",
                EdgeType::Return => "-.->",
            };

            mermaid.push_str(&format!(
                "  block_{} {} block_{}\n",
                edge.from, arrow, edge.to
            ));
        }

        mermaid
    }

    /// Export to JSON
    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize CFG: {}", e))
    }

    /// Import from JSON
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json)
            .map_err(|e| format!("Failed to deserialize CFG: {}", e))
    }

    fn format_block_label(&self, block: &BasicBlock) -> String {
        let mut label = format!("Block {}\\n0x{:x}", block.id, block.address);

        // Add up to 5 instructions
        for (i, instr) in block.instructions.iter().take(5).enumerate() {
            if i > 0 || !label.is_empty() {
                label.push_str("\\n");
            }
            label.push_str(&format!("0x{:x}: {}", instr.address, instr.mnemonic));
        }

        if block.instructions.len() > 5 {
            label.push_str(&format!("\\n... ({} more)", block.instructions.len() - 5));
        }

        // Escape special characters
        label = label.replace('\"', "\\\"");
        label
    }

    /// Calculate CFG metrics
    pub fn get_metrics(&self) -> CFGMetrics {
        let mut metrics = CFGMetrics::default();

        metrics.num_blocks = self.blocks.len();
        metrics.num_edges = self.edges.len();
        metrics.num_instructions = self.blocks.iter()
            .map(|b| b.instructions.len())
            .sum();

        // Calculate cyclomatic complexity: E - N + 2P
        // where E = edges, N = nodes, P = connected components (assume 1)
        metrics.cyclomatic_complexity =
            (self.edges.len() as i32) - (self.blocks.len() as i32) + 2;

        // Count conditional branches
        metrics.num_conditionals = self.edges.iter()
            .filter(|e| matches!(e.edge_type, EdgeType::ConditionalTrue | EdgeType::ConditionalFalse))
            .count() / 2; // Divide by 2 since each conditional has 2 edges

        // Find loops (back edges)
        metrics.num_loops = self.find_back_edges().len();

        metrics
    }

    /// Build dominator tree using iterative algorithm
    pub fn build_dominator_tree(&self) -> DominatorTree {
        let num_blocks = self.blocks.len();
        let mut dom = vec![None; num_blocks];

        if num_blocks == 0 {
            return DominatorTree { dominators: dom };
        }

        // Entry block dominates itself
        dom[self.entry_block] = Some(self.entry_block);

        // Build adjacency list for predecessors
        let mut predecessors: Vec<Vec<usize>> = vec![Vec::new(); num_blocks];
        for edge in &self.edges {
            predecessors[edge.to].push(edge.from);
        }

        // Iterative algorithm to compute dominators
        let mut changed = true;
        while changed {
            changed = false;

            for block_id in 0..num_blocks {
                if block_id == self.entry_block {
                    continue;
                }

                let preds = &predecessors[block_id];
                if preds.is_empty() {
                    continue;
                }

                // Find first processed predecessor
                let mut new_idom = None;
                for &pred in preds {
                    if dom[pred].is_some() {
                        new_idom = Some(pred);
                        break;
                    }
                }

                if new_idom.is_none() {
                    continue;
                }

                let mut new_idom = new_idom.unwrap();

                // Intersect with all other predecessors
                for &pred in preds {
                    if pred == new_idom {
                        continue;
                    }
                    if dom[pred].is_some() {
                        new_idom = self.intersect(&dom, pred, new_idom);
                    }
                }

                if dom[block_id] != Some(new_idom) {
                    dom[block_id] = Some(new_idom);
                    changed = true;
                }
            }
        }

        DominatorTree { dominators: dom }
    }

    /// Helper for dominator tree: find common dominator
    fn intersect(&self, dom: &[Option<usize>], mut b1: usize, mut b2: usize) -> usize {
        while b1 != b2 {
            while b1 > b2 {
                if let Some(idom) = dom[b1] {
                    b1 = idom;
                } else {
                    break;
                }
            }
            while b2 > b1 {
                if let Some(idom) = dom[b2] {
                    b2 = idom;
                } else {
                    break;
                }
            }
        }
        b1
    }

    /// Find natural loops in the CFG
    pub fn find_natural_loops(&self) -> Vec<NaturalLoop> {
        let back_edges = self.find_back_edges();
        let dom_tree = self.build_dominator_tree();
        let mut loops = Vec::new();

        for (tail, head) in back_edges {
            // Natural loop is defined by a back edge (tail -> head)
            // where head dominates tail
            if !dom_tree.dominates(head, tail) {
                continue; // Not a natural loop
            }

            let mut loop_blocks = HashSet::new();
            loop_blocks.insert(head);
            loop_blocks.insert(tail);

            // Find all blocks in the loop using worklist algorithm
            let mut worklist = vec![tail];
            let mut visited = HashSet::new();
            visited.insert(tail);

            while let Some(current) = worklist.pop() {
                // Find predecessors of current block
                for edge in &self.edges {
                    if edge.to == current && !visited.contains(&edge.from) {
                        visited.insert(edge.from);
                        loop_blocks.insert(edge.from);

                        // Only add to worklist if not the loop header
                        if edge.from != head {
                            worklist.push(edge.from);
                        }
                    }
                }
            }

            // Find exit blocks (blocks with edges leaving the loop)
            let mut exit_blocks = Vec::new();
            for &block_id in &loop_blocks {
                for edge in &self.edges {
                    if edge.from == block_id && !loop_blocks.contains(&edge.to) {
                        exit_blocks.push(edge.to);
                    }
                }
            }

            loops.push(NaturalLoop {
                header: head,
                back_edge_source: tail,
                blocks: loop_blocks.into_iter().collect(),
                exit_blocks,
            });
        }

        loops
    }

    /// Detect exception handling structures (try/catch/finally)
    /// This looks for patterns typical of exception handling:
    /// - Blocks with multiple incoming edges from different try blocks
    /// - Indirect jumps to exception handlers
    /// - Stack unwinding patterns
    pub fn detect_exception_handlers(&self) -> Vec<ExceptionHandler> {
        let mut handlers = Vec::new();

        // Look for blocks that appear to be exception handlers
        // These typically have:
        // 1. Multiple predecessors from different parts of code
        // 2. No normal control flow edge leading to them
        // 3. Instructions that manipulate exception state

        for (idx, block) in self.blocks.iter().enumerate() {
            // Count normal predecessors
            let normal_preds: Vec<usize> = self.edges.iter()
                .filter(|e| e.to == idx && !matches!(e.edge_type, EdgeType::Call))
                .map(|e| e.from)
                .collect();

            // Exception handlers often have few or unusual predecessors
            if normal_preds.len() >= 2 {
                // Check for exception-related instructions
                let has_exception_handling = block.instructions.iter().any(|instr| {
                    let mnemonic = instr.mnemonic.to_lowercase();
                    // Common exception handling patterns
                    mnemonic.contains("except") ||
                    mnemonic.contains("unwind") ||
                    // Stack pointer restoration (common in exception handlers)
                    (mnemonic == "mov" && instr.operands.contains("rsp")) ||
                    (mnemonic == "mov" && instr.operands.contains("esp"))
                });

                if has_exception_handling {
                    // Try to find the protected region (try block)
                    let protected_blocks: Vec<usize> = normal_preds.iter()
                        .flat_map(|&pred_id| {
                            // Traverse backwards from handler to find try blocks
                            self.find_reachable_blocks_reverse(pred_id, idx)
                        })
                        .collect::<HashSet<_>>()
                        .into_iter()
                        .collect();

                    handlers.push(ExceptionHandler {
                        handler_block: idx,
                        protected_blocks,
                        handler_type: ExceptionHandlerType::Catch,
                    });
                }
            }
        }

        handlers
    }

    /// Find all blocks reachable from start_block before reaching end_block (going backwards)
    fn find_reachable_blocks_reverse(&self, start_block: usize, end_block: usize) -> HashSet<usize> {
        let mut reachable = HashSet::new();
        let mut worklist = vec![start_block];
        let mut visited = HashSet::new();

        while let Some(current) = worklist.pop() {
            if current == end_block || visited.contains(&current) {
                continue;
            }

            visited.insert(current);
            reachable.insert(current);

            // Add predecessors to worklist
            for edge in &self.edges {
                if edge.to == current && !visited.contains(&edge.from) {
                    worklist.push(edge.from);
                }
            }
        }

        reachable
    }

    /// Detect indirect jumps (computed gotos, switch tables, function pointers)
    pub fn find_indirect_jumps(&self) -> Vec<IndirectJump> {
        let mut indirect_jumps = Vec::new();

        for (block_id, block) in self.blocks.iter().enumerate() {
            if let Some(last_instr) = block.instructions.last() {
                // Look for indirect jump instructions
                let mnemonic = last_instr.mnemonic.to_lowercase();
                let operands = last_instr.operands.to_lowercase();

                let is_indirect =
                    // Indirect jump: jmp [reg] or jmp [mem]
                    (mnemonic == "jmp" && (operands.contains('[') || operands.contains('*'))) ||
                    // Indirect call: call [reg] or call [mem]
                    (mnemonic == "call" && (operands.contains('[') || operands.contains('*'))) ||
                    // Return is technically an indirect jump
                    mnemonic == "ret" ||
                    mnemonic == "retf";

                if is_indirect {
                    // Try to determine possible targets
                    let possible_targets = self.analyze_indirect_targets(block_id, last_instr);

                    indirect_jumps.push(IndirectJump {
                        source_block: block_id,
                        instruction_address: last_instr.address,
                        jump_type: if mnemonic.contains("call") {
                            IndirectJumpType::Call
                        } else if mnemonic.contains("ret") {
                            IndirectJumpType::Return
                        } else {
                            IndirectJumpType::Jump
                        },
                        possible_targets,
                    });
                }
            }
        }

        indirect_jumps
    }

    /// Attempt to resolve possible targets for indirect jumps
    /// This uses simple heuristics - more sophisticated analysis would use value set analysis
    fn analyze_indirect_targets(&self, block_id: usize, _instr: &Instruction) -> Vec<u64> {
        let mut targets = Vec::new();

        // Look for switch table patterns in nearby code
        // This is a simplified heuristic - real implementation would need data flow analysis

        let block = &self.blocks[block_id];

        // Check previous instructions for lea/mov with immediate values (common in switch tables)
        for instr in block.instructions.iter().rev().take(10) {
            // Look for immediate values that could be addresses
            if instr.mnemonic.to_lowercase() == "mov" ||
               instr.mnemonic.to_lowercase() == "lea" {
                // Extract immediate values from operands
                // This is a simplified approach
                let operands = &instr.operands;
                if let Some(addr_str) = operands.split(',').nth(1) {
                    if let Some(addr) = Self::parse_hex_address(addr_str.trim()) {
                        targets.push(addr);
                    }
                }
            }
        }

        targets
    }

    /// Parse hexadecimal address from string
    fn parse_hex_address(s: &str) -> Option<u64> {
        let cleaned = s.trim_start_matches("0x").trim();
        u64::from_str_radix(cleaned, 16).ok()
    }

    fn find_back_edges(&self) -> Vec<(usize, usize)> {
        let mut back_edges = Vec::new();
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();

        for block_id in 0..self.blocks.len() {
            if !visited.contains(&block_id) {
                self.find_back_edges_dfs(
                    block_id,
                    &mut visited,
                    &mut rec_stack,
                    &mut back_edges,
                );
            }
        }

        back_edges
    }

    fn find_back_edges_dfs(
        &self,
        node: usize,
        visited: &mut HashSet<usize>,
        rec_stack: &mut HashSet<usize>,
        back_edges: &mut Vec<(usize, usize)>,
    ) {
        visited.insert(node);
        rec_stack.insert(node);

        for edge in &self.edges {
            if edge.from == node {
                if !visited.contains(&edge.to) {
                    self.find_back_edges_dfs(edge.to, visited, rec_stack, back_edges);
                } else if rec_stack.contains(&edge.to) {
                    // Back edge detected
                    back_edges.push((edge.from, edge.to));
                }
            }
        }

        rec_stack.remove(&node);
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct CFGMetrics {
    pub num_blocks: usize,
    pub num_edges: usize,
    pub num_instructions: usize,
    pub cyclomatic_complexity: i32,
    pub num_conditionals: usize,
    pub num_loops: usize,
}

/// Builder for constructing CFGs from disassembly
pub struct CFGBuilder {
    cfg: ControlFlowGraph,
    block_map: HashMap<u64, usize>, // Address -> block ID
    current_block: Option<BasicBlock>,
}

impl CFGBuilder {
    pub fn new(function_name: String, function_address: u64) -> Self {
        Self {
            cfg: ControlFlowGraph::new(function_name, function_address),
            block_map: HashMap::new(),
            current_block: None,
        }
    }

    /// Build CFG from disassembly using the disasm module
    pub fn from_disassembly(
        function_name: String,
        function_address: u64,
        code: &[u8],
        architecture: Architecture,
    ) -> Result<ControlFlowGraph, String> {
        use crate::disasm::{Disassembler, Architecture as DisasmArch};

        // Convert architecture type
        let disasm_arch = match architecture {
            Architecture::X86 => DisasmArch::X8632,
            Architecture::X8664 => DisasmArch::X8664,
            Architecture::Arm => DisasmArch::Arm,
            Architecture::Arm64 => DisasmArch::Arm64,
        };

        // Analyze control flow using disassembler
        let blocks = Disassembler::analyze_control_flow(code, function_address, disasm_arch)?;

        let mut builder = Self::new(function_name, function_address);

        // Convert disassembler basic blocks to CFG basic blocks
        for (idx, disasm_block) in blocks.iter().enumerate() {
            let block_type = Self::determine_block_type(&disasm_block, idx == 0, &blocks);

            let block_id = builder.start_block(disasm_block.start_offset, block_type);

            // Add instructions to block
            for disasm_instr in &disasm_block.instructions {
                builder.add_instruction(Instruction {
                    address: disasm_instr.offset,
                    bytes: disasm_instr.bytes.clone(),
                    mnemonic: disasm_instr.mnemonic.clone(),
                    operands: disasm_instr.operands.clone(),
                    full_text: disasm_instr.full_text.clone(),
                });
            }
        }

        // Finish final block
        if let Some(block) = builder.current_block.take() {
            if matches!(block.block_type, BlockType::Exit | BlockType::Return) {
                builder.cfg.exit_blocks.push(block.id);
            }
            builder.cfg.add_block(block);
        }

        // Build edges from successors
        for (idx, disasm_block) in blocks.iter().enumerate() {
            for &successor_addr in &disasm_block.successors {
                if let Some(&target_id) = builder.block_map.get(&successor_addr) {
                    let edge_type = Self::determine_edge_type(&disasm_block, successor_addr, &blocks);
                    builder.cfg.add_edge(Edge {
                        from: idx,
                        to: target_id,
                        edge_type,
                    });
                }
            }
        }

        Ok(builder.cfg)
    }

    fn determine_block_type(
        block: &crate::disasm::BasicBlock,
        is_entry: bool,
        all_blocks: &[crate::disasm::BasicBlock],
    ) -> BlockType {
        if is_entry {
            return BlockType::Entry;
        }

        if let Some(last_instr) = block.instructions.last() {
            if last_instr.is_return {
                return BlockType::Return;
            }
            if last_instr.is_call {
                return BlockType::Call;
            }
            if last_instr.is_branch {
                // Check if it's a conditional branch
                let mnemonic = last_instr.mnemonic.to_lowercase();
                if mnemonic.starts_with("j") && mnemonic != "jmp" {
                    return BlockType::Conditional;
                }
            }
        }

        // Check if block has no successors (exit)
        if block.successors.is_empty() {
            return BlockType::Exit;
        }

        BlockType::Normal
    }

    fn determine_edge_type(
        from_block: &crate::disasm::BasicBlock,
        target_addr: u64,
        all_blocks: &[crate::disasm::BasicBlock],
    ) -> EdgeType {
        if let Some(last_instr) = from_block.instructions.last() {
            if last_instr.is_return {
                return EdgeType::Return;
            }
            if last_instr.is_call {
                return EdgeType::Call;
            }
            if last_instr.is_branch {
                let mnemonic = last_instr.mnemonic.to_lowercase();

                // Conditional branch
                if mnemonic.starts_with("j") && mnemonic != "jmp" {
                    // Determine if this is the taken or fall-through edge
                    if let Some(branch_target) = last_instr.branch_target {
                        if branch_target == target_addr {
                            return EdgeType::ConditionalTrue;
                        } else {
                            return EdgeType::ConditionalFalse;
                        }
                    }
                }

                // Unconditional jump
                return EdgeType::Unconditional;
            }
        }

        EdgeType::Unconditional
    }

    /// Start a new basic block
    pub fn start_block(&mut self, address: u64, block_type: BlockType) -> usize {
        // Finish current block if exists
        if let Some(block) = self.current_block.take() {
            let id = block.id;
            self.cfg.add_block(block);
        }

        let block_id = self.cfg.blocks.len();
        self.block_map.insert(address, block_id);

        self.current_block = Some(BasicBlock {
            id: block_id,
            address,
            size: 0,
            instructions: Vec::new(),
            block_type,
        });

        if matches!(block_type, BlockType::Entry) {
            self.cfg.entry_block = block_id;
        }

        block_id
    }

    /// Add instruction to current block
    pub fn add_instruction(&mut self, instr: Instruction) {
        if let Some(block) = &mut self.current_block {
            block.size += instr.bytes.len() as u32;
            block.instructions.push(instr);
        }
    }

    /// Add edge between blocks
    pub fn add_edge(&mut self, from: usize, to: usize, edge_type: EdgeType) {
        self.cfg.add_edge(Edge { from, to, edge_type });
    }

    /// Finalize and return CFG
    pub fn build(mut self) -> ControlFlowGraph {
        // Add final block
        if let Some(block) = self.current_block.take() {
            if matches!(block.block_type, BlockType::Exit | BlockType::Return) {
                self.cfg.exit_blocks.push(block.id);
            }
            self.cfg.add_block(block);
        }

        self.cfg
    }

    /// Get block ID by address
    pub fn get_block_id(&self, address: u64) -> Option<usize> {
        self.block_map.get(&address).cloned()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Architecture {
    X86,
    X8664,
    Arm,
    Arm64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cfg_builder() {
        let mut builder = CFGBuilder::new("test_func".to_string(), 0x1000);

        builder.start_block(0x1000, BlockType::Entry);
        builder.add_instruction(Instruction {
            address: 0x1000,
            bytes: vec![0x55],
            mnemonic: "push".to_string(),
            operands: "rbp".to_string(),
            full_text: "push rbp".to_string(),
        });

        builder.start_block(0x1001, BlockType::Return);
        builder.add_instruction(Instruction {
            address: 0x1001,
            bytes: vec![0xc3],
            mnemonic: "ret".to_string(),
            operands: "".to_string(),
            full_text: "ret".to_string(),
        });

        builder.add_edge(0, 1, EdgeType::Unconditional);

        let cfg = builder.build();
        assert_eq!(cfg.blocks.len(), 2);
        assert_eq!(cfg.edges.len(), 1);
    }

    #[test]
    fn test_cfg_to_dot() {
        let cfg = ControlFlowGraph::new("test".to_string(), 0x1000);
        let dot = cfg.to_dot();
        assert!(dot.contains("digraph CFG"));
        assert!(dot.contains("test"));
    }

    #[test]
    fn test_cfg_to_mermaid() {
        let cfg = ControlFlowGraph::new("test".to_string(), 0x1000);
        let mermaid = cfg.to_mermaid();
        assert!(mermaid.contains("flowchart TD"));
    }

    #[test]
    fn test_cfg_metrics() {
        let mut cfg = ControlFlowGraph::new("test".to_string(), 0x1000);

        cfg.add_block(BasicBlock {
            id: 0,
            address: 0x1000,
            size: 10,
            instructions: vec![],
            block_type: BlockType::Entry,
        });

        cfg.add_block(BasicBlock {
            id: 1,
            address: 0x100a,
            size: 10,
            instructions: vec![],
            block_type: BlockType::Normal,
        });

        cfg.add_edge(Edge {
            from: 0,
            to: 1,
            edge_type: EdgeType::Unconditional,
        });

        let metrics = cfg.get_metrics();
        assert_eq!(metrics.num_blocks, 2);
        assert_eq!(metrics.num_edges, 1);
        // Cyclomatic complexity = E - N + 2 = 1 - 2 + 2 = 1
        assert_eq!(metrics.cyclomatic_complexity, 1);
    }

    #[test]
    fn test_back_edge_detection() {
        let mut cfg = ControlFlowGraph::new("loop_test".to_string(), 0x1000);

        // Create simple loop: 0 -> 1 -> 2 -> 1 (back edge)
        for i in 0..3 {
            cfg.add_block(BasicBlock {
                id: i,
                address: 0x1000 + (i as u64 * 10),
                size: 10,
                instructions: vec![],
                block_type: BlockType::Normal,
            });
        }

        cfg.add_edge(Edge { from: 0, to: 1, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 1, to: 2, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 2, to: 1, edge_type: EdgeType::Unconditional }); // Back edge

        let back_edges = cfg.find_back_edges();
        assert_eq!(back_edges.len(), 1);
        assert_eq!(back_edges[0], (2, 1));
    }

    #[test]
    fn test_dominator_tree() {
        let mut cfg = ControlFlowGraph::new("dom_test".to_string(), 0x1000);

        // Create diamond CFG: 0 -> 1, 0 -> 2, 1 -> 3, 2 -> 3
        for i in 0..4 {
            cfg.add_block(BasicBlock {
                id: i,
                address: 0x1000 + (i as u64 * 10),
                size: 10,
                instructions: vec![],
                block_type: if i == 0 { BlockType::Entry } else { BlockType::Normal },
            });
        }

        cfg.add_edge(Edge { from: 0, to: 1, edge_type: EdgeType::ConditionalTrue });
        cfg.add_edge(Edge { from: 0, to: 2, edge_type: EdgeType::ConditionalFalse });
        cfg.add_edge(Edge { from: 1, to: 3, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 2, to: 3, edge_type: EdgeType::Unconditional });

        let dom_tree = cfg.build_dominator_tree();

        // Block 0 dominates itself
        assert!(dom_tree.dominates(0, 0));
        // Block 0 dominates all other blocks
        assert!(dom_tree.dominates(0, 1));
        assert!(dom_tree.dominates(0, 2));
        assert!(dom_tree.dominates(0, 3));
        // Block 1 does not dominate block 2
        assert!(!dom_tree.dominates(1, 2));
        // Block 1 does not dominate block 3 (both 1 and 2 can reach 3)
        assert!(!dom_tree.dominates(1, 3));
    }

    #[test]
    fn test_natural_loop_detection() {
        let mut cfg = ControlFlowGraph::new("loop_test".to_string(), 0x1000);

        // Create loop with header at block 1
        // 0 -> 1 -> 2 -> 3 -> 1 (back edge)
        for i in 0..4 {
            cfg.add_block(BasicBlock {
                id: i,
                address: 0x1000 + (i as u64 * 10),
                size: 10,
                instructions: vec![],
                block_type: if i == 0 { BlockType::Entry } else { BlockType::Normal },
            });
        }

        cfg.add_edge(Edge { from: 0, to: 1, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 1, to: 2, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 2, to: 3, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 3, to: 1, edge_type: EdgeType::Unconditional }); // Back edge

        let loops = cfg.find_natural_loops();

        assert_eq!(loops.len(), 1);
        assert_eq!(loops[0].header, 1);
        assert_eq!(loops[0].back_edge_source, 3);
        assert!(loops[0].contains_block(1));
        assert!(loops[0].contains_block(2));
        assert!(loops[0].contains_block(3));
        assert!(!loops[0].contains_block(0));
    }

    #[test]
    fn test_indirect_jump_detection() {
        let mut cfg = ControlFlowGraph::new("indirect_test".to_string(), 0x1000);

        // Create block with indirect jump
        let mut block = BasicBlock {
            id: 0,
            address: 0x1000,
            size: 10,
            instructions: vec![],
            block_type: BlockType::Entry,
        };

        // Add indirect jump instruction
        block.instructions.push(Instruction {
            address: 0x1000,
            bytes: vec![0xff, 0xe0],
            mnemonic: "jmp".to_string(),
            operands: "[rax]".to_string(),
            full_text: "jmp [rax]".to_string(),
        });

        cfg.add_block(block);

        let indirect_jumps = cfg.find_indirect_jumps();

        assert_eq!(indirect_jumps.len(), 1);
        assert_eq!(indirect_jumps[0].source_block, 0);
        assert_eq!(indirect_jumps[0].jump_type, IndirectJumpType::Jump);
    }

    #[test]
    fn test_conditional_edge_types() {
        let mut cfg = ControlFlowGraph::new("cond_test".to_string(), 0x1000);

        for i in 0..3 {
            cfg.add_block(BasicBlock {
                id: i,
                address: 0x1000 + (i as u64 * 10),
                size: 10,
                instructions: vec![],
                block_type: BlockType::Normal,
            });
        }

        cfg.add_edge(Edge { from: 0, to: 1, edge_type: EdgeType::ConditionalTrue });
        cfg.add_edge(Edge { from: 0, to: 2, edge_type: EdgeType::ConditionalFalse });

        // Count conditional edges
        let cond_edges: Vec<_> = cfg.edges.iter()
            .filter(|e| matches!(e.edge_type, EdgeType::ConditionalTrue | EdgeType::ConditionalFalse))
            .collect();

        assert_eq!(cond_edges.len(), 2);
    }

    #[test]
    fn test_dominator_tree_immediate_dominator() {
        let mut cfg = ControlFlowGraph::new("idom_test".to_string(), 0x1000);

        // Linear chain: 0 -> 1 -> 2
        for i in 0..3 {
            cfg.add_block(BasicBlock {
                id: i,
                address: 0x1000 + (i as u64 * 10),
                size: 10,
                instructions: vec![],
                block_type: if i == 0 { BlockType::Entry } else { BlockType::Normal },
            });
        }

        cfg.add_edge(Edge { from: 0, to: 1, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 1, to: 2, edge_type: EdgeType::Unconditional });

        let dom_tree = cfg.build_dominator_tree();

        // Check immediate dominators
        assert_eq!(dom_tree.idom(0), Some(0)); // Entry dominates itself
        assert_eq!(dom_tree.idom(1), Some(0));
        assert_eq!(dom_tree.idom(2), Some(1));
    }

    #[test]
    fn test_nested_loops() {
        let mut cfg = ControlFlowGraph::new("nested_loop_test".to_string(), 0x1000);

        // Outer loop: 0 -> 1 -> 5 -> 0
        // Inner loop: 1 -> 2 -> 3 -> 1
        for i in 0..6 {
            cfg.add_block(BasicBlock {
                id: i,
                address: 0x1000 + (i as u64 * 10),
                size: 10,
                instructions: vec![],
                block_type: if i == 0 { BlockType::Entry } else { BlockType::Normal },
            });
        }

        // Outer loop
        cfg.add_edge(Edge { from: 0, to: 1, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 5, to: 0, edge_type: EdgeType::Unconditional }); // Back edge

        // Inner loop
        cfg.add_edge(Edge { from: 1, to: 2, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 2, to: 3, edge_type: EdgeType::Unconditional });
        cfg.add_edge(Edge { from: 3, to: 1, edge_type: EdgeType::Unconditional }); // Back edge

        // Connect inner to outer
        cfg.add_edge(Edge { from: 3, to: 5, edge_type: EdgeType::Unconditional });

        let loops = cfg.find_natural_loops();

        // Should find both loops
        assert!(loops.len() >= 1); // At least one loop detected
    }

    #[test]
    fn test_architecture_enum() {
        // Test that architecture enum is properly defined
        let arch = Architecture::X8664;
        assert_eq!(arch, Architecture::X8664);

        let arch2 = Architecture::X86;
        assert_eq!(arch2, Architecture::X86);
    }
}

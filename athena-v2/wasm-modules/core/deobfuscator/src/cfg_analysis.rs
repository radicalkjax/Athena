use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Control Flow Graph representation for CFF detection
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SimpleCfg {
    pub blocks: Vec<SimpleBlock>,
    pub edges: Vec<(usize, usize)>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SimpleBlock {
    pub id: usize,
    pub address: u64,
    pub instructions: Vec<String>,
}

/// Control Flow Flattening detection result
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ControlFlowFlatteningDetection {
    pub detected: bool,
    pub dispatcher_address: Option<u64>,
    pub state_variable: Option<String>,
    pub num_states: usize,
    pub confidence: f64,
    pub details: CffDetails,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CffDetails {
    pub dispatcher_blocks: Vec<usize>,
    pub dispatcher_out_degree: usize,
    pub blocks_returning_to_dispatcher: usize,
    pub total_blocks: usize,
    pub return_ratio: f64,
    pub switch_patterns: Vec<SwitchPattern>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SwitchPattern {
    pub block_id: usize,
    pub pattern_type: SwitchPatternType,
    pub confidence: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum SwitchPatternType {
    /// Multiple comparisons (if-else chain)
    ComparisonChain,
    /// Jump table based switch
    JumpTable,
    /// Direct switch/case statement
    SwitchStatement,
}

impl Default for ControlFlowFlatteningDetection {
    fn default() -> Self {
        Self {
            detected: false,
            dispatcher_address: None,
            state_variable: None,
            num_states: 0,
            confidence: 0.0,
            details: CffDetails {
                dispatcher_blocks: Vec::new(),
                dispatcher_out_degree: 0,
                blocks_returning_to_dispatcher: 0,
                total_blocks: 0,
                return_ratio: 0.0,
                switch_patterns: Vec::new(),
            },
        }
    }
}

/// Detect control flow flattening in binary code
pub fn detect_control_flow_flattening(
    code: &[u8],
    cfg: Option<&SimpleCfg>,
) -> ControlFlowFlatteningDetection {
    // If we have a CFG, use structural analysis
    if let Some(cfg) = cfg {
        detect_from_cfg(cfg)
    } else {
        // Fall back to pattern-based detection on raw bytes
        detect_from_bytes(code)
    }
}

/// Detect CFF using CFG structure
fn detect_from_cfg(cfg: &SimpleCfg) -> ControlFlowFlatteningDetection {
    let mut result = ControlFlowFlatteningDetection::default();
    let total_blocks = cfg.blocks.len();

    if total_blocks < 5 {
        // Too small to be flattened
        return result;
    }

    result.details.total_blocks = total_blocks;

    // Build adjacency lists for analysis
    let (out_edges, in_edges) = build_adjacency_lists(cfg);

    // 1. Find potential dispatcher blocks (high out-degree)
    let mut dispatcher_candidates = Vec::new();
    for (block_id, edges) in out_edges.iter().enumerate() {
        let out_degree = edges.len();

        // Heuristic: Dispatcher typically has > 10 outgoing edges (or > 30% of blocks)
        let degree_threshold = std::cmp::max(10, total_blocks / 3);
        if out_degree >= degree_threshold {
            dispatcher_candidates.push((block_id, out_degree));
        }
    }

    if dispatcher_candidates.is_empty() {
        return result;
    }

    // Sort by out-degree (highest first)
    dispatcher_candidates.sort_by(|a, b| b.1.cmp(&a.1));

    // Take the block with highest out-degree as primary dispatcher
    let (dispatcher_id, dispatcher_out_degree) = dispatcher_candidates[0];
    result.details.dispatcher_blocks.push(dispatcher_id);
    result.details.dispatcher_out_degree = dispatcher_out_degree;

    if let Some(dispatcher_block) = cfg.blocks.get(dispatcher_id) {
        result.dispatcher_address = Some(dispatcher_block.address);

        // Detect state variable from instructions
        result.state_variable = detect_state_variable(&dispatcher_block.instructions);

        // Detect switch patterns
        result.details.switch_patterns = detect_switch_patterns(dispatcher_block);
    }

    // 2. Count blocks that return to the dispatcher
    let mut blocks_returning = 0;
    for (block_id, edges) in out_edges.iter().enumerate() {
        if block_id == dispatcher_id {
            continue;
        }

        // Check if this block has an edge back to dispatcher
        if edges.contains(&dispatcher_id) {
            blocks_returning += 1;
        }
    }

    result.details.blocks_returning_to_dispatcher = blocks_returning;
    result.details.return_ratio = blocks_returning as f64 / (total_blocks - 1) as f64;

    // 3. Calculate confidence
    let mut confidence_score = 0.0;

    // Factor 1: High dispatcher out-degree (max 0.4)
    let out_degree_ratio = dispatcher_out_degree as f64 / total_blocks as f64;
    confidence_score += (out_degree_ratio * 2.0).min(0.4);

    // Factor 2: High return ratio (max 0.4)
    // In flattened CFG, typically > 70% of blocks return to dispatcher
    if result.details.return_ratio > 0.7 {
        confidence_score += 0.4;
    } else if result.details.return_ratio > 0.5 {
        confidence_score += 0.2;
    } else if result.details.return_ratio > 0.3 {
        confidence_score += 0.1;
    }

    // Factor 3: Switch pattern detected (max 0.2)
    if !result.details.switch_patterns.is_empty() {
        let max_pattern_confidence = result
            .details
            .switch_patterns
            .iter()
            .map(|p| p.confidence)
            .max_by(|a, b| a.partial_cmp(b).unwrap())
            .unwrap_or(0.0);
        confidence_score += max_pattern_confidence * 0.2;
    }

    result.confidence = confidence_score;
    result.num_states = dispatcher_out_degree;

    // Threshold: confidence > 0.6 means detected
    result.detected = confidence_score > 0.6;

    result
}

/// Detect CFF from raw bytes using pattern matching
fn detect_from_bytes(code: &[u8]) -> ControlFlowFlatteningDetection {
    let mut result = ControlFlowFlatteningDetection::default();

    // Look for common x86/x64 switch patterns
    // Pattern 1: cmp reg, imm followed by many jcc instructions
    // Pattern 2: jump table access pattern (lea/mov/jmp)

    let mut cmp_count = 0;
    let mut jmp_count = 0;
    let mut switch_clusters = 0;

    let mut i = 0;
    while i < code.len().saturating_sub(16) {
        // x86 CMP instruction (0x3D for cmp eax/rax, or 0x81/0x83 for cmp r/m)
        if code[i] == 0x3D || code[i] == 0x81 || code[i] == 0x83 {
            cmp_count += 1;

            // Look ahead for conditional jumps within next 20 bytes
            let mut local_jmps = 0;
            for j in i + 1..std::cmp::min(i + 20, code.len()) {
                // Conditional jump opcodes: 0x70-0x7F (short), 0x0F 0x80-0x8F (near)
                if (0x70..=0x7F).contains(&code[j]) {
                    local_jmps += 1;
                } else if j < code.len() - 1 && code[j] == 0x0F && (0x80..=0x8F).contains(&code[j + 1]) {
                    local_jmps += 1;
                }
            }

            if local_jmps >= 3 {
                switch_clusters += 1;
            }
        }

        // Count unconditional jumps (might be jump table)
        if code[i] == 0xE9 || code[i] == 0xEB || code[i] == 0xFF {
            jmp_count += 1;
        }

        i += 1;
    }

    // Calculate confidence based on patterns
    let mut confidence = 0.0;

    if switch_clusters > 0 {
        confidence += (switch_clusters as f64 * 0.15).min(0.5);
        result.num_states = switch_clusters * 5; // Estimate
    }

    if cmp_count > 10 && jmp_count > 15 {
        confidence += 0.3;
    }

    result.confidence = confidence.min(1.0);
    result.detected = confidence > 0.6;

    result
}

/// Build adjacency lists for the CFG
fn build_adjacency_lists(cfg: &SimpleCfg) -> (Vec<Vec<usize>>, Vec<Vec<usize>>) {
    let n = cfg.blocks.len();
    let mut out_edges = vec![Vec::new(); n];
    let mut in_edges = vec![Vec::new(); n];

    for &(from, to) in &cfg.edges {
        if from < n && to < n {
            out_edges[from].push(to);
            in_edges[to].push(from);
        }
    }

    (out_edges, in_edges)
}

/// Detect state variable from instruction patterns
fn detect_state_variable(instructions: &[String]) -> Option<String> {
    // Look for patterns like:
    // - mov reg, [mem]
    // - cmp reg, value
    // - mov reg, value

    for inst in instructions {
        let inst_lower = inst.to_lowercase();

        // Pattern: "mov eax, [state]" or similar
        if inst_lower.starts_with("mov") && inst_lower.contains('[') {
            // Extract the register
            if let Some(reg_end) = inst_lower.find(',') {
                let reg = inst_lower[3..reg_end].trim();
                if ["eax", "rax", "ecx", "rcx", "edx", "rdx", "ebx", "rbx"]
                    .iter()
                    .any(|&r| reg == r)
                {
                    return Some(reg.to_string());
                }
            }
        }

        // Pattern: "cmp eax, value"
        if inst_lower.starts_with("cmp") {
            if let Some(reg_end) = inst_lower.find(',') {
                let reg = inst_lower[3..reg_end].trim();
                if ["eax", "rax", "ecx", "rcx", "edx", "rdx"]
                    .iter()
                    .any(|&r| reg == r)
                {
                    return Some(reg.to_string());
                }
            }
        }
    }

    None
}

/// Detect switch patterns in a dispatcher block
fn detect_switch_patterns(block: &SimpleBlock) -> Vec<SwitchPattern> {
    let mut patterns = Vec::new();

    // Count comparison and jump instructions
    let mut cmp_count = 0;
    let mut jcc_count = 0;
    let mut jmp_count = 0;

    for inst in &block.instructions {
        let inst_lower = inst.to_lowercase();

        if inst_lower.starts_with("cmp") {
            cmp_count += 1;
        } else if inst_lower.starts_with('j') && !inst_lower.starts_with("jmp") {
            jcc_count += 1;
        } else if inst_lower.starts_with("jmp") {
            jmp_count += 1;
        }
    }

    // Pattern 1: Comparison chain (if-else if-else)
    if cmp_count >= 5 && jcc_count >= 5 {
        patterns.push(SwitchPattern {
            block_id: block.id,
            pattern_type: SwitchPatternType::ComparisonChain,
            confidence: ((cmp_count as f64 / 10.0).min(1.0) * 0.9),
        });
    }

    // Pattern 2: Jump table (single indirect jump)
    if jmp_count >= 1 && cmp_count <= 2 {
        // Look for computed jump patterns
        for inst in &block.instructions {
            let inst_lower = inst.to_lowercase();
            if inst_lower.contains("jmp") && (inst_lower.contains('[') || inst_lower.contains("*")) {
                patterns.push(SwitchPattern {
                    block_id: block.id,
                    pattern_type: SwitchPatternType::JumpTable,
                    confidence: 0.85,
                });
                break;
            }
        }
    }

    patterns
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_flattening_small_cfg() {
        let cfg = SimpleCfg {
            blocks: vec![
                SimpleBlock {
                    id: 0,
                    address: 0x1000,
                    instructions: vec!["mov eax, 1".to_string()],
                },
                SimpleBlock {
                    id: 1,
                    address: 0x1010,
                    instructions: vec!["ret".to_string()],
                },
            ],
            edges: vec![(0, 1)],
        };

        let result = detect_control_flow_flattening(&[], Some(&cfg));
        assert!(!result.detected);
        assert_eq!(result.confidence, 0.0);
    }

    #[test]
    fn test_flattened_cfg_detection() {
        // Create a flattened CFG with dispatcher
        let mut blocks = vec![SimpleBlock {
            id: 0,
            address: 0x1000,
            instructions: vec![
                "mov eax, [state]".to_string(),
                "cmp eax, 1".to_string(),
                "je state_1".to_string(),
                "cmp eax, 2".to_string(),
                "je state_2".to_string(),
                "cmp eax, 3".to_string(),
                "je state_3".to_string(),
                "cmp eax, 4".to_string(),
                "je state_4".to_string(),
                "cmp eax, 5".to_string(),
                "je state_5".to_string(),
            ],
        }];

        // Add state blocks that all return to dispatcher
        for i in 1..=10 {
            blocks.push(SimpleBlock {
                id: i,
                address: 0x1000 + (i as u64 * 0x20),
                instructions: vec![
                    format!("mov ebx, {}", i),
                    "mov [state], eax".to_string(),
                    "jmp dispatcher".to_string(),
                ],
            });
        }

        let mut edges = Vec::new();
        // Dispatcher to all state blocks
        for i in 1..=10 {
            edges.push((0, i));
        }
        // All state blocks back to dispatcher
        for i in 1..=10 {
            edges.push((i, 0));
        }

        let cfg = SimpleCfg { blocks, edges };

        let result = detect_control_flow_flattening(&[], Some(&cfg));

        assert!(result.detected, "Should detect flattening");
        assert!(result.confidence > 0.6, "Confidence should be high");
        assert_eq!(result.details.dispatcher_blocks.len(), 1);
        assert_eq!(result.details.dispatcher_blocks[0], 0);
        assert!(result.details.dispatcher_out_degree >= 10);
        assert!(result.details.return_ratio > 0.8);
        assert!(result.state_variable.is_some());
    }

    #[test]
    fn test_switch_pattern_detection() {
        let block = SimpleBlock {
            id: 0,
            address: 0x1000,
            instructions: vec![
                "cmp eax, 1".to_string(),
                "je case_1".to_string(),
                "cmp eax, 2".to_string(),
                "je case_2".to_string(),
                "cmp eax, 3".to_string(),
                "je case_3".to_string(),
                "cmp eax, 4".to_string(),
                "je case_4".to_string(),
                "cmp eax, 5".to_string(),
                "je case_5".to_string(),
            ],
        };

        let patterns = detect_switch_patterns(&block);
        assert!(!patterns.is_empty());
        assert!(patterns
            .iter()
            .any(|p| p.pattern_type == SwitchPatternType::ComparisonChain));
    }

    #[test]
    fn test_jump_table_pattern() {
        let block = SimpleBlock {
            id: 0,
            address: 0x1000,
            instructions: vec![
                "lea rax, [jump_table]".to_string(),
                "mov ecx, [state]".to_string(),
                "jmp [rax + rcx*8]".to_string(),
            ],
        };

        let patterns = detect_switch_patterns(&block);
        assert!(patterns
            .iter()
            .any(|p| p.pattern_type == SwitchPatternType::JumpTable));
    }

    #[test]
    fn test_bytes_pattern_detection() {
        // Create bytecode with CMP/JCC patterns
        let code = vec![
            0x3D, 0x01, 0x00, 0x00, 0x00, // cmp eax, 1
            0x74, 0x05, // je +5
            0x3D, 0x02, 0x00, 0x00, 0x00, // cmp eax, 2
            0x74, 0x05, // je +5
            0x3D, 0x03, 0x00, 0x00, 0x00, // cmp eax, 3
            0x74, 0x05, // je +5
            0x3D, 0x04, 0x00, 0x00, 0x00, // cmp eax, 4
            0x74, 0x05, // je +5
        ];

        let result = detect_control_flow_flattening(&code, None);
        // With enough patterns, should have some confidence
        assert!(result.confidence > 0.0);
    }
}

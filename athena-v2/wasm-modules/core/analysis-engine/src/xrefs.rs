/// Cross-Reference (Xref) System
/// Tracks where code and data are referenced throughout a binary
///
/// Inspired by IDA Pro, Ghidra, and Radare2's xref systems
/// Essential for understanding control flow and data usage

use std::collections::{HashMap, HashSet};
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct XrefDatabase {
    /// Address -> references TO this address
    pub refs_to: HashMap<u64, Vec<Xref>>,
    /// Address -> references FROM this address
    pub refs_from: HashMap<u64, Vec<Xref>>,
    /// Function call graph
    pub call_graph: CallGraph,
    /// String references
    pub string_refs: HashMap<u64, Vec<StringReference>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Xref {
    /// Address where the reference originates
    pub from: u64,
    /// Address being referenced
    pub to: u64,
    /// Type of reference
    pub xref_type: XrefType,
    /// Instruction that creates the reference (optional)
    pub instruction: Option<String>,
    /// Offset within instruction (for data refs)
    pub offset: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum XrefType {
    /// Direct call instruction
    Call,
    /// Indirect call (via register/memory)
    CallIndirect,
    /// Unconditional jump
    Jump,
    /// Conditional jump
    JumpConditional,
    /// Data read
    DataRead,
    /// Data write
    DataWrite,
    /// String reference
    StringRef,
    /// Import/external reference
    Import,
    /// Offset reference (LEA, etc.)
    Offset,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CallGraph {
    /// Function address -> called functions
    pub calls: HashMap<u64, HashSet<u64>>,
    /// Function address -> callers
    pub callers: HashMap<u64, HashSet<u64>>,
    /// Entry points
    pub entry_points: Vec<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StringReference {
    pub address: u64,
    pub string_addr: u64,
    pub value: String,
    pub encoding: StringEncoding,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum StringEncoding {
    ASCII,
    UTF8,
    UTF16LE,
    UTF16BE,
}

impl XrefDatabase {
    pub fn new() -> Self {
        Self {
            refs_to: HashMap::new(),
            refs_from: HashMap::new(),
            call_graph: CallGraph::new(),
            string_refs: HashMap::new(),
        }
    }

    /// Add a cross-reference
    pub fn add_xref(&mut self, xref: Xref) {
        // Add to refs_to (references TO this address)
        self.refs_to
            .entry(xref.to)
            .or_insert_with(Vec::new)
            .push(xref.clone());

        // Add to refs_from (references FROM this address)
        self.refs_from
            .entry(xref.from)
            .or_insert_with(Vec::new)
            .push(xref.clone());

        // Update call graph if it's a call
        if matches!(xref.xref_type, XrefType::Call | XrefType::CallIndirect) {
            self.call_graph.add_call(xref.from, xref.to);
        }
    }

    /// Get all references TO an address
    pub fn get_refs_to(&self, address: u64) -> Vec<&Xref> {
        self.refs_to
            .get(&address)
            .map(|refs| refs.iter().collect())
            .unwrap_or_default()
    }

    /// Get all references FROM an address
    pub fn get_refs_from(&self, address: u64) -> Vec<&Xref> {
        self.refs_from
            .get(&address)
            .map(|refs| refs.iter().collect())
            .unwrap_or_default()
    }

    /// Get all code references to an address
    pub fn get_code_refs_to(&self, address: u64) -> Vec<&Xref> {
        self.get_refs_to(address)
            .into_iter()
            .filter(|xref| matches!(
                xref.xref_type,
                XrefType::Call | XrefType::CallIndirect |
                XrefType::Jump | XrefType::JumpConditional
            ))
            .collect()
    }

    /// Get all data references to an address
    pub fn get_data_refs_to(&self, address: u64) -> Vec<&Xref> {
        self.get_refs_to(address)
            .into_iter()
            .filter(|xref| matches!(
                xref.xref_type,
                XrefType::DataRead | XrefType::DataWrite | XrefType::Offset
            ))
            .collect()
    }

    /// Get all callers of a function
    pub fn get_callers(&self, func_addr: u64) -> Vec<u64> {
        self.call_graph.get_callers(func_addr)
    }

    /// Get all functions called by a function
    pub fn get_callees(&self, func_addr: u64) -> Vec<u64> {
        self.call_graph.get_callees(func_addr)
    }

    /// Add a string reference
    pub fn add_string_ref(&mut self, string_ref: StringReference) {
        self.string_refs
            .entry(string_ref.address)
            .or_insert_with(Vec::new)
            .push(string_ref);
    }

    /// Get string references from an address
    pub fn get_string_refs(&self, address: u64) -> Vec<&StringReference> {
        self.string_refs
            .get(&address)
            .map(|refs| refs.iter().collect())
            .unwrap_or_default()
    }

    /// Find all addresses that reference a specific string
    pub fn find_string_usage(&self, search: &str) -> Vec<u64> {
        let mut addresses = Vec::new();

        for (addr, refs) in &self.string_refs {
            for string_ref in refs {
                if string_ref.value.contains(search) {
                    addresses.push(*addr);
                }
            }
        }

        addresses
    }

    /// Get statistics
    pub fn get_stats(&self) -> XrefStats {
        let total_refs = self.refs_to.values().map(|v| v.len()).sum();
        let total_calls = self.call_graph.calls.values().map(|v| v.len()).sum();
        let total_functions = self.call_graph.calls.len();

        XrefStats {
            total_references: total_refs,
            total_calls,
            total_functions,
            total_string_refs: self.string_refs.values().map(|v| v.len()).sum(),
        }
    }

    /// Export to JSON
    pub fn to_json(&self) -> Result<String, String> {
        serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize xrefs: {}", e))
    }

    /// Import from JSON
    pub fn from_json(json: &str) -> Result<Self, String> {
        serde_json::from_str(json)
            .map_err(|e| format!("Failed to deserialize xrefs: {}", e))
    }
}

impl CallGraph {
    pub fn new() -> Self {
        Self {
            calls: HashMap::new(),
            callers: HashMap::new(),
            entry_points: Vec::new(),
        }
    }

    /// Add a function call relationship
    pub fn add_call(&mut self, from: u64, to: u64) {
        self.calls
            .entry(from)
            .or_insert_with(HashSet::new)
            .insert(to);

        self.callers
            .entry(to)
            .or_insert_with(HashSet::new)
            .insert(from);
    }

    /// Get all functions called by a function
    pub fn get_callees(&self, func_addr: u64) -> Vec<u64> {
        self.calls
            .get(&func_addr)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Get all callers of a function
    pub fn get_callers(&self, func_addr: u64) -> Vec<u64> {
        self.callers
            .get(&func_addr)
            .map(|set| set.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Add an entry point
    pub fn add_entry_point(&mut self, address: u64) {
        if !self.entry_points.contains(&address) {
            self.entry_points.push(address);
        }
    }

    /// Get call depth (distance from entry point)
    pub fn get_call_depth(&self, func_addr: u64) -> Option<usize> {
        // BFS from entry points
        use std::collections::VecDeque;

        let mut queue = VecDeque::new();
        let mut visited = HashSet::new();
        let mut depths = HashMap::new();

        for &entry in &self.entry_points {
            queue.push_back((entry, 0));
            depths.insert(entry, 0);
        }

        while let Some((addr, depth)) = queue.pop_front() {
            if !visited.insert(addr) {
                continue;
            }

            if addr == func_addr {
                return Some(depth);
            }

            if let Some(callees) = self.calls.get(&addr) {
                for &callee in callees {
                    if !visited.contains(&callee) {
                        queue.push_back((callee, depth + 1));
                        depths.entry(callee).or_insert(depth + 1);
                    }
                }
            }
        }

        depths.get(&func_addr).cloned()
    }

    /// Find recursive functions (functions that call themselves)
    pub fn find_recursive_functions(&self) -> Vec<u64> {
        let mut recursive = Vec::new();

        for (&func, callees) in &self.calls {
            if callees.contains(&func) {
                recursive.push(func);
            }
        }

        recursive
    }

    /// Find leaf functions (functions that don't call anything)
    pub fn find_leaf_functions(&self) -> Vec<u64> {
        let mut leaves = Vec::new();

        // A leaf function is one that is called by others but doesn't call anyone
        // Check functions that are callees (appear in callers map)
        for &func in self.callers.keys() {
            // If this function doesn't call anything (not in calls map or has empty callees)
            let makes_no_calls = self.calls.get(&func)
                .map(|callees| callees.is_empty())
                .unwrap_or(true);
            if makes_no_calls {
                leaves.push(func);
            }
        }

        leaves
    }

    /// Export call graph to DOT format (Graphviz)
    pub fn to_dot(&self) -> String {
        let mut dot = String::from("digraph CallGraph {\n");
        dot.push_str("  node [shape=box];\n");

        // Mark entry points
        for &entry in &self.entry_points {
            dot.push_str(&format!("  func_0x{:x} [style=filled,fillcolor=lightgreen];\n", entry));
        }

        // Add edges
        for (&from, callees) in &self.calls {
            for &to in callees {
                dot.push_str(&format!(
                    "  func_0x{:x} -> func_0x{:x};\n",
                    from, to
                ));
            }
        }

        dot.push_str("}\n");
        dot
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct XrefStats {
    pub total_references: usize,
    pub total_calls: usize,
    pub total_functions: usize,
    pub total_string_refs: usize,
}

/// Builder for analyzing a binary and constructing xref database
pub struct XrefBuilder {
    db: XrefDatabase,
}

impl XrefBuilder {
    pub fn new() -> Self {
        Self {
            db: XrefDatabase::new(),
        }
    }

    /// Analyze disassembly and build xref database
    pub fn analyze_instructions(
        &mut self,
        instructions: &[(u64, String, Option<u64>)],
    ) -> Result<(), String> {
        for (addr, instr, branch_target) in instructions {
            self.analyze_instruction(*addr, instr, *branch_target)?;
        }
        Ok(())
    }

    fn analyze_instruction(
        &mut self,
        addr: u64,
        instr: &str,
        branch_target: Option<u64>,
    ) -> Result<(), String> {
        let instr_lower = instr.to_lowercase();

        // Detect calls
        if instr_lower.starts_with("call") {
            if let Some(target) = branch_target {
                self.db.add_xref(Xref {
                    from: addr,
                    to: target,
                    xref_type: XrefType::Call,
                    instruction: Some(instr.to_string()),
                    offset: None,
                });
            } else {
                // Indirect call - try to extract target from instruction
                // This is simplified - real implementation would parse operands
            }
        }

        // Detect jumps
        else if instr_lower.starts_with("jmp") {
            if let Some(target) = branch_target {
                self.db.add_xref(Xref {
                    from: addr,
                    to: target,
                    xref_type: XrefType::Jump,
                    instruction: Some(instr.to_string()),
                    offset: None,
                });
            }
        }

        // Detect conditional jumps
        else if instr_lower.starts_with('j') && branch_target.is_some() {
            if let Some(target) = branch_target {
                self.db.add_xref(Xref {
                    from: addr,
                    to: target,
                    xref_type: XrefType::JumpConditional,
                    instruction: Some(instr.to_string()),
                    offset: None,
                });
            }
        }

        // Detect data references (simplified)
        else if instr_lower.contains("mov") || instr_lower.contains("lea") {
            // Would parse operands to find memory addresses
        }

        Ok(())
    }

    /// Add entry point to call graph
    pub fn add_entry_point(&mut self, address: u64) {
        self.db.call_graph.add_entry_point(address);
    }

    /// Finalize and return the xref database
    pub fn build(self) -> XrefDatabase {
        self.db
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_xref_database() {
        let mut db = XrefDatabase::new();

        let xref = Xref {
            from: 0x1000,
            to: 0x2000,
            xref_type: XrefType::Call,
            instruction: Some("call 0x2000".to_string()),
            offset: None,
        };

        db.add_xref(xref);

        let refs_to = db.get_refs_to(0x2000);
        assert_eq!(refs_to.len(), 1);
        assert_eq!(refs_to[0].from, 0x1000);

        let refs_from = db.get_refs_from(0x1000);
        assert_eq!(refs_from.len(), 1);
        assert_eq!(refs_from[0].to, 0x2000);
    }

    #[test]
    fn test_call_graph() {
        let mut graph = CallGraph::new();

        graph.add_call(0x1000, 0x2000);
        graph.add_call(0x1000, 0x3000);
        graph.add_call(0x2000, 0x4000);

        let callees = graph.get_callees(0x1000);
        assert_eq!(callees.len(), 2);
        assert!(callees.contains(&0x2000));
        assert!(callees.contains(&0x3000));

        let callers = graph.get_callers(0x2000);
        assert_eq!(callers.len(), 1);
        assert!(callers.contains(&0x1000));
    }

    #[test]
    fn test_call_graph_dot() {
        let mut graph = CallGraph::new();
        graph.add_entry_point(0x1000);
        graph.add_call(0x1000, 0x2000);

        let dot = graph.to_dot();
        assert!(dot.contains("digraph CallGraph"));
        assert!(dot.contains("func_0x1000"));
        assert!(dot.contains("func_0x2000"));
    }

    #[test]
    fn test_string_reference() {
        let mut db = XrefDatabase::new();

        let string_ref = StringReference {
            address: 0x1000,
            string_addr: 0x5000,
            value: "malware.exe".to_string(),
            encoding: StringEncoding::ASCII,
        };

        db.add_string_ref(string_ref);

        let refs = db.get_string_refs(0x1000);
        assert_eq!(refs.len(), 1);
        assert_eq!(refs[0].value, "malware.exe");

        let usage = db.find_string_usage("malware");
        assert_eq!(usage.len(), 1);
        assert_eq!(usage[0], 0x1000);
    }

    #[test]
    fn test_recursive_functions() {
        let mut graph = CallGraph::new();
        graph.add_call(0x1000, 0x1000); // Recursive
        graph.add_call(0x2000, 0x3000); // Not recursive

        let recursive = graph.find_recursive_functions();
        assert_eq!(recursive.len(), 1);
        assert_eq!(recursive[0], 0x1000);
    }

    #[test]
    fn test_leaf_functions() {
        let mut graph = CallGraph::new();
        graph.add_call(0x1000, 0x2000);
        // 0x2000 doesn't call anything - it's a leaf

        let leaves = graph.find_leaf_functions();
        assert!(leaves.contains(&0x2000));
    }
}

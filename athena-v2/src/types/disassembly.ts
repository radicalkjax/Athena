/**
 * Disassembly and Control Flow Analysis Types
 *
 * TypeScript interfaces matching the Rust backend types
 */

export interface DisassemblyResult {
    instructions: Instruction[];
    functions: Function[];
    strings: ExtractedString[];
    entry_point: number | null;
    architecture: string;
    sections: Section[];
    instruction_count?: number;
    imports?: Import[];
}

export interface Instruction {
    address: number;
    bytes: string;
    mnemonic: string;
    operands: string;
    size: number;
    is_jump: boolean;
    is_call: boolean;
    jump_target: number | null;
}

export interface Function {
    name: string;
    address: number;
    size: number;
    instructions_count: number;
    calls: string[];
}

export interface ExtractedString {
    address: number;
    value: string;
    section: string;
}

export interface Section {
    name: string;
    address: number;
    size: number;
    flags: string;
}

export interface Import {
    name: string;
    library?: string;
    address?: number;
}

export interface ControlFlowGraph {
    blocks: ControlFlowBlock[];
    entry_block: string;
}

export interface ControlFlowBlock {
    id: string;
    start_address: number;
    end_address: number;
    instructions: Instruction[];
    successors: string[];
    predecessors: string[];
}

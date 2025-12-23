/**
 * Memory Analysis Types
 *
 * TypeScript interfaces for memory analysis Tauri commands
 */

export interface MemoryRegion {
    start_address: number;
    end_address: number;
    size: number;
    permissions: string;
    region_type: string;
    mapped_file: string | null;
}

export interface ExtractedString {
    offset: number;
    value: string;
    encoding: string;
    suspicious: boolean;
    category: string | null;
}

export type StringEncoding = 'ascii' | 'unicode' | 'both';

export type RegionType =
    | 'stack'
    | 'heap'
    | 'shared_library'
    | 'mapped_file'
    | 'vdso'
    | 'vvar'
    | 'anonymous'
    | 'data'
    | 'unknown';

export type StringCategory =
    | 'url'
    | 'file_path'
    | 'registry'
    | 'ip_address'
    | 'email';

export interface MemoryAnalysisStats {
    total_regions: number;
    total_size: number;
    regions_by_type: Record<RegionType, number>;
    executable_regions: number;
    writable_regions: number;
}

export interface StringAnalysisStats {
    total_strings: number;
    suspicious_count: number;
    by_encoding: Record<StringEncoding, number>;
    by_category: Record<StringCategory, number>;
}

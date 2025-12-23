/**
 * System Monitoring Types
 *
 * TypeScript interfaces matching the Rust backend system monitoring types
 */

export interface CpuInfo {
    usage: number;
    cores: CoreInfo[];
    frequency: number;
}

export interface CoreInfo {
    id: number;
    usage: number;
    frequency: number;
}

export interface MemoryInfo {
    total: number;
    used: number;
    available: number;
    swap_total: number;
    swap_used: number;
    usage_percentage: number;
}

export interface ProcessInfo {
    pid: number;
    name: string;
    cpu_usage: number;
    memory: number;
    status: string;
    parent_pid: number | null;
    command: string[];
    ppid?: number; // Alias for parent_pid
    cmd?: string[]; // Alias for command
}

export interface DiskInfo {
    name: string;
    mount_point: string;
    total_space: number;
    available_space: number;
    used_space: number;
    usage_percentage: number;
}

export interface NetworkInfo {
    interface: string;
    received: number;
    transmitted: number;
    packets_received: number;
    packets_transmitted: number;
    connections?: NetworkConnection[];
}

export interface NetworkConnection {
    source_ip: string;
    source_port: number;
    dest_ip: string;
    dest_port: number;
    protocol: string;
    process_name: string;
    bytes_sent: number;
    bytes_received: number;
}

export interface SystemStats {
    cpu: CpuInfo;
    memory: MemoryInfo;
    processes: ProcessInfo[];
    disks: DiskInfo[];
    network: NetworkInfo[];
    uptime: number;
    boot_time: number;
}

export interface SystemStatus {
    uptime: number;
    boot_time: number;
    hostname?: string;
    os_version?: string;
    kernel_version?: string;
}

// Process Tree Types
export interface ProcessTreeNode {
    pid: number;
    name: string;
    parent_pid: number;
    children: ProcessTreeNode[];
    depth: number;
    command_line?: string;
}

// Network Connection Groups
export interface NetworkConnectionGroup {
    destination: string;
    port: number;
    protocol: string;
    connection_count: number;
    total_bytes: number;
    processes: string[];
}

// Volatility Analysis Types
export interface VolatilityResult {
    processes?: VolatilityProcess[];
    network_connections?: VolatilityNetworkConnection[];
    loaded_modules?: VolatilityModule[];
    registry_hives?: VolatilityRegistryHive[];
    injected_code?: VolatilityInjectedCode[];
    summary?: string;
}

export interface VolatilityProcess {
    pid: number;
    ppid: number;
    name: string;
    offset: number;
    threads: number;
    handles: number;
    session_id: number;
    wow64: boolean;
    create_time: string;
    exit_time: string | null;
}

export interface VolatilityNetworkConnection {
    local_addr: string;
    local_port: number;
    remote_addr: string;
    remote_port: number;
    protocol: string;
    state: string;
    pid: number;
    process_name: string;
}

export interface VolatilityModule {
    base: number;
    size: number;
    name: string;
    path: string;
}

export interface VolatilityRegistryHive {
    offset: number;
    name: string;
    path: string;
}

export interface VolatilityInjectedCode {
    pid: number;
    process_name: string;
    address: number;
    size: number;
    protection: string;
    tag: string;
}

export interface VolatilityStatus {
    available: boolean;
    version?: string;
    error?: string;
}

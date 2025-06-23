use serde::{Deserialize, Serialize};
use sysinfo::{System, Disks, Networks, ProcessesToUpdate};
use std::sync::Mutex;
use tauri::State;

pub struct SystemMonitor {
    system: Mutex<System>,
    disks: Mutex<Disks>,
    networks: Mutex<Networks>,
}

impl SystemMonitor {
    pub fn new() -> Self {
        Self {
            system: Mutex::new(System::new_all()),
            disks: Mutex::new(Disks::new_with_refreshed_list()),
            networks: Mutex::new(Networks::new_with_refreshed_list()),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct CpuInfo {
    usage: f32,
    cores: Vec<CoreInfo>,
    frequency: u64,
}

#[derive(Serialize, Deserialize)]
pub struct CoreInfo {
    id: usize,
    usage: f32,
    frequency: u64,
}

#[derive(Serialize, Deserialize)]
pub struct MemoryInfo {
    total: u64,
    used: u64,
    available: u64,
    swap_total: u64,
    swap_used: u64,
    usage_percentage: f32,
}

#[derive(Serialize, Deserialize)]
pub struct ProcessInfo {
    pid: u32,
    name: String,
    cpu_usage: f32,
    memory: u64,
    status: String,
    parent_pid: Option<u32>,
    command: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct DiskInfo {
    name: String,
    mount_point: String,
    total_space: u64,
    available_space: u64,
    used_space: u64,
    usage_percentage: f32,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkInfo {
    interface: String,
    received: u64,
    transmitted: u64,
    packets_received: u64,
    packets_transmitted: u64,
}

#[derive(Serialize, Deserialize)]
pub struct SystemStats {
    cpu: CpuInfo,
    memory: MemoryInfo,
    processes: Vec<ProcessInfo>,
    disks: Vec<DiskInfo>,
    network: Vec<NetworkInfo>,
    uptime: u64,
    boot_time: u64,
}

#[tauri::command]
pub async fn get_cpu_info(monitor: State<'_, SystemMonitor>) -> Result<CpuInfo, String> {
    let mut system = monitor.system.lock().map_err(|e| e.to_string())?;
    system.refresh_cpu_all();
    
    let global_usage = system.global_cpu_usage();
    let mut cores = Vec::new();
    
    for (id, cpu) in system.cpus().iter().enumerate() {
        cores.push(CoreInfo {
            id,
            usage: cpu.cpu_usage(),
            frequency: cpu.frequency(),
        });
    }
    
    // Get frequency from first CPU core
    let frequency = system.cpus().first().map(|cpu| cpu.frequency()).unwrap_or(0);
    
    Ok(CpuInfo {
        usage: global_usage,
        cores,
        frequency,
    })
}

#[tauri::command]
pub async fn get_memory_info(monitor: State<'_, SystemMonitor>) -> Result<MemoryInfo, String> {
    let mut system = monitor.system.lock().map_err(|e| e.to_string())?;
    system.refresh_memory();
    
    let total = system.total_memory();
    let used = system.used_memory();
    let available = system.available_memory();
    
    Ok(MemoryInfo {
        total,
        used,
        available,
        swap_total: system.total_swap(),
        swap_used: system.used_swap(),
        usage_percentage: (used as f32 / total as f32) * 100.0,
    })
}

#[tauri::command]
pub async fn get_processes(monitor: State<'_, SystemMonitor>) -> Result<Vec<ProcessInfo>, String> {
    let mut system = monitor.system.lock().map_err(|e| e.to_string())?;
    system.refresh_processes(ProcessesToUpdate::All);
    
    let mut processes = Vec::new();
    
    for (pid, process) in system.processes() {
        processes.push(ProcessInfo {
            pid: pid.as_u32(),
            name: process.name().to_string_lossy().to_string(),
            cpu_usage: process.cpu_usage(),
            memory: process.memory(),
            status: format!("{:?}", process.status()),
            parent_pid: process.parent().map(|p| p.as_u32()),
            command: process.cmd().iter().map(|s| s.to_string_lossy().to_string()).collect(),
        });
    }
    
    // Sort by CPU usage descending
    processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap());
    
    Ok(processes)
}

#[tauri::command]
pub async fn get_disk_info(monitor: State<'_, SystemMonitor>) -> Result<Vec<DiskInfo>, String> {
    let mut disks = monitor.disks.lock().map_err(|e| e.to_string())?;
    disks.refresh();
    
    let mut disk_list = Vec::new();
    
    for disk in disks.list() {
        let total = disk.total_space();
        let available = disk.available_space();
        let used = total - available;
        
        disk_list.push(DiskInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            total_space: total,
            available_space: available,
            used_space: used,
            usage_percentage: if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 },
        });
    }
    
    Ok(disk_list)
}

#[tauri::command]
pub async fn get_network_info(monitor: State<'_, SystemMonitor>) -> Result<Vec<NetworkInfo>, String> {
    let mut networks = monitor.networks.lock().map_err(|e| e.to_string())?;
    networks.refresh();
    
    let mut network_list = Vec::new();
    
    for (interface_name, data) in networks.list() {
        network_list.push(NetworkInfo {
            interface: interface_name.clone(),
            received: data.total_received(),
            transmitted: data.total_transmitted(),
            packets_received: data.total_packets_received(),
            packets_transmitted: data.total_packets_transmitted(),
        });
    }
    
    Ok(network_list)
}

#[tauri::command]
pub async fn get_system_stats(monitor: State<'_, SystemMonitor>) -> Result<SystemStats, String> {
    // Get all subsystem info
    let cpu = get_cpu_info(monitor.clone()).await?;
    let memory = get_memory_info(monitor.clone()).await?;
    let processes = get_processes(monitor.clone()).await?;
    let disks = get_disk_info(monitor.clone()).await?;
    let network = get_network_info(monitor.clone()).await?;
    
    Ok(SystemStats {
        cpu,
        memory,
        processes,
        disks,
        network,
        uptime: System::uptime(),
        boot_time: System::boot_time(),
    })
}

#[tauri::command]
pub async fn kill_process(pid: u32, monitor: State<'_, SystemMonitor>) -> Result<bool, String> {
    let mut system = monitor.system.lock().map_err(|e| e.to_string())?;
    system.refresh_processes(ProcessesToUpdate::All);
    
    if let Some(process) = system.process(sysinfo::Pid::from(pid as usize)) {
        Ok(process.kill())
    } else {
        Err("Process not found".to_string())
    }
}
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::thread;
use std::time::Instant;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{State, AppHandle, Emitter};
use tauri::path::SafePathBuf;
use crate::commands::wasm_runtime::WasmRuntime;
use crate::metrics::{NETWORK_OPERATION_DURATION, NETWORK_PACKETS_ANALYZED, ACTIVE_PACKET_CAPTURES};
use pcap::{Capture, Linktype, Packet, PacketHeader, Device, Active};
use libc::timeval;
use lazy_static::lazy_static;
use pnet_packet::ethernet::{EthernetPacket, EtherTypes};
use pnet_packet::ip::{IpNextHeaderProtocols};
use pnet_packet::ipv4::Ipv4Packet;
use pnet_packet::ipv6::Ipv6Packet;
use pnet_packet::tcp::TcpPacket;
use pnet_packet::udp::UdpPacket;
use pnet_packet::icmp::IcmpPacket;
use pnet_packet::Packet as PnetPacketTrait;
use chrono;

const NETWORK_MODULE: &str = "network";

// Global state for active packet captures
lazy_static! {
    static ref ACTIVE_CAPTURES: Arc<Mutex<HashMap<String, CaptureSession>>> = Arc::new(Mutex::new(HashMap::new()));
    static ref BLOCKED_IPS: Arc<Mutex<std::collections::HashSet<String>>> = Arc::new(Mutex::new(std::collections::HashSet::new()));
    static ref NETWORK_STATS: Arc<Mutex<NetworkStatistics>> = Arc::new(Mutex::new(NetworkStatistics::default()));
}

struct CaptureSession {
    interface_name: String,
    packets_captured: Arc<Mutex<Vec<NetworkPacket>>>,
    stop_signal: Arc<AtomicBool>,
    thread_handle: Option<thread::JoinHandle<()>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NetworkPacket {
    id: String,
    timestamp: u64,
    protocol: String,
    source_ip: String,
    source_port: u16,
    destination_ip: String,
    destination_port: u16,
    size: u32,
    direction: String,
    flags: Option<Vec<String>>,
    suspicious: bool,
}

#[tauri::command]
pub async fn analyze_network_packet(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    packet: NetworkPacket,
) -> Result<String, String> {
    let start_time = Instant::now();
    let protocol = packet.protocol.clone();

    // Try WASM analyzer first, fall back to native analysis if unavailable
    let wasm_result = try_wasm_analysis(&runtime, &packet).await;

    let analysis = match wasm_result {
        Ok(result) => result,
        Err(_) => {
            // WASM not available, use native analysis
            native_packet_analysis(&packet)
        }
    };

    // Record successful metrics
    let duration = start_time.elapsed();
    NETWORK_OPERATION_DURATION
        .with_label_values(&["analyze_packet", "success"])
        .observe(duration.as_secs_f64());
    NETWORK_PACKETS_ANALYZED
        .with_label_values(&[&protocol, "success"])
        .inc();

    Ok(analysis)
}

async fn try_wasm_analysis(
    runtime: &State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    packet: &NetworkPacket,
) -> Result<String, String> {
    let packet_data = serde_json::to_vec(packet)
        .map_err(|e| format!("Could not prepare packet data: {}", e))?;

    let args = vec![serde_json::json!(packet_data)];

    let result = crate::commands::wasm_runtime::execute_wasm_function(
        runtime.clone(),
        NETWORK_MODULE.to_string(),
        "network-analyzer#analyze-packet".to_string(),
        args,
    ).await?;

    if !result.success {
        return Err(result.error.unwrap_or_else(|| "WASM analysis failed".to_string()));
    }

    let output_str = result.output.as_ref()
        .ok_or("No output from WASM analyzer")?;
    let analysis_result: serde_json::Value = serde_json::from_str(output_str)
        .map_err(|e| format!("Invalid WASM output: {}", e))?;

    format_wasm_analysis(packet, &analysis_result)
}

fn format_wasm_analysis(packet: &NetworkPacket, analysis_result: &serde_json::Value) -> Result<String, String> {
    let mut analysis = String::new();
    analysis.push_str(&format!("Packet ID: {}\n", packet.id));
    analysis.push_str(&format!("Protocol: {}\n",
        analysis_result["protocol"].as_str().unwrap_or(&packet.protocol)));

    if let Some(source_ip) = analysis_result["source_ip"].as_str() {
        analysis.push_str(&format!("Source: {}:{}\n", source_ip,
            analysis_result["source_port"].as_u64().unwrap_or(0)));
    }

    if let Some(dest_ip) = analysis_result["dest_ip"].as_str() {
        analysis.push_str(&format!("Destination: {}:{}\n", dest_ip,
            analysis_result["dest_port"].as_u64().unwrap_or(0)));
    }

    analysis.push_str(&format!("Size: {} bytes\n",
        analysis_result["payload_size"].as_u64().unwrap_or(packet.size as u64)));

    if let Some(flags) = analysis_result["packet_flags"].as_array() {
        if !flags.is_empty() {
            analysis.push_str("\n⚠️ FLAGS DETECTED:\n");
            for flag in flags {
                if let Some(f) = flag.as_str() {
                    analysis.push_str(&format!("- {}\n", f));
                }
            }
        }
    }

    Ok(analysis)
}

fn native_packet_analysis(packet: &NetworkPacket) -> String {
    let mut analysis = String::new();

    // Header
    analysis.push_str("═══════════════════════════════════════\n");
    analysis.push_str("       DEEP PACKET ANALYSIS\n");
    analysis.push_str("═══════════════════════════════════════\n\n");

    // Basic Info
    analysis.push_str("📋 PACKET INFORMATION\n");
    analysis.push_str("───────────────────────────────────────\n");
    analysis.push_str(&format!("  Packet ID:    {}\n", packet.id));
    analysis.push_str(&format!("  Timestamp:    {}\n",
        chrono::DateTime::from_timestamp(packet.timestamp as i64 / 1000, 0)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S%.3f").to_string())
            .unwrap_or_else(|| packet.timestamp.to_string())
    ));
    analysis.push_str(&format!("  Direction:    {}\n", packet.direction));
    analysis.push_str(&format!("  Size:         {} bytes\n\n", packet.size));

    // Network Layer
    analysis.push_str("🌐 NETWORK LAYER\n");
    analysis.push_str("───────────────────────────────────────\n");
    analysis.push_str(&format!("  Protocol:     {}\n", packet.protocol));
    analysis.push_str(&format!("  Source:       {}:{}\n", packet.source_ip, packet.source_port));
    analysis.push_str(&format!("  Destination:  {}:{}\n\n", packet.destination_ip, packet.destination_port));

    // TCP Flags (if present)
    let flags = packet.flags.as_ref().map(|f| f.as_slice()).unwrap_or(&[]);
    if !flags.is_empty() {
        analysis.push_str("🚩 TCP FLAGS\n");
        analysis.push_str("───────────────────────────────────────\n");
        for flag in flags {
            let description = match flag.as_str() {
                "SYN" => "Connection initiation",
                "ACK" => "Acknowledgment",
                "FIN" => "Connection termination",
                "RST" => "Connection reset",
                "PSH" => "Push data immediately",
                "URG" => "Urgent pointer valid",
                "ECE" => "ECN-Echo",
                "CWR" => "Congestion Window Reduced",
                _ => "Unknown flag"
            };
            analysis.push_str(&format!("  {} - {}\n", flag, description));
        }
        analysis.push_str("\n");
    }

    // Security Analysis
    analysis.push_str("🔒 SECURITY ANALYSIS\n");
    analysis.push_str("───────────────────────────────────────\n");

    let mut threats: Vec<&str> = Vec::new();
    let mut warnings: Vec<&str> = Vec::new();

    // Check for suspicious ports
    let suspicious_ports = [4444, 5555, 6666, 7777, 8888, 9999, 31337, 12345];
    if suspicious_ports.contains(&packet.source_port) || suspicious_ports.contains(&packet.destination_port) {
        threats.push("Suspicious port commonly used by malware");
    }

    // Check for common attack ports
    if packet.destination_port == 445 || packet.destination_port == 139 {
        warnings.push("SMB port - potential target for lateral movement");
    }
    if packet.destination_port == 3389 {
        warnings.push("RDP port - ensure proper authentication is enabled");
    }
    if packet.destination_port == 22 {
        warnings.push("SSH port - monitor for brute force attempts");
    }

    // Check TCP flag anomalies
    let has_syn = flags.contains(&"SYN".to_string());
    let has_fin = flags.contains(&"FIN".to_string());
    let has_rst = flags.contains(&"RST".to_string());

    if has_syn && has_fin {
        threats.push("Invalid TCP flags: SYN+FIN (possible scan)");
    }
    if has_syn && has_rst {
        threats.push("Invalid TCP flags: SYN+RST (possible scan)");
    }
    if flags.contains(&"URG".to_string()) && flags.contains(&"PSH".to_string()) && has_fin {
        threats.push("XMAS scan detected (URG+PSH+FIN flags)");
    }

    // Check for suspicious patterns
    if packet.suspicious {
        threats.push("Packet flagged as suspicious by capture engine");
    }

    // Report findings
    if threats.is_empty() && warnings.is_empty() {
        analysis.push_str("  ✅ No security issues detected\n");
    } else {
        if !threats.is_empty() {
            analysis.push_str("  🚨 THREATS:\n");
            for threat in &threats {
                analysis.push_str(&format!("     • {}\n", threat));
            }
        }
        if !warnings.is_empty() {
            analysis.push_str("  ⚠️  WARNINGS:\n");
            for warning in &warnings {
                analysis.push_str(&format!("     • {}\n", warning));
            }
        }
    }

    analysis.push_str("\n═══════════════════════════════════════\n");

    analysis
}

#[tauri::command]
pub async fn export_network_capture(
    format: String,
    output_path: SafePathBuf,
    packets_json: String,
) -> Result<(), String> {
    let path = output_path.as_ref();

    match format.as_str() {
        "json" => {
            std::fs::write(path, packets_json)
                .map_err(|e| {
                    let filename = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string());
                    format!(
                        "Could not write network capture to '{}'. Please ensure you have write permissions. Error: {}",
                        filename,
                        e
                    )
                })?;
            Ok(())
        }
        "pcap" => {
            // Parse the JSON packet data
            let packets: Vec<NetworkPacket> = serde_json::from_str(&packets_json)
                .map_err(|e| format!(
                    "Could not parse packet data for export. The data may be corrupted. Error: {}",
                    e
                ))?;

            // Create a "dead" capture for writing to file (Linktype::ETHERNET = 1)
            let cap = Capture::dead(Linktype::ETHERNET)
                .map_err(|e| format!(
                    "Could not initialize PCAP writer. Please ensure libpcap is installed on your system. Error: {}",
                    e
                ))?;

            // Create savefile
            let mut save = cap.savefile(path)
                .map_err(|e| {
                    let filename = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string());
                    format!(
                        "Could not create PCAP file at '{}'. Please check write permissions and available disk space. Error: {}",
                        filename,
                        e
                    )
                })?;

            // Write each packet to the PCAP file
            for pkt in packets.iter() {
                // Convert our NetworkPacket to raw bytes for PCAP
                // Reconstructs proper Ethernet/IP/TCP/UDP/ICMP headers from packet metadata
                let packet_bytes = create_pcap_packet_data(pkt);

                // Create packet header
                let header = PacketHeader {
                    ts: timeval {
                        tv_sec: (pkt.timestamp / 1000) as i64,
                        tv_usec: ((pkt.timestamp % 1000) * 1000) as i32,
                    },
                    caplen: packet_bytes.len() as u32,
                    len: pkt.size,
                };

                // Create and write packet
                let packet = Packet::new(&header, &packet_bytes);
                save.write(&packet);
            }

            // Flush to ensure all data is written
            save.flush()
                .map_err(|e| {
                    let filename = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string());
                    format!(
                        "Could not finalize PCAP file '{}'. The file may be incomplete. Error: {}",
                        filename,
                        e
                    )
                })?;

            Ok(())
        }
        _ => Err(format!(
            "Unsupported export format: '{}'. Please use 'json' for JSON export or 'pcap' for standard packet capture format.",
            format
        )),
    }
}

/// Generate locally-administered MAC addresses derived from IP addresses
/// Uses the locally-administered bit (bit 1 of first byte = 1) to avoid conflicts
fn generate_mac_addresses(src_ip: &std::net::IpAddr, dst_ip: &std::net::IpAddr) -> ([u8; 6], [u8; 6]) {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    fn ip_to_mac(ip: &std::net::IpAddr) -> [u8; 6] {
        let mut hasher = DefaultHasher::new();
        match ip {
            std::net::IpAddr::V4(v4) => {
                v4.octets().hash(&mut hasher);
            }
            std::net::IpAddr::V6(v6) => {
                v6.octets().hash(&mut hasher);
            }
        }
        let hash = hasher.finish();
        let bytes = hash.to_be_bytes();

        // Create MAC address with locally-administered bit set (0x02 in first byte)
        [
            0x02 | (bytes[0] & 0xFC), // Set bit 1, clear bit 0 (unicast)
            bytes[1],
            bytes[2],
            bytes[3],
            bytes[4],
            bytes[5],
        ]
    }

    (ip_to_mac(src_ip), ip_to_mac(dst_ip))
}

/// Create proper PCAP packet data for export
/// Reconstructs valid Ethernet/IP/TCP/UDP headers from NetworkPacket metadata
fn create_pcap_packet_data(pkt: &NetworkPacket) -> Vec<u8> {
    use std::net::{IpAddr, Ipv4Addr};

    let mut data = Vec::new();

    // Parse source and destination IPs to determine IPv4 vs IPv6
    let src_ip: IpAddr = pkt.source_ip.parse().unwrap_or(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)));
    let dst_ip: IpAddr = pkt.destination_ip.parse().unwrap_or(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)));

    // Ethernet header (14 bytes)
    // Generate MAC addresses derived from IP addresses for consistency
    let (src_mac, dst_mac) = generate_mac_addresses(&src_ip, &dst_ip);
    data.extend_from_slice(&dst_mac); // Dest MAC
    data.extend_from_slice(&src_mac); // Src MAC

    match (src_ip, dst_ip) {
        (IpAddr::V4(src_v4), IpAddr::V4(dst_v4)) => {
            // EtherType: IPv4 (0x0800)
            data.extend_from_slice(&[0x08, 0x00]);

            // Build IPv4 + transport layer packet
            let ip_data = build_ipv4_packet(pkt, &src_v4, &dst_v4);
            data.extend_from_slice(&ip_data);
        }
        (IpAddr::V6(src_v6), IpAddr::V6(dst_v6)) => {
            // EtherType: IPv6 (0x86DD)
            data.extend_from_slice(&[0x86, 0xDD]);

            // Build IPv6 + transport layer packet
            let ip_data = build_ipv6_packet(pkt, &src_v6, &dst_v6);
            data.extend_from_slice(&ip_data);
        }
        _ => {
            // Mixed IPv4/IPv6 or invalid - default to IPv4
            data.extend_from_slice(&[0x08, 0x00]);
            let src_v4 = Ipv4Addr::new(0, 0, 0, 0);
            let dst_v4 = Ipv4Addr::new(0, 0, 0, 0);
            let ip_data = build_ipv4_packet(pkt, &src_v4, &dst_v4);
            data.extend_from_slice(&ip_data);
        }
    }

    data
}

/// Build a complete IPv4 packet with transport layer
fn build_ipv4_packet(pkt: &NetworkPacket, src_ip: &std::net::Ipv4Addr, dst_ip: &std::net::Ipv4Addr) -> Vec<u8> {
    let mut ipv4_data = Vec::new();

    // Determine protocol number and build transport layer
    let (protocol_num, transport_data) = match pkt.protocol.to_uppercase().as_str() {
        "TCP" => (6u8, build_tcp_segment(pkt, &src_ip.octets(), &dst_ip.octets())),
        "UDP" => (17u8, build_udp_datagram(pkt, &src_ip.octets(), &dst_ip.octets())),
        "ICMP" => (1u8, build_icmp_packet(pkt)),
        _ => (6u8, build_tcp_segment(pkt, &src_ip.octets(), &dst_ip.octets())), // Default to TCP
    };

    let total_length = 20 + transport_data.len(); // IPv4 header (20) + payload

    // IPv4 Header (20 bytes minimum, no options)
    ipv4_data.push(0x45); // Version (4) + IHL (5 = 20 bytes)
    ipv4_data.push(0x00); // DSCP + ECN
    ipv4_data.extend_from_slice(&(total_length as u16).to_be_bytes()); // Total length
    ipv4_data.extend_from_slice(&[0x00, 0x00]); // Identification
    ipv4_data.extend_from_slice(&[0x40, 0x00]); // Flags (Don't Fragment) + Fragment Offset
    ipv4_data.push(64); // TTL
    ipv4_data.push(protocol_num); // Protocol
    ipv4_data.extend_from_slice(&[0x00, 0x00]); // Checksum (placeholder)
    ipv4_data.extend_from_slice(&src_ip.octets()); // Source IP
    ipv4_data.extend_from_slice(&dst_ip.octets()); // Destination IP

    // Calculate and insert IPv4 header checksum
    let checksum = calculate_checksum(&ipv4_data);
    ipv4_data[10] = (checksum >> 8) as u8;
    ipv4_data[11] = (checksum & 0xFF) as u8;

    // Append transport layer data
    ipv4_data.extend_from_slice(&transport_data);

    ipv4_data
}

/// Build a complete IPv6 packet with transport layer
fn build_ipv6_packet(pkt: &NetworkPacket, src_ip: &std::net::Ipv6Addr, dst_ip: &std::net::Ipv6Addr) -> Vec<u8> {
    let mut ipv6_data = Vec::new();

    // Convert IPv6 addresses to byte slices for checksum calculation
    let src_bytes = src_ip.octets();
    let dst_bytes = dst_ip.octets();

    // Determine next header (protocol)
    let (next_header, transport_data) = match pkt.protocol.to_uppercase().as_str() {
        "TCP" => (6u8, build_tcp_segment_v6(pkt, &src_bytes, &dst_bytes)),
        "UDP" => (17u8, build_udp_datagram_v6(pkt, &src_bytes, &dst_bytes)),
        "ICMPV6" => (58u8, build_icmp_packet(pkt)),
        _ => (6u8, build_tcp_segment_v6(pkt, &src_bytes, &dst_bytes)), // Default to TCP
    };

    let payload_length = transport_data.len();

    // IPv6 Header (40 bytes fixed)
    ipv6_data.push(0x60); // Version (6) + Traffic Class (upper 4 bits)
    ipv6_data.extend_from_slice(&[0x00, 0x00, 0x00]); // Traffic Class (lower 4 bits) + Flow Label
    ipv6_data.extend_from_slice(&(payload_length as u16).to_be_bytes()); // Payload Length
    ipv6_data.push(next_header); // Next Header
    ipv6_data.push(64); // Hop Limit
    ipv6_data.extend_from_slice(&src_ip.octets()); // Source Address (16 bytes)
    ipv6_data.extend_from_slice(&dst_ip.octets()); // Destination Address (16 bytes)

    // Append transport layer data
    ipv6_data.extend_from_slice(&transport_data);

    ipv6_data
}

/// Build a TCP segment with proper checksum for IPv4
fn build_tcp_segment(pkt: &NetworkPacket, src_ip: &[u8; 4], dst_ip: &[u8; 4]) -> Vec<u8> {
    let mut tcp_data = Vec::new();

    tcp_data.extend_from_slice(&pkt.source_port.to_be_bytes()); // Source Port
    tcp_data.extend_from_slice(&pkt.destination_port.to_be_bytes()); // Destination Port
    tcp_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x01]); // Sequence Number
    tcp_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]); // Acknowledgment Number

    // Data Offset (5 = 20 bytes, no options) + Reserved + Flags
    let mut flags = 0u8;
    if let Some(flag_list) = &pkt.flags {
        for flag in flag_list {
            match flag.as_str() {
                "FIN" => flags |= 0x01,
                "SYN" => flags |= 0x02,
                "RST" => flags |= 0x04,
                "PSH" => flags |= 0x08,
                "ACK" => flags |= 0x10,
                "URG" => flags |= 0x20,
                _ => {}
            }
        }
    } else {
        // Default to ACK if no flags specified
        flags = 0x10;
    }

    tcp_data.push(0x50); // Data Offset (5) << 4
    tcp_data.push(flags); // Flags
    tcp_data.extend_from_slice(&[0x20, 0x00]); // Window Size (8192)
    tcp_data.extend_from_slice(&[0x00, 0x00]); // Checksum (placeholder, will be calculated)
    tcp_data.extend_from_slice(&[0x00, 0x00]); // Urgent Pointer

    // Add minimal payload to match expected packet size
    let header_size = 14 + 20 + 20; // Ethernet + IPv4 + TCP
    let payload_size = if pkt.size > header_size {
        (pkt.size - header_size) as usize
    } else {
        0
    };

    // Add zero-filled payload
    tcp_data.extend(vec![0u8; payload_size]);

    // Calculate and insert TCP checksum
    let checksum = calculate_tcp_checksum(src_ip, dst_ip, &tcp_data);
    tcp_data[16] = (checksum >> 8) as u8;
    tcp_data[17] = (checksum & 0xFF) as u8;

    tcp_data
}

/// Build a TCP segment with proper checksum for IPv6
fn build_tcp_segment_v6(pkt: &NetworkPacket, src_ip: &[u8; 16], dst_ip: &[u8; 16]) -> Vec<u8> {
    let mut tcp_data = Vec::new();

    tcp_data.extend_from_slice(&pkt.source_port.to_be_bytes()); // Source Port
    tcp_data.extend_from_slice(&pkt.destination_port.to_be_bytes()); // Destination Port
    tcp_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x01]); // Sequence Number
    tcp_data.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]); // Acknowledgment Number

    // Data Offset (5 = 20 bytes, no options) + Reserved + Flags
    let mut flags = 0u8;
    if let Some(flag_list) = &pkt.flags {
        for flag in flag_list {
            match flag.as_str() {
                "FIN" => flags |= 0x01,
                "SYN" => flags |= 0x02,
                "RST" => flags |= 0x04,
                "PSH" => flags |= 0x08,
                "ACK" => flags |= 0x10,
                "URG" => flags |= 0x20,
                _ => {}
            }
        }
    } else {
        // Default to ACK if no flags specified
        flags = 0x10;
    }

    tcp_data.push(0x50); // Data Offset (5) << 4
    tcp_data.push(flags); // Flags
    tcp_data.extend_from_slice(&[0x20, 0x00]); // Window Size (8192)
    tcp_data.extend_from_slice(&[0x00, 0x00]); // Checksum (placeholder, will be calculated)
    tcp_data.extend_from_slice(&[0x00, 0x00]); // Urgent Pointer

    // Add minimal payload to match expected packet size
    let header_size = 14 + 40 + 20; // Ethernet + IPv6 + TCP
    let payload_size = if pkt.size > header_size {
        (pkt.size - header_size) as usize
    } else {
        0
    };

    // Add zero-filled payload
    tcp_data.extend(vec![0u8; payload_size]);

    // Calculate and insert TCP checksum for IPv6
    let checksum = calculate_tcp_checksum_v6(src_ip, dst_ip, &tcp_data);
    tcp_data[16] = (checksum >> 8) as u8;
    tcp_data[17] = (checksum & 0xFF) as u8;

    tcp_data
}

/// Build a UDP datagram for IPv4
fn build_udp_datagram(pkt: &NetworkPacket, src_ip: &[u8; 4], dst_ip: &[u8; 4]) -> Vec<u8> {
    let mut udp_data = Vec::new();

    // Calculate payload size
    let header_size = 14 + 20 + 8; // Ethernet + IPv4 + UDP
    let payload_size = if pkt.size > header_size {
        (pkt.size - header_size) as usize
    } else {
        0
    };

    let total_length = 8 + payload_size; // UDP header + payload

    udp_data.extend_from_slice(&pkt.source_port.to_be_bytes()); // Source Port
    udp_data.extend_from_slice(&pkt.destination_port.to_be_bytes()); // Destination Port
    udp_data.extend_from_slice(&(total_length as u16).to_be_bytes()); // Length
    udp_data.extend_from_slice(&[0x00, 0x00]); // Checksum (placeholder)

    // Add zero-filled payload
    udp_data.extend(vec![0u8; payload_size]);

    // Calculate and insert UDP checksum (optional for IPv4, but we'll include it)
    let checksum = calculate_udp_checksum(src_ip, dst_ip, &udp_data);
    udp_data[6] = (checksum >> 8) as u8;
    udp_data[7] = (checksum & 0xFF) as u8;

    udp_data
}

/// Build a UDP datagram for IPv6
fn build_udp_datagram_v6(pkt: &NetworkPacket, src_ip: &[u8; 16], dst_ip: &[u8; 16]) -> Vec<u8> {
    let mut udp_data = Vec::new();

    // Calculate payload size
    let header_size = 14 + 40 + 8; // Ethernet + IPv6 + UDP
    let payload_size = if pkt.size > header_size {
        (pkt.size - header_size) as usize
    } else {
        0
    };

    let total_length = 8 + payload_size; // UDP header + payload

    udp_data.extend_from_slice(&pkt.source_port.to_be_bytes()); // Source Port
    udp_data.extend_from_slice(&pkt.destination_port.to_be_bytes()); // Destination Port
    udp_data.extend_from_slice(&(total_length as u16).to_be_bytes()); // Length
    udp_data.extend_from_slice(&[0x00, 0x00]); // Checksum (placeholder)

    // Add zero-filled payload
    udp_data.extend(vec![0u8; payload_size]);

    // Calculate and insert UDP checksum (required for IPv6)
    let checksum = calculate_udp_checksum_v6(src_ip, dst_ip, &udp_data);
    udp_data[6] = (checksum >> 8) as u8;
    udp_data[7] = (checksum & 0xFF) as u8;

    udp_data
}

/// Build an ICMP packet
fn build_icmp_packet(pkt: &NetworkPacket) -> Vec<u8> {
    let mut icmp_data = Vec::new();

    // ICMP Echo Request as default
    icmp_data.push(8); // Type: Echo Request
    icmp_data.push(0); // Code: 0
    icmp_data.extend_from_slice(&[0x00, 0x00]); // Checksum (placeholder)
    icmp_data.extend_from_slice(&[0x00, 0x01]); // Identifier
    icmp_data.extend_from_slice(&[0x00, 0x01]); // Sequence Number

    // Add minimal payload
    let header_size = 14 + 20 + 8; // Ethernet + IPv4 + ICMP
    let payload_size = if pkt.size > header_size {
        (pkt.size - header_size) as usize
    } else {
        32 // Default ICMP payload size
    };

    icmp_data.extend(vec![0x42u8; payload_size]); // Pattern data

    // Calculate checksum
    let checksum = calculate_checksum(&icmp_data);
    icmp_data[2] = (checksum >> 8) as u8;
    icmp_data[3] = (checksum & 0xFF) as u8;

    icmp_data
}

/// Calculate Internet checksum (RFC 1071)
fn calculate_checksum(data: &[u8]) -> u16 {
    let mut sum: u32 = 0;

    // Sum up 16-bit words
    for chunk in data.chunks(2) {
        if chunk.len() == 2 {
            sum += ((chunk[0] as u32) << 8) | (chunk[1] as u32);
        } else {
            sum += (chunk[0] as u32) << 8;
        }
    }

    // Fold 32-bit sum to 16 bits
    while (sum >> 16) > 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }

    // One's complement
    !sum as u16
}

/// Calculate TCP checksum for IPv4 (includes pseudo-header)
fn calculate_tcp_checksum(src_ip: &[u8; 4], dst_ip: &[u8; 4], tcp_data: &[u8]) -> u16 {
    let mut sum: u32 = 0;

    // Pseudo-header: Source IP
    sum += u16::from_be_bytes([src_ip[0], src_ip[1]]) as u32;
    sum += u16::from_be_bytes([src_ip[2], src_ip[3]]) as u32;

    // Pseudo-header: Destination IP
    sum += u16::from_be_bytes([dst_ip[0], dst_ip[1]]) as u32;
    sum += u16::from_be_bytes([dst_ip[2], dst_ip[3]]) as u32;

    // Pseudo-header: Protocol (TCP = 6)
    sum += 6u32;

    // Pseudo-header: TCP length
    sum += tcp_data.len() as u32;

    // TCP header + data
    for chunk in tcp_data.chunks(2) {
        let word = if chunk.len() == 2 {
            u16::from_be_bytes([chunk[0], chunk[1]])
        } else {
            u16::from_be_bytes([chunk[0], 0])
        };
        sum += word as u32;
    }

    // Fold and complement
    while sum >> 16 != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }

    !sum as u16
}

/// Calculate TCP checksum for IPv6 (includes pseudo-header)
fn calculate_tcp_checksum_v6(src_ip: &[u8; 16], dst_ip: &[u8; 16], tcp_data: &[u8]) -> u16 {
    let mut sum: u32 = 0;

    // Pseudo-header: Source IP (16 bytes)
    for chunk in src_ip.chunks(2) {
        sum += u16::from_be_bytes([chunk[0], chunk[1]]) as u32;
    }

    // Pseudo-header: Destination IP (16 bytes)
    for chunk in dst_ip.chunks(2) {
        sum += u16::from_be_bytes([chunk[0], chunk[1]]) as u32;
    }

    // Pseudo-header: TCP length (32-bit)
    let tcp_len = tcp_data.len() as u32;
    sum += (tcp_len >> 16) as u32;
    sum += (tcp_len & 0xFFFF) as u32;

    // Pseudo-header: Next Header (TCP = 6)
    sum += 6u32;

    // TCP header + data
    for chunk in tcp_data.chunks(2) {
        let word = if chunk.len() == 2 {
            u16::from_be_bytes([chunk[0], chunk[1]])
        } else {
            u16::from_be_bytes([chunk[0], 0])
        };
        sum += word as u32;
    }

    // Fold and complement
    while sum >> 16 != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }

    !sum as u16
}

/// Calculate UDP checksum for IPv4 (includes pseudo-header)
fn calculate_udp_checksum(src_ip: &[u8; 4], dst_ip: &[u8; 4], udp_data: &[u8]) -> u16 {
    let mut sum: u32 = 0;

    // Pseudo-header: Source IP
    sum += u16::from_be_bytes([src_ip[0], src_ip[1]]) as u32;
    sum += u16::from_be_bytes([src_ip[2], src_ip[3]]) as u32;

    // Pseudo-header: Destination IP
    sum += u16::from_be_bytes([dst_ip[0], dst_ip[1]]) as u32;
    sum += u16::from_be_bytes([dst_ip[2], dst_ip[3]]) as u32;

    // Pseudo-header: Protocol (UDP = 17)
    sum += 17u32;

    // Pseudo-header: UDP length
    sum += udp_data.len() as u32;

    // UDP header + data
    for chunk in udp_data.chunks(2) {
        let word = if chunk.len() == 2 {
            u16::from_be_bytes([chunk[0], chunk[1]])
        } else {
            u16::from_be_bytes([chunk[0], 0])
        };
        sum += word as u32;
    }

    // Fold and complement
    while sum >> 16 != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }

    let checksum = !sum as u16;

    // For UDP, checksum of 0 means no checksum, so if result is 0, use 0xFFFF
    if checksum == 0 {
        0xFFFF
    } else {
        checksum
    }
}

/// Calculate UDP checksum for IPv6 (includes pseudo-header)
fn calculate_udp_checksum_v6(src_ip: &[u8; 16], dst_ip: &[u8; 16], udp_data: &[u8]) -> u16 {
    let mut sum: u32 = 0;

    // Pseudo-header: Source IP (16 bytes)
    for chunk in src_ip.chunks(2) {
        sum += u16::from_be_bytes([chunk[0], chunk[1]]) as u32;
    }

    // Pseudo-header: Destination IP (16 bytes)
    for chunk in dst_ip.chunks(2) {
        sum += u16::from_be_bytes([chunk[0], chunk[1]]) as u32;
    }

    // Pseudo-header: UDP length (32-bit)
    let udp_len = udp_data.len() as u32;
    sum += (udp_len >> 16) as u32;
    sum += (udp_len & 0xFFFF) as u32;

    // Pseudo-header: Next Header (UDP = 17)
    sum += 17u32;

    // UDP header + data
    for chunk in udp_data.chunks(2) {
        let word = if chunk.len() == 2 {
            u16::from_be_bytes([chunk[0], chunk[1]])
        } else {
            u16::from_be_bytes([chunk[0], 0])
        };
        sum += word as u32;
    }

    // Fold and complement
    while sum >> 16 != 0 {
        sum = (sum & 0xFFFF) + (sum >> 16);
    }

    !sum as u16
}

/// Parse raw packet data into NetworkPacket structure using pnet
fn parse_pcap_packet(raw_packet: &[u8], packet_id: String) -> NetworkPacket {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_else(|_| std::time::Duration::from_secs(0))
        .as_millis() as u64;

    // Default values
    let mut protocol = "Unknown".to_string();
    let mut source_ip = "0.0.0.0".to_string();
    let mut source_port = 0u16;
    let mut dest_ip = "0.0.0.0".to_string();
    let mut dest_port = 0u16;
    let mut flags: Vec<String> = Vec::new();
    let mut suspicious = false;

    // Parse ethernet frame
    if let Some(ethernet) = EthernetPacket::new(raw_packet) {
        match ethernet.get_ethertype() {
            EtherTypes::Ipv4 => {
                // Parse IPv4 packet
                if let Some(ipv4) = Ipv4Packet::new(ethernet.payload()) {
                    source_ip = ipv4.get_source().to_string();
                    dest_ip = ipv4.get_destination().to_string();

                    match ipv4.get_next_level_protocol() {
                        IpNextHeaderProtocols::Tcp => {
                            protocol = "TCP".to_string();
                            if let Some(tcp) = TcpPacket::new(ipv4.payload()) {
                                source_port = tcp.get_source();
                                dest_port = tcp.get_destination();

                                // Extract TCP flags
                                if tcp.get_flags() & 0x01 != 0 { flags.push("FIN".to_string()); }
                                if tcp.get_flags() & 0x02 != 0 { flags.push("SYN".to_string()); }
                                if tcp.get_flags() & 0x04 != 0 { flags.push("RST".to_string()); }
                                if tcp.get_flags() & 0x08 != 0 { flags.push("PSH".to_string()); }
                                if tcp.get_flags() & 0x10 != 0 { flags.push("ACK".to_string()); }
                                if tcp.get_flags() & 0x20 != 0 { flags.push("URG".to_string()); }

                                // Check for suspicious patterns
                                // SYN+FIN or FIN without ACK
                                if (tcp.get_flags() & 0x03 == 0x03) ||
                                   (tcp.get_flags() & 0x01 != 0 && tcp.get_flags() & 0x10 == 0) {
                                    suspicious = true;
                                }
                            }
                        }
                        IpNextHeaderProtocols::Udp => {
                            protocol = "UDP".to_string();
                            if let Some(udp) = UdpPacket::new(ipv4.payload()) {
                                source_port = udp.get_source();
                                dest_port = udp.get_destination();
                            }
                        }
                        IpNextHeaderProtocols::Icmp => {
                            protocol = "ICMP".to_string();
                            if let Some(icmp) = IcmpPacket::new(ipv4.payload()) {
                                let icmp_type = icmp.get_icmp_type().0;
                                flags.push(format!("Type-{}", icmp_type));
                            }
                        }
                        other => {
                            protocol = format!("IPv4-Protocol-{}", other.0);
                        }
                    }
                }
            }
            EtherTypes::Ipv6 => {
                // Parse IPv6 packet
                if let Some(ipv6) = Ipv6Packet::new(ethernet.payload()) {
                    source_ip = ipv6.get_source().to_string();
                    dest_ip = ipv6.get_destination().to_string();

                    match ipv6.get_next_header() {
                        IpNextHeaderProtocols::Tcp => {
                            protocol = "TCP".to_string();
                            if let Some(tcp) = TcpPacket::new(ipv6.payload()) {
                                source_port = tcp.get_source();
                                dest_port = tcp.get_destination();

                                // Extract TCP flags
                                if tcp.get_flags() & 0x01 != 0 { flags.push("FIN".to_string()); }
                                if tcp.get_flags() & 0x02 != 0 { flags.push("SYN".to_string()); }
                                if tcp.get_flags() & 0x04 != 0 { flags.push("RST".to_string()); }
                                if tcp.get_flags() & 0x08 != 0 { flags.push("PSH".to_string()); }
                                if tcp.get_flags() & 0x10 != 0 { flags.push("ACK".to_string()); }
                                if tcp.get_flags() & 0x20 != 0 { flags.push("URG".to_string()); }

                                // Check for suspicious patterns
                                if (tcp.get_flags() & 0x03 == 0x03) ||
                                   (tcp.get_flags() & 0x01 != 0 && tcp.get_flags() & 0x10 == 0) {
                                    suspicious = true;
                                }
                            }
                        }
                        IpNextHeaderProtocols::Udp => {
                            protocol = "UDP".to_string();
                            if let Some(udp) = UdpPacket::new(ipv6.payload()) {
                                source_port = udp.get_source();
                                dest_port = udp.get_destination();
                            }
                        }
                        IpNextHeaderProtocols::Icmpv6 => {
                            protocol = "ICMPv6".to_string();
                        }
                        other => {
                            protocol = format!("IPv6-Protocol-{}", other.0);
                        }
                    }
                }
            }
            EtherTypes::Arp => {
                protocol = "ARP".to_string();
            }
            other => {
                protocol = format!("EtherType-0x{:04x}", other.0);
            }
        }
    }

    NetworkPacket {
        id: packet_id,
        timestamp,
        protocol,
        source_ip,
        source_port,
        destination_ip: dest_ip,
        destination_port: dest_port,
        size: raw_packet.len() as u32,
        direction: "ingress".to_string(),
        flags: if flags.is_empty() { None } else { Some(flags) },
        suspicious,
    }
}

// Note: Live packet capture requires pcap library and elevated privileges
// This is platform-specific and needs pcap/npcap installed
#[tauri::command]
pub async fn start_packet_capture(
    app: AppHandle,
    interface: Option<String>,
) -> Result<String, String> {
    let capture_id = uuid::Uuid::new_v4().to_string();

    // Determine which interface to use
    let device = if let Some(iface_name) = interface {
        Device::list()
            .map_err(|e| format!(
                "Could not enumerate network interfaces. This usually means libpcap/npcap is not installed or you don't have sufficient permissions. \
                On Windows, install Npcap. On Linux/macOS, install libpcap and run with sudo. Error: {}",
                e
            ))?
            .into_iter()
            .find(|d| d.name == iface_name)
            .ok_or_else(|| format!(
                "Network interface '{}' not found. Please check the interface name and ensure it exists on your system. \
                Use 'ifconfig' (Unix) or 'ipconfig' (Windows) to list available interfaces.",
                iface_name
            ))?
    } else {
        // Find the best interface - prefer one that's up, running, not loopback, and has addresses
        let devices = Device::list()
            .map_err(|e| format!(
                "Could not enumerate network interfaces. Please ensure libpcap/npcap is installed. Error: {}",
                e
            ))?;

        // Log available interfaces for debugging
        println!("Available network interfaces:");
        for d in &devices {
            println!("  - {} (up={}, running={}, loopback={}, addrs={})",
                d.name,
                d.flags.is_up(),
                d.flags.is_running(),
                d.flags.is_loopback(),
                d.addresses.len()
            );
        }

        // Priority order:
        // 1. en0/en1 (typical WiFi/Ethernet on macOS)
        // 2. eth0/wlan0 (typical on Linux)
        // 3. Any interface that's up, running, not loopback, and has addresses
        // 4. Any interface that's up and not loopback
        let preferred_names = ["en0", "en1", "eth0", "wlan0", "Ethernet", "Wi-Fi"];

        devices.iter()
            .find(|d| preferred_names.contains(&d.name.as_str()) && d.flags.is_up() && d.flags.is_running())
            .or_else(|| devices.iter().find(|d|
                d.flags.is_up() &&
                d.flags.is_running() &&
                !d.flags.is_loopback() &&
                !d.addresses.is_empty()
            ))
            .or_else(|| devices.iter().find(|d|
                d.flags.is_up() &&
                !d.flags.is_loopback()
            ))
            .cloned()
            .ok_or_else(||
                "No suitable network interface found. Please ensure a network adapter is connected and enabled.".to_string()
            )?
    };

    let interface_name = device.name.clone();

    // Open the capture device
    let mut active_capture: Capture<Active> = Capture::from_device(device)
        .map_err(|e| format!("Failed to create capture: {}", e))?
        .promisc(true)
        .snaplen(65535)
        .timeout(1000)
        .open()
        .map_err(|e| format!(
            "Failed to activate packet capture: {}. \
            This usually means insufficient permissions. \
            On Linux, run with sudo or grant cap_net_raw capability. \
            On Windows, ensure npcap is installed and running as administrator.",
            e
        ))?;

    // Create shared state for the capture session
    let packets_captured = Arc::new(Mutex::new(Vec::new()));
    let stop_signal = Arc::new(AtomicBool::new(false));

    let packets_clone = Arc::clone(&packets_captured);
    let stop_clone = Arc::clone(&stop_signal);
    let capture_id_clone = capture_id.clone();
    let app_clone = app.clone();
    let interface_name_clone = interface_name.clone();

    // Spawn background thread for packet capture
    let thread_handle = thread::spawn(move || {
        let mut packet_count = 0u64;
        let mut timeout_count = 0u64;

        println!("Packet capture thread started for {} on interface {}", capture_id_clone, interface_name_clone);

        loop {
            // Check stop signal
            if stop_clone.load(Ordering::Relaxed) {
                println!("Stop signal received for capture {}", capture_id_clone);
                break;
            }

            // Try to capture next packet
            match active_capture.next_packet() {
                Ok(raw_packet) => {
                    packet_count += 1;
                    let packet_id = format!("{}-{}", capture_id_clone, packet_count);

                    if packet_count <= 5 || packet_count % 100 == 0 {
                        println!("Captured packet #{} ({} bytes)", packet_count, raw_packet.data.len());
                    }

                    // Parse the packet
                    let network_packet = parse_pcap_packet(raw_packet.data, packet_id);

                    // Store packet
                    if let Ok(mut packets) = packets_clone.lock() {
                        packets.push(network_packet.clone());
                    }

                    // Emit event to frontend
                    if let Err(e) = app_clone.emit("packet-captured", network_packet) {
                        eprintln!("Failed to emit packet event: {}", e);
                    }
                }
                Err(pcap::Error::TimeoutExpired) => {
                    timeout_count += 1;
                    // Log every 10 timeouts to show we're still alive
                    if timeout_count % 10 == 1 {
                        println!("Capture {} waiting for packets... (timeouts: {})", capture_id_clone, timeout_count);
                    }
                    continue;
                }
                Err(e) => {
                    eprintln!("Error capturing packet: {}", e);
                    break;
                }
            }
        }

        println!("Packet capture thread ending for {} (captured {} packets)", capture_id_clone, packet_count);
    });

    // Store the session
    let session = CaptureSession {
        interface_name: interface_name.clone(),
        packets_captured,
        stop_signal,
        thread_handle: Some(thread_handle),
    };

    ACTIVE_CAPTURES.lock()
        .map_err(|e| format!("Failed to lock capture state: {}", e))?
        .insert(capture_id.clone(), session);

    // Record active capture metric
    let active_count = ACTIVE_CAPTURES.lock()
        .map(|captures| captures.len())
        .unwrap_or(0);

    ACTIVE_PACKET_CAPTURES
        .with_label_values(&[&interface_name])
        .set(active_count as f64);

    Ok(format!("Capture started on interface: {} (ID: {})", interface_name, capture_id))
}

#[derive(Serialize, Deserialize)]
pub struct ActiveCaptureInfo {
    capture_id: String,
    interface_name: String,
    packet_count: usize,
}

#[tauri::command]
pub async fn get_active_captures() -> Result<Vec<ActiveCaptureInfo>, String> {
    let captures = ACTIVE_CAPTURES.lock()
        .map_err(|e| format!("Failed to lock capture state: {}", e))?;

    let active_captures: Vec<ActiveCaptureInfo> = captures.iter()
        .map(|(id, session)| {
            let packet_count = session.packets_captured.lock()
                .map(|packets| packets.len())
                .unwrap_or(0);

            ActiveCaptureInfo {
                capture_id: id.clone(),
                interface_name: session.interface_name.clone(),
                packet_count,
            }
        })
        .collect();

    Ok(active_captures)
}

#[tauri::command]
pub async fn stop_packet_capture(capture_id: String) -> Result<Vec<NetworkPacket>, String> {
    let mut captures = ACTIVE_CAPTURES.lock()
        .map_err(|e| format!(
            "Internal error: Could not access packet capture state. Error: {}",
            e
        ))?;

    let mut session = captures.remove(&capture_id)
        .ok_or_else(|| format!(
            "Packet capture session '{}' not found. It may have already been stopped or expired.",
            capture_id
        ))?;

    let interface_name = session.interface_name.clone();

    // Signal thread to stop
    session.stop_signal.store(true, Ordering::Relaxed);

    // Wait for thread to finish
    if let Some(handle) = session.thread_handle.take() {
        handle.join()
            .map_err(|_|
                "Failed to properly stop packet capture thread. Some packets may not have been saved.".to_string()
            )?;
    }

    // Update active capture metric
    let active_count = captures.len();
    ACTIVE_PACKET_CAPTURES
        .with_label_values(&[&interface_name])
        .set(active_count as f64);

    // Return captured packets
    let packets = session.packets_captured.lock()
        .map_err(|e| format!(
            "Could not retrieve captured packets due to internal error. Error: {}",
            e
        ))?
        .clone();

    Ok(packets)
}

// Additional network analysis structures and commands

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct NetworkStatistics {
    total_packets: u64,
    suspicious_packets: u64,
    tcp_packets: u64,
    udp_packets: u64,
    icmp_packets: u64,
    other_packets: u64,
    total_bytes: u64,
    unique_source_ips: std::collections::HashSet<String>,
    unique_dest_ips: std::collections::HashSet<String>,
    blocked_packet_count: u64,
    /// Packet counts per IP address for "Top Connections" display
    ip_packet_counts: std::collections::HashMap<String, u64>,
    /// Protocol distribution for connection type classification
    ip_protocols: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockResult {
    success: bool,
    blocked_count: usize,
    total_blocked: usize,
}

/// Block IP addresses by adding them to the blocklist
/// Blocked IPs can be used to filter packets during capture or analysis
#[tauri::command]
pub async fn block_ip_addresses(ip_addresses: Vec<String>) -> Result<BlockResult, String> {
    let mut blocked_ips = BLOCKED_IPS.lock()
        .map_err(|e| format!(
            "Internal error: Could not access IP blocklist. Error: {}",
            e
        ))?;

    let initial_count = blocked_ips.len();

    // Validate and add IP addresses
    for ip in ip_addresses.iter() {
        // Basic validation - check if it parses as an IP address
        if ip.parse::<std::net::IpAddr>().is_ok() {
            blocked_ips.insert(ip.clone());
        } else {
            return Err(format!(
                "Invalid IP address format: '{}'. Please provide valid IPv4 or IPv6 addresses.",
                ip
            ));
        }
    }

    let new_count = blocked_ips.len();
    let blocked_count = new_count - initial_count;

    Ok(BlockResult {
        success: true,
        blocked_count,
        total_blocked: new_count,
    })
}

/// Get network analysis statistics
/// Returns aggregated statistics about analyzed packets
#[tauri::command]
pub async fn get_network_statistics() -> Result<NetworkStatistics, String> {
    let stats = NETWORK_STATS.lock()
        .map_err(|e| format!(
            "Internal error: Could not access network statistics. Error: {}",
            e
        ))?;

    Ok(stats.clone())
}

/// Update network statistics with a newly analyzed packet
/// This is called internally after packet analysis
pub fn update_network_statistics(packet: &NetworkPacket) {
    if let Ok(mut stats) = NETWORK_STATS.lock() {
        stats.total_packets += 1;
        stats.total_bytes += packet.size as u64;

        // Count by protocol
        match packet.protocol.to_uppercase().as_str() {
            "TCP" => stats.tcp_packets += 1,
            "UDP" => stats.udp_packets += 1,
            "ICMP" | "ICMPV6" => stats.icmp_packets += 1,
            _ => stats.other_packets += 1,
        }

        // Track suspicious packets
        if packet.suspicious {
            stats.suspicious_packets += 1;
        }

        // Track unique IPs
        stats.unique_source_ips.insert(packet.source_ip.clone());
        stats.unique_dest_ips.insert(packet.destination_ip.clone());

        // Track packet counts per IP for "Top Connections" display
        *stats.ip_packet_counts.entry(packet.source_ip.clone()).or_insert(0) += 1;
        *stats.ip_packet_counts.entry(packet.destination_ip.clone()).or_insert(0) += 1;

        // Track primary protocol per IP (use most recent)
        stats.ip_protocols.insert(packet.source_ip.clone(), packet.protocol.clone());
        stats.ip_protocols.insert(packet.destination_ip.clone(), packet.protocol.clone());

        // Check if packet involves blocked IP
        if let Ok(blocked_ips) = BLOCKED_IPS.lock() {
            if blocked_ips.contains(&packet.source_ip) || blocked_ips.contains(&packet.destination_ip) {
                stats.blocked_packet_count += 1;
            }
        }
    }
}

/// Generate a network analysis report in various formats
/// Supports JSON, HTML, and PDF formats
#[tauri::command]
pub async fn generate_network_report(
    format: String,
    include_packets: bool,
) -> Result<Vec<u8>, String> {
    let stats = NETWORK_STATS.lock()
        .map_err(|e| format!(
            "Internal error: Could not access network statistics. Error: {}",
            e
        ))?
        .clone();

    let blocked_ips = BLOCKED_IPS.lock()
        .map_err(|e| format!(
            "Internal error: Could not access IP blocklist. Error: {}",
            e
        ))?
        .clone();

    // Collect all captured packets if requested
    let all_packets = if include_packets {
        let captures = ACTIVE_CAPTURES.lock()
            .map_err(|e| format!(
                "Internal error: Could not access packet captures. Error: {}",
                e
            ))?;

        let mut packets = Vec::new();
        for session in captures.values() {
            if let Ok(session_packets) = session.packets_captured.lock() {
                packets.extend(session_packets.clone());
            }
        }
        packets
    } else {
        Vec::new()
    };

    match format.to_lowercase().as_str() {
        "json" => generate_json_report(&stats, &blocked_ips, &all_packets),
        "html" => generate_html_report(&stats, &blocked_ips, &all_packets),
        "pdf" => generate_pdf_report(&stats, &blocked_ips, &all_packets),
        _ => Err(format!(
            "Unsupported report format: '{}'. Supported formats are: 'json', 'html', 'pdf'.",
            format
        )),
    }
}

/// Generate JSON format report
fn generate_json_report(
    stats: &NetworkStatistics,
    blocked_ips: &std::collections::HashSet<String>,
    packets: &[NetworkPacket],
) -> Result<Vec<u8>, String> {
    let report = serde_json::json!({
        "report_type": "network_analysis",
        "generated_at": chrono::Utc::now().to_rfc3339(),
        "statistics": {
            "total_packets": stats.total_packets,
            "suspicious_packets": stats.suspicious_packets,
            "tcp_packets": stats.tcp_packets,
            "udp_packets": stats.udp_packets,
            "icmp_packets": stats.icmp_packets,
            "other_packets": stats.other_packets,
            "total_bytes": stats.total_bytes,
            "unique_source_ips": stats.unique_source_ips.len(),
            "unique_dest_ips": stats.unique_dest_ips.len(),
            "blocked_packet_count": stats.blocked_packet_count,
        },
        "blocked_ips": blocked_ips.iter().collect::<Vec<_>>(),
        "packets": if packets.is_empty() { serde_json::Value::Null } else { serde_json::to_value(packets).unwrap_or(serde_json::Value::Null) },
    });

    serde_json::to_vec_pretty(&report)
        .map_err(|e| format!(
            "Failed to generate JSON report. Error: {}",
            e
        ))
}

/// Generate HTML format report
fn generate_html_report(
    stats: &NetworkStatistics,
    blocked_ips: &std::collections::HashSet<String>,
    packets: &[NetworkPacket],
) -> Result<Vec<u8>, String> {
    let mut html = String::from(r#"<!DOCTYPE html>
<html>
<head>
    <title>Network Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #ecf0f1; padding: 15px; border-radius: 5px; border-left: 4px solid #3498db; }
        .stat-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; }
        .stat-value { font-size: 24px; font-weight: bold; color: #2c3e50; margin-top: 5px; }
        .suspicious { color: #e74c3c; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #3498db; color: white; }
        tr:hover { background-color: #f5f5f5; }
        .blocked-ip { color: #e74c3c; font-family: monospace; }
        .timestamp { color: #7f8c8d; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Network Analysis Report</h1>
        <p class="timestamp">Generated: "#);

    html.push_str(&chrono::Utc::now().to_rfc3339());
    html.push_str(r#"</p>

        <h2>Summary Statistics</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Packets</div>
                <div class="stat-value">"#);
    html.push_str(&stats.total_packets.to_string());
    html.push_str(r#"</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Suspicious Packets</div>
                <div class="stat-value suspicious">"#);
    html.push_str(&stats.suspicious_packets.to_string());
    html.push_str(r#"</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Data</div>
                <div class="stat-value">"#);
    html.push_str(&format!("{:.2} MB", stats.total_bytes as f64 / 1024.0 / 1024.0));
    html.push_str(r#"</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Unique IPs</div>
                <div class="stat-value">"#);
    html.push_str(&(stats.unique_source_ips.len() + stats.unique_dest_ips.len()).to_string());
    html.push_str(r#"</div>
            </div>
        </div>

        <h2>Protocol Breakdown</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">TCP</div>
                <div class="stat-value">"#);
    html.push_str(&stats.tcp_packets.to_string());
    html.push_str(r#"</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">UDP</div>
                <div class="stat-value">"#);
    html.push_str(&stats.udp_packets.to_string());
    html.push_str(r#"</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">ICMP</div>
                <div class="stat-value">"#);
    html.push_str(&stats.icmp_packets.to_string());
    html.push_str(r#"</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Other</div>
                <div class="stat-value">"#);
    html.push_str(&stats.other_packets.to_string());
    html.push_str(r#"</div>
            </div>
        </div>

        <h2>Blocked IP Addresses</h2>"#);

    if blocked_ips.is_empty() {
        html.push_str("<p>No IP addresses are currently blocked.</p>");
    } else {
        html.push_str("<ul>");
        for ip in blocked_ips {
            html.push_str(&format!("<li class=\"blocked-ip\">{}</li>", ip));
        }
        html.push_str("</ul>");
    }

    if !packets.is_empty() {
        html.push_str(r#"
        <h2>Captured Packets</h2>
        <table>
            <tr>
                <th>Timestamp</th>
                <th>Protocol</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Size</th>
                <th>Flags</th>
            </tr>"#);

        for packet in packets.iter().take(100) {
            // Limit to first 100 packets
            html.push_str("<tr>");
            html.push_str(&format!("<td>{}</td>", packet.timestamp));
            html.push_str(&format!("<td>{}</td>", packet.protocol));
            html.push_str(&format!("<td>{}:{}</td>", packet.source_ip, packet.source_port));
            html.push_str(&format!("<td>{}:{}</td>", packet.destination_ip, packet.destination_port));
            html.push_str(&format!("<td>{} bytes</td>", packet.size));
            html.push_str(&format!("<td>{}</td>",
                packet.flags.as_ref()
                    .map(|f| f.join(", "))
                    .unwrap_or_else(|| "-".to_string())
            ));
            html.push_str("</tr>");
        }

        if packets.len() > 100 {
            html.push_str(&format!("<tr><td colspan='6' style='text-align: center; font-style: italic;'>... and {} more packets</td></tr>", packets.len() - 100));
        }

        html.push_str("</table>");
    }

    html.push_str(r#"
    </div>
</body>
</html>"#);

    Ok(html.into_bytes())
}

/// Generate PDF format report
/// Note: This creates a simple PDF using a basic PDF structure
fn generate_pdf_report(
    _stats: &NetworkStatistics,
    _blocked_ips: &std::collections::HashSet<String>,
    _packets: &[NetworkPacket],
) -> Result<Vec<u8>, String> {
    // For a basic implementation, we'll convert to HTML first and return that
    // In a production system, you would use a proper PDF library like printpdf
    // For now, return an error suggesting HTML export instead
    Err(format!(
        "PDF report generation is not yet implemented. Please use 'html' or 'json' format instead. \
        You can convert the HTML report to PDF using a browser's print-to-PDF function."
    ))
}

// ============================================================================
// Packet Capture Permission Management
// ============================================================================

#[derive(Serialize, Deserialize, Clone)]
pub struct CapturePermissionStatus {
    pub has_permission: bool,
    pub platform: String,
    pub message: String,
    pub can_request_elevation: bool,
}

/// Check if the current process has permission to capture packets
#[tauri::command]
pub async fn check_capture_permissions() -> Result<CapturePermissionStatus, String> {
    let platform = std::env::consts::OS.to_string();

    // Try to open a capture device to test permissions
    let test_result = Device::lookup();

    match test_result {
        Ok(Some(device)) => {
            // Try to actually open the device
            match Capture::from_device(device)
                .map_err(|e| e.to_string())?
                .promisc(false)
                .snaplen(64)
                .timeout(100)
                .open()
            {
                Ok(_) => Ok(CapturePermissionStatus {
                    has_permission: true,
                    platform,
                    message: "Packet capture permissions are available.".to_string(),
                    can_request_elevation: false,
                }),
                Err(e) => {
                    let error_str = e.to_string();
                    let can_elevate = cfg!(target_os = "macos") || cfg!(target_os = "linux");

                    Ok(CapturePermissionStatus {
                        has_permission: false,
                        platform: platform.clone(),
                        message: format!(
                            "Permission denied: {}. {}",
                            error_str,
                            get_permission_help(&platform)
                        ),
                        can_request_elevation: can_elevate,
                    })
                }
            }
        }
        Ok(None) => Ok(CapturePermissionStatus {
            has_permission: false,
            platform,
            message: "No network interfaces available for capture.".to_string(),
            can_request_elevation: false,
        }),
        Err(e) => {
            let can_elevate = cfg!(target_os = "macos") || cfg!(target_os = "linux");

            Ok(CapturePermissionStatus {
                has_permission: false,
                platform: platform.clone(),
                message: format!(
                    "Cannot access network interfaces: {}. {}",
                    e,
                    get_permission_help(&platform)
                ),
                can_request_elevation: can_elevate,
            })
        }
    }
}

fn get_permission_help(platform: &str) -> &'static str {
    match platform {
        "macos" => "On macOS, packet capture requires access to BPF devices. Click 'Grant Access' to configure permissions.",
        "linux" => "On Linux, packet capture requires CAP_NET_RAW capability or root access. Click 'Grant Access' to configure.",
        "windows" => "On Windows, ensure Npcap is installed and you are running as Administrator.",
        _ => "Packet capture requires elevated privileges on this platform.",
    }
}

/// Request elevated permissions for packet capture
/// On macOS: Sets up BPF device permissions
/// On Linux: Attempts to add CAP_NET_RAW capability
#[tauri::command]
pub async fn request_capture_permissions() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        request_macos_permissions().await
    }

    #[cfg(target_os = "linux")]
    {
        request_linux_permissions().await
    }

    #[cfg(target_os = "windows")]
    {
        Err("On Windows, please run the application as Administrator or ensure Npcap is installed with WinPcap API-compatible mode.".to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("Permission elevation is not supported on this platform.".to_string())
    }
}

#[cfg(target_os = "macos")]
async fn request_macos_permissions() -> Result<String, String> {
    use std::process::Command;

    // AppleScript to request admin privileges and set up BPF permissions
    // This approach sets world-readable/writable permissions for immediate effect
    // without requiring logout (group membership changes require re-login)
    let script = r#"
do shell script "
# Set permissions on all BPF devices to allow any user to capture
# This is more permissive but works immediately without logout
for bpf in /dev/bpf*; do
    chmod o+rw \"$bpf\"
done

echo 'BPF permissions configured successfully'
" with administrator privileges
"#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to run permission request: {}", e))?;

    if output.status.success() {
        Ok("Packet capture permissions have been configured. You can now capture network traffic.".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("User canceled") || stderr.contains("cancelled") {
            Err("Permission request was cancelled by user.".to_string())
        } else {
            Err(format!("Failed to configure permissions: {}", stderr))
        }
    }
}

#[cfg(target_os = "linux")]
async fn request_linux_permissions() -> Result<String, String> {
    use std::process::Command;

    // Get the path to the current executable
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Could not determine executable path: {}", e))?;

    // Try to use pkexec (PolicyKit) for graphical sudo
    let script = format!(
        "setcap cap_net_raw,cap_net_admin=eip '{}'",
        exe_path.display()
    );

    // First try pkexec (graphical)
    let output = Command::new("pkexec")
        .arg("sh")
        .arg("-c")
        .arg(&script)
        .output();

    match output {
        Ok(result) if result.status.success() => {
            Ok("Network capture capabilities have been granted. Please restart the application for changes to take effect.".to_string())
        }
        Ok(result) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            if stderr.contains("dismissed") || stderr.contains("cancelled") {
                Err("Permission request was cancelled by user.".to_string())
            } else {
                // Provide manual instructions
                Err(format!(
                    "Automatic permission setup failed. Please run manually:\n\
                    sudo setcap cap_net_raw,cap_net_admin=eip '{}'\n\
                    Error: {}",
                    exe_path.display(),
                    stderr
                ))
            }
        }
        Err(_) => {
            // pkexec not available, provide manual instructions
            Err(format!(
                "PolicyKit (pkexec) is not available. Please run manually:\n\
                sudo setcap cap_net_raw,cap_net_admin=eip '{}'",
                exe_path.display()
            ))
        }
    }
}

/// List available network interfaces for packet capture
#[tauri::command]
pub async fn list_capture_interfaces() -> Result<Vec<NetworkInterfaceInfo>, String> {
    let devices = Device::list()
        .map_err(|e| format!("Failed to list network interfaces: {}", e))?;

    let interfaces: Vec<NetworkInterfaceInfo> = devices
        .into_iter()
        .map(|d| {
            let addresses: Vec<String> = d.addresses.iter()
                .map(|addr| addr.addr.to_string())
                .collect();

            NetworkInterfaceInfo {
                name: d.name,
                description: d.desc.unwrap_or_default(),
                addresses,
                is_loopback: d.flags.is_loopback(),
                is_up: d.flags.is_up(),
                is_running: d.flags.is_running(),
            }
        })
        .collect();

    Ok(interfaces)
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NetworkInterfaceInfo {
    pub name: String,
    pub description: String,
    pub addresses: Vec<String>,
    pub is_loopback: bool,
    pub is_up: bool,
    pub is_running: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_checksum_simple() {
        let data = vec![0x45, 0x00, 0x00, 0x3c];
        let checksum = calculate_checksum(&data);
        assert_ne!(checksum, 0); // Should produce a non-zero checksum
    }

    #[test]
    fn test_calculate_checksum_empty() {
        let data = vec![];
        let checksum = calculate_checksum(&data);
        assert_eq!(checksum, 0xFFFF); // Empty data should produce all 1s
    }

    #[test]
    fn test_build_tcp_segment_no_flags() {
        let packet = NetworkPacket {
            id: "test-1".to_string(),
            timestamp: 1000,
            protocol: "TCP".to_string(),
            source_ip: "192.168.1.1".to_string(),
            source_port: 8080,
            destination_ip: "192.168.1.2".to_string(),
            destination_port: 443,
            size: 100,
            direction: "egress".to_string(),
            flags: None,
            suspicious: false,
        };

        let src_ip = [192, 168, 1, 1];
        let dst_ip = [192, 168, 1, 2];
        let tcp_segment = build_tcp_segment(&packet, &src_ip, &dst_ip);

        // TCP header should be at least 20 bytes
        assert!(tcp_segment.len() >= 20);

        // Check source port (bytes 0-1)
        let src_port = u16::from_be_bytes([tcp_segment[0], tcp_segment[1]]);
        assert_eq!(src_port, 8080);

        // Check destination port (bytes 2-3)
        let dst_port = u16::from_be_bytes([tcp_segment[2], tcp_segment[3]]);
        assert_eq!(dst_port, 443);
    }

    #[test]
    fn test_build_tcp_segment_with_flags() {
        let packet = NetworkPacket {
            id: "test-2".to_string(),
            timestamp: 1000,
            protocol: "TCP".to_string(),
            source_ip: "10.0.0.1".to_string(),
            source_port: 12345,
            destination_ip: "10.0.0.2".to_string(),
            destination_port: 80,
            size: 64,
            direction: "ingress".to_string(),
            flags: Some(vec!["SYN".to_string(), "ACK".to_string()]),
            suspicious: false,
        };

        let src_ip = [10, 0, 0, 1];
        let dst_ip = [10, 0, 0, 2];
        let tcp_segment = build_tcp_segment(&packet, &src_ip, &dst_ip);

        // Check flags byte (byte 13)
        let flags_byte = tcp_segment[13];
        assert!(flags_byte & 0x02 != 0); // SYN flag
        assert!(flags_byte & 0x10 != 0); // ACK flag
    }

    #[test]
    fn test_build_udp_datagram() {
        let packet = NetworkPacket {
            id: "test-3".to_string(),
            timestamp: 2000,
            protocol: "UDP".to_string(),
            source_ip: "172.16.0.1".to_string(),
            source_port: 53,
            destination_ip: "172.16.0.2".to_string(),
            destination_port: 5353,
            size: 512,
            direction: "egress".to_string(),
            flags: None,
            suspicious: false,
        };

        let src_ip = [172, 16, 0, 1];
        let dst_ip = [172, 16, 0, 2];
        let udp_datagram = build_udp_datagram(&packet, &src_ip, &dst_ip);

        // UDP header should be at least 8 bytes
        assert!(udp_datagram.len() >= 8);

        // Check source port
        let src_port = u16::from_be_bytes([udp_datagram[0], udp_datagram[1]]);
        assert_eq!(src_port, 53);

        // Check destination port
        let dst_port = u16::from_be_bytes([udp_datagram[2], udp_datagram[3]]);
        assert_eq!(dst_port, 5353);
    }

    #[test]
    fn test_build_icmp_packet() {
        let packet = NetworkPacket {
            id: "test-4".to_string(),
            timestamp: 3000,
            protocol: "ICMP".to_string(),
            source_ip: "8.8.8.8".to_string(),
            source_port: 0,
            destination_ip: "8.8.4.4".to_string(),
            destination_port: 0,
            size: 64,
            direction: "ingress".to_string(),
            flags: None,
            suspicious: false,
        };

        let icmp_packet = build_icmp_packet(&packet);

        // ICMP header should be at least 8 bytes
        assert!(icmp_packet.len() >= 8);

        // Check ICMP type (byte 0) - should be Echo Request (8)
        assert_eq!(icmp_packet[0], 8);

        // Check ICMP code (byte 1) - should be 0
        assert_eq!(icmp_packet[1], 0);
    }

    #[test]
    fn test_build_ipv4_packet_tcp() {
        use std::net::Ipv4Addr;

        let packet = NetworkPacket {
            id: "test-5".to_string(),
            timestamp: 4000,
            protocol: "TCP".to_string(),
            source_ip: "192.168.0.1".to_string(),
            source_port: 1234,
            destination_ip: "192.168.0.2".to_string(),
            destination_port: 5678,
            size: 100,
            direction: "egress".to_string(),
            flags: None,
            suspicious: false,
        };

        let src_ip = Ipv4Addr::new(192, 168, 0, 1);
        let dst_ip = Ipv4Addr::new(192, 168, 0, 2);

        let ipv4_packet = build_ipv4_packet(&packet, &src_ip, &dst_ip);

        // IPv4 header should be at least 20 bytes + TCP header (20 bytes)
        assert!(ipv4_packet.len() >= 40);

        // Check IPv4 version and IHL (byte 0)
        assert_eq!(ipv4_packet[0], 0x45); // Version 4, IHL 5

        // Check protocol (byte 9) - should be TCP (6)
        assert_eq!(ipv4_packet[9], 6);

        // Check source IP (bytes 12-15)
        assert_eq!(&ipv4_packet[12..16], &[192, 168, 0, 1]);

        // Check destination IP (bytes 16-19)
        assert_eq!(&ipv4_packet[16..20], &[192, 168, 0, 2]);
    }

    #[test]
    fn test_network_packet_creation() {
        let packet = NetworkPacket {
            id: "pkt-001".to_string(),
            timestamp: 123456789,
            protocol: "TCP".to_string(),
            source_ip: "10.0.0.1".to_string(),
            source_port: 80,
            destination_ip: "10.0.0.2".to_string(),
            destination_port: 443,
            size: 1500,
            direction: "ingress".to_string(),
            flags: Some(vec!["SYN".to_string()]),
            suspicious: true,
        };

        assert_eq!(packet.id, "pkt-001");
        assert_eq!(packet.protocol, "TCP");
        assert_eq!(packet.source_port, 80);
        assert_eq!(packet.destination_port, 443);
        assert!(packet.suspicious);
    }

    #[test]
    fn test_create_pcap_packet_data_ipv4() {
        let packet = NetworkPacket {
            id: "pkt-002".to_string(),
            timestamp: 5000,
            protocol: "UDP".to_string(),
            source_ip: "1.2.3.4".to_string(),
            source_port: 1234,
            destination_ip: "5.6.7.8".to_string(),
            destination_port: 5678,
            size: 200,
            direction: "egress".to_string(),
            flags: None,
            suspicious: false,
        };

        let pcap_data = create_pcap_packet_data(&packet);

        // Should have Ethernet header (14 bytes) + IPv4 header (20 bytes) + UDP header (8 bytes)
        assert!(pcap_data.len() >= 42);

        // Check Ethernet type for IPv4 (0x0800)
        assert_eq!(pcap_data[12], 0x08);
        assert_eq!(pcap_data[13], 0x00);
    }

    #[test]
    fn test_parse_pcap_packet_basic() {
        // Create a simple Ethernet frame with minimal valid structure
        let mut raw_packet = Vec::new();

        // Ethernet header (14 bytes)
        raw_packet.extend_from_slice(&[0x00, 0x11, 0x22, 0x33, 0x44, 0x55]); // Dest MAC
        raw_packet.extend_from_slice(&[0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF]); // Src MAC
        raw_packet.extend_from_slice(&[0x08, 0x00]); // EtherType: IPv4

        // IPv4 header (20 bytes minimum)
        raw_packet.push(0x45); // Version 4, IHL 5
        raw_packet.push(0x00); // DSCP/ECN
        raw_packet.extend_from_slice(&[0x00, 0x28]); // Total length (40 bytes)
        raw_packet.extend_from_slice(&[0x00, 0x00]); // Identification
        raw_packet.extend_from_slice(&[0x00, 0x00]); // Flags/Fragment
        raw_packet.push(64); // TTL
        raw_packet.push(6); // Protocol: TCP
        raw_packet.extend_from_slice(&[0x00, 0x00]); // Checksum
        raw_packet.extend_from_slice(&[192, 168, 1, 1]); // Source IP
        raw_packet.extend_from_slice(&[192, 168, 1, 2]); // Dest IP

        // TCP header (20 bytes minimum)
        raw_packet.extend_from_slice(&[0x00, 0x50]); // Source port: 80
        raw_packet.extend_from_slice(&[0x1F, 0x90]); // Dest port: 8080
        raw_packet.extend_from_slice(&[0x00, 0x00, 0x00, 0x01]); // Seq number
        raw_packet.extend_from_slice(&[0x00, 0x00, 0x00, 0x00]); // Ack number
        raw_packet.push(0x50); // Data offset
        raw_packet.push(0x02); // Flags: SYN
        raw_packet.extend_from_slice(&[0x20, 0x00]); // Window
        raw_packet.extend_from_slice(&[0x00, 0x00]); // Checksum
        raw_packet.extend_from_slice(&[0x00, 0x00]); // Urgent pointer

        let parsed = parse_pcap_packet(&raw_packet, "test-parse-1".to_string());

        assert_eq!(parsed.protocol, "TCP");
        assert_eq!(parsed.source_ip, "192.168.1.1");
        assert_eq!(parsed.destination_ip, "192.168.1.2");
        assert_eq!(parsed.source_port, 80);
        assert_eq!(parsed.destination_port, 8080);
        assert!(parsed.flags.is_some());
        assert!(parsed.flags.unwrap().contains(&"SYN".to_string()));
    }

    #[tokio::test]
    async fn test_block_ip_addresses_valid() {
        let ips = vec![
            "192.168.1.1".to_string(),
            "10.0.0.1".to_string(),
            "2001:db8::1".to_string(),
        ];

        let result = block_ip_addresses(ips).await;
        assert!(result.is_ok());

        let block_result = result.unwrap();
        assert!(block_result.success);
        assert!(block_result.blocked_count > 0);
    }

    #[tokio::test]
    async fn test_block_ip_addresses_invalid() {
        let ips = vec![
            "not-an-ip".to_string(),
        ];

        let result = block_ip_addresses(ips).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid IP address format"));
    }

    #[tokio::test]
    async fn test_get_network_statistics() {
        let result = get_network_statistics().await;
        assert!(result.is_ok());

        let stats = result.unwrap();
        // Stats should be initialized (may be all zeros if no packets processed)
        assert_eq!(stats.total_packets, stats.tcp_packets + stats.udp_packets + stats.icmp_packets + stats.other_packets);
    }

    #[test]
    fn test_update_network_statistics() {
        let packet = NetworkPacket {
            id: "test-stats-1".to_string(),
            timestamp: 1000,
            protocol: "TCP".to_string(),
            source_ip: "192.168.1.100".to_string(),
            source_port: 8080,
            destination_ip: "192.168.1.200".to_string(),
            destination_port: 443,
            size: 1024,
            direction: "egress".to_string(),
            flags: Some(vec!["SYN".to_string()]),
            suspicious: true,
        };

        // Update statistics
        update_network_statistics(&packet);

        // Verify the stats were updated (this is a simple check)
        // In a real test, you might want to reset stats first
    }

    #[tokio::test]
    async fn test_generate_network_report_json() {
        let result = generate_network_report("json".to_string(), false).await;
        assert!(result.is_ok());

        let report_bytes = result.unwrap();
        let report_str = String::from_utf8(report_bytes).unwrap();

        // Verify it's valid JSON
        let parsed: serde_json::Value = serde_json::from_str(&report_str).unwrap();
        assert_eq!(parsed["report_type"], "network_analysis");
        assert!(parsed["statistics"].is_object());
    }

    #[tokio::test]
    async fn test_generate_network_report_html() {
        let result = generate_network_report("html".to_string(), false).await;
        assert!(result.is_ok());

        let report_bytes = result.unwrap();
        let report_str = String::from_utf8(report_bytes).unwrap();

        // Verify it contains HTML
        assert!(report_str.contains("<!DOCTYPE html>"));
        assert!(report_str.contains("Network Analysis Report"));
    }

    #[tokio::test]
    async fn test_generate_network_report_pdf_not_implemented() {
        let result = generate_network_report("pdf".to_string(), false).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not yet implemented"));
    }

    #[tokio::test]
    async fn test_generate_network_report_invalid_format() {
        let result = generate_network_report("invalid".to_string(), false).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Unsupported report format"));
    }
}
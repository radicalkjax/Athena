use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::thread;
use std::time::Instant;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{State, AppHandle, Emitter};
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

const NETWORK_MODULE: &str = "network";

// Global state for active packet captures
lazy_static! {
    static ref ACTIVE_CAPTURES: Arc<Mutex<HashMap<String, CaptureSession>>> = Arc::new(Mutex::new(HashMap::new()));
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

    // Reconstruct packet data as bytes for WASM analysis
    let packet_data = serde_json::to_vec(&packet)
        .map_err(|e| {
            NETWORK_OPERATION_DURATION
                .with_label_values(&["analyze_packet", "error"])
                .observe(start_time.elapsed().as_secs_f64());
            NETWORK_PACKETS_ANALYZED
                .with_label_values(&[&protocol, "error"])
                .inc();
            format!(
                "Could not prepare packet data for analysis. The packet may contain invalid data. Error: {}",
                e
            )
        })?;

    // Call WASM network analyzer
    let args = vec![serde_json::json!(packet_data)];

    let result = crate::commands::wasm_runtime::execute_wasm_function(
        runtime,
        NETWORK_MODULE.to_string(),
        "network-analyzer#analyze-packet".to_string(),
        args,
    ).await?;

    if !result.success {
        return Err(result.error.unwrap_or_else(||
            "Network packet analysis failed. The WASM analyzer could not process this packet.".to_string()
        ));
    }

    let output_str = result.output.as_ref()
        .ok_or("Network analyzer produced no output. The packet may be malformed or empty.")?;
    let analysis_result: serde_json::Value = serde_json::from_str(output_str)
        .map_err(|e| format!(
            "Could not understand the network analysis results. The analyzer may have produced invalid output. Error: {}",
            e
        ))?;

    // Format the analysis result
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

#[tauri::command]
pub async fn export_network_capture(
    format: String,
    path: String,
    packets_json: String,
) -> Result<(), String> {
    match format.as_str() {
        "json" => {
            std::fs::write(&path, packets_json)
                .map_err(|e| format!(
                    "Could not write network capture to '{}'. Please ensure you have write permissions. Error: {}",
                    path,
                    e
                ))?;
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
            let mut save = cap.savefile(&path)
                .map_err(|e| format!(
                    "Could not create PCAP file at '{}'. Please check write permissions and available disk space. Error: {}",
                    path,
                    e
                ))?;

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
                .map_err(|e| format!(
                    "Could not finalize PCAP file '{}'. The file may be incomplete. Error: {}",
                    path,
                    e
                ))?;

            Ok(())
        }
        _ => Err(format!(
            "Unsupported export format: '{}'. Please use 'json' for JSON export or 'pcap' for standard packet capture format.",
            format
        )),
    }
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
    data.extend_from_slice(&[0x00, 0x11, 0x22, 0x33, 0x44, 0x55]); // Dest MAC (placeholder)
    data.extend_from_slice(&[0x00, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE]); // Src MAC (placeholder)

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
        "TCP" => (6u8, build_tcp_segment(pkt)),
        "UDP" => (17u8, build_udp_datagram(pkt)),
        "ICMP" => (1u8, build_icmp_packet(pkt)),
        _ => (6u8, build_tcp_segment(pkt)), // Default to TCP
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

    // Determine next header (protocol)
    let (next_header, transport_data) = match pkt.protocol.to_uppercase().as_str() {
        "TCP" => (6u8, build_tcp_segment(pkt)),
        "UDP" => (17u8, build_udp_datagram(pkt)),
        "ICMPV6" => (58u8, build_icmp_packet(pkt)),
        _ => (6u8, build_tcp_segment(pkt)), // Default to TCP
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

/// Build a TCP segment
fn build_tcp_segment(pkt: &NetworkPacket) -> Vec<u8> {
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
    tcp_data.extend_from_slice(&[0x00, 0x00]); // Checksum (placeholder)
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

    tcp_data
}

/// Build a UDP datagram
fn build_udp_datagram(pkt: &NetworkPacket) -> Vec<u8> {
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
    udp_data.extend_from_slice(&[0x00, 0x00]); // Checksum (can be 0 for IPv4)

    // Add zero-filled payload
    udp_data.extend(vec![0u8; payload_size]);

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

/// Parse raw packet data into NetworkPacket structure using pnet
fn parse_pcap_packet(raw_packet: &[u8], packet_id: String) -> NetworkPacket {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
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
        Device::lookup()
            .map_err(|e| format!(
                "Could not find default network interface. Please ensure libpcap/npcap is installed. \
                On Windows, install Npcap from https://npcap.com. On Linux/macOS, install libpcap via your package manager. Error: {}",
                e
            ))?
            .ok_or_else(||
                "No network interfaces available for packet capture. Please check your network adapter is enabled and you have necessary permissions.".to_string()
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

    // Spawn background thread for packet capture
    let thread_handle = thread::spawn(move || {
        let mut packet_count = 0u64;

        loop {
            // Check stop signal
            if stop_clone.load(Ordering::Relaxed) {
                break;
            }

            // Try to capture next packet
            match active_capture.next_packet() {
                Ok(raw_packet) => {
                    packet_count += 1;
                    let packet_id = format!("{}-{}", capture_id_clone, packet_count);

                    // Parse the packet
                    let network_packet = parse_pcap_packet(raw_packet.data, packet_id);

                    // Store packet
                    if let Ok(mut packets) = packets_clone.lock() {
                        packets.push(network_packet.clone());
                    }

                    // Emit event to frontend
                    let _ = app_clone.emit("packet-captured", network_packet);
                }
                Err(pcap::Error::TimeoutExpired) => {
                    // Timeout is normal, continue
                    continue;
                }
                Err(e) => {
                    eprintln!("Error capturing packet: {}", e);
                    break;
                }
            }
        }

        eprintln!("Packet capture thread ending for {}", capture_id_clone);
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

        let tcp_segment = build_tcp_segment(&packet);

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

        let tcp_segment = build_tcp_segment(&packet);

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

        let udp_datagram = build_udp_datagram(&packet);

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
}
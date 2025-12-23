# DynamicAnalysis Component - UI Layout

**Status:** ✅ IMPLEMENTED
**Component:** `/athena-v2/src/components/solid/analysis/DynamicAnalysis.tsx`
**Last Updated:** December 2025

## Visual Structure

```
┌────────────────────────────────────────────────────────────────┐
│ Dynamic Analysis - Docker Sandbox                              │
├────────────────────────────────────────────────────────────────┤
│ [✓] Docker sandbox ready. Linux sandbox: Yes                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│ Advanced Execution Configuration                    [Hide]      │
├────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┬─────────────────┬────────────┬──────────┐  │
│ │ Timeout: 120s   │ Memory: 512 MB  │ [✓] Network│ [ ] Anti-│  │
│ │ ━━━━━━━━━━━━━━━│ [    512    ]   │  Capture   │ Evasion  │  │
│ │ 30          600 │                 │            │          │  │
│ └─────────────────┴─────────────────┴────────────┴──────────┘  │
│ [Execute with Custom Config]                                    │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────┬──────────────────┐
│ LEFT PANEL                                  │ RIGHT PANEL      │
├─────────────────────────────────────────────┼──────────────────┤
│                                             │                  │
│ ┌───────────────────────────────────────┐   │ ┌──────────────┐ │
│ │        THREAT SCORE BADGE             │   │ │ MITRE ATT&CK │ │
│ │                                       │   │ │  Mapping     │ │
│ │              75                       │   │ ├──────────────┤ │
│ │         Threat Score                  │   │ │ T1055        │ │
│ │         HIGH RISK                     │   │ │ Process      │ │
│ │                                       │   │ │ Injection    │ │
│ │ • Critical: Process injection         │   │ │ 85% conf     │ │
│ │ • High: C2 communication             │   │ ├──────────────┤ │
│ │ • MITRE T1055: Process Injection     │   │ │ T1071        │ │
│ └───────────────────────────────────────┘   │ │ Application  │ │
│                                             │ │ Layer Proto  │ │
│ ┌───────────────────────────────────────┐   │ │ 72% conf     │ │
│ │ Behavioral Analysis                   │   │ └──────────────┘ │
│ │ [Start Analysis] [Advanced Config]    │   │                  │
│ │ [View Screenshots]                    │   │ ┌──────────────┐ │
│ ├───────────────────────────────────────┤   │ │Recommendations│ │
│ │ Filter: [All Events ▼]               │   │ ├──────────────┤ │
│ ├───────────────────────────────────────┤   │ │• Monitor for │ │
│ │ [+] Starting analysis...              │   │ │  process     │ │
│ │ [FILE] CREATE: /tmp/malware           │   │ │  injection   │ │
│ │ [PROC] Process created: evil.exe      │   │ │• Block       │ │
│ │ [!!!!] Code injection detected T1055  │   │ │  suspicious  │ │
│ │ [NET] TCP 192.168.1.1:443            │   │ │  outbound    │ │
│ │ [+] Analysis complete (120ms)         │   │ │  connections │ │
│ └───────────────────────────────────────┘   │ └──────────────┘ │
│                                             │                  │
│ ┌───────────────────────────────────────┐   │ ┌──────────────┐ │
│ │ File Operations Summary        [Show] │   │ │ Syscall      │ │
│ ├───────────────────────────────────────┤   │ │ Summary      │ │
│ │ Total: 45  Created: 12  Modified: 8   │   │ ├──────────────┤ │
│ │ Deleted: 3  Opened: 22               │   │ │ open      32 │ │
│ │                                       │   │ │ write     18 │ │
│ │ Most Targeted Paths:                  │   │ │ execve    5  │ │
│ │ • /tmp/malware.exe                   │   │ │ connect   12 │ │
│ │ • /etc/passwd                        │   │ │ ptrace    3  │ │
│ │ • /home/user/.bashrc                 │   │ └──────────────┘ │
│ └───────────────────────────────────────┘   │                  │
│                                             │ ┌──────────────┐ │
│ ┌───────────────────────────────────────┐   │ │ Advanced     │ │
│ │ Process Tree                   [Show] │   │ │ Analysis     │ │
│ ├───────────────────────────────────────┤   │ ├──────────────┤ │
│ │ [PID 1] init                         │   │ │ Video (Show) │ │
│ │   /sbin/init                         │   │ │ Memory (2)   │ │
│ │   ├─[PID 100] bash                   │   │ │ (Show)       │ │
│ │   │   /bin/bash                      │   │ └──────────────┘ │
│ │   │   └─[PID 200] malware.exe        │   │                  │
│ │   │       ./malware.exe --decrypt    │   │                  │
│ └───────────────────────────────────────┘   │                  │
│                                             │                  │
│ ┌───────────────────────────────────────┐   │                  │
│ │ Sandbox Evasion Detection     [Show]  │   │                  │
│ ├───────────────────────────────────────┤   │                  │
│ │ ┌─────────────────────────────────┐  │   │                  │
│ │ │ VmDetection           [BLOCKED] │  │   │                  │
│ │ │ Attempted to read /proc/scsi    │  │   │                  │
│ │ │ Trigger: openat                 │  │   │                  │
│ │ └─────────────────────────────────┘  │   │                  │
│ │ ┌─────────────────────────────────┐  │   │                  │
│ │ │ DebuggerCheck        [DETECTED] │  │   │                  │
│ │ │ ptrace TRACEME anti-debug check │  │   │                  │
│ │ │ Trigger: ptrace                 │  │   │                  │
│ │ └─────────────────────────────────┘  │   │                  │
│ └───────────────────────────────────────┘   │                  │
│                                             │                  │
│ ┌───────────────────────────────────────┐   │                  │
│ │ Hidden VM Artifacts            [Show] │   │                  │
│ ├───────────────────────────────────────┤   │                  │
│ │ Athena's anti-evasion system          │   │                  │
│ │ obfuscates these artifacts:           │   │                  │
│ │                                       │   │                  │
│ │ 🛡️ Docker container ID in cgroup      │   │                  │
│ │ 🛡️ /proc/cpuinfo hypervisor flag      │   │                  │
│ │ 🛡️ VM BIOS strings (VirtualBox, VMware)│   │                  │
│ │ 🛡️ VM vendor MAC address prefixes     │   │                  │
│ └───────────────────────────────────────┘   │                  │
│                                             │                  │
│ ┌───────────────────────────────────────┐   │                  │
│ │ Network Activity                      │   │                  │
│ ├───────────────────────────────────────┤   │                  │
│ │ DNS Queries:                          │   │                  │
│ │ evil.com -> 10.0.0.1                 │   │                  │
│ │                                       │   │                  │
│ │ Network Connections:                  │   │                  │
│ │ TCP 10.0.0.1:443                     │   │                  │
│ │ TCP 192.168.1.1:8080                 │   │                  │
│ │                                       │   │                  │
│ │ Summary:                              │   │                  │
│ │ Outbound: 12 connections              │   │                  │
│ │ Inbound: Analyzed                     │   │                  │
│ └───────────────────────────────────────┘   │                  │
└─────────────────────────────────────────────┴──────────────────┘
```

## Color Coding

### Threat Score Badge
- **Green Border/Text** (score < 30): Low risk
- **Orange Border/Text** (score 30-70): Medium risk
- **Red Border/Text** (score > 70): High/Critical risk

### Event Types in Console
- **Green** (success): Normal completion, low-severity events
- **Yellow** (warning): Medium-severity events, suspicious activity
- **Red** (danger): High/critical severity, confirmed malicious behavior
- **Blue** (info): Informational messages, analysis status

### Evasion Detection Cards
- **Green Left Border** + Green "BLOCKED" badge: Anti-evasion successfully blocked
- **Orange Left Border** + Orange "DETECTED" badge: Evasion detected but not blocked

## Interaction Flow

1. **Initial Load**
   - Status banner shows Docker availability
   - No analysis data displayed
   - Config panel hidden by default

2. **Configure Analysis** (Optional)
   - Click "Advanced Config" to expand panel
   - Adjust timeout slider (visual feedback of value)
   - Set memory limit in input field
   - Toggle network capture and anti-evasion
   - Click "Execute with Custom Config"

3. **Run Standard Analysis**
   - Click "Start Analysis" with default settings
   - Console streams events in real-time
   - Analyzing indicator pulses

4. **Analysis Complete**
   - Threat score badge appears at top (animated entrance)
   - All collapsible panels populate with data
   - MITRE attacks listed on right panel
   - Recommendations generated

5. **Explore Results**
   - Click "Show" on any collapsible panel to expand
   - Use event filter dropdown to focus on specific types
   - Expand process tree to see hierarchy
   - Review evasion attempts and blocked techniques
   - Check hidden artifacts to understand protection

6. **Advanced Features**
   - Toggle video/memory panels if available
   - View screenshots from execution
   - Run Volatility analysis on memory dumps

## Responsive Behavior

- **Wide Screens (>1400px)**: Two-column layout with all panels visible
- **Medium Screens (1000-1400px)**: Panels stack but maintain width
- **Narrow Screens (<1000px)**: Single column, all panels full-width

## Accessibility

- All form controls have labels
- Color is not the only indicator (text labels for status)
- Keyboard navigable (tab through controls)
- Focus states on interactive elements
- Semantic HTML structure

## Performance Optimizations

- Collapsible panels: Content only rendered when expanded (SolidJS `Show`)
- Event list: Limited to recent events, older ones available via scrolling
- Process tree: Recursive rendering with proper key management
- Threat score: Calculated once, cached in signal
- Filter events: Re-uses existing data, no new API calls

## Empty States

- **No Analysis Run**: "Select a file and click Start Analysis..."
- **No File Operations**: "No file operations detected"
- **No Network Activity**: "No network connections detected"
- **No Evasion Attempts**: Panel hidden entirely
- **No VM Artifacts**: Panel hidden entirely

## Error States

- **Docker Unavailable**: Red banner with installation instructions
- **Analysis Failed**: Red error banner with dismiss button + error in console
- **Backend Error**: Graceful degradation (feature doesn't appear)

## Loading States

- **Analysis Running**: Pulsing indicator in console + disabled buttons
- **Screenshots Loading**: Button shows "Loading..." + disabled
- **Config Changes**: Immediate UI feedback (slider value updates)

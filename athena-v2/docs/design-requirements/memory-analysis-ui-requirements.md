# Memory Analysis UI Design Requirements

Based on the HTML template at `/docs/prompts/tauri/athena_tauri_UI_template.html`, here are the specific design requirements for the Memory Analysis component:

## Component Overview

The Memory Analysis section is part of the Core Features (Medium Priority) and provides Runtime Investigation capabilities for memory forensics and process analysis.

## Main Structure

### Header
- Title: "🧠 Memory Analysis - Runtime Investigation"
- Color: `var(--barbie-pink)` 
- Margin bottom: 20px

### Layout
- Uses `analysis-grid` class for the main container
- Two-column layout:
  - Left: `analysis-main` (contains main analysis panels)
  - Right: `ensemble-results` (contains statistics and tools)

## Main Analysis Panels

### 1. Memory Dump Analysis Panel
**Header:**
- Title: "💾 Memory Dump Analysis"
- Actions: 
  - "📄 Load Dump" button (secondary)
  - "🔍 Search" button (secondary)

**Content:**
- Process Memory Map display showing:
  - Memory addresses with color coding
  - Process/module names
  - Memory region types (Text, Data, Heap, etc.)
  - System DLLs

**Color Coding:**
- Success (green): `var(--success-color)` - Normal executable sections
- Info (blue): `var(--info-color)` - Data sections
- Warning (orange): `var(--warning-color)` - Injected/suspicious regions
- Secondary (gray): `var(--text-secondary)` - System DLLs
- Danger (red): `var(--danger-color)` - High-risk regions

**Suspicious Memory Regions Section:**
- RWX Memory detection (Shellcode)
- Modified Import Table detection
- Process Hollowing detection
- Each with size/description details

### 2. String Analysis Panel
**Header:**
- Title: "🔬 String Analysis"

**Content Sections:**
- Network Indicators (URLs, IPs, HTTP headers)
- File System paths
- Registry keys
- Decryption Keys (Key, Salt, Algorithm)

**Color Scheme:**
- Danger: Network C2 servers
- Warning: Suspicious file paths
- Success: Recovered keys
- Info: Algorithms/methods

## Right Sidebar

### Memory Statistics
**Title:** "📊 Memory Statistics"

**Stats Cards (single column grid):**
1. Total Memory (e.g., "2.1GB")
2. Processes count (e.g., "847")
3. Injected Modules count (e.g., "23")
4. Rootkit Hooks count (e.g., "5")

**Card Structure:**
- `stat-card` class
- `stat-value` for the main number
- `stat-label` for the description

### Memory Tools
**Title:** "🔧 Memory Tools"

**Tool Buttons (vertical stack with 8px gap):**
1. "🔍 Volatility Analysis" (primary button)
2. "📊 Process Tree" (secondary)
3. "🌐 Network Connections" (secondary)
4. "🔑 Crypto Analysis" (secondary)
5. "📄 Extract Artifacts" (secondary)

## Visual Design Requirements

### Spacing
- Panel headers: Standard panel-header class
- Content padding: Uses code-editor class standards
- Button spacing: 8px gap in vertical stacks

### Typography
- Headers: Strong tags with `var(--barbie-pink)` color
- Memory addresses: Monospace font implied by code-editor
- Descriptions: `var(--text-secondary)` color

### Interactive Elements
- All buttons should have hover states
- Memory regions should be selectable/clickable
- Search functionality for memory content
- File upload support for memory dumps

### Icons
- Consistent emoji usage for visual identification
- 💾 for memory dumps
- 🔬 for analysis
- 🚨 for critical alerts
- ⚠️ for warnings
- 📊 for statistics
- 🔧 for tools

## Integration Points

1. **File Loading**: Integration with Tauri file dialog for memory dump loading
2. **Search**: Real-time search within memory contents
3. **Export**: Ability to export findings
4. **Navigation**: Links to related analyses (Network, Process)

## Accessibility
- Proper ARIA labels for all interactive elements
- Role="tabpanel" with corresponding aria-labelledby
- Clear visual hierarchy with proper heading structure
- Color contrast compliance for all text elements
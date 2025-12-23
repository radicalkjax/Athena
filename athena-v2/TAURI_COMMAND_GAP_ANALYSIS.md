# Tauri Command Frontend/Backend Gap Analysis

**⚠️ HISTORICAL DOCUMENT - ALL GAPS RESOLVED DECEMBER 2025**

**Original Audit Date:** December 22, 2025
**Branch:** tauri-migration (merged to main)
**Status:** ALL 41 GAPS CLOSED ✅

---

## Current Status (December 2025)

**All 41 originally identified gaps have been resolved.**

| Metric | Original | Current | Status |
|--------|----------|---------|--------|
| Total Backend Commands | 134 | 138 | ✅ Increased |
| Commands Used in Frontend | 93 | 98+ | ✅ Improved |
| Commands Missing UI | 41 | 0 (backend) | ✅ ALL RESOLVED |
| High Priority Gaps | 23 | 0 | ✅ ALL IMPLEMENTED |
| Medium Priority Gaps | 13 | 0 | ✅ ALL IMPLEMENTED |
| Low Priority Gaps | 5 | 0 | ✅ ALL IMPLEMENTED |

**See:** `/athena-v2/COMMAND_VERIFICATION_REPORT.md` for current verification status.

---

## Executive Summary (Original Findings - NOW RESOLVED)

The original audit identified 41 backend commands (30.6%) with no frontend integration. Of these, 23 were high-priority features.

**All have been implemented** as of December 2025.

---

## 1. Sample Management (12 commands) - CRITICAL GAP

The **entire quarantine storage system** has no frontend UI. All 12 sample management commands are unused.

| Command | Backend Location | Priority | Notes |
|---------|-----------------|----------|-------|
| `register_sample` | samples.rs:38 | HIGH | Register malware sample in quarantine |
| `list_staged_samples` | samples.rs:68 | HIGH | List samples awaiting analysis |
| `list_all_samples` | samples.rs:88 | HIGH | List all quarantined samples |
| `get_sample_metadata` | samples.rs:108 | HIGH | Get sample details (hash, tags, notes) |
| `get_sample_path` | samples.rs:128 | MEDIUM | Get path to quarantined file |
| `sample_exists` | samples.rs:148 | MEDIUM | Check if sample already exists |
| `update_sample_tags` | samples.rs:168 | HIGH | Add tags to samples |
| `update_sample_notes` | samples.rs:188 | HIGH | Add analysis notes |
| `read_quarantined_sample` | samples.rs:208 | HIGH | Read sample binary data |
| `cleanup_staging` | samples.rs:228 | LOW | Remove temporary files |
| `purge_deleted_samples` | samples.rs:248 | LOW | Permanent deletion |
| `get_quarantine_stats` | samples.rs:268 | MEDIUM | Storage statistics |

**Impact:** Users cannot manage quarantined malware samples through the UI. This is a major feature gap.

**Recommendation:** Create `SampleManager.tsx` component with:
- Sample library browser (list_all_samples, list_staged_samples)
- Sample detail view (get_sample_metadata)
- Tag and notes editor (update_sample_tags, update_sample_notes)
- Quarantine stats dashboard (get_quarantine_stats)
- Admin cleanup tools (cleanup_staging, purge_deleted_samples)

**File Path:** `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/SampleManager.tsx` (NEW)

---

## 2. Network Analysis (3 commands) - HIGH PRIORITY

Live packet capture functionality exists in backend but has no UI controls.

| Command | Backend Location | Priority | Current Usage |
|---------|-----------------|----------|---------------|
| `start_packet_capture` | network.rs:215 | HIGH | Not called |
| `stop_packet_capture` | network.rs:235 | HIGH | Not called |
| `get_active_captures` | network.rs:255 | MEDIUM | Not called |

**Impact:** Users cannot perform live network monitoring during malware analysis.

**Recommendation:** Add to `NetworkAnalysis.tsx`:
- Start/Stop capture buttons
- Active capture status indicator
- Live packet stream display

**File Path:** `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/NetworkAnalysis.tsx` (ENHANCE)

---

## 3. YARA Scanner (3 commands) - HIGH PRIORITY

Advanced YARA features not exposed in UI.

| Command | Backend Location | Priority | Current Usage |
|---------|-----------------|----------|---------------|
| `auto_generate_yara_rules` | yara_scanner.rs:318 | HIGH | Not called |
| `get_yara_rule_sets` | yara_scanner.rs:338 | MEDIUM | Not called |
| `load_yara_rules` | yara_scanner.rs:358 | HIGH | Not called |

**Impact:** Users cannot auto-generate YARA rules from malware samples or manage rule sets.

**Recommendation:** Add to `YaraScanner.tsx`:
- "Generate Rules from Sample" button (auto_generate_yara_rules)
- Rule set selector dropdown (get_yara_rule_sets)
- Custom rule loader (load_yara_rules)

**File Path:** `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/YaraScanner.tsx` (ENHANCE)

---

## 4. Threat Intelligence (3 commands) - MEDIUM PRIORITY

MITRE ATT&CK integration and behavioral analysis helpers not used.

| Command | Backend Location | Priority | Current Usage |
|---------|-----------------|----------|---------------|
| `get_mitre_attack_details` | sandbox_commands.rs:428 | HIGH | Not called |
| `summarize_file_operations` | sandbox_commands.rs:448 | MEDIUM | Not called |
| `filter_behavioral_events` | sandbox_commands.rs:468 | MEDIUM | Not called |

**Impact:** Missing MITRE ATT&CK technique mapping for detected behaviors.

**Recommendation:** 
- Add MITRE ATT&CK panel to `ThreatIntelligence.tsx`
- Use `summarize_file_operations` in `BehavioralAnalysis.tsx`
- Use `filter_behavioral_events` for timeline filtering

**File Paths:**
- `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/ThreatIntelligence.tsx` (ENHANCE)
- `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/BehavioralAnalysis.tsx` (ENHANCE)

---

## 5. Sandbox Execution (2 commands) - HIGH PRIORITY

Advanced sandbox execution modes not available in UI.

| Command | Backend Location | Priority | Current Usage |
|---------|-----------------|----------|---------------|
| `execute_sample_with_config` | sandbox_commands.rs:88 | MEDIUM | Not called |
| `execute_sample_with_video` | sandbox_commands.rs:108 | HIGH | Not called |

**Current:** `ContainerSandbox.tsx` only calls basic `execute_sample_in_sandbox`.

**Impact:** Cannot enable video recording or customize sandbox config through UI.

**Recommendation:** Add to `ContainerSandbox.tsx`:
- "Record Video" checkbox (execute_sample_with_video)
- Advanced settings panel (execute_sample_with_config)

**File Path:** `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/ContainerSandbox.tsx` (ENHANCE)

---

## 6. AI Provider Management (7 commands) - MEDIUM PRIORITY

Some AI management functions not exposed.

| Command | Backend Location | Priority | Current Usage |
|---------|-----------------|----------|---------------|
| `get_ai_provider_config` | ai_analysis.rs:218 | MEDIUM | Not called (should be used in PlatformConfig) |
| `delete_api_key_from_storage` | ai_analysis.rs:238 | MEDIUM | Not called |
| `get_ai_queue_size` | ai_analysis.rs:258 | LOW | Not called |
| `reset_ai_queue` | ai_analysis.rs:278 | LOW | Not called |
| `is_circuit_breaker_open` | ai_analysis.rs:298 | LOW | Not called |
| `reset_circuit_breaker` | ai_analysis.rs:318 | LOW | Not called |
| `analyze_with_ensemble` | ai_analysis.rs:338 | MEDIUM | aiService.ts uses it, but not exposed in AIEnsemble.tsx |

**Impact:** Limited AI troubleshooting and ensemble control.

**Recommendation:**
- Add API key deletion to `PlatformConfig.tsx`
- Add circuit breaker status to `AIProviderStatus.tsx`
- Add queue metrics to debug panel

**File Paths:**
- `/Users/kali/Athena/Athena/athena-v2/src/components/solid/PlatformConfig.tsx` (ENHANCE)
- `/Users/kali/Athena/Athena/athena-v2/src/components/solid/providers/AIProviderStatus.tsx` (ENHANCE)

---

## 7. File Operations (2 commands) - HIGH PRIORITY

Basic file operations not properly integrated.

| Command | Backend Location | Priority | Current Usage |
|---------|-----------------|----------|---------------|
| `upload_file` | file_ops.rs:38 | HIGH | Not called (FileUploadArea needs this) |
| `get_file_metadata` | file_ops.rs:58 | MEDIUM | Not called |

**Impact:** File upload may not be using proper backend command.

**Recommendation:** Update `FileUploadArea.tsx` to use `upload_file` command instead of direct file reading.

**File Path:** `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/FileUploadArea.tsx` (FIX)

---

## 8. Sandbox Utilities (4 commands) - LOW PRIORITY

Helper functions for sandbox analysis.

| Command | Backend Location | Priority | Notes |
|---------|-----------------|----------|-------|
| `detect_sandbox_evasion` | sandbox_commands.rs:488 | MEDIUM | Anti-evasion detection |
| `get_hidden_vm_artifacts` | sandbox_commands.rs:508 | LOW | VM artifact detection |
| `format_sandbox_error` | sandbox_commands.rs:528 | LOW | Error formatting utility |
| `calculate_threat_score` | sandbox_commands.rs:548 | MEDIUM | Threat scoring algorithm |

**Recommendation:** 
- Add evasion detection panel to `DynamicAnalysis.tsx`
- Use `calculate_threat_score` in `AnalysisDashboard.tsx`

---

## 9. Cache Management (3 commands) - LOW PRIORITY

| Command | Backend Location | Priority | Notes |
|---------|-----------------|----------|-------|
| `cache_key_exists` | ai_analysis.rs:358 | LOW | Internal utility |
| `cleanup_cache` | ai_analysis.rs:378 | LOW | Cache maintenance |
| `clear_ai_cache` | ai_analysis.rs:398 | MEDIUM | Already exposed in PlatformConfig |

**Recommendation:** Add cache stats panel to settings.

---

## 10. Miscellaneous (3 commands)

| Command | Backend Location | Priority | Notes |
|---------|-----------------|----------|-------|
| `cleanup_expired_sessions` | wasm_runtime.rs:418 | LOW | Should run automatically in background |
| `get_video_recording_info` | sandbox_commands.rs:568 | MEDIUM | Video metadata for VideoPlayer.tsx |
| `get_quarantine_base_dir` | samples.rs:288 | LOW | Settings/debug only |

---

## Action Plan

### Phase 1: Critical Features (Est. 8 hours)

**1.1 Sample Manager (NEW COMPONENT)**
- Create `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/SampleManager.tsx`
- Implement sample browser with tags/notes
- Add to Sidebar navigation
- Commands: `register_sample`, `list_staged_samples`, `list_all_samples`, `get_sample_metadata`, `update_sample_tags`, `update_sample_notes`

**1.2 Fix File Upload**
- Update `FileUploadArea.tsx` to use `upload_file` command
- Add proper file metadata retrieval with `get_file_metadata`

**1.3 YARA Auto-Generation**
- Add auto-generation button to `YaraScanner.tsx`
- Commands: `auto_generate_yara_rules`, `load_yara_rules`, `get_yara_rule_sets`

### Phase 2: Network & Sandbox (Est. 4 hours)

**2.1 Network Capture**
- Add capture controls to `NetworkAnalysis.tsx`
- Commands: `start_packet_capture`, `stop_packet_capture`, `get_active_captures`

**2.2 Sandbox Video Recording**
- Add video recording option to `ContainerSandbox.tsx`
- Commands: `execute_sample_with_video`, `get_video_recording_info`

### Phase 3: Intelligence & Scoring (Est. 3 hours)

**3.1 MITRE ATT&CK Integration**
- Add MITRE panel to `ThreatIntelligence.tsx`
- Command: `get_mitre_attack_details`

**3.2 Threat Scoring**
- Add threat score visualization to `AnalysisDashboard.tsx`
- Command: `calculate_threat_score`

**3.3 Behavioral Filtering**
- Add event filtering to `BehavioralAnalysis.tsx`
- Commands: `filter_behavioral_events`, `summarize_file_operations`

### Phase 4: Polish (Est. 2 hours)

**4.1 AI Management**
- Add API key deletion to `PlatformConfig.tsx`
- Add circuit breaker controls to `AIProviderStatus.tsx`

**4.2 Evasion Detection**
- Add evasion detection panel to `DynamicAnalysis.tsx`
- Commands: `detect_sandbox_evasion`, `get_hidden_vm_artifacts`

---

## Implementation Priority Matrix

| Feature | Business Value | Dev Effort | Priority Score |
|---------|---------------|------------|----------------|
| Sample Manager | HIGH | MEDIUM | 1 |
| YARA Auto-Gen | HIGH | LOW | 2 |
| File Upload Fix | HIGH | LOW | 3 |
| Network Capture | MEDIUM | MEDIUM | 4 |
| Video Recording | MEDIUM | LOW | 5 |
| MITRE Mapping | MEDIUM | MEDIUM | 6 |
| Threat Scoring | MEDIUM | LOW | 7 |
| AI Management | LOW | LOW | 8 |
| Evasion Detection | LOW | MEDIUM | 9 |

**Total Estimated Effort:** 17 hours

---

## Files Requiring Changes

### New Files (1)
- `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/SampleManager.tsx`

### Enhanced Files (10)
1. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/FileUploadArea.tsx`
2. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/YaraScanner.tsx`
3. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/NetworkAnalysis.tsx`
4. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/ContainerSandbox.tsx`
5. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/ThreatIntelligence.tsx`
6. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/AnalysisDashboard.tsx`
7. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/BehavioralAnalysis.tsx`
8. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/PlatformConfig.tsx`
9. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/providers/AIProviderStatus.tsx`
10. `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/DynamicAnalysis.tsx`

### Navigation Update (1)
- `/Users/kali/Athena/Athena/athena-v2/src/components/solid/navigation/Sidebar.tsx` (add Sample Manager link)

---

## Validation Checklist

After implementation, verify:

- [ ] All 23 high-priority commands are accessible through UI
- [ ] Sample Manager appears in sidebar navigation
- [ ] File upload uses `upload_file` command
- [ ] YARA auto-generation works end-to-end
- [ ] Network capture can start/stop
- [ ] Sandbox video recording option appears
- [ ] MITRE ATT&CK techniques displayed for behaviors
- [ ] Threat score calculation shown in dashboard
- [ ] No console errors from missing commands

---

## False Positives Clarification

**"both"** - Not a command, it's a parameter value for `extract_strings_from_dump` encoding
**"get_wasm_module_path"** - Optional command with fallback in wasmService.ts (line 210-216)

---

---

**ORIGINAL REPORT:** Generated 2025-12-22
**RESOLUTION:** All gaps closed December 2025
**STATUS:** HISTORICAL DOCUMENT - All issues resolved

**For current status, see:**
- `/athena-v2/COMMAND_VERIFICATION_REPORT.md` - Latest command verification
- `/athena-v2/MISSING_COMMANDS_SUMMARY.md` - Implementation summary
- `/athena-v2/README.md` - Project overview with metrics
- `/agentdocs/PROGRESS_TRACKER.md` - Overall progress

**Project:** Athena v2 Malware Analysis Platform - Complete ✅

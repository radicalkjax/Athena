import { Component } from 'solid-js';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import './Reports.css';

const Reports: Component = () => {
  const executiveSummaryContent = `<div style="text-align: center; margin-bottom: 20px;">
    <h3 style="color: var(--barbie-pink);">MALWARE ANALYSIS REPORT</h3>
    <div style="color: var(--text-secondary);">Sample: malware_sample.exe</div>
    <div style="color: var(--text-secondary);">Analysis Date: 2024-12-15 14:30:22 UTC</div>
    <div style="color: var(--text-secondary);">Report ID: REP-2024-1215-001</div>
  </div>
  
  <strong style="color: var(--barbie-pink); font-size: 1.1rem;">EXECUTIVE SUMMARY</strong><br><br>
  
  The analyzed sample (MD5: a1b2c3d4e5f6789012345678901234567) has been classified as 
  <strong style="color: var(--danger-color);">high-risk malware</strong> belonging to the Emotet banking trojan family. 
  The AI ensemble analysis achieved <strong>94% confidence</strong> with unanimous agreement 
  across all six specialized agents.<br><br>
  
  <strong style="color: var(--barbie-pink);">KEY FINDINGS:</strong><br>
  • <strong style="color: var(--danger-color);">Threat Level:</strong> High<br>
  • <strong style="color: var(--warning-color);">Family:</strong> Trojan.GenKryptik.Win32 (Emotet variant)<br>
  • <strong style="color: var(--info-color);">Primary Function:</strong> Banking credential theft, botnet recruitment<br>
  • <strong style="color: var(--warning-color);">Persistence:</strong> Registry Run key modification<br>
  • <strong style="color: var(--danger-color);">C2 Communication:</strong> HTTP-based beacon to malicious infrastructure<br><br>
  
  <strong style="color: var(--barbie-pink);">IMMEDIATE ACTIONS REQUIRED:</strong><br>
  1. Block network communication to 192.168.1.100:8080<br>
  2. Remove registry persistence mechanism<br>
  3. Scan all systems for similar indicators<br>
  4. Update endpoint detection rules<br>
  5. Implement network monitoring for similar traffic patterns<br><br>
  
  <strong style="color: var(--barbie-pink);">BUSINESS IMPACT:</strong><br>
  This malware poses significant risk to financial data and could lead to:<br>
  • Unauthorized access to banking credentials<br>
  • Potential financial theft<br>
  • System compromise and lateral movement<br>
  • Compliance violations (PCI-DSS, SOX)<br>
  • Reputational damage`;

  const technicalDetailsContent = `<strong style="color: var(--barbie-pink);">TECHNICAL DETAILS</strong><br><br>
  
  <strong>File Properties:</strong><br>
  Name: malware_sample.exe<br>
  Size: 2,457,600 bytes (2.3 MB)<br>
  Type: PE32 Executable<br>
  Architecture: x86-64<br>
  Entropy: 7.82 (High - indicates packing/encryption)<br>
  Packer: UPX v3.96 with custom modifications<br><br>
  
  <strong>Static Analysis:</strong><br>
  Entry Point: 0x401000<br>
  Sections: 5 (.text, .data, .rdata, .rsrc, .upx)<br>
  Imports: 47 functions from 8 libraries<br>
  Notable APIs: RegCreateKeyEx, InternetConnect, SetWindowsHookEx<br><br>
  
  <strong>Dynamic Behavior:</strong><br>
  Process Creation: Creates svchost.exe copy in %TEMP%<br>
  Registry Modification: Adds Run key for persistence<br>
  Network Activity: Connects to C2 server every 30 seconds<br>
  File System: Creates encrypted config file<br>
  Process Injection: Injects code into explorer.exe<br><br>
  
  <strong>AI Provider Analysis:</strong><br>
  🤖 Claude 3.5: Identified evasion techniques, 92% confidence<br>
  🧠 GPT-4 Turbo: Architecture suggests multi-stage attack, 95% confidence<br>
  🔍 DeepSeek V3: Correlates with known APT campaign, 96% confidence<br>
  💎 Claude 3 Opus: Commercial packer with obfuscation, 93% confidence<br>
  ⚡ GPT-4o: High infrastructure impact, 94% confidence<br>
  🌟 Gemini Pro: Emotet family classification, 97% confidence`;

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        📊 Analysis Reports - Comprehensive Documentation
      </h2>
      
      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel 
            title="Executive Summary Report" 
            icon="📄"
            actions={
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary">📧 Email Report</button>
                <button class="btn-export">📄 Export PDF</button>
              </div>
            }
            className="scrollable-panel"
          >
            <div class="code-editor">
              <div class="code-content" innerHTML={executiveSummaryContent}></div>
            </div>
          </AnalysisPanel>
          
          <AnalysisPanel title="Technical Analysis Details" icon="🔬" className="scrollable-panel">
            <div class="code-editor">
              <div class="code-content" innerHTML={technicalDetailsContent}></div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            📋 Report Templates
          </h3>
          
          <div class="template-buttons" style="margin-bottom: 20px;">
            <button class="template-btn">📄 Executive Summary</button>
            <button class="template-btn">🔬 Technical Report</button>
            <button class="template-btn">🚨 Incident Response</button>
            <button class="template-btn">📊 Compliance Report</button>
            <button class="template-btn">🎯 IOC Summary</button>
          </div>
          
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
            📊 Report Statistics
          </h3>
          
          <div class="stats-overview" style="grid-template-columns: 1fr;">
            <div class="stat-card">
              <div class="stat-value">94%</div>
              <div class="stat-label">Analysis Confidence</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">6/6</div>
              <div class="stat-label">Provider Agreement</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">127</div>
              <div class="stat-label">IOCs Extracted</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">23</div>
              <div class="stat-label">MITRE Techniques</div>
            </div>
          </div>
          
          <h3 style="color: var(--barbie-pink); margin: 20px 0 15px;">
            📤 Export Options
          </h3>
          
          <div class="export-options">
            <button class="btn-export">📄 Export PDF</button>
            <button class="export-btn">📧 Email Report</button>
            <button class="export-btn">📋 Copy to Clipboard</button>
            <button class="export-btn">💾 Save Template</button>
            <button class="export-btn">🔗 Share Link</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
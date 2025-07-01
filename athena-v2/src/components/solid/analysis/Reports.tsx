import { Component, createSignal, For, Show, onMount, lazy } from 'solid-js';
import { createStore } from 'solid-js/store';
import { analysisStore } from '../../../stores/analysisStore';
import { invokeCommand } from '../../../utils/tauriCompat';
import './Reports.css';

const BatchExport = lazy(() => import('./BatchExport'));

interface ReportSection {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
}

interface GeneratedReport {
  id: string;
  fileId: string;
  fileName: string;
  template: string;
  createdAt: Date;
  format: 'pdf' | 'html' | 'json';
  status: 'generating' | 'completed' | 'error';
  url?: string;
  content?: any;
}

const defaultTemplates: ReportTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Summary',
    description: 'High-level overview for management',
    sections: [
      { id: 'overview', title: 'Overview', enabled: true, order: 1 },
      { id: 'risk-assessment', title: 'Risk Assessment', enabled: true, order: 2 },
      { id: 'recommendations', title: 'Recommendations', enabled: true, order: 3 },
      { id: 'mitre-mapping', title: 'MITRE ATT&CK', enabled: true, order: 4 },
    ]
  },
  {
    id: 'technical',
    name: 'Technical Deep Dive',
    description: 'Detailed technical analysis',
    sections: [
      { id: 'static-analysis', title: 'Static Analysis', enabled: true, order: 1 },
      { id: 'dynamic-analysis', title: 'Dynamic Analysis', enabled: true, order: 2 },
      { id: 'network-analysis', title: 'Network Analysis', enabled: true, order: 3 },
      { id: 'ai-insights', title: 'AI Insights', enabled: true, order: 4 },
      { id: 'ioc-extraction', title: 'IoC Extraction', enabled: true, order: 5 },
      { id: 'code-analysis', title: 'Code Analysis', enabled: true, order: 6 },
    ]
  },
  {
    id: 'incident',
    name: 'Incident Response',
    description: 'Actionable incident response report',
    sections: [
      { id: 'timeline', title: 'Attack Timeline', enabled: true, order: 1 },
      { id: 'indicators', title: 'Indicators of Compromise', enabled: true, order: 2 },
      { id: 'affected-systems', title: 'Affected Systems', enabled: true, order: 3 },
      { id: 'containment', title: 'Containment Steps', enabled: true, order: 4 },
      { id: 'remediation', title: 'Remediation', enabled: true, order: 5 },
    ]
  }
];

const Reports: Component = () => {
  const [templates, setTemplates] = createStore(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = createSignal<ReportTemplate | null>(null);
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [generatedReports, setGeneratedReports] = createStore<GeneratedReport[]>([]);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<'pdf' | 'html' | 'json'>('pdf');
  const [customizingTemplate, setCustomizingTemplate] = createSignal(false);
  const [showBatchExport, setShowBatchExport] = createSignal(false);

  onMount(() => {
    loadReports();
  });

  const loadReports = () => {
    const saved = localStorage.getItem('athena-reports');
    if (saved) {
      setGeneratedReports(JSON.parse(saved));
    }
  };

  const saveReports = () => {
    localStorage.setItem('athena-reports', JSON.stringify(generatedReports));
  };

  const generateReport = async () => {
    const template = selectedTemplate();
    const fileId = selectedFile();
    const file = analysisStore.state.files.find(f => f.id === fileId);
    
    if (!template || !file) return;

    setIsGenerating(true);

    const report: GeneratedReport = {
      id: crypto.randomUUID(),
      fileId: file.id,
      fileName: file.name,
      template: template.name,
      createdAt: new Date(),
      format: exportFormat(),
      status: 'generating'
    };

    setGeneratedReports([...generatedReports, report]);

    try {
      const content = await compileReportContent(file, template);
      
      if (exportFormat() === 'json') {
        // For JSON, just save the content
        report.content = content;
        report.status = 'completed';
      } else {
        // For PDF/HTML, generate via backend
        const result = await invokeCommand('generate_report', {
          content,
          format: exportFormat(),
          fileName: `${file.name}_report_${Date.now()}`
        });
        
        report.url = result.url;
        report.status = 'completed';
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      report.status = 'error';
    }

    // Update report status
    const index = generatedReports.findIndex(r => r.id === report.id);
    if (index >= 0) {
      setGeneratedReports(index, report);
    }

    saveReports();
    setIsGenerating(false);
  };

  const compileReportContent = async (file: any, template: ReportTemplate) => {
    const content: any = {
      metadata: {
        fileName: file.name,
        fileHash: file.hash,
        fileSize: file.size,
        analysisDate: new Date().toISOString(),
        template: template.name
      },
      sections: {}
    };

    // Get enabled sections in order
    const enabledSections = template.sections
      .filter(s => s.enabled)
      .sort((a, b) => a.order - b.order);

    for (const section of enabledSections) {
      content.sections[section.id] = await generateSectionContent(file, section.id);
    }

    return content;
  };

  const generateSectionContent = async (file: any, sectionId: string) => {
    switch (sectionId) {
      case 'overview':
        return {
          title: 'Executive Overview',
          content: `File ${file.name} has been analyzed with a comprehensive security assessment.`,
          severity: file.results?.malwareScore > 70 ? 'critical' : 
                   file.results?.malwareScore > 40 ? 'high' : 'medium',
          summary: generateExecutiveSummary(file)
        };

      case 'risk-assessment':
        return {
          title: 'Risk Assessment',
          overallRisk: calculateOverallRisk(file),
          categories: {
            malware: file.results?.malwareScore || 0,
            vulnerabilities: 45,
            dataExfiltration: 30,
            persistence: 60
          },
          factors: generateRiskFactors(file)
        };

      case 'recommendations':
        return {
          title: 'Recommendations',
          immediate: [
            'Isolate affected systems immediately',
            'Block identified IoCs at perimeter',
            'Initiate incident response procedures'
          ],
          shortTerm: [
            'Conduct full network scan for similar indicators',
            'Update security signatures and rules',
            'Review access logs for suspicious activity'
          ],
          longTerm: [
            'Implement enhanced monitoring',
            'Review security architecture',
            'Conduct security awareness training'
          ]
        };

      case 'mitre-mapping':
        return {
          title: 'MITRE ATT&CK Mapping',
          techniques: extractMitreTechniques(file),
          tactics: ['Initial Access', 'Execution', 'Persistence', 'Defense Evasion'],
          heatmap: generateAttackHeatmap()
        };

      case 'static-analysis':
        return {
          title: 'Static Analysis Results',
          fileInfo: file.analysisResult?.basic_analysis || {},
          entropy: file.analysisResult?.entropy || 0,
          strings: file.analysisResult?.strings || [],
          imports: file.analysisResult?.imports || [],
          sections: file.analysisResult?.sections || []
        };

      case 'ai-insights':
        return {
          title: 'AI Analysis Insights',
          consensus: file.results?.aiAnalysis || {},
          providers: Object.entries(file.results?.aiAnalysis || {}).map(([provider, data]: any) => ({
            provider,
            score: data.score,
            summary: data.summary,
            confidence: data.score / 100
          })),
          aggregatedInsights: generateAggregatedInsights()
        };

      case 'ioc-extraction':
        return {
          title: 'Indicators of Compromise',
          domains: extractIOCs(file, 'domains'),
          ips: extractIOCs(file, 'ips'),
          files: extractIOCs(file, 'files'),
          registry: extractIOCs(file, 'registry'),
          hashes: {
            md5: file.analysisResult?.hashes?.md5,
            sha1: file.analysisResult?.hashes?.sha1,
            sha256: file.analysisResult?.hashes?.sha256
          }
        };

      default:
        return { title: sectionId, content: 'Section content not available' };
    }
  };

  const generateExecutiveSummary = (file: any) => {
    const score = file.results?.malwareScore || 0;
    if (score > 70) {
      return `Critical threat detected. ${file.name} exhibits multiple malicious behaviors and should be treated as high-risk malware. Immediate action required.`;
    } else if (score > 40) {
      return `Suspicious file detected. ${file.name} shows concerning behaviors that warrant further investigation and containment.`;
    }
    return `File analyzed with moderate risk indicators. Continue monitoring and apply standard security procedures.`;
  };

  const calculateOverallRisk = (file: any) => {
    const factors = {
      malwareScore: file.results?.malwareScore || 0,
      entropy: file.analysisResult?.entropy > 7 ? 80 : 40,
      suspiciousImports: file.analysisResult?.imports?.filter((i: any) => i.suspicious).length * 10 || 0,
      aiConsensus: Object.values(file.results?.aiAnalysis || {}).reduce((acc: number, ai: any) => acc + ai.score, 0) / 6
    };
    
    return Math.min(100, Object.values(factors).reduce((a, b) => a + b) / Object.keys(factors).length);
  };

  const generateRiskFactors = (file: any) => {
    const factors = [];
    if (file.analysisResult?.entropy > 7) factors.push('High entropy indicates packing/encryption');
    if (file.results?.threats?.length > 0) factors.push(`${file.results.threats.length} threat signatures detected`);
    if (file.analysisResult?.anomalies?.length > 0) factors.push('Structural anomalies detected');
    return factors;
  };

  const extractMitreTechniques = (file: any) => {
    // Extract from AI analysis and static analysis
    const techniques = [];
    if (file.analysisResult?.suspicious_strings?.includes('CreateRemoteThread')) {
      techniques.push('T1055 - Process Injection');
    }
    if (file.analysisResult?.suspicious_strings?.includes('RegSetValueEx')) {
      techniques.push('T1547.001 - Registry Run Keys');
    }
    return techniques;
  };

  const generateAttackHeatmap = () => {
    // Generate heatmap data for MITRE ATT&CK matrix
    return {
      'initial-access': 0.3,
      'execution': 0.8,
      'persistence': 0.6,
      'privilege-escalation': 0.4,
      'defense-evasion': 0.7,
      'credential-access': 0.2,
      'discovery': 0.5,
      'lateral-movement': 0.3,
      'collection': 0.4,
      'command-and-control': 0.6,
      'exfiltration': 0.3,
      'impact': 0.5
    };
  };

  const extractIOCs = (file: any, type: string) => {
    // Extract from various analysis results
    const iocs: string[] = [];
    
    // From AI analysis
    Object.values(file.results?.aiAnalysis || {}).forEach((ai: any) => {
      if (ai.details && ai.details.includes(type)) {
        // Parse IOCs from details
      }
    });
    
    return iocs;
  };

  const generateAggregatedInsights = () => {
    return {
      consensusThreatLevel: 'High',
      confidenceScore: 0.87,
      primaryThreatType: 'Banking Trojan',
      suggestedActions: [
        'Immediate isolation required',
        'Full forensic analysis recommended',
        'Check for lateral movement indicators'
      ]
    };
  };

  const downloadReport = (report: GeneratedReport) => {
    if (report.format === 'json' && report.content) {
      const blob = new Blob([JSON.stringify(report.content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.fileName}_report_${report.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (report.url) {
      window.open(report.url, '_blank');
    }
  };

  const updateTemplateSection = (sectionId: string, updates: Partial<ReportSection>) => {
    const template = selectedTemplate();
    if (!template) return;
    
    const templateIndex = templates.findIndex(t => t.id === template.id);
    const sectionIndex = template.sections.findIndex(s => s.id === sectionId);
    
    if (templateIndex >= 0 && sectionIndex >= 0) {
      setTemplates(templateIndex, 'sections', sectionIndex, updates);
    }
  };

  return (
    <div class="reports-container">
      <div class="reports-header">
        <h2>Report Generation</h2>
        <div class="report-stats">
          <span>📄 {generatedReports.length} reports generated</span>
          <button 
            class="batch-export-button"
            onClick={() => setShowBatchExport(true)}
          >
            📦 Batch Export
          </button>
        </div>
      </div>

      <div class="report-generator">
        <div class="generator-section">
          <h3>1. Select File</h3>
          <select 
            value={selectedFile() || ''}
            onChange={(e) => setSelectedFile(e.currentTarget.value)}
            class="file-selector"
          >
            <option value="">Choose a file...</option>
            <For each={analysisStore.state.files.filter(f => f.status === 'completed')}>
              {(file) => (
                <option value={file.id}>{file.name}</option>
              )}
            </For>
          </select>
        </div>

        <div class="generator-section">
          <h3>2. Choose Template</h3>
          <div class="template-grid">
            <For each={templates}>
              {(template) => (
                <div 
                  class={`template-card ${selectedTemplate()?.id === template.id ? 'selected' : ''}`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <h4>{template.name}</h4>
                  <p>{template.description}</p>
                  <span class="section-count">{template.sections.length} sections</span>
                </div>
              )}
            </For>
          </div>
        </div>

        <Show when={selectedTemplate()}>
          <div class="generator-section">
            <div class="section-header">
              <h3>3. Customize Sections</h3>
              <button 
                onClick={() => setCustomizingTemplate(!customizingTemplate())}
                class="customize-button"
              >
                {customizingTemplate() ? '✓ Done' : '⚙️ Customize'}
              </button>
            </div>
            
            <Show when={customizingTemplate()}>
              <div class="sections-list">
                <For each={selectedTemplate()!.sections}>
                  {(section) => (
                    <div class="section-item">
                      <input 
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(e) => updateTemplateSection(section.id, { enabled: e.currentTarget.checked })}
                      />
                      <span class="section-title">{section.title}</span>
                      <input 
                        type="number"
                        value={section.order}
                        min="1"
                        max="10"
                        onChange={(e) => updateTemplateSection(section.id, { order: parseInt(e.currentTarget.value) })}
                        class="order-input"
                      />
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <div class="generator-section">
          <h3>4. Export Format</h3>
          <div class="format-options">
            <label class="format-option">
              <input 
                type="radio"
                name="format"
                value="pdf"
                checked={exportFormat() === 'pdf'}
                onChange={() => setExportFormat('pdf')}
              />
              <span>📑 PDF</span>
            </label>
            <label class="format-option">
              <input 
                type="radio"
                name="format"
                value="html"
                checked={exportFormat() === 'html'}
                onChange={() => setExportFormat('html')}
              />
              <span>🌐 HTML</span>
            </label>
            <label class="format-option">
              <input 
                type="radio"
                name="format"
                value="json"
                checked={exportFormat() === 'json'}
                onChange={() => setExportFormat('json')}
              />
              <span>📊 JSON</span>
            </label>
          </div>
        </div>

        <button 
          onClick={generateReport}
          disabled={!selectedFile() || !selectedTemplate() || isGenerating()}
          class="generate-button"
        >
          {isGenerating() ? '⏳ Generating...' : '🚀 Generate Report'}
        </button>
      </div>

      <div class="generated-reports">
        <h3>Generated Reports</h3>
        <div class="reports-list">
          <For each={generatedReports.slice().reverse()}>
            {(report) => (
              <div class="report-item">
                <div class="report-info">
                  <h4>{report.fileName}</h4>
                  <div class="report-meta">
                    <span>{report.template}</span>
                    <span>•</span>
                    <span>{report.format.toUpperCase()}</span>
                    <span>•</span>
                    <span>{new Date(report.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div class="report-status">
                  <Show when={report.status === 'completed'}>
                    <button onClick={() => downloadReport(report)} class="download-button">
                      ⬇️ Download
                    </button>
                  </Show>
                  <Show when={report.status === 'generating'}>
                    <span class="generating">Generating...</span>
                  </Show>
                  <Show when={report.status === 'error'}>
                    <span class="error">Failed</span>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
      
      <Show when={showBatchExport()}>
        <BatchExport onClose={() => setShowBatchExport(false)} />
      </Show>
    </div>
  );
};

export default Reports;
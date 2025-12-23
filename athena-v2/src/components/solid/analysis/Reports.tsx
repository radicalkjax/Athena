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
  format: 'pdf' | 'html' | 'json' | 'stix';
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
  },
  {
    id: 'campaign',
    name: 'Campaign Report',
    description: 'Comprehensive threat campaign analysis',
    sections: [
      { id: 'campaign-overview', title: 'Campaign Overview', enabled: true, order: 1 },
      { id: 'threat-actor', title: 'Threat Actor Profile', enabled: true, order: 2 },
      { id: 'campaign-iocs', title: 'Campaign IOCs', enabled: true, order: 3 },
      { id: 'campaign-ttps', title: 'Tactics & Techniques', enabled: true, order: 4 },
      { id: 'timeline', title: 'Attack Timeline', enabled: true, order: 5 },
      { id: 'related-samples', title: 'Related Samples', enabled: true, order: 6 },
    ]
  }
];

const Reports: Component = () => {
  const [templates, setTemplates] = createStore(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = createSignal<ReportTemplate | null>(null);
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [generatedReports, setGeneratedReports] = createStore<GeneratedReport[]>([]);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [exportFormat, setExportFormat] = createSignal<'pdf' | 'html' | 'json' | 'stix'>('pdf');
  const [customizingTemplate, setCustomizingTemplate] = createSignal(false);
  const [showBatchExport, setShowBatchExport] = createSignal(false);

  // Campaign report specific state
  const [campaignName, setCampaignName] = createSignal('');
  const [selectedSamples, setSelectedSamples] = createSignal<string[]>([]);

  // STIX export options
  const [includeIndicators, setIncludeIndicators] = createSignal(true);
  const [includeRelationships, setIncludeRelationships] = createSignal(true);
  const [includeAttackPatterns, setIncludeAttackPatterns] = createSignal(true);
  const [includeThreatActors, setIncludeThreatActors] = createSignal(false);

  onMount(() => {
    loadReports();
  });

  const loadReports = () => {
    const saved = localStorage.getItem('athena-reports');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that parsed data is an array of reports
        if (!Array.isArray(parsed)) {
          console.warn('Invalid reports format: expected array');
          localStorage.removeItem('athena-reports');
          return;
        }
        // Validate each report has required fields
        const validReports = parsed.filter((r: unknown) => {
          if (typeof r !== 'object' || r === null) return false;
          const report = r as Record<string, unknown>;
          return typeof report.id === 'string' &&
                 typeof report.fileId === 'string' &&
                 typeof report.fileName === 'string' &&
                 typeof report.template === 'string' &&
                 typeof report.format === 'string';
        }).map((r: Record<string, unknown>) => ({
          ...r,
          // Parse createdAt back to Date if it's a string
          createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt as string)
        }));
        setGeneratedReports(validReports as GeneratedReport[]);
      } catch (err) {
        console.warn('Failed to parse saved reports:', err);
        localStorage.removeItem('athena-reports');
      }
    }
  };

  const saveReports = () => {
    localStorage.setItem('athena-reports', JSON.stringify(generatedReports));
  };

  const generateReport = async () => {
    const template = selectedTemplate();
    const fileId = selectedFile();
    const file = analysisStore.state.files.find(f => f.id === fileId);

    if (!template) return;

    // Campaign reports have different requirements
    if (template.id === 'campaign') {
      if (!campaignName().trim()) {
        alert('Please enter a campaign name');
        return;
      }
      if (selectedSamples().length === 0) {
        alert('Please select at least one sample for the campaign report');
        return;
      }
      await generateCampaignReport();
      return;
    }

    if (!file) return;

    setIsGenerating(true);

    const report: GeneratedReport = {
      id: crypto.randomUUID(),
      fileId: file.id,
      fileName: file.name,
      template: template.name,
      createdAt: new Date(),
      format: exportFormat() as 'pdf' | 'html' | 'json',
      status: 'generating'
    };

    setGeneratedReports([...generatedReports, report]);

    try {
      // Handle STIX export
      if (exportFormat() === 'stix') {
        const stixData = await invokeCommand<string>('export_stix_format', {
          analysisId: file.hash || file.id,
          includeIndicators: includeIndicators(),
          includeRelationships: includeRelationships(),
        });

        report.content = JSON.parse(stixData);
        report.status = 'completed';
      } else {
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

  const generateCampaignReport = async () => {
    setIsGenerating(true);

    const report: GeneratedReport = {
      id: crypto.randomUUID(),
      fileId: 'campaign',
      fileName: campaignName(),
      template: 'Campaign Report',
      createdAt: new Date(),
      format: exportFormat() as 'pdf' | 'html' | 'json',
      status: 'generating'
    };

    setGeneratedReports([...generatedReports, report]);

    try {
      // Get the format (map 'stix' to 'json' for campaign reports)
      const format = exportFormat() === 'stix' ? 'json' : exportFormat();

      const reportData = await invokeCommand<number[]>('generate_campaign_report', {
        campaignName: campaignName(),
        samples: selectedSamples(),
        format,
      });

      // Convert byte array to string
      const decoder = new TextDecoder();
      const reportString = decoder.decode(new Uint8Array(reportData));

      if (format === 'json') {
        report.content = JSON.parse(reportString);
      } else {
        // For HTML/Markdown, store as string
        report.content = reportString;
      }

      report.status = 'completed';
    } catch (error) {
      console.error('Failed to generate campaign report:', error);
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
          heatmap: generateAttackHeatmap(file)
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
          aggregatedInsights: generateAggregatedInsights(file)
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

  const generateAttackHeatmap = (file: any): Record<string, number> => {
    // Generate heatmap data from actual analysis results
    const result = file?.analysisResult;
    const heatmap: Record<string, number> = {
      'initial-access': 0,
      'execution': 0,
      'persistence': 0,
      'privilege-escalation': 0,
      'defense-evasion': 0,
      'credential-access': 0,
      'discovery': 0,
      'lateral-movement': 0,
      'collection': 0,
      'command-and-control': 0,
      'exfiltration': 0,
      'impact': 0
    };

    if (!result) return heatmap;

    // Analyze imports for technique indicators
    const suspiciousImports = result.imports?.filter((i: any) => i.suspicious) || [];
    suspiciousImports.forEach((imp: any) => {
      const name = (imp.name || '').toLowerCase();
      if (name.includes('createremotethread') || name.includes('virtualalloc')) heatmap['execution'] = (heatmap['execution'] || 0) + 0.3;
      if (name.includes('regsetvalue') || name.includes('createservice')) heatmap['persistence'] = (heatmap['persistence'] || 0) + 0.3;
      if (name.includes('adjusttoken') || name.includes('impersonate')) heatmap['privilege-escalation'] = (heatmap['privilege-escalation'] || 0) + 0.3;
      if (name.includes('crypt') || name.includes('encode')) heatmap['defense-evasion'] = (heatmap['defense-evasion'] || 0) + 0.3;
      if (name.includes('lsass') || name.includes('credential')) heatmap['credential-access'] = (heatmap['credential-access'] || 0) + 0.3;
      if (name.includes('socket') || name.includes('http')) heatmap['command-and-control'] = (heatmap['command-and-control'] || 0) + 0.3;
    });

    // Cap values at 1.0
    Object.keys(heatmap).forEach(key => {
      const value = heatmap[key];
      heatmap[key] = Math.min(1.0, value !== undefined ? value : 0);
    });

    return heatmap;
  };

  const extractIOCs = (file: any, type: string) => {
    // Extract from various analysis results
    const iocs: string[] = [];
    const result = file?.analysisResult;

    if (!result) return iocs;

    // Extract from strings
    if (result.strings && type === 'network') {
      result.strings.forEach((s: string) => {
        if (s.match(/https?:\/\//) || s.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)) {
          iocs.push(s);
        }
      });
    }

    // From AI analysis
    Object.values(file.results?.aiAnalysis || {}).forEach((ai: any) => {
      if (ai.details && ai.details.includes(type)) {
        // Parse IOCs from details
      }
    });

    return iocs.slice(0, 20); // Limit to 20 items
  };

  const generateAggregatedInsights = (file?: any) => {
    if (!file?.analysisResult) {
      return {
        consensusThreatLevel: 'Unknown',
        confidenceScore: 0,
        primaryThreatType: 'Not analyzed',
        suggestedActions: ['Upload and analyze a file to get insights']
      };
    }

    const result = file.analysisResult;
    const score = file.results?.malwareScore || calculateOverallRisk(file);

    // Determine threat level based on actual analysis
    let threatLevel = 'Low';
    if (score > 70) threatLevel = 'Critical';
    else if (score > 50) threatLevel = 'High';
    else if (score > 30) threatLevel = 'Medium';

    // Determine primary threat type from signatures and analysis
    let threatType = 'Unknown';
    if (result.signatures?.length > 0) {
      threatType = result.signatures[0].name || 'Unknown';
    } else if (result.format_info?.is_packed) {
      threatType = 'Packed/Obfuscated Binary';
    } else if (result.entropy > 7) {
      threatType = 'Potentially Encrypted/Packed';
    }

    // Generate actions based on findings
    const actions = [];
    if (score > 50) actions.push('Consider isolation and quarantine');
    if (result.imports?.some((i: any) => i.suspicious)) actions.push('Review suspicious API calls');
    if (result.anomalies?.length > 0) actions.push('Investigate structural anomalies');
    if (actions.length === 0) actions.push('Continue standard monitoring');

    return {
      consensusThreatLevel: threatLevel,
      confidenceScore: Math.min(1, score / 100),
      primaryThreatType: threatType,
      suggestedActions: actions
    };
  };

  const downloadReport = (report: GeneratedReport) => {
    if ((report.format === 'json' || report.format === 'stix') && report.content) {
      const contentType = report.format === 'stix' ? 'application/stix+json' : 'application/json';
      const extension = report.format === 'stix' ? 'stix.json' : 'json';
      const blob = new Blob([JSON.stringify(report.content, null, 2)], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.fileName}_report_${report.id}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (typeof report.content === 'string') {
      // For HTML/Markdown campaign reports
      const contentType = report.format === 'html' ? 'text/html' : 'text/markdown';
      const extension = report.format === 'html' ? 'html' : 'md';
      const blob = new Blob([report.content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.fileName}_report_${report.id}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (report.url) {
      // Add URL validation to prevent javascript: URLs and other dangerous schemes
      try {
        const url = new URL(report.url);
        if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'blob:') {
          window.open(report.url, '_blank', 'noopener,noreferrer');
        } else {
          console.error('Invalid URL protocol:', url.protocol);
        }
      } catch (e) {
        console.error('Invalid URL:', report.url, e);
      }
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
          <h3>1. Select File{selectedTemplate()?.id === 'campaign' ? 's' : ''}</h3>
          <Show when={selectedTemplate()?.id === 'campaign'}>
            <div class="campaign-inputs">
              <input
                type="text"
                placeholder="Campaign Name (e.g., APT28 Operation XYZ)"
                value={campaignName()}
                onInput={(e) => setCampaignName(e.currentTarget.value)}
                class="campaign-name-input"
              />
              <div class="samples-selector">
                <label>Select Related Samples:</label>
                <For each={analysisStore.state.files.filter(f => f.status === 'completed')}>
                  {(file) => (
                    <label class="sample-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedSamples().includes(file.hash || file.id)}
                        onChange={(e) => {
                          const id = file.hash || file.id;
                          if (e.currentTarget.checked) {
                            setSelectedSamples([...selectedSamples(), id]);
                          } else {
                            setSelectedSamples(selectedSamples().filter(s => s !== id));
                          }
                        }}
                      />
                      <span>{file.name} ({file.hash?.substring(0, 8) || file.id.substring(0, 8)})</span>
                    </label>
                  )}
                </For>
                <Show when={analysisStore.state.files.filter(f => f.status === 'completed').length === 0}>
                  <p class="no-files">No analyzed files available. Complete file analysis first.</p>
                </Show>
              </div>
            </div>
          </Show>
          <Show when={selectedTemplate()?.id !== 'campaign'}>
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
          </Show>
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
                disabled={selectedTemplate()?.id === 'campaign'}
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
            <label class="format-option">
              <input
                type="radio"
                name="format"
                value="stix"
                checked={exportFormat() === 'stix'}
                onChange={() => setExportFormat('stix')}
              />
              <span>🔒 STIX 2.1</span>
            </label>
          </div>

          <Show when={exportFormat() === 'stix'}>
            <div class="stix-options">
              <h4>STIX Export Options</h4>
              <label class="stix-checkbox">
                <input
                  type="checkbox"
                  checked={includeIndicators()}
                  onChange={(e) => setIncludeIndicators(e.currentTarget.checked)}
                />
                <span>Include Indicators</span>
              </label>
              <label class="stix-checkbox">
                <input
                  type="checkbox"
                  checked={includeRelationships()}
                  onChange={(e) => setIncludeRelationships(e.currentTarget.checked)}
                />
                <span>Include Relationships</span>
              </label>
              <label class="stix-checkbox">
                <input
                  type="checkbox"
                  checked={includeAttackPatterns()}
                  onChange={(e) => setIncludeAttackPatterns(e.currentTarget.checked)}
                />
                <span>Include Attack Patterns</span>
              </label>
              <label class="stix-checkbox">
                <input
                  type="checkbox"
                  checked={includeThreatActors()}
                  onChange={(e) => setIncludeThreatActors(e.currentTarget.checked)}
                />
                <span>Include Threat Actors</span>
              </label>
            </div>
          </Show>
        </div>

        <button
          onClick={generateReport}
          disabled={
            !selectedTemplate() ||
            isGenerating() ||
            (selectedTemplate()?.id === 'campaign'
              ? (!campaignName().trim() || selectedSamples().length === 0)
              : !selectedFile())
          }
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
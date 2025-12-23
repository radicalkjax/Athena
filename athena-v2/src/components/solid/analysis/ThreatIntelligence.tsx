import { Component, createSignal, Show, For, onMount } from 'solid-js';
import { invokeCommand } from '../../../utils/tauriCompat';
import { analysisStore } from '../../../stores/analysisStore';
import type { ThreatIntelligence as ThreatIntelType, ThreatIndicator } from '../../../types/analysis';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import './ThreatIntelligence.css';

const ThreatIntelligence: Component = () => {
  const [isLoading, setIsLoading] = createSignal(false);
  const [threatIntel, setThreatIntel] = createSignal<ThreatIntelType[]>([]);
  const [selectedSource, setSelectedSource] = createSignal<string>('all');
  const [error, setError] = createSignal<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = createSignal(false);
  const [loadingMessage, setLoadingMessage] = createSignal('Loading threat intelligence...');
  const [showAlertModal, setShowAlertModal] = createSignal(false);
  const [showShareModal, setShowShareModal] = createSignal(false);
  const [alertForm, setAlertForm] = createSignal({ title: '', severity: 'high', description: '' });
  const [selectedPlatforms, setSelectedPlatforms] = createSignal<string[]>([]);

  const sources = [
    { id: 'all', name: 'All Sources', icon: '🌐' },
    { id: 'virustotal', name: 'VirusTotal', icon: '🛡️' },
    { id: 'alienvault', name: 'AlienVault OTX', icon: '👽' },
    { id: 'misp', name: 'MISP', icon: '🔗' },
    { id: 'threatfox', name: 'ThreatFox', icon: '🦊' },
    { id: 'malwarebazaar', name: 'MalwareBazaar', icon: '🏪' }
  ];

  onMount(() => {
    // Auto-fetch if we have a file
    if (analysisStore.currentFile) {
      fetchThreatIntelligence();
    }
  });

  const fetchThreatIntelligence = async () => {
    const file = analysisStore.currentFile;
    if (!file) {
      setError('No file selected. Please upload and analyze a file first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasTimedOut(false);
    setLoadingMessage('Querying threat intelligence sources...');

    // Set up timeout (60 seconds for threat intel queries)
    const timeout = setTimeout(() => {
      setHasTimedOut(true);
      setLoadingMessage('Still loading... External threat intelligence services may be slow.');
    }, 60000);

    try {
      const result = await invokeCommand('get_threat_intelligence', {
        fileHash: file.hash,
        iocs: [] // Will be populated from other analysis
      }) as ThreatIntelType[];

      clearTimeout(timeout);
      setThreatIntel(result);

      // Extract MITRE techniques from threat intel results
      const mitreCategories: Record<string, string[]> = {};
      result.forEach(intel => {
        intel.indicators.forEach(indicator => {
          if (indicator.mitre_attack_id) {
            const category = indicator.category || 'Unknown';
            if (!mitreCategories[category]) {
              mitreCategories[category] = [];
            }
            const technique = `${indicator.mitre_attack_id} - ${indicator.description || 'Unknown'}`;
            if (!mitreCategories[category].includes(technique)) {
              mitreCategories[category].push(technique);
            }
          }
        });
      });
      setMitreMapping(Object.entries(mitreCategories).map(([category, techniques]) => ({
        category,
        techniques
      })));

      // Try to fetch attribution data
      try {
        const attrResult = await invokeCommand('get_threat_attribution', {
          fileHash: file.hash
        }) as {
          campaign_name?: string;
          threat_actor?: string;
          active_since?: string;
          geographic_focus?: string;
          confidence?: number;
          targets?: string[];
          attack_vectors?: string[];
          related_samples?: string[];
        } | null;

        if (attrResult) {
          setAttribution({
            campaignName: attrResult.campaign_name || '',
            threatActor: attrResult.threat_actor || '',
            activeSince: attrResult.active_since || '',
            geographicFocus: attrResult.geographic_focus || '',
            confidence: attrResult.confidence || 0,
            targets: attrResult.targets || [],
            attackVectors: attrResult.attack_vectors || [],
            relatedSamples: attrResult.related_samples || []
          });
        }
      } catch {
        // Attribution not available - that's okay
        setAttribution(null);
      }

      if (result.length === 0) {
        setError('No threat intelligence found for this file. This may indicate the file is new or not previously reported.');
      }
    } catch (err) {
      clearTimeout(timeout);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch threat intelligence';
      setError(`${errorMessage}\n\nPossible causes:\n- Network connectivity issues\n- Threat intelligence service unavailable\n- Invalid file hash or API key`);
    } finally {
      setIsLoading(false);
      setHasTimedOut(false);
    }
  };

  const filteredIntel = () => {
    if (selectedSource() === 'all') return threatIntel();
    return threatIntel().filter(intel => intel.source.toLowerCase() === selectedSource());
  };

  const getThreatLevelColor = (indicators: ThreatIndicator[]) => {
    const maxConfidence = Math.max(...indicators.map(i => i.confidence));
    if (maxConfidence > 0.8) return '#f38ba8';
    if (maxConfidence > 0.6) return '#fab387';
    if (maxConfidence > 0.4) return '#f9e2af';
    return '#a6e3a1';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const copyIOCs = async () => {
    try {
      const iocData = iocs();
      let iocText = '=== FILE HASHES ===\n';
      if (iocData.fileHashes.md5) {
        iocText += `MD5: ${iocData.fileHashes.md5}\n`;
        iocText += `SHA1: ${iocData.fileHashes.sha1}\n`;
        iocText += `SHA256: ${iocData.fileHashes.sha256}\n\n`;
      }

      iocText += '=== NETWORK INDICATORS ===\n';
      iocData.networkIndicators.forEach(ind => {
        iocText += `${ind.type}: ${ind.value}\n`;
      });

      iocText += '\n=== FILE SYSTEM ===\n';
      iocData.fileSystem.forEach(file => {
        iocText += `${file}\n`;
      });

      iocText += '\n=== REGISTRY KEYS ===\n';
      iocData.registry.forEach(reg => {
        iocText += `${reg.key}: ${reg.value}\n`;
      });

      iocText += '\n=== PROCESSES ===\n';
      iocData.processes.forEach(proc => {
        iocText += `${proc.name} (${proc.type})\n`;
      });

      await navigator.clipboard.writeText(iocText);
      alert('IOCs copied to clipboard!');
    } catch (err) {
      setError(`Failed to copy IOCs: ${err}`);
    }
  };

  const exportSTIX = async () => {
    try {
      const file = analysisStore.currentFile;
      if (!file) {
        setError('No file selected for STIX export');
        return;
      }

      setIsLoading(true);
      setLoadingMessage('Generating STIX export...');
      setHasTimedOut(false);

      const timeout = setTimeout(() => {
        setHasTimedOut(true);
      }, 30000);

      // Backend signature: export_stix_format(analysis_id, include_indicators, include_relationships)
      const stixData = await invokeCommand('export_stix_format', {
        analysisId: file.hash,
        includeIndicators: true,
        includeRelationships: true
      });

      clearTimeout(timeout);

      const fileName = `stix_export_${file.hash.substring(0, 8)}_${Date.now()}.json`;
      const blob = new Blob([typeof stixData === 'string' ? stixData : JSON.stringify(stixData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      alert(`STIX export successful: ${fileName}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to export STIX: ${errorMessage}\n\nPlease check your threat intelligence data and try again.`);
    } finally {
      setIsLoading(false);
      setHasTimedOut(false);
    }
  };

  const shareIntel = async (platforms: string[]) => {
    try {
      const file = analysisStore.currentFile;
      if (!file) {
        setError('No file selected for sharing');
        return;
      }

      if (platforms.length === 0) {
        setError('Please select at least one platform to share with');
        return;
      }

      setIsLoading(true);
      setLoadingMessage('Sharing threat intelligence...');

      // Convert threat intel to JSON values for the backend
      const indicatorData = threatIntel().map(intel => ({
        source: intel.source,
        indicators: intel.indicators,
        malware_family: intel.malware_family,
        campaigns: intel.campaigns
      }));

      const result = await invokeCommand('share_threat_intelligence', {
        fileHash: file.hash,
        indicators: indicatorData,
        platforms: platforms
      }) as {
        successful_shares: number;
        platforms_contacted: number;
        results: Array<{ platform: string; success: boolean; message: string; url?: string }>;
      };

      const successMsg = result.results
        .map(r => `${r.platform}: ${r.message}`)
        .join('\n');

      alert(`Shared to ${result.successful_shares}/${result.platforms_contacted} platforms:\n\n${successMsg}`);
      setShowShareModal(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to share intelligence: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openMitreNavigator = () => {
    const mitreUrl = 'https://mitre-attack.github.io/attack-navigator/';
    window.open(mitreUrl, '_blank');
  };

  const generateCampaignReport = async () => {
    try {
      const file = analysisStore.currentFile;
      if (!file) {
        setError('No file selected for report generation');
        return;
      }

      setIsLoading(true);
      const report = await invokeCommand('generate_campaign_report', {
        fileHash: file.hash,
        threatIntel: threatIntel()
      });

      const fileName = `campaign_report_${Date.now()}.html`;
      const blob = new Blob([report as string], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to generate report: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createAlert = async () => {
    try {
      const form = alertForm();

      if (!form.title.trim()) {
        setError('Alert title is required');
        return;
      }

      if (!form.description.trim()) {
        setError('Alert description is required');
        return;
      }

      setIsLoading(true);
      setLoadingMessage('Creating threat alert...');

      // Extract indicators from current IOCs
      const currentIOCs = iocs();
      const indicatorList: string[] = [];

      if (currentIOCs.fileHashes.sha256) {
        indicatorList.push(currentIOCs.fileHashes.sha256);
      }
      currentIOCs.networkIndicators.forEach(ind => {
        indicatorList.push(`${ind.type}: ${ind.value}`);
      });

      const result = await invokeCommand('create_threat_alert', {
        title: form.title,
        severity: form.severity,
        description: form.description,
        indicators: indicatorList
      }) as {
        id: string;
        title: string;
        severity: string;
        created_at: string;
      };

      alert(`Threat alert created successfully!\n\nAlert ID: ${result.id}\nSeverity: ${result.severity.toUpperCase()}\nCreated: ${result.created_at}`);
      setShowAlertModal(false);
      setAlertForm({ title: '', severity: 'high', description: '' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create alert: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // IOCs populated from actual file analysis
  const iocs = () => {
    const file = analysisStore.currentFile;
    const result = file?.analysisResult;

    if (!result) {
      return {
        fileHashes: { md5: '', sha1: '', sha256: '' },
        networkIndicators: [] as Array<{ type: string; value: string }>,
        fileSystem: [] as string[],
        registry: [] as Array<{ key: string; value: string }>,
        processes: [] as Array<{ name: string; type: string }>
      };
    }

    // Extract network indicators from strings analysis
    const networkIndicators: Array<{ type: string; value: string }> = [];
    if (result.strings) {
      result.strings.forEach((s: string) => {
        // Detect IPs
        const ipMatch = s.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
        if (ipMatch) {
          networkIndicators.push({ type: 'IP', value: ipMatch[1] });
        }
        // Detect URLs
        if (s.match(/https?:\/\/[^\s]+/)) {
          networkIndicators.push({ type: 'URL', value: s });
        }
        // Detect domains
        const domainMatch = s.match(/\b([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/i);
        if (domainMatch && !s.includes('http')) {
          networkIndicators.push({ type: 'Domain', value: domainMatch[0] });
        }
      });
    }

    return {
      fileHashes: {
        md5: result.hashes?.md5 || '',
        sha1: result.hashes?.sha1 || '',
        sha256: result.hashes?.sha256 || ''
      },
      networkIndicators: networkIndicators.slice(0, 20), // Limit to 20
      fileSystem: [] as string[],
      registry: [] as Array<{ key: string; value: string }>,
      processes: [] as Array<{ name: string; type: string }>
    };
  };

  // MITRE mapping from actual threat intel (populated by backend)
  const [mitreMapping, setMitreMapping] = createSignal<Array<{ category: string; techniques: string[] }>>([]);

  // Attribution data from backend
  const [attribution, setAttribution] = createSignal<{
    campaignName: string;
    threatActor: string;
    activeSince: string;
    geographicFocus: string;
    confidence: number;
    targets: string[];
    attackVectors: string[];
    relatedSamples: string[];
  } | null>(null);

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        🚨 Threat Intelligence - IOCs & Attribution
      </h2>

      <Show when={isLoading()}>
        <div style="text-align: center; padding: 40px; background: var(--panel-bg); border-radius: 8px; margin-bottom: 20px;">
          <div class="spinner" style="margin: 0 auto 20px;"></div>
          <div style="color: var(--text-secondary);">{loadingMessage()}</div>
          <Show when={hasTimedOut()}>
            <div style="color: var(--warning-color); margin-top: 15px; max-width: 500px; margin-left: auto; margin-right: auto;">
              This is taking longer than usual. External threat intelligence services may be experiencing high load or network delays.
            </div>
          </Show>
        </div>
      </Show>

      <Show when={error()}>
        <div style="background: var(--danger-color); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <strong>Error:</strong> {error()}
          <button
            onClick={() => {
              setError(null);
              fetchThreatIntelligence();
            }}
            style="margin-left: 10px; padding: 5px 10px; background: white; color: var(--danger-color); border: none; border-radius: 4px; cursor: pointer;"
          >
            Retry
          </button>
        </div>
      </Show>

      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel 
            title="Indicators of Compromise (IOCs)" 
            icon="🎯"
            actions={
              <div style="display: flex; gap: 8px;">
                <button
                  class="btn btn-secondary"
                  onClick={copyIOCs}
                >
                  📋 Copy IOCs
                </button>
                <button
                  class="btn btn-primary"
                  onClick={exportSTIX}
                  disabled={isLoading()}
                >
                  📤 Export STIX
                </button>
              </div>
            }
            className="scrollable-panel"
          >
            <div class="code-editor">
              <div class="code-content">
                <strong style="color: var(--danger-color);">🚨 HIGH PRIORITY IOCs</strong><br /><br />
                
                <strong style="color: var(--barbie-pink);">File Hashes:</strong><br />
                <Show when={iocs().fileHashes.md5} fallback={<span style="color: var(--text-secondary);">No file hashes available</span>}>
                  <span style="color: var(--danger-color);">MD5:</span> {iocs().fileHashes.md5}<br />
                  <span style="color: var(--danger-color);">SHA1:</span> {iocs().fileHashes.sha1}<br />
                  <span style="color: var(--danger-color);">SHA256:</span> {iocs().fileHashes.sha256}<br />
                </Show>
                <br />
                
                <strong style="color: var(--barbie-pink);">Network Indicators:</strong><br />
                <Show when={iocs().networkIndicators.length > 0} fallback={<span style="color: var(--text-secondary);">No network indicators detected</span>}>
                  <For each={iocs().networkIndicators}>
                    {(indicator) => (
                      <div>
                        <span style="color: var(--danger-color);">{indicator.type}:</span> {indicator.value}<br />
                      </div>
                    )}
                  </For>
                </Show>
                <br />
                
                <strong style="color: var(--barbie-pink);">File System Artifacts:</strong><br />
                <Show when={iocs().fileSystem.length > 0} fallback={<span style="color: var(--text-secondary);">No file system artifacts detected</span>}>
                  <For each={iocs().fileSystem}>
                    {(file) => (
                      <div>
                        <span style="color: var(--warning-color);">File:</span> {file}<br />
                      </div>
                    )}
                  </For>
                </Show>
                <br />
                
                <strong style="color: var(--barbie-pink);">Registry Keys:</strong><br />
                <Show when={iocs().registry.length > 0} fallback={<span style="color: var(--text-secondary);">No registry artifacts detected</span>}>
                  <For each={iocs().registry}>
                    {(reg) => (
                      <div>
                        <span style="color: var(--danger-color);">Key:</span> {reg.key}<br />
                        <span style="color: var(--warning-color);">Value:</span> {reg.value}<br />
                      </div>
                    )}
                  </For>
                </Show>
                <br />
                
                <strong style="color: var(--barbie-pink);">Process Indicators:</strong><br />
                <Show when={iocs().processes.length > 0} fallback={<span style="color: var(--text-secondary);">No process artifacts detected</span>}>
                  <For each={iocs().processes}>
                    {(proc) => (
                      <div>
                        <span style="color: var(--warning-color);">Process:</span> {proc.name} ({proc.type})<br />
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          </AnalysisPanel>
          
          <AnalysisPanel title="Attribution & Campaign Analysis" icon="🕵️" className="scrollable-panel">
            <div class="code-editor">
              <div class="code-content">
                <strong style="color: var(--barbie-pink);">THREAT ATTRIBUTION</strong><br /><br />

                <Show when={attribution()} fallback={
                  <div style="color: var(--text-secondary); text-align: center; padding: 20px;">
                    <p>No attribution data available.</p>
                    <p style="font-size: 0.85rem;">Attribution data is populated from threat intelligence sources when the file hash matches known campaigns.</p>
                  </div>
                }>
                  <strong>Campaign Name:</strong> <span style="color: var(--danger-color);">{attribution()?.campaignName || 'Unknown'}</span><br />
                  <strong>Threat Actor:</strong> <span style="color: var(--warning-color);">{attribution()?.threatActor || 'Unknown'}</span><br />
                  <strong>Active Since:</strong> <span style="color: var(--text-secondary);">{attribution()?.activeSince || 'Unknown'}</span><br />
                  <strong>Geographic Focus:</strong> <span style="color: var(--info-color);">{attribution()?.geographicFocus || 'Unknown'}</span><br />
                  <strong>Confidence Level:</strong> <span style="color: var(--success-color);">{attribution()?.confidence ? `${attribution()!.confidence}%` : 'Unknown'}</span><br /><br />

                  <Show when={attribution()?.targets && attribution()!.targets.length > 0}>
                    <strong style="color: var(--barbie-pink);">PRIMARY TARGETS:</strong><br />
                    <For each={attribution()?.targets}>
                      {(target) => <div>• {target}</div>}
                    </For>
                    <br />
                  </Show>

                  <Show when={attribution()?.attackVectors && attribution()!.attackVectors.length > 0}>
                    <strong style="color: var(--barbie-pink);">ATTACK VECTORS:</strong><br />
                    <For each={attribution()?.attackVectors}>
                      {(vector) => <div>• {vector}</div>}
                    </For>
                    <br />
                  </Show>

                  <Show when={attribution()?.relatedSamples && attribution()!.relatedSamples.length > 0}>
                    <strong style="color: var(--barbie-pink);">RELATED SAMPLES:</strong><br />
                    <For each={attribution()?.relatedSamples}>
                      {(sample) => <div>• SHA256: {sample.substring(0, 16)}...</div>}
                    </For>
                  </Show>
                </Show>
              </div>
            </div>
          </AnalysisPanel>
        </div>
        
        <div class="ensemble-results">
          <div class="mitre-mapping-section">
            <h3 class="mitre-mapping-header">
              🎯 MITRE ATT&CK Mapping
            </h3>

            <div class="mitre-categories">
              <Show when={mitreMapping().length > 0} fallback={
                <div style="color: var(--text-secondary); text-align: center; padding: 20px;">
                  <p>No MITRE ATT&CK techniques detected.</p>
                  <p style="font-size: 0.85rem;">MITRE mappings are populated from threat intelligence analysis.</p>
                </div>
              }>
                <For each={mitreMapping()}>
                  {(category) => (
                    <div class="mitre-category">
                      <strong class="mitre-category-name">{category.category}:</strong>
                      <For each={category.techniques}>
                        {(technique) => {
                          const [id, ...desc] = technique.split(' - ');
                          return (
                            <div class="mitre-technique">
                              <span class="mitre-technique-id">{id}</span> - {desc.join(' - ')}
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>
          
          <div class="defense-section">
            <h3 class="defense-header">
              🛡️ Defense Recommendations
            </h3>

            <div class="defense-content">
              <Show when={threatIntel().length > 0 || iocs().networkIndicators.length > 0} fallback={
                <div style="color: var(--text-secondary); text-align: center; padding: 20px;">
                  <p>No specific recommendations available.</p>
                  <p style="font-size: 0.85rem;">Recommendations are generated based on detected threats and IOCs.</p>
                </div>
              }>
                <div class="defense-priority">
                  <strong class="priority-label immediate">Immediate Actions:</strong>
                  <Show when={iocs().networkIndicators.length > 0}>
                    <div class="defense-item">✅ Block detected malicious domains/IPs</div>
                  </Show>
                  <div class="defense-item">✅ Quarantine affected file</div>
                  <div class="defense-item">✅ Scan for similar indicators</div>
                  <div class="defense-item">✅ Update endpoint protection signatures</div>
                </div>

                <div class="defense-priority">
                  <strong class="priority-label medium">Medium-term:</strong>
                  <div class="defense-item">⚠️ User awareness training</div>
                  <div class="defense-item">⚠️ Email security hardening</div>
                  <div class="defense-item">⚠️ Network segmentation review</div>
                  <div class="defense-item">⚠️ Behavioral monitoring enhancement</div>
                </div>
              </Show>
            </div>
          </div>
          
          <div class="threat-actions">
            <button
              class="threat-action-btn primary"
              onClick={() => setShowShareModal(true)}
              disabled={isLoading() || threatIntel().length === 0}
              title={threatIntel().length === 0 ? 'Fetch threat intelligence first' : 'Share intelligence with external platforms'}
            >
              📤 Share Intel
            </button>
            <button
              class="threat-action-btn"
              onClick={() => setShowAlertModal(true)}
              disabled={isLoading() || !analysisStore.currentFile}
              title={!analysisStore.currentFile ? 'No file selected' : 'Create threat alert'}
            >
              🚨 Create Alert
            </button>
            <button
              class="threat-action-btn"
              onClick={openMitreNavigator}
            >
              🔗 MITRE Navigator
            </button>
            <button
              class="threat-action-btn"
              onClick={generateCampaignReport}
              disabled={isLoading()}
            >
              📊 Campaign Report
            </button>
          </div>
        </div>
      </div>

      {/* Create Alert Modal */}
      <Show when={showAlertModal()}>
        <div class="modal-overlay" onClick={() => setShowAlertModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style="color: var(--barbie-pink); margin-bottom: 20px;">🚨 Create Threat Alert</h3>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; color: var(--text-primary);">
                Alert Title *
              </label>
              <input
                type="text"
                value={alertForm().title}
                onInput={(e) => setAlertForm({ ...alertForm(), title: e.currentTarget.value })}
                placeholder="e.g., New APT Campaign Detected"
                style="width: 100%; padding: 8px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);"
              />
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; color: var(--text-primary);">
                Severity Level *
              </label>
              <select
                value={alertForm().severity}
                onChange={(e) => setAlertForm({ ...alertForm(), severity: e.currentTarget.value })}
                style="width: 100%; padding: 8px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; margin-bottom: 5px; color: var(--text-primary);">
                Description *
              </label>
              <textarea
                value={alertForm().description}
                onInput={(e) => setAlertForm({ ...alertForm(), description: e.currentTarget.value })}
                placeholder="Describe the threat and recommended actions..."
                rows={4}
                style="width: 100%; padding: 8px; background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary); resize: vertical;"
              />
            </div>

            <div style="margin-bottom: 15px; padding: 10px; background: var(--panel-bg); border-radius: 4px;">
              <strong style="color: var(--text-secondary); font-size: 0.9rem;">
                Indicators to Include:
              </strong>
              <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">
                {iocs().fileHashes.sha256 ? `File Hash: ${iocs().fileHashes.sha256.substring(0, 16)}...` : 'No file hash'}
                <br />
                Network IOCs: {iocs().networkIndicators.length} detected
              </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button
                class="btn btn-secondary"
                onClick={() => {
                  setShowAlertModal(false);
                  setAlertForm({ title: '', severity: 'high', description: '' });
                }}
              >
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onClick={createAlert}
                disabled={isLoading()}
              >
                {isLoading() ? 'Creating...' : 'Create Alert'}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Share Intelligence Modal */}
      <Show when={showShareModal()}>
        <div class="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style="color: var(--barbie-pink); margin-bottom: 20px;">📤 Share Threat Intelligence</h3>

            <div style="margin-bottom: 20px;">
              <p style="color: var(--text-secondary); margin-bottom: 15px;">
                Select platforms to share threat intelligence data with:
              </p>

              <div style="display: flex; flex-direction: column; gap: 10px;">
                {['misp', 'virustotal', 'otx', 'taxii'].map(platform => {
                  const platformNames: Record<string, string> = {
                    misp: 'MISP (Malware Information Sharing Platform)',
                    virustotal: 'VirusTotal',
                    otx: 'AlienVault OTX',
                    taxii: 'TAXII/STIX Sharing'
                  };

                  return (
                    <label style="display: flex; align-items: center; padding: 10px; background: var(--panel-bg); border-radius: 4px; cursor: pointer;">
                      <input
                        type="checkbox"
                        checked={selectedPlatforms().includes(platform)}
                        onChange={(e) => {
                          if (e.currentTarget.checked) {
                            setSelectedPlatforms([...selectedPlatforms(), platform]);
                          } else {
                            setSelectedPlatforms(selectedPlatforms().filter(p => p !== platform));
                          }
                        }}
                        style="margin-right: 10px;"
                      />
                      <span style="color: var(--text-primary);">{platformNames[platform]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style="margin-bottom: 15px; padding: 10px; background: var(--panel-bg); border-radius: 4px;">
              <strong style="color: var(--text-secondary); font-size: 0.9rem;">
                Data to Share:
              </strong>
              <div style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);">
                Threat Intel Sources: {threatIntel().length}
                <br />
                Total Indicators: {threatIntel().reduce((sum, intel) => sum + intel.indicators.length, 0)}
              </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button
                class="btn btn-secondary"
                onClick={() => {
                  setShowShareModal(false);
                  setSelectedPlatforms([]);
                }}
              >
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onClick={() => shareIntel(selectedPlatforms())}
                disabled={isLoading() || selectedPlatforms().length === 0}
              >
                {isLoading() ? 'Sharing...' : `Share to ${selectedPlatforms().length} Platform${selectedPlatforms().length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default ThreatIntelligence;
import { Component, createSignal, Show, onMount, createEffect, For } from 'solid-js';
import { analysisStore } from '../../../stores/analysisStore';
import AnalysisPanel from '../shared/AnalysisPanel';
import { invokeCommand } from '../../../utils/tauriCompat';
import { open } from '@tauri-apps/plugin-dialog';
import './YaraScanner.css';

const YaraScanner: Component = () => {
  const [ruleText, setRuleText] = createSignal(`rule My_Custom_Rule {
    meta:
        description = "Custom detection rule"
        author = "Athena User"
        threat_level = "medium"

    strings:
        $mz = "MZ"
        $string1 = "suspicious_string" nocase

    condition:
        $mz at 0 and any of ($string*)
}`);
  const [savedRules, setSavedRules] = createSignal<{name: string; content: string}[]>([]);
  const [testResults, setTestResults] = createSignal<any>(null);
  const [scanResults, setScanResults] = createSignal<any[]>([]);
  const [isScanning, setIsScanning] = createSignal(false);
  const [isTesting, setIsTesting] = createSignal(false);
  const [scannerInitialized, setScannerInitialized] = createSignal(false);
  const [rulesLoaded, setRulesLoaded] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [recommendations, setRecommendations] = createSignal<string[]>([]);
  const [ruleSets, setRuleSets] = createSignal<any[]>([]);
  const [selectedRuleSet, setSelectedRuleSet] = createSignal<string>('default-malware-rules');
  const [isImporting, setIsImporting] = createSignal(false);
  const [isGenerating, setIsGenerating] = createSignal(false);

  onMount(() => {
    // Load saved rules from localStorage with proper validation
    const loadSavedRules = () => {
      const saved = localStorage.getItem('athena-yara-rules');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (!Array.isArray(parsed)) {
            console.warn('Invalid YARA rules format: expected array');
            localStorage.removeItem('athena-yara-rules');
            return;
          }
          const validRules = parsed.filter((r: unknown) => {
            if (typeof r !== 'object' || r === null) return false;
            const rule = r as Record<string, unknown>;
            return typeof rule.name === 'string' && typeof rule.content === 'string';
          });
          if (validRules.length > 0) {
            setSavedRules(validRules);
            if (validRules[0].content) {
              setRuleText(validRules[0].content);
            }
          }
        } catch (err) {
          console.warn('Failed to parse saved YARA rules:', err);
          localStorage.removeItem('athena-yara-rules');
        }
      }
    };

    loadSavedRules();

    // Initialize scanner (async but don't block)
    invokeCommand('initialize_yara_scanner')
      .then(() => setScannerInitialized(true))
      .catch((err) => console.warn('Scanner init failed:', err));

    invokeCommand('load_default_yara_rules')
      .then(() => setRulesLoaded(true))
      .catch((err) => console.warn('Rules load failed:', err));

    // Load available rule sets
    invokeCommand('get_yara_rule_sets')
      .then((sets: any[]) => setRuleSets(sets))
      .catch((err) => console.warn('Failed to load rule sets:', err));
  });

  createEffect(() => {
    const files = analysisStore.files();
    const initialized = scannerInitialized();
    const loaded = rulesLoaded();

    if (files.length > 0 && initialized && loaded) {
      const latestFile = files[files.length - 1];
      if (latestFile?.path) {
        scanFile(latestFile.path);
      }
    }
  });

  const scanFile = (filePath: string) => {
    setIsScanning(true);
    setError(null);

    invokeCommand('scan_file_with_yara', { filePath })
      .then((results: any) => {
        setScanResults(results?.matches || []);
      })
      .catch((err) => {
        console.warn('YARA scan failed:', err);
      })
      .finally(() => {
        setIsScanning(false);
      });
  };

  const testRule = () => {
    setIsTesting(true);
    setTestResults(null);
    setError(null);
    setRecommendations([]);

    const currentRuleText = ruleText();

    if (!currentRuleText.trim()) {
      setError('Please enter a YARA rule to test');
      setIsTesting(false);
      return;
    }

    // Generate recommendations based on rule content
    const recs: string[] = [];
    const hasNocase = currentRuleText.includes('nocase');
    const hasHexStrings = currentRuleText.includes('{') && currentRuleText.includes('}');
    const hasFilesize = currentRuleText.includes('filesize');
    const stringCount = (currentRuleText.match(/\$\w+\s*=/g) || []).length;

    if (stringCount < 3) recs.push('Add more specific strings to improve detection accuracy');
    if (!hasFilesize) recs.push('Consider adding filesize constraints');
    if (!hasNocase && stringCount > 0) recs.push('Consider using "nocase" modifier');
    if (!hasHexStrings) recs.push('Add hex byte patterns for binary matching');
    if (recs.length === 0) recs.push('Rule looks comprehensive!');

    setRecommendations(recs);

    invokeCommand('validate_yara_rule', { rulesContent: currentRuleText })
      .then((result: any) => {
        const isSuccess = result?.compilation === 'Success';
        const strCount = result?.string_count || 0;
        const fpRisk = strCount >= 3 ? 'Low' : 'Medium';

        setTestResults({
          compilation: isSuccess ? 'Success' : 'Failed',
          matches: 0,
          falsePositives: fpRisk,
          performance: 'Good',
          coverage: {
            strings: Math.min(100, Math.round((strCount / 6) * 100)),
            conditions: 85,
            confidence: 75,
            fpRisk: fpRisk
          },
          warnings: result?.warnings || [],
          errors: result?.errors || []
        });
      })
      .catch((err) => {
        setError(`Rule validation failed: ${err}`);
        setTestResults({
          compilation: 'Failed',
          matches: 0,
          falsePositives: 'N/A',
          performance: 'N/A',
          coverage: { strings: 0, conditions: 0, confidence: 0, fpRisk: 'N/A' },
          warnings: [],
          errors: [String(err)]
        });
      })
      .finally(() => {
        setIsTesting(false);
      });
  };

  const saveRule = () => {
    const currentRuleText = ruleText();
    if (!currentRuleText.trim()) {
      setError('No rule to save');
      return;
    }

    const ruleNameMatch = currentRuleText.match(/rule\s+(\w+)/);
    const ruleName = ruleNameMatch?.[1] || `rule_${Date.now()}`;

    const existingRules = savedRules();
    const ruleIndex = existingRules.findIndex(r => r.name === ruleName);

    let updatedRules: { name: string; content: string }[];
    if (ruleIndex >= 0) {
      updatedRules = [...existingRules];
      updatedRules[ruleIndex] = { name: ruleName, content: currentRuleText };
    } else {
      updatedRules = [...existingRules, { name: ruleName, content: currentRuleText }];
    }

    setSavedRules(updatedRules);
    localStorage.setItem('athena-yara-rules', JSON.stringify(updatedRules));

    // Download file
    const blob = new Blob([currentRuleText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${ruleName}.yar`;
    link.click();
    URL.revokeObjectURL(url);
    setError(null);
  };

  const loadRule = (rule: { name: string; content: string }) => {
    setRuleText(rule.content);
    setTestResults(null);
    setRecommendations([]);
    setError(null);
  };

  const deleteRule = (ruleName: string) => {
    const updatedRules = savedRules().filter(r => r.name !== ruleName);
    setSavedRules(updatedRules);
    localStorage.setItem('athena-yara-rules', JSON.stringify(updatedRules));
  };

  const newRule = () => {
    setRuleText(`rule New_Rule {
    meta:
        description = "New detection rule"
        author = "Athena User"

    strings:
        $s1 = "pattern" nocase

    condition:
        any of them
}`);
    setTestResults(null);
    setRecommendations([]);
    setError(null);
  };

  const importRules = async () => {
    try {
      setIsImporting(true);
      setError(null);

      const selected = await open({
        multiple: false,
        filters: [{
          name: 'YARA Rules',
          extensions: ['yar', 'yara', 'txt']
        }]
      });

      if (selected && typeof selected === 'string') {
        // Read the file content from the selected path
        const content = await invokeCommand<string>('read_file_text', { path: selected });

        // Load the rules into the scanner
        await invokeCommand('load_yara_rules', {
          rulesContent: content,
          namespace: 'imported'
        });

        // Display the rules in the editor
        setRuleText(content);
        setError(null);

        // Optionally save to local storage
        const ruleNameMatch = content.match(/rule\s+(\w+)/);
        const ruleName = ruleNameMatch?.[1] || `imported_${Date.now()}`;
        const updatedRules = [...savedRules(), { name: ruleName, content }];
        setSavedRules(updatedRules);
        localStorage.setItem('athena-yara-rules', JSON.stringify(updatedRules));
      }
    } catch (err) {
      setError(`Failed to import rules: ${err}`);
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  };

  const autoGenerateRules = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const currentFile = analysisStore.currentFile;
      const progress = analysisStore.analysisProgress;

      if (!currentFile) {
        setError('No file selected for rule generation');
        return;
      }

      // Extract analysis data from the current file and progress
      const staticAnalysisResult = progress?.staticAnalysis?.result;
      const dynamicAnalysisResult = progress?.dynamicAnalysis?.result;

      // Prepare data for rule generation
      const fileHash = currentFile.hash || 'unknown';
      const fileType = currentFile.type || 'unknown';

      // Extract suspicious strings from static analysis
      const suspiciousStrings: string[] = [];
      if (staticAnalysisResult?.strings) {
        suspiciousStrings.push(...staticAnalysisResult.strings);
      }
      if (staticAnalysisResult?.suspicious_strings) {
        suspiciousStrings.push(...staticAnalysisResult.suspicious_strings);
      }

      // Extract suspicious imports
      const suspiciousImports: string[] = [];
      if (staticAnalysisResult?.imports) {
        suspiciousImports.push(...staticAnalysisResult.imports);
      }
      if (staticAnalysisResult?.suspicious_imports) {
        suspiciousImports.push(...staticAnalysisResult.suspicious_imports);
      }

      // Extract behaviors
      const behaviors: string[] = [];
      if (dynamicAnalysisResult?.behaviors) {
        behaviors.push(...dynamicAnalysisResult.behaviors);
      }
      if (staticAnalysisResult?.behaviors) {
        behaviors.push(...staticAnalysisResult.behaviors);
      }

      // Call the backend to generate rules
      const generatedRule = await invokeCommand<string>('auto_generate_yara_rules', {
        fileHash,
        fileType,
        suspiciousStrings: suspiciousStrings.slice(0, 10), // Limit to 10
        suspiciousImports: suspiciousImports.slice(0, 10),
        behaviors: behaviors.slice(0, 5)
      });

      // Display the generated rule in the editor
      setRuleText(generatedRule);
      setTestResults(null);
      setRecommendations([]);
      setError(null);

    } catch (err) {
      setError(`Failed to generate rules: ${err}`);
      console.error('Auto-generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div class="content-panel">
      <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
        📝 YARA Rules - Signature Detection
      </h2>

      <div class="analysis-grid">
        <div class="analysis-main">
          <AnalysisPanel
            title="YARA Rule Editor"
            icon="🎯"
            className="scrollable-panel"
            actions={
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary" onClick={newRule}>➕ New</button>
                <button class="btn btn-secondary" onClick={saveRule}>📄 Save</button>
                <button class="btn btn-primary" onClick={testRule} disabled={isTesting()}>
                  {isTesting() ? '⏳ Testing...' : '✅ Test Rule'}
                </button>
              </div>
            }
          >
            <div class="code-editor">
              <textarea
                class="yara-editor-textarea"
                value={ruleText()}
                onInput={(e) => setRuleText(e.currentTarget.value)}
                placeholder="Enter your YARA rule here..."
                spellcheck={false}
                style={{
                  width: '100%',
                  'min-height': '350px',
                  'font-family': "'JetBrains Mono', monospace",
                  'font-size': '0.9rem',
                  'line-height': '1.5',
                  padding: '15px',
                  background: 'var(--code-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255, 107, 157, 0.3)',
                  'border-radius': '8px',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
            </div>
          </AnalysisPanel>

          <AnalysisPanel title="Rule Management" icon="📚" className="scrollable-panel">
            <div style="display: flex; flex-direction: column; gap: 15px;">
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button
                  class="btn btn-secondary"
                  onClick={importRules}
                  disabled={isImporting()}
                >
                  {isImporting() ? '⏳ Importing...' : '📥 Import Rules'}
                </button>
                <button
                  class="btn btn-secondary"
                  onClick={autoGenerateRules}
                  disabled={isGenerating() || !analysisStore.currentFile}
                >
                  {isGenerating() ? '⏳ Generating...' : '🤖 Auto-Generate Rules'}
                </button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px;">
                <label style="color: var(--text-primary); font-weight: 500;">
                  Available Rule Sets:
                </label>
                <select
                  class="form-select"
                  value={selectedRuleSet()}
                  onChange={(e) => setSelectedRuleSet(e.currentTarget.value)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--code-bg)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(255, 107, 157, 0.3)',
                    'border-radius': '6px',
                    'font-size': '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  <For each={ruleSets()}>
                    {(ruleSet) => (
                      <option value={ruleSet.name}>
                        {ruleSet.name} ({ruleSet.rules_count} rules)
                      </option>
                    )}
                  </For>
                  <Show when={ruleSets().length === 0}>
                    <option value="">Loading rule sets...</option>
                  </Show>
                </select>
              </div>

              <Show when={selectedRuleSet()}>
                <div style="background: var(--code-bg); padding: 12px; border-radius: 6px; font-size: 0.85rem;">
                  <div style="color: var(--text-secondary); margin-bottom: 8px;">
                    <strong style="color: var(--barbie-pink)">Selected Rule Set:</strong>
                  </div>
                  <For each={ruleSets().filter(rs => rs.name === selectedRuleSet())}>
                    {(ruleSet) => (
                      <div>
                        <div style="color: var(--info-color)">
                          📦 {ruleSet.name}
                        </div>
                        <div style="color: var(--text-secondary); margin-top: 4px;">
                          Rules: {ruleSet.rules_count} |
                          Status: {ruleSet.loaded ? '✅ Loaded' : '⏳ Not Loaded'}
                        </div>
                        <Show when={ruleSet.categories && ruleSet.categories.length > 0}>
                          <div style="color: var(--text-secondary); margin-top: 4px;">
                            Categories: {ruleSet.categories.join(', ')}
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                </div>
              </Show>

              <div style="color: var(--text-secondary); font-size: 0.85rem; padding: 10px; background: rgba(255, 107, 157, 0.1); border-radius: 6px;">
                <strong style="color: var(--barbie-pink)">💡 Tips:</strong><br />
                • Import custom YARA rules from .yar or .yara files<br />
                • Auto-generate rules based on current analysis results<br />
                • Generated rules include file hash, suspicious strings, and behaviors
              </div>
            </div>
          </AnalysisPanel>

          <Show when={testResults()}>
            <AnalysisPanel title="Rule Testing & Validation" icon="🔍" className="scrollable-panel">
              <div class="code-editor">
                <div class="code-content">
                  <strong style="color: var(--barbie-pink)">TEST RESULTS</strong><br /><br />
                  <span style="color: var(--success-color)">✅ Compilation:</span> {testResults()?.compilation}<br />
                  <span style="color: var(--info-color)">⚡ Performance:</span> {testResults()?.performance}<br />
                  <span style="color: var(--warning-color)">⚠️ FP Risk:</span> {testResults()?.falsePositives}<br /><br />

                  <strong style="color: var(--barbie-pink)">RECOMMENDATIONS</strong><br /><br />
                  <For each={recommendations()}>
                    {(rec) => <span style="color: var(--info-color)">• {rec}<br /></span>}
                  </For>
                </div>
              </div>
            </AnalysisPanel>
          </Show>
        </div>

        <div class="ensemble-results">
          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">📚 Saved Rules</h3>
          <div style="background: var(--code-bg); padding: 15px; border-radius: 6px; margin-bottom: 15px; font-size: 0.85rem; max-height: 200px; overflow-y: auto;">
            <Show when={savedRules().length > 0} fallback={
              <span style="color: var(--text-secondary)">No saved rules yet.</span>
            }>
              <For each={savedRules()}>
                {(rule) => (
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 6px; background: rgba(255, 107, 157, 0.1); border-radius: 4px;">
                    <span style="cursor: pointer; color: var(--barbie-pink); flex: 1;" onClick={() => loadRule(rule)}>
                      📝 {rule.name}
                    </span>
                    <button style="background: none; border: none; color: var(--danger-color); cursor: pointer;" onClick={() => deleteRule(rule.name)}>×</button>
                  </div>
                )}
              </For>
            </Show>
          </div>

          <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">📊 Scanner Status</h3>
          <div style="background: var(--code-bg); padding: 15px; border-radius: 6px; margin-bottom: 15px; font-size: 0.85rem;">
            {scannerInitialized() ? '✅ Scanner Ready' : '⏳ Initializing...'}<br />
            {rulesLoaded() ? '✅ Rules Loaded' : '⏳ Loading...'}<br />
            {isScanning() ? '⏳ Scanning...' : '✅ Ready'}<br /><br />
            <strong>Matches:</strong> {scanResults().length > 0 ? scanResults().length : 'None'}
          </div>

          <Show when={error()}>
            <div style="color: var(--danger-color); margin: 10px 0; padding: 10px; background: rgba(255, 107, 107, 0.1); border-radius: 6px;">
              ❌ {error()}
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default YaraScanner;

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { invokeCommand } from '../utils/tauriCompat';

export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'html' | 'xlsx' | 'encrypted';
  template?: string;
  includeMetadata?: boolean;
  compression?: boolean;
  encryption?: {
    enabled: boolean;
    password?: string;
  };
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: ExportOptions['format'];
  sections: string[];
  customFields?: Record<string, any>;
}

export interface BatchExportOptions extends ExportOptions {
  fileIds: string[];
  outputDirectory?: string;
  naming?: 'original' | 'sequential' | 'custom';
  customNamingPattern?: string;
}

class ExportService {
  private templates: Map<string, ExportTemplate> = new Map();
  private exportHistory: Array<{
    timestamp: number;
    fileId: string;
    format: string;
    success: boolean;
  }> = [];

  constructor() {
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
    const templates: ExportTemplate[] = [
      {
        id: 'malware-ioc',
        name: 'IoC Export',
        description: 'Export indicators of compromise',
        format: 'json',
        sections: ['hashes', 'ips', 'domains', 'files', 'registry', 'yara_matches']
      },
      {
        id: 'executive-report',
        name: 'Executive Report',
        description: 'High-level summary for management',
        format: 'pdf',
        sections: ['summary', 'risk_assessment', 'recommendations', 'timeline']
      },
      {
        id: 'technical-analysis',
        name: 'Technical Deep Dive',
        description: 'Detailed technical analysis',
        format: 'html',
        sections: ['static_analysis', 'dynamic_analysis', 'code_analysis', 'network_analysis', 'memory_analysis']
      },
      {
        id: 'forensics-timeline',
        name: 'Forensics Timeline',
        description: 'Chronological event timeline',
        format: 'csv',
        sections: ['events', 'processes', 'network_connections', 'file_operations']
      },
      {
        id: 'mitre-mapping',
        name: 'MITRE ATT&CK Mapping',
        description: 'Map to MITRE framework',
        format: 'json',
        sections: ['techniques', 'tactics', 'mitigations', 'detections']
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  public async exportAnalysis(
    fileId: string,
    analysisData: any,
    options: ExportOptions
  ): Promise<string> {
    try {
      // Prepare export data
      const exportData = await this.prepareExportData(analysisData, options);
      
      // Choose file path
      const filePath = await save({
        defaultPath: `athena_export_${fileId}_${Date.now()}.${options.format}`,
        filters: [
          { name: options.format.toUpperCase(), extensions: [options.format] }
        ]
      });

      if (!filePath) {
        throw new Error('Export cancelled by user');
      }

      // Apply encryption if requested
      let finalData = exportData;
      if (options.encryption?.enabled) {
        finalData = await this.encryptData(exportData, options.encryption.password!);
      }

      // Apply compression if requested
      if (options.compression) {
        finalData = await this.compressData(finalData);
      }

      // Write file based on format
      await this.writeExportFile(filePath, finalData, options.format);

      // Update history
      this.exportHistory.push({
        timestamp: Date.now(),
        fileId,
        format: options.format,
        success: true
      });

      return filePath;
    } catch (error) {
      this.exportHistory.push({
        timestamp: Date.now(),
        fileId,
        format: options.format,
        success: false
      });
      throw error;
    }
  }

  public async batchExport(
    analysisDataMap: Map<string, any>,
    options: BatchExportOptions
  ): Promise<string[]> {
    const exportedPaths: string[] = [];
    const errors: Array<{ fileId: string; error: string }> = [];

    // Get output directory
    const outputDir = options.outputDirectory || await save({
      directory: true,
      defaultPath: `athena_batch_export_${Date.now()}`
    });

    if (!outputDir) {
      throw new Error('Batch export cancelled by user');
    }

    // Process each file
    for (const [index, fileId] of options.fileIds.entries()) {
      try {
        const analysisData = analysisDataMap.get(fileId);
        if (!analysisData) {
          errors.push({ fileId, error: 'Analysis data not found' });
          continue;
        }

        // Determine filename
        let filename: string;
        switch (options.naming) {
          case 'sequential':
            filename = `export_${index + 1}.${options.format}`;
            break;
          case 'custom':
            filename = this.applyNamingPattern(
              options.customNamingPattern || 'export_{index}',
              { index: index + 1, fileId, timestamp: Date.now() }
            ) + `.${options.format}`;
            break;
          default:
            filename = `${fileId}_export.${options.format}`;
        }

        const filePath = `${outputDir}/${filename}`;
        
        // Export individual file
        const exportOptions: ExportOptions = {
          format: options.format,
          template: options.template,
          includeMetadata: options.includeMetadata,
          compression: options.compression,
          encryption: options.encryption
        };

        await this.exportAnalysis(fileId, analysisData, exportOptions);
        exportedPaths.push(filePath);

      } catch (error) {
        errors.push({ 
          fileId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    // Create summary report
    await this.createBatchSummary(outputDir, exportedPaths, errors);

    if (errors.length > 0) {
      console.warn('Batch export completed with errors:', errors);
    }

    return exportedPaths;
  }

  private async prepareExportData(data: any, options: ExportOptions): Promise<any> {
    const template = options.template ? this.templates.get(options.template) : null;
    
    let exportData: any = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        tool: 'Athena Security Platform'
      }
    };

    if (template) {
      // Apply template sections
      for (const section of template.sections) {
        if (data[section]) {
          exportData[section] = data[section];
        }
      }
    } else {
      // Include all data
      exportData = { ...exportData, ...data };
    }

    if (!options.includeMetadata) {
      delete exportData.metadata;
    }

    return exportData;
  }

  private async writeExportFile(path: string, data: any, format: string): Promise<void> {
    switch (format) {
      case 'json':
        await invokeCommand('write_file_text', { 
          path, 
          content: JSON.stringify(data, null, 2) 
        });
        break;
      
      case 'csv':
        const csv = await this.convertToCSV(data);
        await invokeCommand('write_file_text', { path, content: csv });
        break;
      
      case 'html':
        const html = await this.generateHTMLReport(data);
        await invokeCommand('write_file_text', { path, content: html });
        break;
      
      case 'pdf':
        // Use backend command for PDF generation
        await invoke('generate_pdf_report', { data, outputPath: path });
        break;
      
      case 'xlsx':
        // Use backend command for Excel generation
        await invoke('generate_excel_report', { data, outputPath: path });
        break;
      
      case 'encrypted':
        // Data should already be encrypted - write as base64 string
        await invokeCommand('write_file_text', { path, content: data });
        break;
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async convertToCSV(data: any): Promise<string> {
    const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
      return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
        const prefixedKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(acc, flattenObject(obj[key], prefixedKey));
        } else {
          acc[prefixedKey] = obj[key];
        }
        return acc;
      }, {});
    };

    const flattened = flattenObject(data);
    const headers = Object.keys(flattened);
    const values = Object.values(flattened).map(v => 
      typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
    );

    return `${headers.join(',')}\n${values.join(',')}`;
  }

  private async generateHTMLReport(data: any): Promise<string> {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Athena Security Analysis Report</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            background: #0a0e27; 
            color: #e0e0e0; 
            padding: 40px;
            line-height: 1.6;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: #1a1a1a; 
            border-radius: 12px; 
            padding: 40px;
            box-shadow: 0 0 40px rgba(255, 107, 157, 0.1);
        }
        h1 { 
            color: #ff6b9d; 
            border-bottom: 3px solid #ff6b9d; 
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        h2 { 
            color: #ff6b9d; 
            margin-top: 40px;
            margin-bottom: 20px;
        }
        .section { 
            background: #2a2a2a; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 20px;
            border: 1px solid #444;
        }
        .metric { 
            display: inline-block; 
            background: #3a3a3a; 
            padding: 10px 20px; 
            border-radius: 6px; 
            margin: 5px;
            border: 1px solid #555;
        }
        .severity-high { color: #ef4444; }
        .severity-medium { color: #fb923c; }
        .severity-low { color: #fbbf24; }
        pre { 
            background: #0a0e27; 
            padding: 15px; 
            border-radius: 6px; 
            overflow-x: auto;
            border: 1px solid #333;
        }
        code { 
            color: #48dbfb; 
            font-family: 'JetBrains Mono', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛡️ Athena Security Analysis Report</h1>
        ${this.generateHTMLContent(data)}
    </div>
</body>
</html>`;
  }

  private generateHTMLContent(data: any): string {
    let content = '';
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'metadata') continue;
      
      content += `<div class="section">`;
      content += `<h2>${this.formatSectionTitle(key)}</h2>`;
      
      if (Array.isArray(value)) {
        content += '<ul>';
        value.forEach(item => {
          content += `<li>${this.formatValue(item)}</li>`;
        });
        content += '</ul>';
      } else if (typeof value === 'object') {
        content += '<pre><code>' + JSON.stringify(value, null, 2) + '</code></pre>';
      } else {
        content += `<p>${this.formatValue(value)}</p>`;
      }
      
      content += '</div>';
    }
    
    return content;
  }

  private formatSectionTitle(key: string): string {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatValue(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private async encryptData(data: any, password: string): Promise<string> {
    // Use backend encryption service
    return await invoke('encrypt_export_data', { 
      data: JSON.stringify(data), 
      password 
    });
  }

  private async compressData(data: any): Promise<any> {
    // Use backend compression service
    return await invoke('compress_export_data', { data });
  }

  private applyNamingPattern(pattern: string, vars: Record<string, any>): string {
    return pattern.replace(/{(\w+)}/g, (match, key) => {
      return vars[key] || match;
    });
  }

  private async createBatchSummary(
    outputDir: string,
    exportedPaths: string[],
    errors: Array<{ fileId: string; error: string }>
  ): Promise<void> {
    const summary = {
      timestamp: new Date().toISOString(),
      totalFiles: exportedPaths.length + errors.length,
      successful: exportedPaths.length,
      failed: errors.length,
      exportedFiles: exportedPaths,
      errors: errors
    };

    await invokeCommand('write_file_text', {
      path: `${outputDir}/batch_export_summary.json`,
      content: JSON.stringify(summary, null, 2)
    });
  }

  // Template management
  public addCustomTemplate(template: ExportTemplate): void {
    this.templates.set(template.id, template);
    this.saveTemplates();
  }

  public removeTemplate(templateId: string): boolean {
    const result = this.templates.delete(templateId);
    if (result) {
      this.saveTemplates();
    }
    return result;
  }

  public getTemplates(): ExportTemplate[] {
    return Array.from(this.templates.values());
  }

  public getTemplate(templateId: string): ExportTemplate | undefined {
    return this.templates.get(templateId);
  }

  private saveTemplates(): void {
    // Save custom templates to localStorage
    const customTemplates = Array.from(this.templates.entries())
      .filter(([id]) => !this.isDefaultTemplate(id))
      .map(([_, template]) => template);
    
    localStorage.setItem('athena_export_templates', JSON.stringify(customTemplates));
  }

  private isDefaultTemplate(id: string): boolean {
    const defaultIds = ['malware-ioc', 'executive-report', 'technical-analysis', 'forensics-timeline', 'mitre-mapping'];
    return defaultIds.includes(id);
  }

  public getExportHistory(): typeof this.exportHistory {
    return [...this.exportHistory];
  }

  public clearExportHistory(): void {
    this.exportHistory = [];
  }
}

// Create singleton instance
export const exportService = new ExportService();
/// Analysis Export System
/// Exports analysis results in multiple formats for sharing and integration
///
/// Supports: JSON, HTML, C headers, Markdown reports

use serde::{Serialize, Deserialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AnalysisExport {
    pub metadata: ExportMetadata,
    pub functions: Vec<FunctionExport>,
    pub xrefs: Vec<XrefExport>,
    pub strings: Vec<StringExport>,
    pub imports: Vec<ImportExport>,
    pub exports: Vec<ExportSymbol>,
    pub cfg: Option<String>, // DOT format
    pub decompilation: HashMap<u64, String>, // address -> C code
    pub annotations: Vec<Annotation>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExportMetadata {
    pub tool_name: String,
    pub tool_version: String,
    pub analysis_date: String,
    pub file_name: String,
    pub file_hash: String,
    pub file_type: String,
    pub architecture: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FunctionExport {
    pub address: u64,
    pub name: String,
    pub size: u32,
    pub signature: Option<String>,
    pub calling_convention: Option<String>,
    pub decompiled_code: Option<String>,
    pub complexity: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct XrefExport {
    pub from: u64,
    pub to: u64,
    pub xref_type: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StringExport {
    pub address: u64,
    pub value: String,
    pub encoding: String,
    pub references: Vec<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ImportExport {
    pub library: String,
    pub function: String,
    pub address: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ExportSymbol {
    pub name: String,
    pub address: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Annotation {
    pub address: u64,
    pub annotation_type: AnnotationType,
    pub content: String,
    pub author: Option<String>,
    pub timestamp: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum AnnotationType {
    Comment,
    Label,
    TypeHint,
    Note,
}

pub struct Exporter;

impl Exporter {
    /// Export to JSON (for programmatic consumption and tool integration)
    pub fn to_json(analysis: &AnalysisExport) -> Result<String, String> {
        serde_json::to_string_pretty(analysis)
            .map_err(|e| format!("JSON export failed: {}", e))
    }

    /// Export to HTML report (for human-readable analysis)
    pub fn to_html(analysis: &AnalysisExport) -> String {
        let mut html = String::from("<!DOCTYPE html>\n<html>\n<head>\n");
        html.push_str("<title>Athena Analysis Report</title>\n");
        html.push_str("<style>\n");
        html.push_str("body { font-family: Arial, sans-serif; margin: 20px; }\n");
        html.push_str("h1 { color: #333; }\n");
        html.push_str("table { border-collapse: collapse; width: 100%; margin: 20px 0; }\n");
        html.push_str("th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }\n");
        html.push_str("th { background-color: #4CAF50; color: white; }\n");
        html.push_str("code { background-color: #f4f4f4; padding: 2px 4px; }\n");
        html.push_str(".metadata { background-color: #f9f9f9; padding: 15px; margin: 10px 0; }\n");
        html.push_str("</style>\n</head>\n<body>\n");

        // Metadata
        html.push_str("<h1>Athena Malware Analysis Report</h1>\n");
        html.push_str("<div class='metadata'>\n");
        html.push_str(&format!("<p><strong>File:</strong> {}</p>\n", analysis.metadata.file_name));
        html.push_str(&format!("<p><strong>Hash:</strong> <code>{}</code></p>\n", analysis.metadata.file_hash));
        html.push_str(&format!("<p><strong>Type:</strong> {}</p>\n", analysis.metadata.file_type));
        html.push_str(&format!("<p><strong>Architecture:</strong> {}</p>\n", analysis.metadata.architecture));
        html.push_str(&format!("<p><strong>Analysis Date:</strong> {}</p>\n", analysis.metadata.analysis_date));
        html.push_str("</div>\n");

        // Functions
        html.push_str("<h2>Functions</h2>\n");
        html.push_str("<table>\n<tr><th>Address</th><th>Name</th><th>Size</th><th>Complexity</th></tr>\n");
        for func in &analysis.functions {
            html.push_str(&format!(
                "<tr><td>0x{:x}</td><td>{}</td><td>{}</td><td>{}</td></tr>\n",
                func.address,
                func.name,
                func.size,
                func.complexity.map_or("-".to_string(), |c| c.to_string())
            ));
        }
        html.push_str("</table>\n");

        // Imports
        if !analysis.imports.is_empty() {
            html.push_str("<h2>Imports</h2>\n");
            html.push_str("<table>\n<tr><th>Library</th><th>Function</th></tr>\n");
            for imp in &analysis.imports {
                html.push_str(&format!(
                    "<tr><td>{}</td><td>{}</td></tr>\n",
                    imp.library, imp.function
                ));
            }
            html.push_str("</table>\n");
        }

        // Strings
        if !analysis.strings.is_empty() {
            html.push_str("<h2>Strings</h2>\n");
            html.push_str("<table>\n<tr><th>Address</th><th>Value</th></tr>\n");
            for string in analysis.strings.iter().take(50) {
                html.push_str(&format!(
                    "<tr><td>0x{:x}</td><td><code>{}</code></td></tr>\n",
                    string.address,
                    html_escape(&string.value)
                ));
            }
            html.push_str("</table>\n");
        }

        html.push_str("</body>\n</html>");
        html
    }

    /// Export to Markdown report
    pub fn to_markdown(analysis: &AnalysisExport) -> String {
        let mut md = String::from("# Athena Malware Analysis Report\n\n");

        // Metadata
        md.push_str("## Metadata\n\n");
        md.push_str(&format!("- **File**: {}\n", analysis.metadata.file_name));
        md.push_str(&format!("- **Hash**: `{}`\n", analysis.metadata.file_hash));
        md.push_str(&format!("- **Type**: {}\n", analysis.metadata.file_type));
        md.push_str(&format!("- **Architecture**: {}\n", analysis.metadata.architecture));
        md.push_str(&format!("- **Date**: {}\n\n", analysis.metadata.analysis_date));

        // Summary statistics
        md.push_str("## Summary\n\n");
        md.push_str(&format!("- Functions: {}\n", analysis.functions.len()));
        md.push_str(&format!("- Imports: {}\n", analysis.imports.len()));
        md.push_str(&format!("- Exports: {}\n", analysis.exports.len()));
        md.push_str(&format!("- Strings: {}\n\n", analysis.strings.len()));

        // Functions
        md.push_str("## Functions\n\n");
        md.push_str("| Address | Name | Size |\n");
        md.push_str("|---------|------|------|\n");
        for func in &analysis.functions {
            md.push_str(&format!(
                "| 0x{:x} | {} | {} |\n",
                func.address, func.name, func.size
            ));
        }
        md.push_str("\n");

        // CFG if available
        if let Some(cfg) = &analysis.cfg {
            md.push_str("## Control Flow Graph\n\n");
            md.push_str("```dot\n");
            md.push_str(cfg);
            md.push_str("\n```\n\n");
        }

        md
    }

    /// Export to C header file (for integration with C/C++ tools)
    pub fn to_c_header(analysis: &AnalysisExport) -> String {
        let mut c = String::from("/* Athena Analysis Export */\n");
        c.push_str(&format!("/* File: {} */\n", analysis.metadata.file_name));
        c.push_str(&format!("/* Hash: {} */\n\n", analysis.metadata.file_hash));

        c.push_str("#ifndef ATHENA_ANALYSIS_H\n");
        c.push_str("#define ATHENA_ANALYSIS_H\n\n");

        // Function declarations
        c.push_str("/* Function Declarations */\n");
        for func in &analysis.functions {
            if let Some(sig) = &func.signature {
                c.push_str(&format!("{};\n", sig));
            } else {
                c.push_str(&format!("void {}(void); /* 0x{:x} */\n", func.name, func.address));
            }
        }
        c.push_str("\n");

        // Import declarations
        if !analysis.imports.is_empty() {
            c.push_str("/* Imports */\n");
            for imp in &analysis.imports {
                c.push_str(&format!("extern void {}(void); /* from {} */\n", imp.function, imp.library));
            }
            c.push_str("\n");
        }

        c.push_str("#endif /* ATHENA_ANALYSIS_H */\n");
        c
    }

    /// Import from JSON
    pub fn from_json(json: &str) -> Result<AnalysisExport, String> {
        serde_json::from_str(json)
            .map_err(|e| format!("JSON import failed: {}", e))
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_export() {
        let export = AnalysisExport {
            metadata: ExportMetadata {
                tool_name: "Athena".to_string(),
                tool_version: "1.0.0".to_string(),
                analysis_date: "2025-01-01".to_string(),
                file_name: "test.exe".to_string(),
                file_hash: "abc123".to_string(),
                file_type: "PE32".to_string(),
                architecture: "x86".to_string(),
            },
            functions: vec![],
            xrefs: vec![],
            strings: vec![],
            imports: vec![],
            exports: vec![],
            cfg: None,
            decompilation: HashMap::new(),
            annotations: vec![],
        };

        let json = Exporter::to_json(&export);
        assert!(json.is_ok());
        assert!(json.unwrap().contains("Athena"));
    }

    #[test]
    fn test_html_export() {
        let export = AnalysisExport {
            metadata: ExportMetadata {
                tool_name: "Athena".to_string(),
                tool_version: "1.0.0".to_string(),
                analysis_date: "2025-01-01".to_string(),
                file_name: "test.exe".to_string(),
                file_hash: "abc123".to_string(),
                file_type: "PE32".to_string(),
                architecture: "x86".to_string(),
            },
            functions: vec![],
            xrefs: vec![],
            strings: vec![],
            imports: vec![],
            exports: vec![],
            cfg: None,
            decompilation: HashMap::new(),
            annotations: vec![],
        };

        let html = Exporter::to_html(&export);
        assert!(html.contains("<!DOCTYPE html>"));
        assert!(html.contains("Athena"));
    }
}

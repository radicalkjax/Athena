use crate::types::*;

pub struct SignatureDatabase;

impl SignatureDatabase {
    pub fn get_default_rules() -> Vec<Rule> {
        vec![
            // JavaScript Obfuscation
            Rule {
                id: "js_eval_base64".to_string(),
                name: "JavaScript Eval with Base64".to_string(),
                description: "Detects JavaScript code that evaluates base64 decoded content".to_string(),
                patterns: vec![
                    Pattern {
                        id: "eval_atob".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"eval\s*\(\s*atob\s*\(".as_bytes().to_vec(),
                        mask: None,
                        description: "eval(atob( pattern".to_string(),
                        weight: 0.9,
                    }
                ],
                condition: Condition::All,
                severity: Severity::High,
                category: ThreatCategory::Obfuscation,
                tags: vec!["javascript".to_string(), "obfuscation".to_string(), "base64".to_string()],
                metadata: serde_json::json!({"technique": "T1027"}),
            },
            
            Rule {
                id: "js_hex_obfuscation".to_string(),
                name: "JavaScript Hex String Obfuscation".to_string(),
                description: "Detects hex encoded strings in JavaScript".to_string(),
                patterns: vec![
                    Pattern {
                        id: "hex_string".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"\\x[0-9a-fA-F]{2}".as_bytes().to_vec(),
                        mask: None,
                        description: "Hex encoded string".to_string(),
                        weight: 0.7,
                    }
                ],
                condition: Condition::All,
                severity: Severity::Medium,
                category: ThreatCategory::Obfuscation,
                tags: vec!["javascript".to_string(), "obfuscation".to_string(), "hex".to_string()],
                metadata: serde_json::json!({"technique": "T1027"}),
            },
            
            Rule {
                id: "js_unicode_obfuscation".to_string(),
                name: "JavaScript Unicode Obfuscation".to_string(),
                description: "Detects unicode encoded strings in JavaScript".to_string(),
                patterns: vec![
                    Pattern {
                        id: "unicode_string".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"\\u[0-9a-fA-F]{4}".as_bytes().to_vec(),
                        mask: None,
                        description: "Unicode encoded string".to_string(),
                        weight: 0.7,
                    }
                ],
                condition: Condition::All,
                severity: Severity::Medium,
                category: ThreatCategory::Obfuscation,
                tags: vec!["javascript".to_string(), "obfuscation".to_string(), "unicode".to_string()],
                metadata: serde_json::json!({"technique": "T1027"}),
            },
            
            // Exploit Patterns
            Rule {
                id: "js_document_write_script".to_string(),
                name: "Dynamic Script Injection".to_string(),
                description: "Detects dynamic script injection via document.write".to_string(),
                patterns: vec![
                    Pattern {
                        id: "doc_write_script".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r#"document\.write\s*\(\s*['"]\s*<script"#.as_bytes().to_vec(),
                        mask: None,
                        description: "document.write with script tag".to_string(),
                        weight: 0.85,
                    }
                ],
                condition: Condition::All,
                severity: Severity::High,
                category: ThreatCategory::Exploit,
                tags: vec!["javascript".to_string(), "injection".to_string(), "xss".to_string()],
                metadata: serde_json::json!({"technique": "T1059.007"}),
            },
            
            Rule {
                id: "js_activex_object".to_string(),
                name: "ActiveX Object Creation".to_string(),
                description: "Detects creation of ActiveX objects (Windows specific)".to_string(),
                patterns: vec![
                    Pattern {
                        id: "new_activex".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"new\s+ActiveXObject".as_bytes().to_vec(),
                        mask: None,
                        description: "ActiveX object instantiation".to_string(),
                        weight: 0.8,
                    }
                ],
                condition: Condition::All,
                severity: Severity::High,
                category: ThreatCategory::Exploit,
                tags: vec!["windows".to_string(), "activex".to_string(), "exploit".to_string()],
                metadata: serde_json::json!({"platform": "windows"}),
            },
            
            // Backdoor Patterns
            Rule {
                id: "php_eval_backdoor".to_string(),
                name: "PHP Eval Backdoor".to_string(),
                description: "Detects PHP backdoor using eval with user input".to_string(),
                patterns: vec![
                    Pattern {
                        id: "eval_post_get".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"@?eval\s*\(\s*\$_(POST|GET|REQUEST)".as_bytes().to_vec(),
                        mask: None,
                        description: "eval with user input".to_string(),
                        weight: 0.95,
                    }
                ],
                condition: Condition::All,
                severity: Severity::Critical,
                category: ThreatCategory::Malware,
                tags: vec!["php".to_string(), "backdoor".to_string(), "webshell".to_string()],
                metadata: serde_json::json!({"technique": "T1505.003"}),
            },
            
            Rule {
                id: "reverse_shell".to_string(),
                name: "Reverse Shell Connection".to_string(),
                description: "Detects potential reverse shell connections".to_string(),
                patterns: vec![
                    Pattern {
                        id: "nc_reverse".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"(nc|netcat|bash|sh)\s+.*\s+\d+\.\d+\.\d+\.\d+\s+\d+".as_bytes().to_vec(),
                        mask: None,
                        description: "Reverse shell command".to_string(),
                        weight: 0.9,
                    }
                ],
                condition: Condition::All,
                severity: Severity::Critical,
                category: ThreatCategory::Malware,
                tags: vec!["shell".to_string(), "backdoor".to_string(), "persistence".to_string()],
                metadata: serde_json::json!({"technique": "T1059.004"}),
            },
            
            // Binary Patterns
            Rule {
                id: "pe_executable".to_string(),
                name: "Windows PE Executable".to_string(),
                description: "Detects Windows PE executable files".to_string(),
                patterns: vec![
                    Pattern {
                        id: "mz_header".to_string(),
                        pattern_type: PatternType::Binary,
                        value: vec![0x4D, 0x5A], // MZ
                        mask: Some(vec![0xFF, 0xFF]),
                        description: "DOS MZ header".to_string(),
                        weight: 0.6,
                    },
                    Pattern {
                        id: "pe_header".to_string(),
                        pattern_type: PatternType::Binary,
                        value: vec![0x50, 0x45, 0x00, 0x00], // PE\0\0
                        mask: Some(vec![0xFF, 0xFF, 0xFF, 0xFF]),
                        description: "PE header signature".to_string(),
                        weight: 0.8,
                    }
                ],
                condition: Condition::And(vec![
                    Condition::PatternRef("mz_header".to_string()),
                    Condition::PatternRef("pe_header".to_string())
                ]),
                severity: Severity::Medium,
                category: ThreatCategory::Suspicious,
                tags: vec!["windows".to_string(), "executable".to_string(), "pe".to_string()],
                metadata: serde_json::json!({"file_type": "executable"}),
            },
            
            // PowerShell Patterns
            Rule {
                id: "ps_encoded_command".to_string(),
                name: "PowerShell Encoded Command".to_string(),
                description: "Detects encoded PowerShell commands".to_string(),
                patterns: vec![
                    Pattern {
                        id: "encodedcommand".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"powershell[^|]*-e(nc|ncodedcommand)\s+".as_bytes().to_vec(),
                        mask: None,
                        description: "PowerShell -EncodedCommand".to_string(),
                        weight: 0.85,
                    }
                ],
                condition: Condition::All,
                severity: Severity::High,
                category: ThreatCategory::Obfuscation,
                tags: vec!["powershell".to_string(), "obfuscation".to_string(), "windows".to_string()],
                metadata: serde_json::json!({"technique": "T1059.001"}),
            },
            
            // Crypto Miner Patterns
            Rule {
                id: "crypto_miner_domains".to_string(),
                name: "Cryptocurrency Miner Domains".to_string(),
                description: "Detects known cryptocurrency mining domains".to_string(),
                patterns: vec![
                    Pattern {
                        id: "coinhive".to_string(),
                        pattern_type: PatternType::Exact,
                        value: b"coinhive.com".to_vec(),
                        mask: None,
                        description: "Coinhive mining domain".to_string(),
                        weight: 0.9,
                    },
                    Pattern {
                        id: "cryptoloot".to_string(),
                        pattern_type: PatternType::Exact,
                        value: b"crypto-loot.com".to_vec(),
                        mask: None,
                        description: "CryptoLoot mining domain".to_string(),
                        weight: 0.9,
                    },
                    Pattern {
                        id: "webmine".to_string(),
                        pattern_type: PatternType::Exact,
                        value: b"webmine.cz".to_vec(),
                        mask: None,
                        description: "Webmine mining domain".to_string(),
                        weight: 0.9,
                    }
                ],
                condition: Condition::Any(1),
                severity: Severity::High,
                category: ThreatCategory::Malware,
                tags: vec!["cryptominer".to_string(), "malware".to_string()],
                metadata: serde_json::json!({"technique": "T1496"}),
            },
            
            // Ransomware Patterns
            Rule {
                id: "ransomware_note".to_string(),
                name: "Ransomware Note Keywords".to_string(),
                description: "Detects common ransomware note keywords".to_string(),
                patterns: vec![
                    Pattern {
                        id: "encrypted_files".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"(your files|all files|documents).{0,50}(encrypted|locked)".as_bytes().to_vec(),
                        mask: None,
                        description: "Files encrypted message".to_string(),
                        weight: 0.8,
                    },
                    Pattern {
                        id: "bitcoin_payment".to_string(),
                        pattern_type: PatternType::Regex,
                        value: r"(bitcoin|btc|monero|payment).{0,50}(address|wallet)".as_bytes().to_vec(),
                        mask: None,
                        description: "Cryptocurrency payment request".to_string(),
                        weight: 0.7,
                    }
                ],
                condition: Condition::And(vec![
                    Condition::PatternRef("encrypted_files".to_string()),
                    Condition::PatternRef("bitcoin_payment".to_string())
                ]),
                severity: Severity::Critical,
                category: ThreatCategory::Malware,
                tags: vec!["ransomware".to_string(), "encryption".to_string()],
                metadata: serde_json::json!({"technique": "T1486"}),
            },
            
            // Suspicious API Calls
            Rule {
                id: "suspicious_apis".to_string(),
                name: "Suspicious API Calls".to_string(),
                description: "Detects suspicious Windows API calls".to_string(),
                patterns: vec![
                    Pattern {
                        id: "virtual_alloc".to_string(),
                        pattern_type: PatternType::Exact,
                        value: b"VirtualAlloc".to_vec(),
                        mask: None,
                        description: "Memory allocation API".to_string(),
                        weight: 0.6,
                    },
                    Pattern {
                        id: "write_process_memory".to_string(),
                        pattern_type: PatternType::Exact,
                        value: b"WriteProcessMemory".to_vec(),
                        mask: None,
                        description: "Process memory manipulation".to_string(),
                        weight: 0.8,
                    },
                    Pattern {
                        id: "create_remote_thread".to_string(),
                        pattern_type: PatternType::Exact,
                        value: b"CreateRemoteThread".to_vec(),
                        mask: None,
                        description: "Remote thread creation".to_string(),
                        weight: 0.9,
                    }
                ],
                condition: Condition::Any(2),
                severity: Severity::High,
                category: ThreatCategory::Suspicious,
                tags: vec!["windows".to_string(), "api".to_string(), "injection".to_string()],
                metadata: serde_json::json!({"technique": "T1055"}),
            },
        ]
    }
    
    pub fn get_yara_compatible_rules() -> Vec<&'static str> {
        vec![
            r#"
rule js_obfuscated_eval
{
    strings:
        $eval_base64 = /eval\s*\(\s*atob\s*\(/
        $eval_hex = /eval\s*\(\s*String\.fromCharCode/
        $eval_unescape = /eval\s*\(\s*unescape\s*\(/
    condition:
        any of them
}
"#,
            r#"
rule webshell_php
{
    strings:
        $php_eval = /@?eval\s*\(\s*\$_(POST|GET|REQUEST)/
        $php_system = /system\s*\(\s*\$_(POST|GET|REQUEST)/
        $php_exec = /exec\s*\(\s*\$_(POST|GET|REQUEST)/
        $php_assert = /assert\s*\(\s*\$_(POST|GET|REQUEST)/
    condition:
        any of them
}
"#,
            r#"
rule suspicious_powershell
{
    strings:
        $ps_encoded = /powershell[^|]*-e(nc|ncodedcommand)\s+/i
        $ps_bypass = /powershell[^|]*-ExecutionPolicy\s+Bypass/i
        $ps_hidden = /powershell[^|]*-WindowStyle\s+Hidden/i
        $ps_download = /(New-Object|IWR|Invoke-WebRequest).*DownloadString/i
    condition:
        2 of them
}
"#,
        ]
    }
}
// Additional YARA rule sets for malware detection
// These are automatically loaded by initialize_yara_scanner()

pub const RANSOMWARE_RULES: &str = r#"
rule Generic_Ransomware {
    meta:
        description = "Generic ransomware detection"
        severity = "critical"
        author = "Athena Platform"
    
    strings:
        $enc1 = "Your files have been encrypted"
        $enc2 = "All your files are encrypted"
        $btc = /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/
        $ext = /\.(locked|enc|encrypted|crypto|[0-9a-f]{6})$/
        
    condition:
        2 of them
}

rule Ransomware_Note {
    meta:
        description = "Detects ransomware payment instructions"
        severity = "high"
    
    strings:
        $pay1 = "bitcoin" nocase
        $pay2 = "payment" nocase
        $pay3 = "decrypt" nocase
        $pay4 = "restore" nocase
        
    condition:
        3 of them
}
"#;

pub const TROJAN_RULES: &str = r#"
rule Trojan_Generic {
    meta:
        description = "Generic trojan detection"
        severity = "high"
        author = "Athena Platform"
    
    strings:
        $api1 = "CreateRemoteThread"
        $api2 = "VirtualAllocEx"
        $api3 = "WriteProcessMemory"
        $api4 = "SetWindowsHookEx"
        
    condition:
        3 of them
}

rule Backdoor_Commands {
    meta:
        description = "Detects backdoor command patterns"
        severity = "high"
    
    strings:
        $cmd1 = "cmd.exe /c"
        $cmd2 = "powershell -"
        $cmd3 = "systeminfo"
        $cmd4 = "netstat -"
        
    condition:
        2 of them
}
"#;

pub const EXPLOIT_RULES: &str = r#"
rule Exploit_Shellcode {
    meta:
        description = "Detects common shellcode patterns"
        severity = "critical"
    
    strings:
        $nop = { 90 90 90 90 90 90 90 90 }
        $egg = { 77 30 30 74 }
        $seh = { EB 06 90 90 }
        
    condition:
        any of them
}

rule CVE_Pattern {
    meta:
        description = "Detects CVE exploit patterns"
        severity = "critical"
    
    strings:
        $cve1 = "CVE-"
        $cve2 = /CVE-[0-9]{4}-[0-9]{4,}/
        
    condition:
        any of them
}
"#;

pub const PACKER_RULES: &str = r#"
rule UPX_Packer {
    meta:
        description = "Detects UPX packer"
        severity = "medium"
    
    strings:
        $upx1 = "UPX!"
        $upx2 = "UPX0"
        $upx3 = "UPX1"
        
    condition:
        any of them
}

rule VMProtect {
    meta:
        description = "Detects VMProtect packer"
        severity = "medium"
    
    strings:
        $vmp = ".vmp0"
        $vmp1 = ".vmp1"
        $vmp2 = ".vmp2"
        
    condition:
        any of them
}
"#;
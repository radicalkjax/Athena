#[cfg(test)]
mod tests {
    use crate::*;
    use crate::analyzer::ObfuscationAnalyzer;
    use crate::chain::DeobfuscationChain;
    use crate::types::*;

    #[test]
    fn test_base64_detection() {
        let analyzer = ObfuscationAnalyzer::new();
        // Longer base64 string to meet pattern requirements (20+ chars)
        let content = "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBsb25nZXIgc3RyaW5nLg=="; 
        let analysis = analyzer.analyze(content);
        
        assert!(analysis.detected_techniques.iter()
            .any(|(tech, _)| matches!(tech, ObfuscationTechnique::Base64Encoding)));
    }

    #[test]
    fn test_hex_detection() {
        let analyzer = ObfuscationAnalyzer::new();
        let content = r"\x48\x65\x6c\x6c\x6f"; // "Hello" in hex
        let analysis = analyzer.analyze(content);
        
        assert!(analysis.detected_techniques.iter()
            .any(|(tech, _)| matches!(tech, ObfuscationTechnique::HexEncoding)));
    }

    #[test]
    fn test_unicode_detection() {
        let analyzer = ObfuscationAnalyzer::new();
        let content = r"\u0048\u0065\u006c\u006c\u006f"; // "Hello" in unicode
        let analysis = analyzer.analyze(content);
        
        assert!(analysis.detected_techniques.iter()
            .any(|(tech, _)| matches!(tech, ObfuscationTechnique::UnicodeEscape)));
    }

    #[test]
    fn test_base64_deobfuscation() {
        let config = DeobfuscatorConfig::default();
        let chain = DeobfuscationChain::new(config);
        let analyzer = ObfuscationAnalyzer::new();
        
        let content = "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBsb25nZXIgc3RyaW5nLg==";
        let analysis = analyzer.analyze(content);
        let result = chain.deobfuscate(content, &analysis).unwrap();
        
        assert_eq!(result.deobfuscated, "Hello World! This is a longer string.");
        assert!(result.confidence > 0.5);
    }

    #[test]
    fn test_hex_deobfuscation() {
        let config = DeobfuscatorConfig::default();
        let chain = DeobfuscationChain::new(config);
        let analyzer = ObfuscationAnalyzer::new();
        
        let content = r"\x48\x65\x6c\x6c\x6f";
        let analysis = analyzer.analyze(content);
        let result = chain.deobfuscate(content, &analysis).unwrap();
        
        assert_eq!(result.deobfuscated, "Hello");
    }

    #[test]
    fn test_unicode_deobfuscation() {
        let config = DeobfuscatorConfig::default();
        let chain = DeobfuscationChain::new(config);
        let analyzer = ObfuscationAnalyzer::new();
        
        let content = r"\u0048\u0065\u006c\u006c\u006f";
        let analysis = analyzer.analyze(content);
        let result = chain.deobfuscate(content, &analysis).unwrap();
        
        assert_eq!(result.deobfuscated, "Hello");
    }

    #[test]
    fn test_multi_layer_deobfuscation() {
        let config = DeobfuscatorConfig::default();
        let chain = DeobfuscationChain::new(config);
        let analyzer = ObfuscationAnalyzer::new();
        
        // Double encoded: Base64(Hex("Hello"))
        let content = "XHg0OFx4NjVceDZjXHg2Y1x4NmY=";
        let analysis = analyzer.analyze(content);
        let result = chain.deobfuscate(content, &analysis).unwrap();
        
        assert!(result.metadata.layers_detected >= 2);
        assert_eq!(result.deobfuscated, "Hello");
    }

    #[test]
    fn test_entropy_analysis() {
        use crate::ml::entropy::EntropyAnalyzer;
        
        let analyzer = EntropyAnalyzer::new();
        
        // Low entropy (readable text)
        let text = "Hello World! This is a simple text.";
        let features = analyzer.analyze(text.as_bytes());
        assert!(features.global_entropy < 5.0);
        
        // High entropy (random bytes)
        let random = vec![0xAB; 100];
        let features = analyzer.analyze(&random);
        assert!(features.global_entropy < 1.0); // All same byte = low entropy
        
        // Mixed content
        let mixed = b"Normal text \xFF\xFE\xFD\xFC random bytes";
        let features = analyzer.analyze(mixed);
        assert!(features.global_entropy > 2.0);
    }

    #[test]
    fn test_pattern_detection() {
        use crate::ml::patterns::PatternDetector;
        
        let detector = PatternDetector::new();
        
        // Test base64 detection
        let base64_content = "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBsb25nZXIgc3RyaW5nLg==";
        let features = detector.detect(base64_content);
        assert!(features.base64_likelihood > 0.5);
        
        // Test JavaScript obfuscation
        let js_content = "_0x1234['push'](_0x5678);";
        let features = detector.detect(js_content);
        assert!(features.js_obfuscation_score > 0.0);
        
        // Test PowerShell
        let ps_content = "powershell -EncodedCommand SGVsbG8=";
        let features = detector.detect(ps_content);
        assert!(features.ps_obfuscation_score > 0.0);
    }

    #[test]
    #[cfg(target_arch = "wasm32")]
    fn test_string_extraction() {
        let deobfuscator = Deobfuscator::new();
        let content = "Hello World! Some\x00binary\x01data here. Another string.";
        
        let result = deobfuscator.extract_strings(content).unwrap();
        let strings: Vec<ExtractedString> = serde_wasm_bindgen::from_value(result).unwrap();
        
        assert!(!strings.is_empty());
        assert!(strings.iter().any(|s| s.value.contains("Hello World")));
        assert!(strings.iter().any(|s| s.value.contains("Another string")));
    }

    #[test]
    fn test_ioc_extraction() {
        use crate::ml::patterns::PatternDetector;
        
        let detector = PatternDetector::new();
        let content = "Visit https://example.com or connect to 192.168.1.1 at C:\\Windows\\System32\\cmd.exe";
        
        let iocs = detector.extract_iocs(content);
        
        assert!(iocs.iter().any(|ioc| ioc.contains("https://example.com")));
        assert!(iocs.iter().any(|ioc| ioc.contains("192.168.1.1")));
        assert!(iocs.iter().any(|ioc| ioc.contains("C:\\Windows\\System32\\cmd.exe")));
    }
}
// Component Model implementation for athena:deobfuscator

wit_bindgen::generate!({
    world: "deobfuscator-component",
    path: "wit",
});

use crate::types::*;
use crate::analyzer::ObfuscationAnalyzer;
use crate::chain::DeobfuscationChain;
use crate::ml::MlPredictor;
use std::cell::RefCell;

// ============================================================================
// Component Implementation
// ============================================================================

struct Component;

// ============================================================================
// Resource: Deobfuscator
// ============================================================================

struct DeobfuscatorInstance {
    config: DeobfuscatorConfig,
    analyzer: ObfuscationAnalyzer,
    chain: DeobfuscationChain,
    ml_predictor: Option<MlPredictor>,
}

impl DeobfuscatorInstance {
    fn new() -> Self {
        Self::with_config(DeobfuscatorConfig::default())
    }

    fn with_config(config: DeobfuscatorConfig) -> Self {
        let ml_predictor = if config.enable_ml {
            Some(MlPredictor::new())
        } else {
            None
        };

        Self {
            analyzer: ObfuscationAnalyzer::new(),
            chain: DeobfuscationChain::new(config.clone()),
            config,
            ml_predictor,
        }
    }

    fn detect_internal(&self, content: &str) -> std::result::Result<exports::athena::deobfuscator::deobfuscator::ObfuscationAnalysis, String> {
        let mut analysis = self.analyzer.analyze(content);

        // Add ML predictions if enabled
        if let Some(ref predictor) = self.ml_predictor {
            let predictions = predictor.predict(content);
            analysis.ml_hints = Some(predictions);
        }

        // Convert to WIT format
        let detected_techniques: Vec<(exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique, f32)> =
            analysis.detected_techniques.iter()
                .map(|(tech, conf)| (convert_technique_to_wit(tech), *conf))
                .collect();

        let ml_hints = analysis.ml_hints.map(|ml| {
            exports::athena::deobfuscator::deobfuscator::MlPredictions {
                obfuscation_probability: ml.obfuscation_probability,
                malware_probability: ml.malware_probability,
                technique_probabilities: ml.technique_probabilities.into_iter().collect(),
            }
        });

        Ok(exports::athena::deobfuscator::deobfuscator::ObfuscationAnalysis {
            detected_techniques,
            complexity_score: analysis.complexity_score,
            ml_hints,
        })
    }

    fn deobfuscate_internal(&self, content: &str) -> std::result::Result<exports::athena::deobfuscator::deobfuscator::DeobfuscationResult, String> {
        let mut analysis = self.analyzer.analyze(content);

        // Add ML predictions if enabled
        if let Some(ref predictor) = self.ml_predictor {
            let predictions = predictor.predict(content);
            analysis.ml_hints = Some(predictions);
        }

        // Perform deobfuscation
        match self.chain.deobfuscate(content, &analysis) {
            Ok(mut result) => {
                // Add ML predictions to result
                if let Some(ref predictor) = self.ml_predictor {
                    let final_predictions = predictor.predict(&result.deobfuscated);
                    result.metadata.ml_predictions = Some(final_predictions);
                }

                // Convert to WIT format
                Ok(convert_result_to_wit(result))
            }
            Err(e) => Err(e.to_string()),
        }
    }

    fn is_obfuscated_internal(&self, content: &str) -> bool {
        let analysis = self.analyzer.analyze(content);
        analysis.complexity_score > 0.5 || !analysis.detected_techniques.is_empty()
    }
}

// ============================================================================
// Deobfuscator Interface Implementation
// ============================================================================

impl exports::athena::deobfuscator::deobfuscator::Guest for Component {
    type Deobfuscator = DeobfuscatorResource;

    fn new() -> exports::athena::deobfuscator::deobfuscator::Deobfuscator {
        exports::athena::deobfuscator::deobfuscator::Deobfuscator::new(
            DeobfuscatorResource::new(DeobfuscatorInstance::new())
        )
    }

    fn with_config(config: exports::athena::deobfuscator::deobfuscator::DeobfuscatorConfig) -> exports::athena::deobfuscator::deobfuscator::Deobfuscator {
        let internal_config = DeobfuscatorConfig {
            max_layers: config.max_layers,
            min_confidence: config.min_confidence,
            enable_ml: config.enable_ml,
            timeout_ms: config.timeout_ms,
            extract_strings: config.extract_strings,
            detect_packers: config.detect_packers,
        };
        exports::athena::deobfuscator::deobfuscator::Deobfuscator::new(
            DeobfuscatorResource::new(DeobfuscatorInstance::with_config(internal_config))
        )
    }

    fn detect_obfuscation(handle: exports::athena::deobfuscator::deobfuscator::Deobfuscator, content: String) -> std::result::Result<exports::athena::deobfuscator::deobfuscator::ObfuscationAnalysis, String> {
        handle.get::<DeobfuscatorResource>().instance.borrow().detect_internal(&content)
    }

    fn deobfuscate(handle: exports::athena::deobfuscator::deobfuscator::Deobfuscator, content: String) -> std::result::Result<exports::athena::deobfuscator::deobfuscator::DeobfuscationResult, String> {
        handle.get::<DeobfuscatorResource>().instance.borrow().deobfuscate_internal(&content)
    }

    fn is_obfuscated(handle: exports::athena::deobfuscator::deobfuscator::Deobfuscator, content: String) -> bool {
        handle.get::<DeobfuscatorResource>().instance.borrow().is_obfuscated_internal(&content)
    }

    fn get_supported_techniques() -> Vec<exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique> {
        vec![
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::Base64Encoding,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::HexEncoding,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::UnicodeEscape,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::UrlEncoding,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::HtmlEntityEncoding,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::CharcodeConcat,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::StringReverse,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::JsEvalChain,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::JsPackedCode,
            exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique::PsEncodedCommand,
        ]
    }
}

// ============================================================================
// Deobfuscator Resource Implementation
// ============================================================================

struct DeobfuscatorResource {
    instance: RefCell<DeobfuscatorInstance>,
}

impl DeobfuscatorResource {
    fn new(instance: DeobfuscatorInstance) -> Self {
        Self {
            instance: RefCell::new(instance),
        }
    }
}

impl exports::athena::deobfuscator::deobfuscator::GuestDeobfuscator for DeobfuscatorResource {
    fn new() -> Self {
        Self::new(DeobfuscatorInstance::new())
    }

    fn detect(&self, content: String) -> std::result::Result<exports::athena::deobfuscator::deobfuscator::ObfuscationAnalysis, String> {
        self.instance.borrow().detect_internal(&content)
    }

    fn deobfuscate(&self, content: String) -> std::result::Result<exports::athena::deobfuscator::deobfuscator::DeobfuscationResult, String> {
        self.instance.borrow().deobfuscate_internal(&content)
    }

    fn is_obfuscated(&self, content: String) -> bool {
        self.instance.borrow().is_obfuscated_internal(&content)
    }
}

// ============================================================================
// Helper Functions - Conversion
// ============================================================================

fn convert_technique_to_wit(technique: &ObfuscationTechnique) -> exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique {
    use exports::athena::deobfuscator::deobfuscator::ObfuscationTechnique as WitTech;

    match technique {
        ObfuscationTechnique::Base64Encoding => WitTech::Base64Encoding,
        ObfuscationTechnique::HexEncoding => WitTech::HexEncoding,
        ObfuscationTechnique::UnicodeEscape => WitTech::UnicodeEscape,
        ObfuscationTechnique::UrlEncoding => WitTech::UrlEncoding,
        ObfuscationTechnique::HtmlEntityEncoding => WitTech::HtmlEntityEncoding,
        ObfuscationTechnique::CharCodeConcat => WitTech::CharcodeConcat,
        ObfuscationTechnique::StringReverse => WitTech::StringReverse,
        ObfuscationTechnique::StringSplit => WitTech::StringSplit,
        ObfuscationTechnique::StringReplace => WitTech::StringReplace,
        ObfuscationTechnique::XorEncryption { key } => WitTech::XorEncryption(key.clone()),
        ObfuscationTechnique::Rc4Encryption => WitTech::Rc4Encryption,
        ObfuscationTechnique::SimpleSubstitution => WitTech::SimpleSubstitution,
        ObfuscationTechnique::AesEncryption => WitTech::BinaryEncrypted, // Map to generic binary encrypted
        ObfuscationTechnique::DesEncryption => WitTech::BinaryEncrypted, // Map to generic binary encrypted
        ObfuscationTechnique::CryptoConstants { algorithm } => WitTech::CustomEncoding(format!("crypto:{}", algorithm)),
        ObfuscationTechnique::JsEvalChain => WitTech::JsEvalChain,
        ObfuscationTechnique::JsPackedCode => WitTech::JsPackedCode,
        ObfuscationTechnique::JsObfuscatorIo => WitTech::JsObfuscatorIo,
        ObfuscationTechnique::JsFunctionConstructor => WitTech::JsFunctionConstructor,
        ObfuscationTechnique::JsUglified => WitTech::JsUglified,
        ObfuscationTechnique::PsEncodedCommand => WitTech::PsEncodedCommand,
        ObfuscationTechnique::PsCompressed => WitTech::PsCompressed,
        ObfuscationTechnique::PsStringReplace => WitTech::PsStringReplace,
        ObfuscationTechnique::PsInvokeExpression => WitTech::PsInvokeExpression,
        ObfuscationTechnique::BinaryPacked => WitTech::BinaryPacked,
        ObfuscationTechnique::BinaryCompressed => WitTech::BinaryCompressed,
        ObfuscationTechnique::BinaryEncrypted => WitTech::BinaryEncrypted,
        ObfuscationTechnique::ControlFlowFlattening => WitTech::ControlFlowFlattening,
        ObfuscationTechnique::DeadCodeInjection => WitTech::DeadCodeInjection,
        ObfuscationTechnique::OpaquePredicates => WitTech::OpaquePredicates,
        ObfuscationTechnique::CustomEncoding(s) => WitTech::CustomEncoding(s.clone()),
    }
}

fn convert_result_to_wit(result: DeobfuscationResult) -> exports::athena::deobfuscator::deobfuscator::DeobfuscationResult {
    let techniques_applied: Vec<exports::athena::deobfuscator::deobfuscator::AppliedTechnique> =
        result.techniques_applied.iter()
            .map(|at| exports::athena::deobfuscator::deobfuscator::AppliedTechnique {
                technique: convert_technique_to_wit(&at.technique),
                confidence: at.confidence,
                layer: at.layer,
                context: at.context.clone(),
            })
            .collect();

    let extracted_strings: Vec<exports::athena::deobfuscator::deobfuscator::ExtractedString> =
        result.metadata.extracted_strings.iter()
            .map(|es| exports::athena::deobfuscator::deobfuscator::ExtractedString {
                value: es.value.clone(),
                confidence: es.confidence,
                context: es.context.clone(),
                offset: es.offset as u64,
            })
            .collect();

    let ml_predictions = result.metadata.ml_predictions.map(|ml| {
        exports::athena::deobfuscator::deobfuscator::MlPredictions {
            obfuscation_probability: ml.obfuscation_probability,
            malware_probability: ml.malware_probability,
            technique_probabilities: ml.technique_probabilities.into_iter().collect(),
        }
    });

    let metadata = exports::athena::deobfuscator::deobfuscator::DeobfuscationMetadata {
        entropy_before: result.metadata.entropy_before,
        entropy_after: result.metadata.entropy_after,
        layers_detected: result.metadata.layers_detected,
        processing_time_ms: result.metadata.processing_time_ms,
        suspicious_patterns: result.metadata.suspicious_patterns,
        extracted_strings,
        ml_predictions,
    };

    exports::athena::deobfuscator::deobfuscator::DeobfuscationResult {
        original: result.original,
        deobfuscated: result.deobfuscated,
        techniques_applied,
        confidence: result.confidence,
        metadata,
    }
}

// ============================================================================
// Export Component Implementations
// ============================================================================

export!(Component);

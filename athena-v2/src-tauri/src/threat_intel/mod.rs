pub mod stix_parser;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIntelligence {
    pub source: String,
    pub timestamp: u64,
    pub indicators: Vec<ThreatIndicator>,
    pub malware_family: Option<String>,
    pub campaigns: Option<Vec<String>>,
    pub actors: Option<Vec<String>>,
    pub ttps: Vec<String>,
    pub references: Vec<String>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatIndicator {
    pub indicator_type: String,
    pub value: String,
    pub confidence: f32,
    pub first_seen: Option<u64>,
    pub last_seen: Option<u64>,
    pub tags: Vec<String>,
    pub description: Option<String>,
}


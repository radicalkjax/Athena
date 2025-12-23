use super::{ThreatIndicator, ThreatIntelligence};
use anyhow::{Context, Result};
use rust_stix2::{bundles::Bundle, domain_objects::sdo::DomainObjectType, object::StixObject};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Parse STIX 2.x JSON bundle into our ThreatIntelligence format
pub fn parse_stix_bundle(stix_json: &str) -> Result<Vec<ThreatIntelligence>> {
    let bundle = Bundle::from_json(stix_json).context("Failed to parse STIX bundle")?;

    let mut threat_intel_list = Vec::new();
    let objects = bundle.get_objects();

    for obj in objects {
        match obj {
            StixObject::Sdo(sdo) => {
                let threat_intel = match &sdo.object_type {
                    DomainObjectType::Indicator(indicator) => {
                        parse_indicator(indicator, &sdo)
                    }
                    DomainObjectType::Malware(malware) => {
                        parse_malware(malware, &sdo)
                    }
                    DomainObjectType::AttackPattern(attack_pattern) => {
                        parse_attack_pattern(attack_pattern, &sdo)
                    }
                    DomainObjectType::ThreatActor(actor) => {
                        parse_threat_actor(actor, &sdo)
                    }
                    DomainObjectType::Campaign(campaign) => {
                        parse_campaign(campaign, &sdo)
                    }
                    _ => None, // Skip other object types
                };

                if let Some(intel) = threat_intel {
                    threat_intel_list.push(intel);
                }
            }
            _ => continue, // Skip non-SDO objects
        }
    }

    Ok(threat_intel_list)
}

fn parse_indicator(
    indicator: &rust_stix2::domain_objects::sdo_types::Indicator,
    sdo: &rust_stix2::domain_objects::sdo::DomainObject,
) -> Option<ThreatIntelligence> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_secs();

    let description = indicator.description.clone();

    // Parse STIX pattern to extract IOC value and type
    let (ioc_type, ioc_value) = parse_stix_pattern(&indicator.pattern);

    let indicators_vec = vec![ThreatIndicator {
        indicator_type: ioc_type,
        value: ioc_value,
        confidence: 70.0, // Default confidence
        first_seen: None, // Timestamps are not easily accessible in current API
        last_seen: None,
        tags: indicator.indicator_types.clone().unwrap_or_default(),
        description: description.clone(),
    }];

    // Extract external references by serializing the DomainObject to JSON
    // This is the recommended way since fields are private
    let references: Vec<String> = sdo
        .common_properties
        .external_references
        .as_ref()
        .map(|refs| {
            refs.iter()
                .filter_map(|r| {
                    // Serialize ExternalReference to JSON to access fields
                    serde_json::to_value(r).ok().and_then(|v| {
                        let source = v.get("source_name")?.as_str()?;
                        let url = v.get("url").and_then(|u| u.as_str());
                        if let Some(url_str) = url {
                            Some(format!("{}: {}", source, url_str))
                        } else {
                            Some(source.to_string())
                        }
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Some(ThreatIntelligence {
        source: "STIX".to_string(),
        timestamp,
        indicators: indicators_vec,
        malware_family: None,
        campaigns: None,
        actors: None,
        ttps: vec![],
        references,
        confidence: 70.0,
    })
}

fn parse_malware(
    malware: &rust_stix2::domain_objects::sdo_types::Malware,
    sdo: &rust_stix2::domain_objects::sdo::DomainObject,
) -> Option<ThreatIntelligence> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_secs();

    let name = malware.name.clone().unwrap_or_else(|| "Unknown".to_string());
    let description = malware.description.clone();

    let indicators = vec![ThreatIndicator {
        indicator_type: "malware".to_string(),
        value: name.clone(),
        confidence: 80.0,
        first_seen: None,
        last_seen: None,
        tags: malware.malware_types.clone().unwrap_or_default(),
        description,
    }];

    let references: Vec<String> = sdo
        .common_properties
        .external_references
        .as_ref()
        .map(|refs| {
            refs.iter()
                .filter_map(|r| {
                    serde_json::to_value(r).ok().and_then(|v| {
                        let source = v.get("source_name")?.as_str()?;
                        let url = v.get("url").and_then(|u| u.as_str());
                        if let Some(url_str) = url {
                            Some(format!("{}: {}", source, url_str))
                        } else {
                            Some(source.to_string())
                        }
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Some(ThreatIntelligence {
        source: "STIX".to_string(),
        timestamp,
        indicators,
        malware_family: Some(name),
        campaigns: None,
        actors: None,
        ttps: vec![],
        references,
        confidence: 80.0,
    })
}

fn parse_attack_pattern(
    attack_pattern: &rust_stix2::domain_objects::sdo_types::AttackPattern,
    sdo: &rust_stix2::domain_objects::sdo::DomainObject,
) -> Option<ThreatIntelligence> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_secs();

    let name = attack_pattern.name.clone();

    let references: Vec<String> = sdo
        .common_properties
        .external_references
        .as_ref()
        .map(|refs| {
            refs.iter()
                .filter_map(|r| {
                    serde_json::to_value(r).ok().and_then(|v| {
                        let source = v.get("source_name")?.as_str()?;
                        let url = v.get("url").and_then(|u| u.as_str());
                        if let Some(url_str) = url {
                            Some(format!("{}: {}", source, url_str))
                        } else {
                            Some(source.to_string())
                        }
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Some(ThreatIntelligence {
        source: "STIX".to_string(),
        timestamp,
        indicators: vec![],
        malware_family: None,
        campaigns: None,
        actors: None,
        ttps: vec![name],
        references,
        confidence: 75.0,
    })
}

fn parse_threat_actor(
    actor: &rust_stix2::domain_objects::sdo_types::ThreatActor,
    sdo: &rust_stix2::domain_objects::sdo::DomainObject,
) -> Option<ThreatIntelligence> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_secs();

    let name = actor.name.clone();

    let references: Vec<String> = sdo
        .common_properties
        .external_references
        .as_ref()
        .map(|refs| {
            refs.iter()
                .filter_map(|r| {
                    serde_json::to_value(r).ok().and_then(|v| {
                        let source = v.get("source_name")?.as_str()?;
                        let url = v.get("url").and_then(|u| u.as_str());
                        if let Some(url_str) = url {
                            Some(format!("{}: {}", source, url_str))
                        } else {
                            Some(source.to_string())
                        }
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Some(ThreatIntelligence {
        source: "STIX".to_string(),
        timestamp,
        indicators: vec![],
        malware_family: None,
        campaigns: None,
        actors: Some(vec![name]),
        ttps: vec![],
        references,
        confidence: 75.0,
    })
}

fn parse_campaign(
    campaign: &rust_stix2::domain_objects::sdo_types::Campaign,
    sdo: &rust_stix2::domain_objects::sdo::DomainObject,
) -> Option<ThreatIntelligence> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_secs();

    let name = campaign.name.clone();

    let references: Vec<String> = sdo
        .common_properties
        .external_references
        .as_ref()
        .map(|refs| {
            refs.iter()
                .filter_map(|r| {
                    serde_json::to_value(r).ok().and_then(|v| {
                        let source = v.get("source_name")?.as_str()?;
                        let url = v.get("url").and_then(|u| u.as_str());
                        if let Some(url_str) = url {
                            Some(format!("{}: {}", source, url_str))
                        } else {
                            Some(source.to_string())
                        }
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Some(ThreatIntelligence {
        source: "STIX".to_string(),
        timestamp,
        indicators: vec![],
        malware_family: None,
        campaigns: Some(vec![name]),
        actors: None,
        ttps: vec![],
        references,
        confidence: 75.0,
    })
}

/// Parse STIX pattern like "[file:hashes.MD5 = 'abc123']" into (type, value)
fn parse_stix_pattern(pattern: &str) -> (String, String) {
    // Simple pattern parsing
    if pattern.contains("file:hashes") {
        if let Some(hash_start) = pattern.find('\'') {
            if let Some(hash_end) = pattern[hash_start + 1..].find('\'') {
                let hash = &pattern[hash_start + 1..hash_start + 1 + hash_end];
                return ("hash".to_string(), hash.to_string());
            }
        }
    } else if pattern.contains("ipv4-addr:value") || pattern.contains("ipv6-addr:value") {
        if let Some(ip_start) = pattern.find('\'') {
            if let Some(ip_end) = pattern[ip_start + 1..].find('\'') {
                let ip = &pattern[ip_start + 1..ip_start + 1 + ip_end];
                return ("ip".to_string(), ip.to_string());
            }
        }
    } else if pattern.contains("domain-name:value") {
        if let Some(domain_start) = pattern.find('\'') {
            if let Some(domain_end) = pattern[domain_start + 1..].find('\'') {
                let domain = &pattern[domain_start + 1..domain_start + 1 + domain_end];
                return ("domain".to_string(), domain.to_string());
            }
        }
    } else if pattern.contains("url:value") {
        if let Some(url_start) = pattern.find('\'') {
            if let Some(url_end) = pattern[url_start + 1..].find('\'') {
                let url = &pattern[url_start + 1..url_start + 1 + url_end];
                return ("url".to_string(), url.to_string());
            }
        }
    }

    ("unknown".to_string(), pattern.to_string())
}

/// Load STIX data from MITRE ATT&CK or other STIX feeds
pub async fn load_mitre_attack_stix() -> Result<Vec<ThreatIntelligence>> {
    // Fetch from MITRE ATT&CK STIX repository
    let url = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";

    // Create properly configured reqwest Client per DeepWiki best practices
    // (reusing Client is critical for connection pooling and performance)
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .connect_timeout(std::time::Duration::from_secs(10))
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .pool_max_idle_per_host(10)
        .use_rustls_tls()
        .build()
        .context("Failed to create HTTP client")?;

    let response = client
        .get(url)
        .send()
        .await
        .context("Failed to fetch MITRE ATT&CK data")?;

    let stix_json = response
        .text()
        .await
        .context("Failed to read MITRE ATT&CK response")?;

    parse_stix_bundle(&stix_json)
}

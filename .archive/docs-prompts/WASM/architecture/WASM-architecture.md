# WASM-First Infrastructure Plan: Secure Speed-to-Market MVP
## WebAssembly Security with Pragmatic Cloud Deployment

**A WASM-powered architecture that delivers military-grade security isolation while maintaining rapid deployment and bootstrap economics.**

---

## Executive Summary: WASM Security + Cloud Speed

This updated plan leverages **WebAssembly's perfect isolation** for malware analysis while using **cloud-native deployment** for rapid market entry. We gain the security advantages of WASM sandboxing without sacrificing development velocity or operational simplicity.

### **Updated Architecture Principles:**
- **🔒 WASM-First Security:** Perfect isolation for malware analysis using WebAssembly sandboxes
- **⚡ Speed-to-Market:** 6-month MVP with cloud-native deployment on AWS
- **🌐 Multi-Provider AI:** WASM-secured preprocessing for OpenAI, Anthropic, Google APIs
- **📦 Hybrid Deployment:** WASM modules + containerized services for best of both worlds
- **💰 Bootstrap Economics:** Managed services to minimize operational overhead
- **🚀 Edge-Ready:** WASM modules can deploy to edge locations for global performance

### **WASM-Enhanced Technology Stack:**
- **Core Analysis:** **Rust → WASM** modules with **Wasmtime** runtime for perfect isolation
- **Backend:** **FastAPI** with embedded WASM engine for secure file processing
- **Frontend:** **React/TypeScript** with optional client-side WASM for preview
- **Database:** **PostgreSQL** container with persistent volumes
- **AI Integration:** **Multi-provider** with WASM-sanitized inputs for safety
- **Storage:** **MinIO** container for S3-compatible object storage with WASM-determined quarantine policies
- **Deployment:** **Docker Compose** with all services containerized (no cloud dependencies)
- **Security:** **WASM sandboxing** + **Traefik** reverse proxy + **Fail2ban** intrusion prevention

---

## Phase 1: 6-Month WASM-Secured MVP
## Perfect Isolation + Cloud Deployment

### **Core WASM Security Engine**

#### **Rust Analysis Module Architecture**
```rust
// analysis-engine/src/lib.rs - Enhanced WASM security module
use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
pub struct WasmThreatAssessment {
    pub threat_level: String,           // safe, suspicious, dangerous, critical
    pub confidence: f64,                // 0.0 to 1.0
    pub risk_score: u32,               // 0-100
    pub indicators: Vec<String>,        // Security indicators found
    pub yara_matches: Vec<String>,      // YARA-style rule matches
    pub quarantine_required: bool,      // Should file be quarantined
    pub ai_analysis_safe: bool,        // Safe to send to AI providers
    pub file_metadata: FileMetadata,   // Extracted metadata
    pub processing_time_ms: u32,       // Analysis duration
}

#[derive(Serialize, Deserialize)]
pub struct FileMetadata {
    pub file_hash: String,
    pub file_size: u32,
    pub file_type: String,
    pub entropy: f64,
    pub pe_characteristics: Option<PeMetadata>,
    pub string_analysis: StringAnalysis,
    pub behavioral_indicators: Vec<String>,
    pub packer_detected: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct PeMetadata {
    pub is_executable: bool,
    pub is_dll: bool,
    pub compile_timestamp: Option<u64>,
    pub suspicious_sections: Vec<String>,
    pub imported_apis: Vec<String>,
    pub export_count: u32,
    pub digital_signature: bool,
}

#[derive(Serialize, Deserialize)]
pub struct StringAnalysis {
    pub total_strings: u32,
    pub suspicious_strings: Vec<String>,
    pub urls_found: Vec<String>,
    pub crypto_indicators: Vec<String>,
    pub obfuscation_detected: bool,
}

#[wasm_bindgen]
pub struct SecureMalwareAnalyzer {
    yara_engine: YaraEngine,
    api_patterns: HashMap<String, u32>,
    string_patterns: HashMap<String, u32>,
    entropy_threshold: f64,
    size_limits: SizeLimits,
}

pub struct YaraEngine {
    rules: Vec<SecurityRule>,
    crypto_patterns: Vec<String>,
    network_patterns: Vec<String>,
    persistence_patterns: Vec<String>,
}

pub struct SecurityRule {
    name: String,
    category: String,
    patterns: Vec<String>,
    weight: u32,
    requires_quarantine: bool,
}

pub struct SizeLimits {
    max_file_size: u32,
    max_analysis_time_ms: u32,
    max_strings_to_extract: u32,
}

#[wasm_bindgen]
impl SecureMalwareAnalyzer {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SecureMalwareAnalyzer {
        console_log!("Initializing WASM Secure Malware Analyzer v2.0");
        
        let security_rules = vec![
            SecurityRule {
                name: "CriticalAPIs".to_string(),
                category: "dangerous_apis".to_string(),
                patterns: vec![
                    "CreateRemoteThread".to_string(),
                    "WriteProcessMemory".to_string(),
                    "VirtualAllocEx".to_string(),
                    "SetWindowsHookEx".to_string(),
                    "DllMain".to_string(),
                    "ExitWindowsEx".to_string(),
                ],
                weight: 40,
                requires_quarantine: true,
            },
            SecurityRule {
                name: "RansomwareIndicators".to_string(),
                category: "ransomware".to_string(),
                patterns: vec![
                    "CryptEncrypt".to_string(),
                    "CryptGenKey".to_string(),
                    ".encrypt".to_string(),
                    ".locked".to_string(),
                    "README_DECRYPT".to_string(),
                    "bitcoin".to_string(),
                ],
                weight: 50,
                requires_quarantine: true,
            },
            SecurityRule {
                name: "NetworkExfiltration".to_string(),
                category: "network".to_string(),
                patterns: vec![
                    "InternetOpen".to_string(),
                    "HttpSendRequest".to_string(),
                    "FtpPutFile".to_string(),
                    "send".to_string(),
                    "WSAConnect".to_string(),
                ],
                weight: 30,
                requires_quarantine: false,
            },
            SecurityRule {
                name: "SystemPersistence".to_string(),
                category: "persistence".to_string(),
                patterns: vec![
                    "RegSetValue".to_string(),
                    "CreateService".to_string(),
                    "SetFileAttributes".to_string(),
                    "HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run".to_string(),
                ],
                weight: 35,
                requires_quarantine: false,
            },
        ];
        
        let yara_engine = YaraEngine {
            rules: security_rules,
            crypto_patterns: vec![
                "AES".to_string(),
                "RSA".to_string(), 
                "SHA256".to_string(),
                "MD5".to_string(),
            ],
            network_patterns: vec![
                "http://".to_string(),
                "https://".to_string(),
                "ftp://".to_string(),
                "tcp://".to_string(),
            ],
            persistence_patterns: vec![
                "startup".to_string(),
                "autorun".to_string(),
                "service".to_string(),
                "registry".to_string(),
            ],
        };
        
        SecureMalwareAnalyzer {
            yara_engine,
            api_patterns: HashMap::new(),
            string_patterns: HashMap::new(),
            entropy_threshold: 7.0,
            size_limits: SizeLimits {
                max_file_size: 100 * 1024 * 1024, // 100MB
                max_analysis_time_ms: 30000,       // 30 seconds
                max_strings_to_extract: 10000,     // 10k strings max
            },
        }
    }
    
    /// Perform complete security analysis in WASM sandbox
    #[wasm_bindgen]
    pub fn analyze_file_secure(&self, file_data: &[u8], filename: &str) -> String {
        let start_time = js_sys::Date::now();
        
        console_log!("WASM: Analyzing {} ({} bytes)", filename, file_data.len());
        
        // Size validation
        if file_data.len() > self.size_limits.max_file_size as usize {
            return self.create_error_result("File too large for analysis");
        }
        
        // Extract comprehensive metadata
        let metadata = self.extract_comprehensive_metadata(file_data, filename);
        
        // Perform threat assessment
        let mut assessment = self.assess_security_threats(&metadata, file_data);
        
        // Calculate processing time
        let processing_time = js_sys::Date::now() - start_time;
        assessment.processing_time_ms = processing_time as u32;
        
        // Serialize result
        serde_json::to_string(&assessment).unwrap_or_else(|_| {
            self.create_error_result("Analysis serialization failed")
        })
    }
    
    fn extract_comprehensive_metadata(&self, file_data: &[u8], filename: &str) -> FileMetadata {
        let file_hash = self.calculate_sha256(file_data);
        let entropy = self.calculate_entropy(file_data);
        let file_type = self.detect_file_type(file_data, filename);
        
        // PE analysis if applicable
        let pe_characteristics = if self.is_pe_file(file_data) {
            Some(self.analyze_pe_structure(file_data))
        } else {
            None
        };
        
        // String analysis
        let string_analysis = self.analyze_strings(file_data);
        
        // Behavioral indicators
        let behavioral_indicators = self.detect_behavioral_patterns(file_data);
        
        // Packer detection
        let packer_detected = self.detect_packers(file_data);
        
        FileMetadata {
            file_hash,
            file_size: file_data.len() as u32,
            file_type,
            entropy,
            pe_characteristics,
            string_analysis,
            behavioral_indicators,
            packer_detected,
        }
    }
    
    fn assess_security_threats(&self, metadata: &FileMetadata, file_data: &[u8]) -> WasmThreatAssessment {
        let mut risk_score = 0u32;
        let mut indicators = Vec::new();
        let mut yara_matches = Vec::new();
        let mut quarantine_required = false;
        
        // High entropy analysis
        if metadata.entropy > self.entropy_threshold {
            risk_score += 30;
            indicators.push(format!("High entropy: {:.2} (threshold: {:.2})", metadata.entropy, self.entropy_threshold));
        }
        
        // PE analysis
        if let Some(ref pe_info) = metadata.pe_characteristics {
            risk_score += self.analyze_pe_threats(pe_info, &mut indicators);
        }
        
        // String analysis threats
        risk_score += self.analyze_string_threats(&metadata.string_analysis, &mut indicators);
        
        // YARA rule matching
        for rule in &self.yara_engine.rules {
            if self.check_rule_match(rule, file_data) {
                yara_matches.push(rule.name.clone());
                risk_score += rule.weight;
                indicators.push(format!("Matched rule: {}", rule.name));
                
                if rule.requires_quarantine {
                    quarantine_required = true;
                }
            }
        }
        
        // Behavioral pattern analysis
        for pattern in &metadata.behavioral_indicators {
            risk_score += 15;
            indicators.push(format!("Behavioral indicator: {}", pattern));
        }
        
        // Packer detection
        if !metadata.packer_detected.is_empty() {
            risk_score += 25;
            quarantine_required = true; // Packed files require careful analysis
            indicators.push("Packed/obfuscated binary detected".to_string());
        }
        
        // Critical risk threshold
        if risk_score > 80 {
            quarantine_required = true;
        }
        
        // Determine threat level and confidence
        let (threat_level, confidence) = self.calculate_threat_level(risk_score, &indicators);
        
        WasmThreatAssessment {
            threat_level,
            confidence,
            risk_score: std::cmp::min(risk_score, 100),
            indicators,
            yara_matches,
            quarantine_required,
            ai_analysis_safe: !quarantine_required && risk_score < 60,
            file_metadata: metadata.clone(),
            processing_time_ms: 0, // Set by caller
        }
    }
    
    fn create_error_result(&self, error: &str) -> String {
        let error_assessment = WasmThreatAssessment {
            threat_level: "unknown".to_string(),
            confidence: 0.1,
            risk_score: 50,
            indicators: vec![format!("Analysis error: {}", error)],
            yara_matches: vec![],
            quarantine_required: true, // Err on side of caution
            ai_analysis_safe: false,
            file_metadata: FileMetadata {
                file_hash: "unknown".to_string(),
                file_size: 0,
                file_type: "unknown".to_string(),
                entropy: 0.0,
                pe_characteristics: None,
                string_analysis: StringAnalysis {
                    total_strings: 0,
                    suspicious_strings: vec![],
                    urls_found: vec![],
                    crypto_indicators: vec![],
                    obfuscation_detected: false,
                },
                behavioral_indicators: vec![],
                packer_detected: vec![],
            },
            processing_time_ms: 0,
        };
        
        serde_json::to_string(&error_assessment).unwrap_or_else(|_| {
            r#"{"threat_level":"unknown","confidence":0.1,"risk_score":50,"indicators":["Critical error"],"quarantine_required":true,"ai_analysis_safe":false}"#.to_string()
        })
    }
}
```

### **FastAPI Backend with WASM Integration**

#### **Python WASM Runtime Manager**
```python
# src/wasm/secure_runtime.py - Enhanced WASM runtime with Docker support
import asyncio
import logging
import json
import time
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import wasmtime
import hashlib

logger = logging.getLogger(__name__)

@dataclass
class WasmSecurityResult:
    threat_level: str
    confidence: float
    risk_score: int
    indicators: List[str]
    yara_matches: List[str]
    quarantine_required: bool
    ai_analysis_safe: bool
    file_metadata: Dict[str, Any]
    processing_time_ms: int

class SecureWasmRuntime:
    """Enhanced WASM runtime for containerized deployment"""
    
    def __init__(self, wasm_module_path: str = "/app/wasm/analysis_engine.wasm"):
        self.wasm_module_path = Path(wasm_module_path)
        self.engine = None
        self.module = None
        self.module_hash = None
        self.max_instances = 10
        self.instance_pool = []
        self.active_analyses = {}
        self._initialize_wasm_engine()
    
    def _initialize_wasm_engine(self):
        """Initialize WASM engine with security constraints"""
        try:
            # Configure WASM engine with security limits
            config = wasmtime.Config()
            config.wasm_simd = False  # Disable SIMD for security
            config.wasm_bulk_memory = False  # Disable bulk memory
            config.wasm_multi_memory = False  # Single memory space
            config.consume_fuel = True  # Enable fuel for execution limits
            
            self.engine = wasmtime.Engine(config)
            
            # Load and validate WASM module
            if not self.wasm_module_path.exists():
                raise FileNotFoundError(f"WASM module not found: {self.wasm_module_path}")
            
            module_bytes = self.wasm_module_path.read_bytes()
            self.module_hash = hashlib.sha256(module_bytes).hexdigest()
            self.module = wasmtime.Module(self.engine, module_bytes)
            
            # Pre-create instance pool
            self._create_instance_pool()
            
            logger.info(f"WASM engine initialized - Module hash: {self.module_hash[:8]}...")
            
        except Exception as e:
            logger.error(f"Failed to initialize WASM engine: {e}")
            raise
    
    def _create_instance_pool(self):
        """Pre-create WASM instances for performance"""
        for i in range(self.max_instances):
            try:
                store = wasmtime.Store(self.engine)
                store.set_fuel(1000000)  # Limit execution fuel
                instance = wasmtime.Instance(store, self.module, [])
                self.instance_pool.append((store, instance))
            except Exception as e:
                logger.warning(f"Failed to create WASM instance {i}: {e}")
    
    async def analyze_file_secure(
        self, 
        file_data: bytes, 
        filename: str,
        analysis_id: str = None
    ) -> WasmSecurityResult:
        """Analyze file with complete WASM isolation"""
        
        if analysis_id is None:
            analysis_id = hashlib.sha256(file_data + filename.encode()).hexdigest()[:16]
        
        if not self.instance_pool:
            raise RuntimeError("No WASM instances available")
        
        # Get instance from pool
        store, instance = self.instance_pool.pop(0)
        
        try:
            self.active_analyses[analysis_id] = time.time()
            
            # Reset fuel for this analysis
            store.set_fuel(1000000)
            
            # Get WASM exports
            exports = instance.exports(store)
            analyzer_class = exports["SecureMalwareAnalyzer"]
            memory = exports["memory"]
            
            # Create analyzer instance
            analyzer = analyzer_class(store)
            
            # Allocate memory for file data
            file_size = len(file_data)
            if file_size > 100 * 1024 * 1024:  # 100MB limit
                raise SecurityError("File too large for WASM analysis")
            
            # Allocate memory in WASM
            alloc_func = exports["__wbindgen_malloc"]
            data_ptr = alloc_func(store, file_size)
            
            # Copy file data to WASM memory
            memory_data = memory.data(store)
            memory_data[data_ptr:data_ptr + file_size] = file_data
            
            # Call analysis function with timeout
            analyze_func = analyzer.analyze_file_secure
            result_json = await asyncio.wait_for(
                asyncio.to_thread(analyze_func, store, data_ptr, file_size, filename),
                timeout=30.0  # 30 second timeout
            )
            
            # Clean up WASM memory
            free_func = exports["__wbindgen_free"]
            free_func(store, data_ptr, file_size)
            
            # Parse result
            result_dict = json.loads(result_json)
            
            return WasmSecurityResult(
                threat_level=result_dict.get("threat_level", "unknown"),
                confidence=result_dict.get("confidence", 0.0),
                risk_score=result_dict.get("risk_score", 50),
                indicators=result_dict.get("indicators", []),
                yara_matches=result_dict.get("yara_matches", []),
                quarantine_required=result_dict.get("quarantine_required", True),
                ai_analysis_safe=result_dict.get("ai_analysis_safe", False),
                file_metadata=result_dict.get("file_metadata", {}),
                processing_time_ms=result_dict.get("processing_time_ms", 0)
            )
            
        except asyncio.TimeoutError:
            logger.error(f"WASM analysis timeout for {analysis_id}")
            raise SecurityError("Analysis timed out - potential infinite loop")
        except Exception as e:
            logger.error(f"WASM analysis failed for {analysis_id}: {e}")
            raise SecurityError(f"WASM analysis failed: {str(e)}")
        finally:
            # Return instance to pool
            self.instance_pool.append((store, instance))
            self.active_analyses.pop(analysis_id, None)
    
    def get_runtime_stats(self) -> Dict[str, Any]:
        """Get runtime statistics"""
        return {
            "engine_type": "wasmtime_secure",
            "module_hash": self.module_hash,
            "available_instances": len(self.instance_pool),
            "active_analyses": len(self.active_analyses),
            "max_instances": self.max_instances,
            "module_path": str(self.wasm_module_path),
            "security_features": [
                "memory_isolation",
                "execution_fuel_limits", 
                "simd_disabled",
                "bulk_memory_disabled",
                "timeout_protection"
            ]
        }

class SecurityError(Exception):
    """WASM security-related error"""
    pass
```

### **Docker Compose Deployment Configuration**

#### **Complete Self-Hosted Docker Compose**
```yaml
# docker-compose.prod.yml - Fully self-hosted production deployment
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: malware_analyzer_db
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-malware_analyzer}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
      - ./backups:/backups
    networks:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
    command: >
      postgres
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=200
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c work_mem=4MB
      -c maintenance_work_mem=64MB

  # MinIO Object Storage (S3-compatible)
  minio:
    image: minio/minio:latest
    container_name: malware_analyzer_storage
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin123}
      MINIO_REGION_NAME: us-east-1
    volumes:
      - minio_data:/data
    networks:
      - backend
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'

  # Redis Cache & Session Store
  redis:
    image: redis:7-alpine
    container_name: malware_analyzer_cache
    command: >
      redis-server
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf
    networks:
      - backend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'

  # WASM-Powered Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
      target: production
    container_name: malware_analyzer_api
    environment:
      # Database
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-malware_analyzer}
      
      # Redis
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      
      # MinIO Object Storage
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin123}
      MINIO_SECURE: false
      MINIO_BUCKET_UPLOADS: malware-uploads
      MINIO_BUCKET_QUARANTINE: malware-quarantine
      
      # AI Providers
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GOOGLE_API_KEY: ${GOOGLE_API_KEY}
      
      # Security
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      
      # WASM Configuration
      WASM_MODULE_PATH: /app/wasm/analysis_engine.wasm
      WASM_MAX_INSTANCES: 10
      WASM_EXECUTION_TIMEOUT: 30
      
      # File Processing
      MAX_FILE_SIZE: 104857600  # 100MB
      QUARANTINE_HIGH_RISK: true
      
      # Application
      ENVIRONMENT: production
      LOG_LEVEL: INFO
      CORS_ORIGINS: https://${DOMAIN_NAME:-localhost}
      
    volumes:
      - ./logs:/app/logs
      - ./temp:/app/temp
    networks:
      - backend
      - frontend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`${DOMAIN_NAME:-localhost}`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.routers.backend.middlewares=security-headers,rate-limit"
      - "traefik.http.services.backend.loadbalancer.server.port=8000"
      # Rate limiting
      - "traefik.http.middlewares.rate-limit.ratelimit.burst=20"
      - "traefik.http.middlewares.rate-limit.ratelimit.average=10"
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
      replicas: 2
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m

  # React Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.frontend
      target: production
    container_name: malware_analyzer_web
    environment:
      REACT_APP_API_URL: https://${DOMAIN_NAME:-localhost}/api
      REACT_APP_ENVIRONMENT: production
      REACT_APP_WASM_FEATURES: enabled
      REACT_APP_MAX_FILE_SIZE: 104857600
    networks:
      - frontend
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`${DOMAIN_NAME:-localhost}`)"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.routers.frontend.middlewares=security-headers"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /var/cache/nginx:noexec,nosuid,size=50m
      - /var/run:noexec,nosuid,size=10m

  # Traefik Reverse Proxy with SSL & Security
  traefik:
    image: traefik:v3.0
    container_name: malware_analyzer_proxy
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--log.level=INFO"
      - "--accesslog=true"
      - "--metrics.prometheus=true"
      - "--api.insecure=false"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard (secure this in production)
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/letsencrypt:/letsencrypt
      - ./traefik/config:/etc/traefik/dynamic
      - ./logs/traefik:/var/log/traefik
    networks:
      - frontend
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      # Dashboard
      - "traefik.http.routers.traefik.rule=Host(`traefik.${DOMAIN_NAME:-localhost}`)"
      - "traefik.http.routers.traefik.tls.certresolver=letsencrypt"
      - "traefik.http.routers.traefik.service=api@internal"
      # Secure dashboard with auth
      - "traefik.http.routers.traefik.middlewares=auth"
      - "traefik.http.middlewares.auth.basicauth.users=${TRAEFIK_AUTH}"
      # Security headers
      - "traefik.http.middlewares.security-headers.headers.frameDeny=true"
      - "traefik.http.middlewares.security-headers.headers.contentTypeNosniff=true"
      - "traefik.http.middlewares.security-headers.headers.browserXssFilter=true"
      - "traefik.http.middlewares.security-headers.headers.referrerPolicy=strict-origin-when-cross-origin"
      - "traefik.http.middlewares.security-headers.headers.customRequestHeaders.X-Forwarded-Proto=https"
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
    security_opt:
      - no-new-privileges:true

  # Fail2ban Intrusion Prevention
  fail2ban:
    image: crazymax/fail2ban:latest
    container_name: malware_analyzer_fail2ban
    network_mode: "host"
    cap_add:
      - NET_ADMIN
      - NET_RAW
    volumes:
      - ./fail2ban/config:/etc/fail2ban
      - ./logs:/var/log:ro
      - fail2ban_data:/data
    environment:
      F2B_LOG_TARGET: STDOUT
      F2B_LOG_LEVEL: INFO
      F2B_DB_PURGE_AGE: 30d
    restart: unless-stopped
    depends_on:
      - traefik
    profiles:
      - security

  # ClamAV Antivirus Scanner
  clamav:
    image: clamav/clamav:latest
    container_name: malware_analyzer_antivirus
    volumes:
      - clamav_data:/var/lib/clamav
      - ./logs/clamav:/var/log/clamav
    networks:
      - backend
    restart: unless-stopped
    environment:
      CLAMAV_NO_FRESHCLAMD: false
      CLAMAV_NO_CLAMD: false
    healthcheck:
      test: ["CMD", "clamdscan", "--ping"]
      interval: 60s
      timeout: 10s
      retries: 3
      start_period: 300s  # ClamAV needs time to update signatures
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '0.5'
    profiles:
      - security

  # Wazuh Security Monitoring (OSSEC successor)
  wazuh:
    image: wazuh/wazuh-manager:4.7.0
    container_name: malware_analyzer_siem
    hostname: wazuh-manager
    restart: unless-stopped
    environment:
      WAZUH_MANAGER_ROOT_CA_PATH: /var/ossec/etc/rootCA.pem
      WAZUH_MANAGER_ADMIN_CERTS_PATH: /var/ossec/etc/manager.pem
      WAZUH_MANAGER_ADMIN_KEY_PATH: /var/ossec/etc/manager.key
    volumes:
      - wazuh_config:/wazuh-config-mount
      - wazuh_data:/var/ossec/data
      - ./logs:/var/log/host:ro
      - ./wazuh/config:/var/ossec/etc/shared/default
    networks:
      - backend
    ports:
      - "1514:1514/udp"  # Syslog
      - "1515:1515"      # Agent enrollment
      - "55000:55000"    # API
    profiles:
      - security
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'

  # HashiCorp Vault for Secrets Management
  vault:
    image: hashicorp/vault:1.15
    container_name: malware_analyzer_vault
    command: ["vault", "server", "-config=/vault/config/vault.hcl"]
    cap_add:
      - IPC_LOCK
    volumes:
      - ./vault/config:/vault/config
      - vault_data:/vault/data
      - vault_logs:/vault/logs
    networks:
      - backend
    ports:
      - "8200:8200"
    environment:
      VAULT_ADDR: http://0.0.0.0:8200
      VAULT_LOCAL_CONFIG: |
        {
          "backend": {"file": {"path": "/vault/data"}},
          "listener": {"tcp": {"address": "0.0.0.0:8200", "tls_disable": true}},
          "default_lease_ttl": "168h",
          "max_lease_ttl": "720h",
          "ui": true
        }
    restart: unless-stopped
    profiles:
      - security
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.vault.rule=Host(`vault.${DOMAIN_NAME:-localhost}`)"
      - "traefik.http.routers.vault.tls.certresolver=letsencrypt"
      - "traefik.http.services.vault.loadbalancer.server.port=8200"
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'

  # Background Job Worker
  worker:
    build:
      context: .
      dockerfile: Dockerfile.backend
      target: production
    container_name: malware_analyzer_worker
    command: python -m src.worker
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-malware_analyzer}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin123}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      WASM_MODULE_PATH: /app/wasm/analysis_engine.wasm
      WORKER_CONCURRENCY: 4
    volumes:
      - ./logs:/app/logs
      - ./temp:/app/temp
    networks:
      - backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
      replicas: 2
    security_opt:
      - no-new-privileges:true

  # PostgreSQL Backup Service
  postgres-backup:
    image: postgres:15-alpine
    container_name: malware_analyzer_backup
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-malware_analyzer}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGPASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - ./backups:/backups
      - ./backup-scripts:/scripts
    networks:
      - backend
    depends_on:
      - postgres
    restart: "no"
    command: >
      sh -c "
      while true; do
        sleep 86400
        echo 'Starting backup...'
        pg_dump -h postgres -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-malware_analyzer} > /backups/backup_$(date +%Y%m%d_%H%M%S).sql
        echo 'Backup completed'
        find /backups -name '*.sql' -mtime +7 -delete
      done
      "
    profiles:
      - backup

  # MinIO Client for bucket management
  minio-client:
    image: minio/mc:latest
    container_name: malware_analyzer_mc
    environment:
      MC_HOST_minio: http://${MINIO_ACCESS_KEY:-minioadmin}:${MINIO_SECRET_KEY:-minioadmin123}@minio:9000
    networks:
      - backend
    depends_on:
      - minio
    restart: "no"
    command: >
      sh -c "
      sleep 10
      mc alias set minio http://minio:9000 ${MINIO_ACCESS_KEY:-minioadmin} ${MINIO_SECRET_KEY:-minioadmin123}
      mc mb minio/malware-uploads --ignore-existing
      mc mb minio/malware-quarantine --ignore-existing
      mc policy set public minio/malware-uploads
      mc policy set private minio/malware-quarantine
      echo 'MinIO buckets configured'
      "
    profiles:
      - setup

  # Log Aggregation (Optional)
  loki:
    image: grafana/loki:2.9.0
    container_name: malware_analyzer_loki
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./monitoring/loki-config.yaml:/etc/loki/local-config.yaml
      - loki_data:/loki
    networks:
      - backend
    restart: unless-stopped
    profiles:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'

  # Metrics Collection (Optional)
  prometheus:
    image: prom/prometheus:latest
    container_name: malware_analyzer_metrics
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - backend
    restart: unless-stopped
    profiles:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'

  # Monitoring Dashboard (Optional)
  grafana:
    image: grafana/grafana:latest
    container_name: malware_analyzer_dashboard
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin123}
      GF_USERS_ALLOW_SIGN_UP: false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    networks:
      - backend
      - frontend
    ports:
      - "3001:3000"
    restart: unless-stopped
    profiles:
      - monitoring
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'

volumes:
  postgres_data:
    driver: local
  minio_data:
    driver: local
  redis_data:
    driver: local
  loki_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  fail2ban_data:
    driver: local
  clamav_data:
    driver: local
  wazuh_config:
    driver: local
  wazuh_data:
    driver: local
  vault_data:
    driver: local
  vault_logs:
    driver: local

networks:
  frontend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24
  backend:
    driver: bridge
    internal: true
    ipam:
      config:
        - subnet: 172.21.0.0/24
```

#### **Development Docker Compose**
```yaml
# docker-compose.dev.yml - Development environment
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: malware_analyzer_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
      target: development
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/malware_analyzer_dev
      REDIS_URL: redis://redis:6379/0
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      JWT_SECRET_KEY: dev-secret-key-change-in-production
      WASM_MODULE_PATH: /app/wasm/analysis_engine.wasm
      ENVIRONMENT: development
      LOG_LEVEL: DEBUG
    volumes:
      - ./src:/app/src
      - ./wasm:/app/wasm
      - ./data/uploads:/app/data/uploads
      - ./data/quarantine:/app/data/quarantine
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    develop:
      watch:
        - action: rebuild
          path: requirements.txt
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: ./wasm/analysis_engine.wasm

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.frontend
      target: development
    ports:
      - "3000:3000"
    environment:
      REACT_APP_API_URL: http://localhost:8000
      REACT_APP_ENVIRONMENT: development
      REACT_APP_WASM_FEATURES: enabled
    volumes:
      - ./frontend/src:/app/src
      - ./frontend/public:/app/public
    develop:
      watch:
        - action: sync
          path: ./frontend/src
          target: /app/src

  # WASM Development Builder
  wasm-builder:
    build:
      context: .
      dockerfile: Dockerfile.wasm
    volumes:
      - ./analysis-engine:/workspace
      - ./wasm:/output
    command: /workspace/build.sh
    profiles:
      - wasm-dev

volumes:
  postgres_dev_data:
```

#### **Enhanced Backend Configuration**
```python
# src/storage/minio_client.py - MinIO integration for object storage
import logging
from typing import Optional, Dict, Any, List
from minio import Minio
from minio.error import S3Error
from io import BytesIO
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class MinIOStorageManager:
    """MinIO-based object storage for file management"""
    
    def __init__(self):
        self.client = Minio(
            endpoint=os.getenv("MINIO_ENDPOINT", "minio:9000"),
            access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
            secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin123"),
            secure=os.getenv("MINIO_SECURE", "false").lower() == "true"
        )
        
        self.upload_bucket = os.getenv("MINIO_BUCKET_UPLOADS", "malware-uploads")
        self.quarantine_bucket = os.getenv("MINIO_BUCKET_QUARANTINE", "malware-quarantine")
        
        self._ensure_buckets_exist()
    
    def _ensure_buckets_exist(self):
        """Ensure required buckets exist"""
        try:
            for bucket in [self.upload_bucket, self.quarantine_bucket]:
                if not self.client.bucket_exists(bucket):
                    self.client.make_bucket(bucket)
                    logger.info(f"Created MinIO bucket: {bucket}")
        except S3Error as e:
            logger.error(f"Failed to create buckets: {e}")
            raise
    
    async def store_file(
        self, 
        file_content: bytes, 
        file_hash: str, 
        organization_id: str,
        quarantine: bool = False,
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """Store file in appropriate bucket"""
        
        bucket = self.quarantine_bucket if quarantine else self.upload_bucket
        object_name = f"{organization_id}/{file_hash}"
        
        # Prepare metadata
        file_metadata = {
            'organization_id': organization_id,
            'upload_timestamp': datetime.utcnow().isoformat(),
            'file_size': str(len(file_content)),
            'quarantined': str(quarantine),
            **(metadata or {})
        }
        
        try:
            file_stream = BytesIO(file_content)
            
            self.client.put_object(
                bucket_name=bucket,
                object_name=object_name,
                data=file_stream,
                length=len(file_content),
                metadata=file_metadata
            )
            
            logger.info(f"File stored: {bucket}/{object_name} (quarantine: {quarantine})")
            return f"{bucket}/{object_name}"
            
        except S3Error as e:
            logger.error(f"Failed to store file: {e}")
            raise
    
    async def retrieve_file(self, storage_path: str) -> bytes:
        """Retrieve file content from storage"""
        try:
            bucket, object_name = storage_path.split('/', 1)
            
            response = self.client.get_object(bucket, object_name)
            content = response.read()
            response.close()
            response.release_conn()
            
            return content
            
        except S3Error as e:
            logger.error(f"Failed to retrieve file {storage_path}: {e}")
            raise
    
    async def get_file_metadata(self, storage_path: str) -> Dict[str, Any]:
        """Get file metadata"""
        try:
            bucket, object_name = storage_path.split('/', 1)
            
            stat = self.client.stat_object(bucket, object_name)
            
            return {
                'size': stat.size,
                'etag': stat.etag,
                'last_modified': stat.last_modified,
                'metadata': stat.metadata or {},
                'bucket': bucket,
                'object_name': object_name
            }
            
        except S3Error as e:
            logger.error(f"Failed to get metadata for {storage_path}: {e}")
            raise
    
    async def delete_file(self, storage_path: str) -> bool:
        """Delete file from storage"""
        try:
            bucket, object_name = storage_path.split('/', 1)
            
            self.client.remove_object(bucket, object_name)
            logger.info(f"File deleted: {storage_path}")
            return True
            
        except S3Error as e:
            logger.error(f"Failed to delete file {storage_path}: {e}")
            return False
    
    async def list_organization_files(
        self, 
        organization_id: str, 
        bucket_type: str = "upload",
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List files for an organization"""
        
        bucket = self.upload_bucket if bucket_type == "upload" else self.quarantine_bucket
        prefix = f"{organization_id}/"
        
        try:
            objects = self.client.list_objects(
                bucket, 
                prefix=prefix, 
                recursive=True
            )
            
            files = []
            for obj in objects:
                files.append({
                    'object_name': obj.object_name,
                    'size': obj.size,
                    'last_modified': obj.last_modified,
                    'etag': obj.etag,
                    'storage_path': f"{bucket}/{obj.object_name}"
                })
                
                if len(files) >= limit:
                    break
            
            return files
            
        except S3Error as e:
            logger.error(f"Failed to list files for {organization_id}: {e}")
            return []
    
    async def cleanup_old_files(self, days_old: int = 30) -> int:
        """Clean up files older than specified days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        deleted_count = 0
        
        for bucket in [self.upload_bucket, self.quarantine_bucket]:
            try:
                objects = self.client.list_objects(bucket, recursive=True)
                
                for obj in objects:
                    if obj.last_modified < cutoff_date:
                        self.client.remove_object(bucket, obj.object_name)
                        deleted_count += 1
                        logger.info(f"Cleaned up old file: {bucket}/{obj.object_name}")
                        
            except S3Error as e:
                logger.error(f"Failed to cleanup bucket {bucket}: {e}")
        
        return deleted_count
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get storage statistics"""
        stats = {
            'buckets': {},
            'total_objects': 0,
            'total_size': 0
        }
        
        for bucket in [self.upload_bucket, self.quarantine_bucket]:
            try:
                objects = list(self.client.list_objects(bucket, recursive=True))
                bucket_size = sum(obj.size for obj in objects)
                
                stats['buckets'][bucket] = {
                    'object_count': len(objects),
                    'size_bytes': bucket_size
                }
                
                stats['total_objects'] += len(objects)
                stats['total_size'] += bucket_size
                
            except S3Error as e:
                logger.error(f"Failed to get stats for bucket {bucket}: {e}")
                stats['buckets'][bucket] = {'error': str(e)}
        
        return stats

# src/config.py - Updated configuration for self-hosted services
import os
from functools import lru_cache
from typing import Optional

class Settings:
    """Application settings"""
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/malware_analyzer"
    )
    
    # Redis
    REDIS_URL: str = os.getenv(
        "REDIS_URL",
        "redis://localhost:6379/0"
    )
    
    # MinIO Object Storage
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    MINIO_BUCKET_UPLOADS: str = os.getenv("MINIO_BUCKET_UPLOADS", "malware-uploads")
    MINIO_BUCKET_QUARANTINE: str = os.getenv("MINIO_BUCKET_QUARANTINE", "malware-quarantine")
    
    # AI Providers
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    GOOGLE_API_KEY: Optional[str] = os.getenv("GOOGLE_API_KEY")
    
    # Security
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "your-encryption-key-32-bytes!!")
    
    # WASM Configuration
    WASM_MODULE_PATH: str = os.getenv("WASM_MODULE_PATH", "/app/wasm/analysis_engine.wasm")
    WASM_MAX_INSTANCES: int = int(os.getenv("WASM_MAX_INSTANCES", "10"))
    WASM_EXECUTION_TIMEOUT: int = int(os.getenv("WASM_EXECUTION_TIMEOUT", "30"))
    
    # File Processing
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "104857600"))  # 100MB
    QUARANTINE_HIGH_RISK: bool = os.getenv("QUARANTINE_HIGH_RISK", "true").lower() == "true"
    
    # Application
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    
    @property
    def cors_origins_list(self) -> list:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

#### **Backend Dockerfile with WASM**
```dockerfile
# Dockerfile.backend - Multi-stage build with WASM
FROM rust:1.70 as wasm-builder

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build WASM module
WORKDIR /workspace
COPY analysis-engine/ ./
RUN wasm-pack build --target bundler --out-dir pkg --release

# Development stage
FROM python:3.11-slim as development

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libmagic1 \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Copy WASM module
COPY --from=wasm-builder /workspace/pkg/analysis_engine.wasm ./wasm/

# Create data directories
RUN mkdir -p data/uploads data/quarantine logs

# Development server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production stage
FROM python:3.11-slim as production

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libmagic1 \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN useradd --create-home --shell /bin/bash --uid 1000 appuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=appuser:appuser src/ ./src/

# Copy WASM module
COPY --from=wasm-builder --chown=appuser:appuser /workspace/pkg/analysis_engine.wasm ./wasm/

# Create data directories
RUN mkdir -p data/uploads data/quarantine logs \
    && chown -R appuser:appuser data logs

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

# Production server
CMD ["gunicorn", "src.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

#### **WASM Builder Dockerfile**
```dockerfile
# Dockerfile.wasm - Dedicated WASM builder
FROM rust:1.70

# Install wasm-pack and build tools
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
RUN rustup target add wasm32-unknown-unknown

# Install development tools
RUN cargo install wasm-pack
RUN cargo install basic-http-server

WORKDIR /workspace

# Copy build script
COPY analysis-engine/build.sh /workspace/
RUN chmod +x /workspace/build.sh

# Default command
CMD ["/workspace/build.sh"]
```

### **Open-Source Security Stack Configuration**

#### **Traefik Configuration**
```yaml
# traefik/config/security.yml - Dynamic security configuration
http:
  middlewares:
    # Security headers
    security-headers:
      headers:
        frameDeny: true
        contentTypeNosniff: true
        browserXssFilter: true
        referrerPolicy: "strict-origin-when-cross-origin"
        forceSTSHeader: true
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000
        customRequestHeaders:
          X-Forwarded-Proto: "https"
        customResponseHeaders:
          X-Robots-Tag: "noindex,nofollow,nosnippet,noarchive"
          server: ""
    
    # Rate limiting
    api-rate-limit:
      rateLimit:
        burst: 20
        average: 10
        sourceCriterion:
          requestHeaderName: "X-Real-IP"
    
    upload-rate-limit:
      rateLimit:
        burst: 5
        average: 2
        sourceCriterion:
          requestHeaderName: "X-Real-IP"
    
    # IP whitelist for admin endpoints
    admin-whitelist:
      ipWhiteList:
        sourceRange:
          - "127.0.0.1/32"
          - "10.0.0.0/8"
          - "172.16.0.0/12"
          - "192.168.0.0/16"
    
    # Basic auth for sensitive endpoints
    admin-auth:
      basicAuth:
        users:
          - "admin:$2y$10$your-bcrypt-hash-here"
```

#### **Fail2ban Configuration**
```ini
# fail2ban/config/jail.local - Intrusion prevention rules
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = auto

[traefik-auth]
enabled = true
filter = traefik-auth
logpath = /var/log/traefik/access.log
maxretry = 3
bantime = 7200

[traefik-botsearch]
enabled = true
filter = traefik-botsearch
logpath = /var/log/traefik/access.log
maxretry = 2
bantime = 86400

[malware-analyzer-api]
enabled = true
filter = malware-analyzer-api
logpath = /var/log/malware-analyzer/app.log
maxretry = 10
bantime = 3600

[ssh]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400
```

```ini
# fail2ban/config/filter.d/traefik-auth.conf
[Definition]
failregex = ^.*"401 Unauthorized".*"<HOST>".*$
ignoreregex =
```

```ini
# fail2ban/config/filter.d/malware-analyzer-api.conf
[Definition]
failregex = ^.*\[ERROR\].*Invalid.*token.*from.*<HOST>.*$
            ^.*\[WARNING\].*Suspicious.*activity.*from.*<HOST>.*$
            ^.*\[ERROR\].*Authentication.*failed.*<HOST>.*$
ignoreregex =
```

#### **Wazuh SIEM Configuration**
```xml
<!-- wazuh/config/ossec.conf - Security monitoring rules -->
<ossec_config>
  <global>
    <jsonout_output>yes</jsonout_output>
    <alerts_log>yes</alerts_log>
    <logall>no</logall>
    <logall_json>no</logall_json>
    <email_notification>yes</email_notification>
    <smtp_server>localhost</smtp_server>
    <email_from>wazuh@malware-analyzer.local</email_from>
    <email_to>admin@yourcompany.com</email_to>
  </global>

  <alerts>
    <log_alert_level>3</log_alert_level>
    <email_alert_level>12</email_alert_level>
  </alerts>

  <!-- Monitor application logs -->
  <localfile>
    <log_format>json</log_format>
    <location>/var/log/host/malware-analyzer/app.log</location>
  </localfile>

  <!-- Monitor Traefik access logs -->
  <localfile>
    <log_format>json</log_format>
    <location>/var/log/host/traefik/access.log</location>
  </localfile>

  <!-- Custom rules for malware analysis platform -->
  <rules>
    <include>rules_config.xml</include>
    <include>local_rules.xml</include>
    <include>malware_analyzer_rules.xml</include>
  </rules>
</ossec_config>
```

```xml
<!-- wazuh/config/rules/malware_analyzer_rules.xml -->
<group name="malware_analyzer,">
  
  <!-- High-risk file upload detected -->
  <rule id="100001" level="10">
    <decoded_as>json</decoded_as>
    <field name="message">quarantine_required.*true</field>
    <description>High-risk malware file quarantined</description>
    <mitre>
      <id>T1566</id>
    </mitre>
  </rule>

  <!-- Multiple failed authentication attempts -->
  <rule id="100002" level="8">
    <decoded_as>json</decoded_as>
    <field name="level">ERROR</field>
    <field name="message">Authentication failed</field>
    <frequency>5</frequency>
    <timeframe>300</timeframe>
    <description>Multiple authentication failures</description>
  </rule>

  <!-- WASM analysis engine failure -->
  <rule id="100003" level="12">
    <decoded_as>json</decoded_as>
    <field name="message">WASM.*analysis.*failed</field>
    <description>WASM analysis engine failure - potential security issue</description>
  </rule>

  <!-- Unusual file upload patterns -->
  <rule id="100004" level="6">
    <decoded_as>json</decoded_as>
    <field name="endpoint">/api/analysis/upload</field>
    <frequency>20</frequency>
    <timeframe>300</timeframe>
    <description>High volume of file uploads from single source</description>
  </rule>

</group>
```

#### **HashiCorp Vault Configuration**
```hcl
# vault/config/vault.hcl - Secrets management
ui = true
disable_mlock = true

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

api_addr = "http://0.0.0.0:8200"
cluster_addr = "http://0.0.0.0:8201"

# Auto-unseal with transit engine (for production)
# seal "transit" {
#   address         = "https://vault.yourcompany.com:8200"
#   token           = "s.your-token-here"
#   disable_renewal = "false"
#   key_name        = "autounseal"
#   mount_path      = "transit/"
#   tls_skip_verify = "false"
# }

log_level = "Info"
raw_storage_endpoint = true
cluster_name = "malware-analyzer-vault"
```

#### **Enhanced Backend Security Integration**
```python
# src/security/security_manager.py - Integrated security services
import logging
import asyncio
import aiohttp
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import json

logger = logging.getLogger(__name__)

class SecurityManager:
    """Centralized security management using open-source tools"""
    
    def __init__(self):
        self.clamav_host = "clamav"
        self.clamav_port = 3310
        self.vault_url = "http://vault:8200"
        self.wazuh_api_url = "http://wazuh:55000"
        self.fail2ban_log_path = "/var/log/malware-analyzer/security.log"
    
    async def scan_file_with_clamav(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Scan file with ClamAV antivirus"""
        try:
            # Connect to ClamAV daemon
            reader, writer = await asyncio.open_connection(self.clamav_host, self.clamav_port)
            
            # Send INSTREAM command
            writer.write(b"zINSTREAM\0")
            
            # Send file size and content
            chunk_size = 4096
            for i in range(0, len(file_content), chunk_size):
                chunk = file_content[i:i + chunk_size]
                writer.write(len(chunk).to_bytes(4, byteorder='big'))
                writer.write(chunk)
            
            # End of stream
            writer.write(b'\0\0\0\0')
            await writer.drain()
            
            # Read response
            response = await reader.read(1024)
            writer.close()
            await writer.wait_closed()
            
            result = response.decode('utf-8').strip()
            
            is_infected = "FOUND" in result
            threat_name = result.split(":")[1].strip() if ":" in result else None
            
            scan_result = {
                "scanner": "clamav",
                "filename": filename,
                "is_infected": is_infected,
                "threat_name": threat_name,
                "raw_result": result,
                "scan_time": datetime.utcnow().isoformat()
            }
            
            if is_infected:
                await self._log_security_event("malware_detected", {
                    "filename": filename,
                    "threat": threat_name,
                    "scanner": "clamav"
                })
            
            return scan_result
            
        except Exception as e:
            logger.error(f"ClamAV scan failed: {e}")
            return {
                "scanner": "clamav",
                "filename": filename,
                "is_infected": False,
                "error": str(e),
                "scan_time": datetime.utcnow().isoformat()
            }
    
    async def get_secret_from_vault(self, secret_path: str) -> Optional[Dict[str, Any]]:
        """Retrieve secret from HashiCorp Vault"""
        try:
            vault_token = os.getenv("VAULT_TOKEN")
            if not vault_token:
                logger.warning("VAULT_TOKEN not set, skipping Vault integration")
                return None
            
            headers = {"X-Vault-Token": vault_token}
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.vault_url}/v1/secret/data/{secret_path}",
                    headers=headers
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("data", {}).get("data", {})
                    else:
                        logger.error(f"Vault request failed: {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"Failed to retrieve secret from Vault: {e}")
            return None
    
    async def store_secret_in_vault(self, secret_path: str, secret_data: Dict[str, Any]) -> bool:
        """Store secret in HashiCorp Vault"""
        try:
            vault_token = os.getenv("VAULT_TOKEN")
            if not vault_token:
                logger.warning("VAULT_TOKEN not set, skipping Vault integration")
                return False
            
            headers = {
                "X-Vault-Token": vault_token,
                "Content-Type": "application/json"
            }
            
            payload = {"data": secret_data}
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.vault_url}/v1/secret/data/{secret_path}",
                    headers=headers,
                    json=payload
                ) as response:
                    success = response.status in [200, 204]
                    if not success:
                        logger.error(f"Vault store failed: {response.status}")
                    return success
                    
        except Exception as e:
            logger.error(f"Failed to store secret in Vault: {e}")
            return False
    
    async def check_ip_reputation(self, ip_address: str) -> Dict[str, Any]:
        """Check IP reputation using multiple open-source threat feeds"""
        reputation_result = {
            "ip": ip_address,
            "is_malicious": False,
            "threat_sources": [],
            "reputation_score": 0,
            "check_time": datetime.utcnow().isoformat()
        }
        
        # Add checks against open threat intelligence feeds
        threat_feeds = [
            "https://raw.githubusercontent.com/stamparm/ipsum/master/ipsum.txt",
            "https://feodotracker.abuse.ch/downloads/ipblocklist.txt",
        ]
        
        try:
            async with aiohttp.ClientSession() as session:
                for feed_url in threat_feeds:
                    try:
                        async with session.get(feed_url, timeout=5) as response:
                            if response.status == 200:
                                content = await response.text()
                                if ip_address in content:
                                    reputation_result["is_malicious"] = True
                                    reputation_result["threat_sources"].append(feed_url)
                                    reputation_result["reputation_score"] += 25
                    except Exception as e:
                        logger.warning(f"Failed to check threat feed {feed_url}: {e}")
            
            if reputation_result["is_malicious"]:
                await self._log_security_event("malicious_ip_detected", {
                    "ip": ip_address,
                    "sources": reputation_result["threat_sources"]
                })
            
            return reputation_result
            
        except Exception as e:
            logger.error(f"IP reputation check failed: {e}")
            reputation_result["error"] = str(e)
            return reputation_result
    
    async def _log_security_event(self, event_type: str, event_data: Dict[str, Any]):
        """Log security events for Wazuh SIEM consumption"""
        try:
            security_event = {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": event_type,
                "source": "malware_analyzer_security",
                "level": "WARNING" if "detected" in event_type else "INFO",
                "data": event_data
            }
            
            # Write to security log file (monitored by Wazuh)
            with open(self.fail2ban_log_path, "a") as f:
                f.write(json.dumps(security_event) + "\n")
            
            logger.info(f"Security event logged: {event_type}")
            
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")

# src/middleware/security_middleware.py - Enhanced security middleware
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer
import ipaddress
from typing import Set
import time

class EnhancedSecurityMiddleware:
    """Enhanced security middleware with open-source integrations"""
    
    def __init__(self):
        self.security_manager = SecurityManager()
        self.rate_limit_cache: Dict[str, List[float]] = {}
        self.blocked_ips: Set[str] = set()
        self.suspicious_patterns = [
            "script",
            "javascript:",
            "<script",
            "eval(",
            "expression(",
            "vbscript:",
            "onload=",
            "onerror="
        ]
    
    async def __call__(self, request: Request, call_next):
        """Process request through security checks"""
        
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # Check if IP is blocked
        if client_ip in self.blocked_ips:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Rate limiting
        if not self._check_rate_limit(client_ip):
            await self.security_manager._log_security_event("rate_limit_exceeded", {
                "ip": client_ip,
                "endpoint": str(request.url)
            })
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        
        # Input validation
        await self._validate_request_input(request)
        
        # Check IP reputation for suspicious endpoints
        if request.url.path.startswith("/api/analysis/upload"):
            reputation = await self.security_manager.check_ip_reputation(client_ip)
            if reputation["is_malicious"]:
                self.blocked_ips.add(client_ip)
                raise HTTPException(status_code=403, detail="Access denied - malicious IP")
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract real client IP from request"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return str(request.client.host) if request.client else "unknown"
    
    def _check_rate_limit(self, client_ip: str, max_requests: int = 100, time_window: int = 60) -> bool:
        """Check if client IP is within rate limits"""
        current_time = time.time()
        
        if client_ip not in self.rate_limit_cache:
            self.rate_limit_cache[client_ip] = []
        
        # Clean old entries
        self.rate_limit_cache[client_ip] = [
            timestamp for timestamp in self.rate_limit_cache[client_ip]
            if current_time - timestamp < time_window
        ]
        
        # Check rate limit
        if len(self.rate_limit_cache[client_ip]) >= max_requests:
            return False
        
        # Add current request
        self.rate_limit_cache[client_ip].append(current_time)
        return True
    
    async def _validate_request_input(self, request: Request):
        """Validate request input for common attacks"""
        
        # Check query parameters
        for param, value in request.query_params.items():
            if any(pattern in value.lower() for pattern in self.suspicious_patterns):
                await self.security_manager._log_security_event("suspicious_input_detected", {
                    "type": "query_param",
                    "param": param,
                    "value": value[:100],  # Truncate for logging
                    "ip": self._get_client_ip(request)
                })
                raise HTTPException(status_code=400, detail="Invalid input detected")
        
        # Check headers for injection attempts
        for header, value in request.headers.items():
            if any(pattern in value.lower() for pattern in self.suspicious_patterns):
                await self.security_manager._log_security_event("suspicious_header_detected", {
                    "header": header,
                    "value": value[:100],
                    "ip": self._get_client_ip(request)
                })
                raise HTTPException(status_code=400, detail="Invalid header detected")
```

### **Environment Configuration**
```bash
# .env.production - Production environment variables
# Database
POSTGRES_DB=malware_analyzer
POSTGRES_USER=dbuser
POSTGRES_PASSWORD=your-secure-db-password-change-this

# Redis
REDIS_PASSWORD=your-secure-redis-password-change-this

# MinIO Object Storage
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-secure-minio-secret-key-change-this
MINIO_SECURE=false

# Security Stack
TRAEFIK_AUTH=admin:$2y$10$your-bcrypt-hash-for-traefik-dashboard
VAULT_TOKEN=your-vault-root-token-change-this
ACME_EMAIL=your-email@yourcompany.com

# Security
JWT_SECRET_KEY=your-jwt-secret-key-256-bit-change-this
ENCRYPTION_KEY=your-encryption-key-32-bytes-change!!

# AI Providers
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
GOOGLE_API_KEY=your-google-api-key

# Application
DOMAIN_NAME=malware-analyzer.yourcompany.com
ENVIRONMENT=production

# Monitoring (Optional)
GRAFANA_PASSWORD=your-secure-grafana-password
```

### **Deployment & Management Scripts**
```bash
#!/bin/bash
# deploy.sh - Complete self-hosted deployment

set -e

echo "🚀 Deploying Self-Hosted WASM Malware Analyzer..."

# Check if .env file exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found. Please create it first."
    echo "📋 Copy .env.example and fill in your values."
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env.production | xargs)

echo "🔧 Building WASM analysis engine..."
docker compose -f docker-compose.prod.yml --profile setup build wasm-builder
docker compose -f docker-compose.prod.yml --profile setup run --rm wasm-builder

# Initialize MinIO buckets
echo "🪣 Setting up MinIO buckets..."
docker compose -f docker-compose.prod.yml --profile setup up -d minio
sleep 10
docker compose -f docker-compose.prod.yml --profile setup run --rm minio-client

# Initialize Vault (if using)
if [[ "${VAULT_TOKEN}" ]]; then
    echo "🔐 Initializing HashiCorp Vault..."
    docker compose -f docker-compose.prod.yml --profile security up -d vault
    sleep 15
    
    # Vault will auto-initialize on first run
    echo "📝 Vault is ready at: https://vault.${DOMAIN_NAME:-localhost}"
fi

# Start security services
echo "🛡️ Starting security stack..."
docker compose -f docker-compose.prod.yml --profile security up -d fail2ban clamav wazuh

# Build application services
echo "🏗️ Building application containers..."
docker compose -f docker-compose.prod.yml build

# Start core services
echo "🔄 Starting core services..."
docker compose -f docker-compose.prod.yml up -d postgres redis minio

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 30

# Start application services
echo "🚀 Starting application services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for application to be ready
echo "⏳ Waiting for application to start..."
sleep 30

# Run health checks
echo "🏥 Running health checks..."
if docker compose -f docker-compose.prod.yml exec -T backend curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend service healthy"
else
    echo "❌ Backend service not responding"
    exit 1
fi

if docker compose -f docker-compose.prod.yml exec -T frontend wget --spider -q http://localhost:80/ > /dev/null 2>&1; then
    echo "✅ Frontend service healthy"
else
    echo "❌ Frontend service not responding"
    exit 1
fi

# Show status
echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Application URLs:"
echo "   Main App: http://${DOMAIN_NAME:-localhost}"
echo "   MinIO Console: http://${DOMAIN_NAME:-localhost}:9001"
echo "   API Health: http://${DOMAIN_NAME:-localhost}/api/health"
echo ""
echo "📊 Monitoring (if enabled):"
echo "   Grafana: http://${DOMAIN_NAME:-localhost}:3001"
echo ""
echo "🛠️ Management commands:"
echo "   View logs: docker compose -f docker-compose.prod.yml logs -f"
echo "   Stop services: docker compose -f docker-compose.prod.yml down"
echo "   Restart: docker compose -f docker-compose.prod.yml restart"
echo ""

# Optional: Start monitoring stack
read -p "🔍 Start monitoring stack? (y/N): " start_monitoring
if [[ $start_monitoring =~ ^[Yy]$ ]]; then
    echo "📊 Starting monitoring services..."
    docker compose -f docker-compose.prod.yml --profile monitoring up -d
    echo "✅ Monitoring stack started"
fi

echo "🎉 WASM Malware Analyzer is now running!"
```

### **Backup Script**
```bash
#!/bin/bash
# backup.sh - Automated backup script

set -e

BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "💾 Starting backup process..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup PostgreSQL database
echo "🗄️ Backing up PostgreSQL database..."
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U ${POSTGRES_USER:-postgres} ${POSTGRES_DB:-malware_analyzer} > $BACKUP_DIR/database_$DATE.sql

# Backup MinIO data
echo "🪣 Backing up MinIO data..."
docker run --rm -v minio_data:/data -v $(pwd)/$BACKUP_DIR:/backup alpine tar czf /backup/minio_data_$DATE.tar.gz -C /data .

# Backup configuration
echo "⚙️ Backing up configuration..."
tar czf $BACKUP_DIR/config_$DATE.tar.gz nginx/ monitoring/ .env.production docker-compose.prod.yml

# Clean old backups (keep last 7 days)
echo "🧹 Cleaning old backups..."
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $BACKUP_DIR/"
echo "📁 Files created:"
ls -la $BACKUP_DIR/*_$DATE.*
```

### **Monitoring Configuration**
```yaml
# monitoring/prometheus.yml - Prometheus configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'malware-analyzer-backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'malware-analyzer-worker'
    static_configs:
      - targets: ['worker:8000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 60s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 60s

  - job_name: 'minio'
    static_configs:
      - targets: ['minio:9000']
    metrics_path: '/minio/v2/metrics/cluster'
    scrape_interval: 60s
```

---

## 🛡️ **Complete Open-Source Security Stack**

### **Enterprise-Grade Security Without Vendor Lock-in:**

**Traefik**: Modern reverse proxy with automatic SSL, rate limiting, and security headers
**Fail2ban**: Intrusion prevention system that automatically blocks malicious IPs
**ClamAV**: Real-time antivirus scanning for uploaded files
**Wazuh**: SIEM (Security Information and Event Management) for threat detection
**HashiCorp Vault**: Secrets management and encryption as a service
**Open threat feeds**: IP reputation checking against community threat intelligence

### **🔒 Enhanced Security Features:**

#### **Multi-Layered Protection**
- **WASM sandboxing** - Perfect isolation for malware analysis
- **Traefik rate limiting** - Automatic DDoS protection
- **Fail2ban intrusion prevention** - Blocks brute force attacks
- **ClamAV antivirus** - Real-time malware detection
- **Wazuh SIEM** - Advanced threat detection and alerting
- **IP reputation checking** - Blocks known malicious sources

#### **Automated SSL & Security Headers**
- **Let's Encrypt integration** - Automatic SSL certificate management
- **Security headers** - HSTS, CSP, X-Frame-Options, etc.
- **Perfect Forward Secrecy** - Enhanced encryption protection
- **TLS 1.3 support** - Latest encryption standards

#### **Advanced Monitoring & Alerting**
- **Real-time threat detection** with Wazuh SIEM
- **Security event correlation** across all services
- **Automated incident response** via Fail2ban
- **Compliance reporting** for SOC2/ISO27001

### **💰 Cost & Competitive Advantages:**

#### **Zero Vendor Lock-in**
- **100% open-source** security stack
- **No licensing fees** or per-user costs
- **Community support** and active development
- **Enterprise features** without enterprise pricing

#### **Superior to AWS Security**
- **More flexible** than AWS WAF and GuardDuty
- **Better visibility** with full access to logs and configs
- **Faster response times** - no cloud API delays
- **Custom rules** tailored to malware analysis workloads

#### **Professional Security Posture**
- **Enterprise-grade** protection using proven open-source tools
- **Compliance ready** - meets most security frameworks
- **Transparent security** - full visibility into all security controls
- **Community vetted** - battle-tested by millions of deployments

### **🚀 Operational Benefits:**

#### **Simplified Management**
- **Single pane of glass** with Traefik dashboard
- **Automated deployment** with Docker Compose profiles
- **Centralized logging** with structured events
- **Easy scaling** - add replicas as needed

#### **Developer Friendly**
- **Local development** mirrors production security
- **Hot reloading** for rapid iteration
- **Easy debugging** with accessible logs
- **Consistent environments** across dev/staging/prod

This open-source security stack provides enterprise-grade protection that rivals or exceeds AWS security services while maintaining complete independence and dramatically lower costs. You get military-grade WASM isolation plus industry-standard security controls, all managed through simple Docker Compose commands.

### **Deployment Scripts**
```bash
#!/bin/bash
# deploy.sh - Production deployment script

set -e

echo "🚀 Deploying WASM-Powered Malware Analyzer..."

# Build WASM modules
echo "Building WASM analysis engine..."
docker compose -f docker-compose.prod.yml build wasm-builder
docker compose -f docker-compose.prod.yml run --rm wasm-builder

# Build and start services
echo "Building application containers..."
docker compose -f docker-compose.prod.yml build

echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 30

# Run health checks
echo "Running health checks..."
docker compose -f docker-compose.prod.yml exec backend curl -f http://localhost:8000/health
docker compose -f docker-compose.prod.yml exec frontend wget --spider -q http://localhost:80/

echo "✅ Deployment complete!"
echo "🌐 Application available at: https://${DOMAIN_NAME}"
echo "📊 Monitor with: docker compose -f docker-compose.prod.yml logs -f"
```

---

## Key Deployment Advantages

### **🔒 WASM Security in Containers:**
- **Perfect isolation** - Malware cannot escape WASM sandbox even in containers
- **Memory safety** - No buffer overflows or memory corruption possible
- **Capability-based security** - Only explicit permissions granted
- **Multi-layered protection** - WASM + container + network isolation

### **📦 Docker Compose Benefits:**
- **Simple deployment** - Single command deployment
- **Local development** - Identical dev/prod environments
- **Easy scaling** - Scale services independently
- **Resource control** - CPU and memory limits per service
- **Health monitoring** - Built-in health checks

### **⚡ Performance Optimizations:**
- **WASM instance pooling** - Pre-created instances for low latency
- **Horizontal scaling** - Multiple backend/worker replicas
- **NGINX load balancing** - Efficient request distribution
- **Redis caching** - Fast result caching
- **Connection pooling** - Database connection optimization

### **🚀 Operational Simplicity:**
- **Infrastructure as code** - All configuration in version control
- **One-command deployment** - `docker compose up -d`
- **Easy monitoring** - Centralized logging and metrics
- **Simple backups** - Volume-based data persistence
- **Zero-downtime updates** - Rolling deployments with Docker Compose

This WASM-first architecture with Docker Compose deployment gives you military-grade security isolation while maintaining the simplicity and speed needed for a 6-month MVP timeline.
pub mod orchestrator;
pub mod memory_capture;
pub mod video_capture;
pub mod anti_evasion;
pub mod volatility;

// Re-export all public types for external use
pub use orchestrator::{
    SandboxOrchestrator,
    SandboxConfig,
    ExecutionReport,
    BehaviorEvent,
    FileOperation,
    NetworkConnection,
    ProcessInfo,
    OsType,
    SandboxError,
    MitreAttack,
};

pub use memory_capture::{
    MemoryDump,
    MemoryRegion,
    MemoryAnalysisResult,
    MemoryCaptureConfig,
    MemoryCaptureManager,
    DumpTrigger,
    SuspiciousFinding,
    SuspiciousFindingType,
    MemoryStatistics,
    ExtractedString,
};

pub use video_capture::{
    VideoCaptureConfig,
    VideoRecording,
    Screenshot,
    VideoCaptureManager,
};

pub use anti_evasion::{
    AntiEvasionConfig,
    AntiEvasionManager,
    VmArtifact,
    EvasionAttempt,
    EvasionTechnique,
};

pub use volatility::{
    VolatilityAnalysis,
    VolatilityRunner,
    VolatilityConfig,
    VolProcess,
    VolNetConn,
    MalfindHit,
    ModuleInfo,
    ApiHook,
    HandleInfo,
};

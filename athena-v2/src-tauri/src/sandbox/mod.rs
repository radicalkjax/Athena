pub mod orchestrator;
pub mod memory_capture;
pub mod video_capture;
pub mod anti_evasion;
pub mod volatility;
pub mod seccomp;

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




pub use volatility::{
    VolatilityAnalysis,
    VolatilityRunner,
    VolatilityConfig,
};

// Video capture types are used internally only
// pub use video_capture::{VideoCaptureConfig, VideoCaptureManager, VideoRecording};

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for JobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobStatus::Pending => write!(f, "Pending"),
            JobStatus::Running => write!(f, "Running"),
            JobStatus::Completed => write!(f, "Completed"),
            JobStatus::Failed => write!(f, "Failed"),
            JobStatus::Cancelled => write!(f, "Cancelled"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum WorkflowType {
    FileAnalysis,
    BatchScan,
    ThreatHunting,
    ReportGeneration,
}

impl std::fmt::Display for WorkflowType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WorkflowType::FileAnalysis => write!(f, "FileAnalysis"),
            WorkflowType::BatchScan => write!(f, "BatchScan"),
            WorkflowType::ThreatHunting => write!(f, "ThreatHunting"),
            WorkflowType::ReportGeneration => write!(f, "ReportGeneration"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum LogLevel {
    Info,
    Warning,
    Error,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Info => write!(f, "Info"),
            LogLevel::Warning => write!(f, "Warning"),
            LogLevel::Error => write!(f, "Error"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub workflow_type: WorkflowType,
    pub status: JobStatus,
    pub progress: f64, // 0.0 to 1.0
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
    pub logs: Vec<LogEntry>,
}

impl Job {
    pub fn new(workflow_type: WorkflowType, input: serde_json::Value) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            workflow_type,
            status: JobStatus::Pending,
            progress: 0.0,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            input,
            output: None,
            error: None,
            logs: Vec::new(),
        }
    }

    pub fn add_log(&mut self, level: LogLevel, message: String) {
        self.logs.push(LogEntry {
            timestamp: Utc::now(),
            level,
            message,
        });
    }

    pub fn update_progress(&mut self, progress: f64) {
        self.progress = progress.clamp(0.0, 1.0);
    }

    pub fn start(&mut self) {
        self.status = JobStatus::Running;
        self.started_at = Some(Utc::now());
        self.add_log(LogLevel::Info, "Job started".to_string());
    }

    pub fn complete(&mut self, output: serde_json::Value) {
        self.status = JobStatus::Completed;
        self.output = Some(output);
        self.completed_at = Some(Utc::now());
        self.progress = 1.0;
        self.add_log(LogLevel::Info, "Job completed successfully".to_string());
    }

    pub fn fail(&mut self, error: String) {
        self.status = JobStatus::Failed;
        self.error = Some(error.clone());
        self.completed_at = Some(Utc::now());
        self.progress = 1.0;
        self.add_log(LogLevel::Error, format!("Job failed: {}", error));
    }

    pub fn cancel(&mut self) {
        self.status = JobStatus::Cancelled;
        self.completed_at = Some(Utc::now());
        self.add_log(LogLevel::Warning, "Job cancelled by user".to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_job_creation() {
        let input = serde_json::json!({"file_path": "/test/malware.exe"});
        let job = Job::new(WorkflowType::FileAnalysis, input.clone());

        assert_eq!(job.status, JobStatus::Pending);
        assert_eq!(job.progress, 0.0);
        assert_eq!(job.input, input);
        assert!(job.output.is_none());
        assert!(job.error.is_none());
    }

    #[test]
    fn test_job_lifecycle() {
        let mut job = Job::new(
            WorkflowType::FileAnalysis,
            serde_json::json!({}),
        );

        // Start job
        job.start();
        assert_eq!(job.status, JobStatus::Running);
        assert!(job.started_at.is_some());
        assert_eq!(job.logs.len(), 1);

        // Update progress
        job.update_progress(0.5);
        assert_eq!(job.progress, 0.5);

        // Complete job
        let output = serde_json::json!({"result": "clean"});
        job.complete(output.clone());
        assert_eq!(job.status, JobStatus::Completed);
        assert_eq!(job.output, Some(output));
        assert_eq!(job.progress, 1.0);
        assert!(job.completed_at.is_some());
    }

    #[test]
    fn test_job_failure() {
        let mut job = Job::new(
            WorkflowType::FileAnalysis,
            serde_json::json!({}),
        );

        job.start();
        job.fail("File not found".to_string());

        assert_eq!(job.status, JobStatus::Failed);
        assert!(job.error.is_some());
        assert_eq!(job.error.unwrap(), "File not found");
        assert!(job.completed_at.is_some());
    }
}

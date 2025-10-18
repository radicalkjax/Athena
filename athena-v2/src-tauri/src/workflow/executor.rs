use super::schema::{Job, JobStatus, WorkflowType, LogLevel};
use super::job_store::JobStore;
use anyhow::Result;
use std::sync::Arc;
use tokio::sync::mpsc;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ProgressUpdate {
    pub job_id: String,
    pub progress: f64,
    pub message: String,
}

pub struct JobExecutor {
    store: Arc<JobStore>,
    progress_tx: mpsc::UnboundedSender<ProgressUpdate>,
}

impl JobExecutor {
    pub fn new(store: Arc<JobStore>, progress_tx: mpsc::UnboundedSender<ProgressUpdate>) -> Self {
        Self { store, progress_tx }
    }

    pub async fn execute_job(&self, job_id: String) -> Result<()> {
        // Get job
        let mut job = self.store.get_job(&job_id)?
            .ok_or_else(|| anyhow::anyhow!("Job not found: {}", job_id))?;

        // Mark as running
        job.start();
        self.store.update_job(&job)?;
        self.send_progress(&job.id, 0.0, "Starting job".to_string());

        // Execute based on workflow type
        let result = match job.workflow_type {
            WorkflowType::FileAnalysis => self.execute_file_analysis(&mut job).await,
            WorkflowType::BatchScan => self.execute_batch_scan(&mut job).await,
            WorkflowType::ThreatHunting => self.execute_threat_hunting(&mut job).await,
            WorkflowType::ReportGeneration => self.execute_report_generation(&mut job).await,
        };

        // Update final status
        match result {
            Ok(output) => {
                job.complete(output);
                self.send_progress(&job.id, 1.0, "Job completed successfully".to_string());
            }
            Err(e) => {
                job.fail(e.to_string());
                self.send_progress(&job.id, 1.0, format!("Job failed: {}", e));
            }
        }

        self.store.update_job(&job)?;

        Ok(())
    }

    async fn execute_file_analysis(&self, job: &mut Job) -> Result<serde_json::Value> {
        // Simulate analysis steps
        self.send_progress(&job.id, 0.1, "Loading file".to_string());
        job.update_progress(0.1);
        self.store.update_job(&job)?;
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

        self.send_progress(&job.id, 0.3, "Calculating hashes".to_string());
        job.update_progress(0.3);
        self.store.update_job(&job)?;
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        self.send_progress(&job.id, 0.5, "Analyzing binary structure".to_string());
        job.update_progress(0.5);
        self.store.update_job(&job)?;
        tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;

        self.send_progress(&job.id, 0.7, "Running YARA rules".to_string());
        job.update_progress(0.7);
        self.store.update_job(&job)?;
        tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;

        self.send_progress(&job.id, 0.9, "Generating report".to_string());
        job.update_progress(0.9);
        self.store.update_job(&job)?;
        tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;

        Ok(serde_json::json!({
            "status": "complete",
            "threat_level": "low",
            "malware_detected": false,
            "analysis_time_ms": 2600,
        }))
    }

    async fn execute_batch_scan(&self, job: &mut Job) -> Result<serde_json::Value> {
        self.send_progress(&job.id, 0.5, "Scanning files".to_string());
        job.update_progress(0.5);
        self.store.update_job(&job)?;
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        Ok(serde_json::json!({
            "files_scanned": 0,
            "threats_found": 0,
        }))
    }

    async fn execute_threat_hunting(&self, job: &mut Job) -> Result<serde_json::Value> {
        self.send_progress(&job.id, 0.5, "Searching for threats".to_string());
        job.update_progress(0.5);
        self.store.update_job(&job)?;
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        Ok(serde_json::json!({
            "threats_found": [],
        }))
    }

    async fn execute_report_generation(&self, job: &mut Job) -> Result<serde_json::Value> {
        self.send_progress(&job.id, 0.5, "Generating report".to_string());
        job.update_progress(0.5);
        self.store.update_job(&job)?;
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        Ok(serde_json::json!({
            "report_path": "/tmp/report.pdf",
        }))
    }

    fn send_progress(&self, job_id: &str, progress: f64, message: String) {
        let _ = self.progress_tx.send(ProgressUpdate {
            job_id: job_id.to_string(),
            progress,
            message,
        });
    }
}

use tauri::{Manager, AppHandle, State, Emitter};
use tokio::sync::mpsc;
use std::sync::Arc;
use crate::workflow::{Job, JobStore, JobExecutor, JobStatus, WorkflowType, ProgressUpdate};

#[tauri::command]
pub async fn start_job(
    app: AppHandle,
    workflow_type: WorkflowType,
    input: serde_json::Value,
) -> Result<String, String> {
    // Create job
    let job = Job::new(workflow_type, input);
    let job_id = job.id.clone();

    // Get job store
    let store = app.state::<Arc<JobStore>>();
    store.create_job(&job).map_err(|e| e.to_string())?;

    // Create progress channel
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Spawn executor
    let executor = JobExecutor::new(store.inner().clone(), tx);
    let job_id_clone = job_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        // Spawn listener for progress updates
        let app_inner = app_clone.clone();
        tokio::spawn(async move {
            while let Some(update) = rx.recv().await {
                // Emit progress event to frontend
                let _ = app_inner.emit("job-progress", update);
            }
        });

        // Execute job
        if let Err(e) = executor.execute_job(job_id_clone).await {
            eprintln!("Job execution failed: {}", e);
        }
    });

    Ok(job_id)
}

#[tauri::command]
pub async fn get_job_status(
    store: State<'_, Arc<JobStore>>,
    job_id: String,
) -> Result<Job, String> {
    store.get_job(&job_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Job not found".to_string())
}

#[tauri::command]
pub async fn list_jobs(
    store: State<'_, Arc<JobStore>>,
    status: Option<JobStatus>,
    limit: Option<usize>,
) -> Result<Vec<Job>, String> {
    store.list_jobs(status, limit.unwrap_or(100))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cancel_job(
    store: State<'_, Arc<JobStore>>,
    job_id: String,
) -> Result<(), String> {
    let mut job = store.get_job(&job_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Job not found".to_string())?;

    job.cancel();
    store.update_job(&job).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_job(
    store: State<'_, Arc<JobStore>>,
    job_id: String,
) -> Result<(), String> {
    store.delete_job(&job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_active_jobs(
    store: State<'_, Arc<JobStore>>,
) -> Result<Vec<Job>, String> {
    store.get_active_jobs().map_err(|e| e.to_string())
}

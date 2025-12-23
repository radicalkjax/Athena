use rusqlite::{Connection, params, OptionalExtension};
use anyhow::{Result, Context};
use std::sync::{Arc, Mutex};
use super::schema::{Job, JobStatus, LogEntry};

pub struct JobStore {
    conn: Arc<Mutex<Connection>>,
}

impl JobStore {
    pub fn new(db_path: &str) -> Result<Self> {
        let conn = Connection::open(db_path)
            .context("Failed to open jobs database")?;

        // Configure SQLite for production per DeepWiki best practices
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;           -- Write-Ahead Logging for better concurrency
             PRAGMA synchronous = NORMAL;         -- Balance between safety and performance
             PRAGMA cache_size = -64000;          -- 64MB cache (negative = KB)
             PRAGMA temp_store = MEMORY;          -- Store temp tables in memory
             PRAGMA mmap_size = 30000000000;      -- 30GB memory-mapped I/O
             PRAGMA page_size = 4096;             -- 4KB pages (good for modern systems)
             PRAGMA auto_vacuum = INCREMENTAL;    -- Reclaim space incrementally
             PRAGMA busy_timeout = 5000;          -- 5s timeout for locks
             PRAGMA foreign_keys = ON;            -- Enforce foreign key constraints"
        ).context("Failed to configure SQLite pragmas")?;

        // Create jobs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                workflow_type TEXT NOT NULL,
                status TEXT NOT NULL,
                progress REAL NOT NULL,
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT,
                input TEXT NOT NULL,
                output TEXT,
                error TEXT
            )",
            [],
        )?;

        // Create job_logs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS job_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // Create indices for performance
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_job_status ON jobs(status)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_job_created ON jobs(created_at DESC)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_log_job ON job_logs(job_id)",
            [],
        )?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn create_job(&self, job: &Job) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|poisoned| {
            eprintln!("JobStore mutex was poisoned, recovering...");
            poisoned.into_inner()
        });

        conn.execute(
            "INSERT INTO jobs (id, workflow_type, status, progress, created_at, input)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                job.id,
                serde_json::to_string(&job.workflow_type)?,
                serde_json::to_string(&job.status)?,
                job.progress,
                job.created_at.to_rfc3339(),
                serde_json::to_string(&job.input)?,
            ],
        )?;

        Ok(())
    }

    pub fn update_job(&self, job: &Job) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|poisoned| {
            eprintln!("JobStore mutex was poisoned, recovering...");
            poisoned.into_inner()
        });

        conn.execute(
            "UPDATE jobs SET
                status = ?1,
                progress = ?2,
                started_at = ?3,
                completed_at = ?4,
                output = ?5,
                error = ?6
             WHERE id = ?7",
            params![
                serde_json::to_string(&job.status)?,
                job.progress,
                job.started_at.map(|t| t.to_rfc3339()),
                job.completed_at.map(|t| t.to_rfc3339()),
                job.output.as_ref().map(|o| serde_json::to_string(o).ok()).flatten(),
                job.error,
                job.id,
            ],
        )?;

        Ok(())
    }

    pub fn add_log(&self, job_id: &str, log: &LogEntry) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|poisoned| {
            eprintln!("JobStore mutex was poisoned, recovering...");
            poisoned.into_inner()
        });

        conn.execute(
            "INSERT INTO job_logs (job_id, timestamp, level, message)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                job_id,
                log.timestamp.to_rfc3339(),
                serde_json::to_string(&log.level)?,
                log.message,
            ],
        )?;

        Ok(())
    }

    pub fn get_job(&self, job_id: &str) -> Result<Option<Job>> {
        let conn = self.conn.lock().unwrap_or_else(|poisoned| {
            eprintln!("JobStore mutex was poisoned, recovering...");
            poisoned.into_inner()
        });

        let mut stmt = conn.prepare(
            "SELECT id, workflow_type, status, progress, created_at, started_at, completed_at, input, output, error
             FROM jobs WHERE id = ?1"
        )?;

        let job = stmt.query_row([job_id], |row| {
            Ok(Job {
                id: row.get(0)?,
                workflow_type: serde_json::from_str(&row.get::<_, String>(1)?)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                        1,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?,
                status: serde_json::from_str(&row.get::<_, String>(2)?)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                        2,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?,
                progress: row.get(3)?,
                created_at: row.get::<_, String>(4)?
                    .parse()
                    .map_err(|e: chrono::ParseError| rusqlite::Error::FromSqlConversionFailure(
                        4,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?,
                started_at: row.get::<_, Option<String>>(5)?
                    .map(|s| s.parse())
                    .transpose()
                    .map_err(|e: chrono::ParseError| rusqlite::Error::FromSqlConversionFailure(
                        5,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?,
                completed_at: row.get::<_, Option<String>>(6)?
                    .map(|s| s.parse())
                    .transpose()
                    .map_err(|e: chrono::ParseError| rusqlite::Error::FromSqlConversionFailure(
                        6,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?,
                input: serde_json::from_str(&row.get::<_, String>(7)?)
                    .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                        7,
                        rusqlite::types::Type::Text,
                        Box::new(e)
                    ))?,
                output: row.get::<_, Option<String>>(8)?.and_then(|s| serde_json::from_str(&s).ok()),
                error: row.get(9)?,
                logs: Vec::new(),  // Loaded separately
            })
        }).optional()?;

        // Load logs if job exists
        if let Some(mut job) = job {
            let mut log_stmt = conn.prepare(
                "SELECT timestamp, level, message FROM job_logs WHERE job_id = ?1 ORDER BY timestamp"
            )?;

            let logs = log_stmt.query_map([&job.id], |row| {
                Ok(LogEntry {
                    timestamp: row.get::<_, String>(0)?
                        .parse()
                        .map_err(|e: chrono::ParseError| rusqlite::Error::FromSqlConversionFailure(
                            0,
                            rusqlite::types::Type::Text,
                            Box::new(e)
                        ))?,
                    level: serde_json::from_str(&row.get::<_, String>(1)?)
                        .map_err(|e| rusqlite::Error::FromSqlConversionFailure(
                            1,
                            rusqlite::types::Type::Text,
                            Box::new(e)
                        ))?,
                    message: row.get(2)?,
                })
            })?;

            job.logs = logs.collect::<Result<Vec<_>, _>>()?;
            return Ok(Some(job));
        }

        Ok(None)
    }

    pub fn list_jobs(&self, status: Option<JobStatus>, limit: usize) -> Result<Vec<Job>> {
        let conn = self.conn.lock().unwrap_or_else(|poisoned| {
            eprintln!("JobStore mutex was poisoned, recovering...");
            poisoned.into_inner()
        });

        let (query, params_vec): (String, Vec<String>) = if let Some(status) = status {
            (
                format!(
                    "SELECT id FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT {}",
                    limit
                ),
                vec![serde_json::to_string(&status)?],
            )
        } else {
            (
                format!("SELECT id FROM jobs ORDER BY created_at DESC LIMIT {}", limit),
                vec![],
            )
        };

        let mut stmt = conn.prepare(&query)?;
        let job_ids: Vec<String> = if params_vec.is_empty() {
            stmt.query_map([], |row| row.get(0))?
                .collect::<Result<Vec<_>, _>>()?
        } else {
            stmt.query_map(params![params_vec[0]], |row| row.get(0))?
                .collect::<Result<Vec<_>, _>>()?
        };

        drop(stmt);
        drop(conn);

        let mut jobs = Vec::new();
        for id in job_ids {
            if let Some(job) = self.get_job(&id)? {
                jobs.push(job);
            }
        }

        Ok(jobs)
    }

    pub fn delete_job(&self, job_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap_or_else(|poisoned| {
            eprintln!("JobStore mutex was poisoned, recovering...");
            poisoned.into_inner()
        });

        conn.execute("DELETE FROM job_logs WHERE job_id = ?1", [job_id])?;
        conn.execute("DELETE FROM jobs WHERE id = ?1", [job_id])?;

        Ok(())
    }

    pub fn get_active_jobs(&self) -> Result<Vec<Job>> {
        self.list_jobs(Some(JobStatus::Running), 100)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::schema::WorkflowType;

    #[test]
    fn test_job_store_crud() {
        let store = JobStore::new(":memory:").unwrap();

        // Create job
        let input = serde_json::json!({"file": "test.exe"});
        let job = Job::new(WorkflowType::FileAnalysis, input);
        let job_id = job.id.clone();

        store.create_job(&job).unwrap();

        // Retrieve job
        let retrieved = store.get_job(&job_id).unwrap().unwrap();
        assert_eq!(retrieved.id, job_id);
        assert_eq!(retrieved.status, JobStatus::Pending);

        // Update job
        let mut updated_job = retrieved.clone();
        updated_job.status = JobStatus::Running;
        updated_job.progress = 0.5;
        store.update_job(&updated_job).unwrap();

        let retrieved_again = store.get_job(&job_id).unwrap().unwrap();
        assert_eq!(retrieved_again.status, JobStatus::Running);
        assert_eq!(retrieved_again.progress, 0.5);

        // Delete job
        store.delete_job(&job_id).unwrap();
        assert!(store.get_job(&job_id).unwrap().is_none());
    }

    #[test]
    fn test_list_jobs() {
        let store = JobStore::new(":memory:").unwrap();

        // Create multiple jobs
        for i in 0..5 {
            let job = Job::new(
                WorkflowType::FileAnalysis,
                serde_json::json!({"index": i}),
            );
            store.create_job(&job).unwrap();
        }

        // List all jobs
        let jobs = store.list_jobs(None, 10).unwrap();
        assert_eq!(jobs.len(), 5);

        // List pending jobs
        let pending = store.list_jobs(Some(JobStatus::Pending), 10).unwrap();
        assert_eq!(pending.len(), 5);
    }
}

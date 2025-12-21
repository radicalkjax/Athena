//! Video capture module for sandbox dynamic analysis
//!
//! Provides functionality to record video of malware execution in a headless
//! X11 environment using Xvfb and ffmpeg.

use serde::{Serialize, Deserialize};
use std::path::PathBuf;

/// Video capture configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoCaptureConfig {
    /// Enable video recording
    pub enabled: bool,
    /// Video resolution width
    pub width: u32,
    /// Video resolution height
    pub height: u32,
    /// Frame rate (fps)
    pub frame_rate: u32,
    /// Video codec (libx264, libx265, etc.)
    pub codec: String,
    /// Video quality preset (ultrafast, fast, medium, slow)
    pub preset: String,
    /// Maximum video duration in seconds (0 = unlimited)
    pub max_duration: u64,
    /// Whether to capture screenshots at intervals
    pub capture_screenshots: bool,
    /// Screenshot interval in milliseconds
    pub screenshot_interval_ms: u64,
}

impl Default for VideoCaptureConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            width: 1280,
            height: 720,
            frame_rate: 15,
            codec: "libx264".to_string(),
            preset: "ultrafast".to_string(),
            max_duration: 300, // 5 minutes max
            capture_screenshots: true,
            screenshot_interval_ms: 5000, // Every 5 seconds
        }
    }
}

/// Information about a captured video recording
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoRecording {
    /// Session ID this recording belongs to
    pub session_id: String,
    /// Path to the video file
    pub video_path: PathBuf,
    /// Duration in milliseconds
    pub duration_ms: u64,
    /// Video resolution
    pub resolution: (u32, u32),
    /// Frame rate
    pub frame_rate: u32,
    /// File size in bytes
    pub file_size: u64,
    /// Video format/container
    pub format: String,
    /// Video codec used
    pub codec: String,
}

/// Screenshot captured during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    /// Timestamp when captured (Unix millis)
    pub timestamp: u64,
    /// Path to the screenshot file
    pub path: PathBuf,
    /// Image dimensions
    pub width: u32,
    pub height: u32,
    /// File size in bytes
    pub file_size: u64,
    /// Associated event that triggered the screenshot (if any)
    pub trigger_event: Option<String>,
}

/// Video capture manager for generating recording scripts
pub struct VideoCaptureManager {
    config: VideoCaptureConfig,
}

impl VideoCaptureManager {
    /// Create a new video capture manager with default config
    pub fn new() -> Self {
        Self {
            config: VideoCaptureConfig::default(),
        }
    }

    /// Create with custom configuration
    pub fn with_config(config: VideoCaptureConfig) -> Self {
        Self { config }
    }

    /// Generate the script to start video recording
    pub fn generate_start_script(&self, output_dir: &str) -> String {
        let video_path = format!("{}/recording.mp4", output_dir);
        let screenshots_dir = format!("{}/screenshots", output_dir);

        let mut script = String::new();

        // Start Xvfb (virtual framebuffer)
        script.push_str(&format!(
            r#"
# Start virtual display
export DISPLAY=:99
Xvfb :99 -screen 0 {}x{}x24 &
XVFB_PID=$!
sleep 1

# Start a basic window manager for GUI apps
fluxbox -display :99 &
FLUXBOX_PID=$!
sleep 0.5

mkdir -p {}

"#,
            self.config.width, self.config.height, screenshots_dir
        ));

        // Start ffmpeg recording
        script.push_str(&format!(
            r#"# Start video recording
ffmpeg -f x11grab -video_size {}x{} -framerate {} -i :99 \
    -c:v {} -preset {} -pix_fmt yuv420p \
    -t {} {} &
FFMPEG_PID=$!
echo $FFMPEG_PID > {}/ffmpeg.pid

"#,
            self.config.width,
            self.config.height,
            self.config.frame_rate,
            self.config.codec,
            self.config.preset,
            self.config.max_duration,
            video_path,
            output_dir
        ));

        // Screenshot capture loop (background)
        if self.config.capture_screenshots {
            script.push_str(&format!(
                r#"# Start screenshot capture loop
(
    SCREENSHOT_COUNT=0
    while true; do
        if [ -f {}/stop_recording ]; then
            break
        fi
        import -window root -display :99 {}/screenshot_$(date +%s%N).png 2>/dev/null || true
        SCREENSHOT_COUNT=$((SCREENSHOT_COUNT + 1))
        sleep {}
    done
) &
SCREENSHOT_PID=$!
echo $SCREENSHOT_PID > {}/screenshot.pid

"#,
                output_dir,
                screenshots_dir,
                self.config.screenshot_interval_ms as f64 / 1000.0,
                output_dir
            ));
        }

        script
    }

    /// Generate the script to stop video recording
    pub fn generate_stop_script(&self, output_dir: &str) -> String {
        format!(
            r#"
# Stop video and screenshot capture
echo "[VIDEO] Stopping recording..."
touch {}/stop_recording

# Stop ffmpeg gracefully
if [ -f {}/ffmpeg.pid ]; then
    FFMPEG_PID=$(cat {}/ffmpeg.pid)
    kill -INT $FFMPEG_PID 2>/dev/null || true
    sleep 2
    kill -TERM $FFMPEG_PID 2>/dev/null || true
fi

# Stop screenshot capture
if [ -f {}/screenshot.pid ]; then
    kill $(cat {}/screenshot.pid) 2>/dev/null || true
fi

# Stop Xvfb and fluxbox
pkill -f "Xvfb :99" 2>/dev/null || true
pkill -f fluxbox 2>/dev/null || true

# Wait for video to finalize
sleep 1

# Log video info
if [ -f {}/recording.mp4 ]; then
    echo "[VIDEO] Recording saved: $(ls -lh {}/recording.mp4 | awk '{{print $5}}')"
    echo "[VIDEO] Screenshots: $(ls -1 {}/screenshots/*.png 2>/dev/null | wc -l) captured"
else
    echo "[VIDEO] Warning: No video recording found"
fi
"#,
            output_dir,
            output_dir, output_dir,
            output_dir, output_dir,
            output_dir, output_dir, output_dir
        )
    }

    /// Generate script to simulate user input (anti-evasion)
    pub fn generate_user_simulation_script(&self) -> String {
        r#"
# Simulate user activity to defeat evasion techniques
(
    export DISPLAY=:99
    while true; do
        if [ -f /sandbox/output/stop_recording ]; then
            break
        fi

        # Random mouse movements
        xdotool mousemove --sync $(shuf -i 100-1100 -n 1) $(shuf -i 100-600 -n 1) 2>/dev/null || true
        sleep 0.5

        # Occasional clicks
        if [ $((RANDOM % 10)) -eq 0 ]; then
            xdotool click 1 2>/dev/null || true
        fi

        # Occasional keyboard input
        if [ $((RANDOM % 15)) -eq 0 ]; then
            xdotool type "test" 2>/dev/null || true
        fi

        sleep $(shuf -i 1-3 -n 1)
    done
) &
USER_SIM_PID=$!
echo $USER_SIM_PID > /sandbox/output/user_sim.pid
"#.to_string()
    }

    /// Parse video metadata from ffprobe output
    pub fn parse_video_info(&self, ffprobe_output: &str, file_path: &str, file_size: u64) -> Option<VideoRecording> {
        // Parse duration from ffprobe output
        // Format: duration=123.456
        let duration_ms = ffprobe_output
            .lines()
            .find(|line| line.starts_with("duration="))
            .and_then(|line| line.strip_prefix("duration="))
            .and_then(|s| s.parse::<f64>().ok())
            .map(|d| (d * 1000.0) as u64)
            .unwrap_or(0);

        // Parse resolution
        let width = ffprobe_output
            .lines()
            .find(|line| line.starts_with("width="))
            .and_then(|line| line.strip_prefix("width="))
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(self.config.width);

        let height = ffprobe_output
            .lines()
            .find(|line| line.starts_with("height="))
            .and_then(|line| line.strip_prefix("height="))
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(self.config.height);

        Some(VideoRecording {
            session_id: String::new(),
            video_path: PathBuf::from(file_path),
            duration_ms,
            resolution: (width, height),
            frame_rate: self.config.frame_rate,
            file_size,
            format: "mp4".to_string(),
            codec: self.config.codec.clone(),
        })
    }
}

impl Default for VideoCaptureManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = VideoCaptureConfig::default();
        assert!(config.enabled);
        assert_eq!(config.width, 1280);
        assert_eq!(config.height, 720);
        assert_eq!(config.frame_rate, 15);
        assert_eq!(config.codec, "libx264");
    }

    #[test]
    fn test_generate_start_script() {
        let manager = VideoCaptureManager::new();
        let script = manager.generate_start_script("/sandbox/output");

        assert!(script.contains("Xvfb :99"));
        assert!(script.contains("ffmpeg"));
        assert!(script.contains("x11grab"));
        assert!(script.contains("1280x720"));
        assert!(script.contains("recording.mp4"));
    }

    #[test]
    fn test_generate_stop_script() {
        let manager = VideoCaptureManager::new();
        let script = manager.generate_stop_script("/sandbox/output");

        assert!(script.contains("stop_recording"));
        assert!(script.contains("ffmpeg.pid"));
        assert!(script.contains("pkill"));
    }

    #[test]
    fn test_generate_user_simulation() {
        let manager = VideoCaptureManager::new();
        let script = manager.generate_user_simulation_script();

        assert!(script.contains("xdotool"));
        assert!(script.contains("mousemove"));
        assert!(script.contains("click"));
    }

    #[test]
    fn test_parse_video_info() {
        let manager = VideoCaptureManager::new();
        let ffprobe_output = r#"width=1280
height=720
duration=45.678
codec_name=h264"#;

        let info = manager.parse_video_info(ffprobe_output, "/path/video.mp4", 12345678);
        assert!(info.is_some());

        let info = info.unwrap();
        assert_eq!(info.duration_ms, 45678);
        assert_eq!(info.resolution, (1280, 720));
        assert_eq!(info.file_size, 12345678);
    }
}

import { Component, createSignal, createMemo, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import AnalysisPanel from '../shared/AnalysisPanel';
import { invokeCommand } from '../../../utils/tauriCompat';
import './VideoPlayer.css';

export interface Screenshot {
  timestamp: number;
  path: string;
  dataUrl?: string;
}

export interface VideoRecording {
  video_path: string;
  duration_ms: number;
  format: string;
  size_bytes: number;
}

export interface BehaviorEvent {
  type: 'success' | 'warning' | 'danger' | 'info';
  symbol: string;
  description: string;
  timestamp?: number;
  mitre_attack_id?: string;
}

interface VideoPlayerProps {
  videoPath: string;
  sessionId: string;
  screenshots: Screenshot[];
  events: BehaviorEvent[];
  onSeekToEvent?: (event: BehaviorEvent) => void;
}

const VideoPlayer: Component<VideoPlayerProps> = (props) => {
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [videoUrl, setVideoUrl] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [playbackRate, setPlaybackRate] = createSignal(1);
  const [volume, setVolume] = createSignal(0.5);
  const [showTimeline, setShowTimeline] = createSignal(true);
  const [screenshotUrls, setScreenshotUrls] = createSignal<Map<string, string>>(new Map());
  const [selectedEvent, setSelectedEvent] = createSignal<BehaviorEvent | null>(null);

  let videoRef: HTMLVideoElement | undefined;

  // Load video from Tauri backend
  onMount(async () => {
    if (!props.videoPath) {
      setError('No video path provided');
      setLoading(false);
      return;
    }

    try {
      const bytes = await invokeCommand('read_file_binary', {
        path: props.videoPath,
        offset: 0,
        length: 100 * 1024 * 1024 // 100MB max
      }) as number[];

      if (!bytes || bytes.length === 0) {
        setError('Video file is empty or could not be read');
        setLoading(false);
        return;
      }

      const blob = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);

      // Load screenshot thumbnails
      await loadScreenshots();
    } catch (e) {
      console.error('Failed to load video:', e);
      setError(e instanceof Error ? e.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  });

  // Cleanup blob URLs on unmount
  onCleanup(() => {
    const url = videoUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    // Cleanup screenshot URLs
    screenshotUrls().forEach((url) => URL.revokeObjectURL(url));
  });

  // Load screenshot thumbnails
  const loadScreenshots = async () => {
    const urls = new Map<string, string>();

    for (const screenshot of props.screenshots) {
      if (screenshot.dataUrl) {
        urls.set(screenshot.path, screenshot.dataUrl);
      } else {
        try {
          const bytes = await invokeCommand('read_file_binary', {
            path: screenshot.path,
            offset: 0,
            length: 1024 * 1024 // 1MB max per screenshot
          }) as number[];

          if (bytes && bytes.length > 0) {
            const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
            urls.set(screenshot.path, URL.createObjectURL(blob));
          }
        } catch (e) {
          console.warn('Failed to load screenshot:', screenshot.path, e);
        }
      }
    }

    setScreenshotUrls(urls);
  };

  // Calculate event markers on timeline
  const eventMarkers = createMemo(() => {
    const dur = duration();
    if (dur === 0) return [];

    return props.events
      .filter(event => event.timestamp !== undefined)
      .map(event => ({
        ...event,
        position: ((event.timestamp! / 1000) / dur) * 100 // Convert ms to seconds
      }));
  });

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (!videoRef) return;

    if (isPlaying()) {
      videoRef.pause();
    } else {
      videoRef.play();
    }
  };

  // Seek to specific time
  const seekTo = (time: number) => {
    if (!videoRef) return;
    videoRef.currentTime = time;
  };

  // Seek to event
  const seekToEvent = (event: BehaviorEvent) => {
    if (event.timestamp !== undefined && videoRef) {
      const timeInSeconds = event.timestamp / 1000;
      videoRef.currentTime = timeInSeconds;
      setSelectedEvent(event);
      props.onSeekToEvent?.(event);
    }
  };

  // Handle timeline click
  const handleTimelineClick = (e: MouseEvent) => {
    if (!videoRef) return;
    const timeline = e.currentTarget as HTMLDivElement;
    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    seekTo(percentage * duration());
  };

  // Change playback rate
  const handleRateChange = (rate: number) => {
    if (!videoRef) return;
    setPlaybackRate(rate);
    videoRef.playbackRate = rate;
  };

  // Get severity class for event marker
  const getSeverityClass = (type: string): string => {
    switch (type) {
      case 'danger': return 'marker-critical';
      case 'warning': return 'marker-warning';
      case 'success': return 'marker-success';
      default: return 'marker-info';
    }
  };

  return (
    <AnalysisPanel
      title="Execution Recording"
      icon="Recording"
      className="video-player-panel"
      actions={
        <div class="video-actions">
          <button
            class="btn btn-secondary btn-sm"
            onClick={() => setShowTimeline(!showTimeline())}
          >
            {showTimeline() ? 'Hide Timeline' : 'Show Timeline'}
          </button>
        </div>
      }
    >
      <div class="video-player-container">
        {/* Loading State */}
        <Show when={loading()}>
          <div class="video-loading">
            <div class="loading-spinner"></div>
            <span>Loading video recording...</span>
          </div>
        </Show>

        {/* Error State */}
        <Show when={error()}>
          <div class="video-error">
            <span class="error-icon">!</span>
            <span>{error()}</span>
          </div>
        </Show>

        {/* Video Player */}
        <Show when={videoUrl() && !loading() && !error()}>
          <div class="video-wrapper">
            <video
              ref={videoRef}
              src={videoUrl()!}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
              class="video-element"
            />

            {/* Play overlay when paused */}
            <Show when={!isPlaying()}>
              <div class="play-overlay" onClick={togglePlay}>
                <span class="play-icon">&#9658;</span>
              </div>
            </Show>
          </div>

          {/* Event Timeline */}
          <Show when={showTimeline()}>
            <div class="event-timeline" onClick={handleTimelineClick}>
              {/* Progress bar */}
              <div
                class="timeline-progress"
                style={{ width: `${(currentTime() / duration()) * 100}%` }}
              />

              {/* Event markers */}
              <For each={eventMarkers()}>
                {(marker) => (
                  <div
                    class={`timeline-marker ${getSeverityClass(marker.type)} ${selectedEvent() === marker ? 'selected' : ''}`}
                    style={{ left: `${marker.position}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      seekToEvent(marker);
                    }}
                    title={`${marker.symbol} ${marker.description}${marker.mitre_attack_id ? ` [${marker.mitre_attack_id}]` : ''}`}
                  />
                )}
              </For>
            </div>
          </Show>

          {/* Controls */}
          <div class="video-controls">
            <div class="controls-left">
              <button class="control-btn" onClick={togglePlay}>
                {isPlaying() ? '⏸' : '▶'}
              </button>
              <button class="control-btn" onClick={() => seekTo(0)}>
                ⏮
              </button>
              <span class="time-display">
                {formatTime(currentTime())} / {formatTime(duration())}
              </span>
            </div>

            <div class="controls-center">
              {/* Playback rate */}
              <div class="rate-selector">
                <For each={[0.5, 1, 1.5, 2]}>
                  {(rate) => (
                    <button
                      class={`rate-btn ${playbackRate() === rate ? 'active' : ''}`}
                      onClick={() => handleRateChange(rate)}
                    >
                      {rate}x
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div class="controls-right">
              {/* Volume control */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume()}
                onInput={(e) => {
                  const vol = parseFloat(e.currentTarget.value);
                  setVolume(vol);
                  if (videoRef) videoRef.volume = vol;
                }}
                class="volume-slider"
              />
            </div>
          </div>

          {/* Selected Event Info */}
          <Show when={selectedEvent()}>
            <div class="selected-event-info">
              <span class={`event-badge ${selectedEvent()!.type}`}>
                {selectedEvent()!.symbol}
              </span>
              <span class="event-description">{selectedEvent()!.description}</span>
              <Show when={selectedEvent()!.mitre_attack_id}>
                <span class="mitre-badge">{selectedEvent()!.mitre_attack_id}</span>
              </Show>
              <button class="close-btn" onClick={() => setSelectedEvent(null)}>×</button>
            </div>
          </Show>
        </Show>

        {/* Screenshot Strip */}
        <Show when={props.screenshots.length > 0}>
          <div class="screenshot-section">
            <h4 class="screenshot-title">Screenshots ({props.screenshots.length})</h4>
            <div class="screenshot-strip">
              <For each={props.screenshots}>
                {(screenshot) => (
                  <div
                    class="screenshot-item"
                    onClick={() => seekTo(screenshot.timestamp / 1000)}
                  >
                    <Show
                      when={screenshotUrls().get(screenshot.path)}
                      fallback={<div class="screenshot-placeholder">Loading...</div>}
                    >
                      <img
                        src={screenshotUrls().get(screenshot.path)}
                        alt={`Screenshot at ${formatTime(screenshot.timestamp / 1000)}`}
                        class="screenshot-img"
                      />
                    </Show>
                    <span class="screenshot-time">{formatTime(screenshot.timestamp / 1000)}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </AnalysisPanel>
  );
};

export default VideoPlayer;

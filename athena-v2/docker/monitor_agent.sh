#!/bin/bash
set -e

SAMPLE_PATH="$1"
OUTPUT_DIR="/sandbox/output"
TIMEOUT="${2:-120}"
MEMORY_DIR="$OUTPUT_DIR/memory"
SCREENSHOT_DIR="$OUTPUT_DIR/screenshots"
VIDEO_ENABLED="${3:-true}"

echo "[+] Starting Athena Monitor Agent v2.1"
echo "[+] Sample: $SAMPLE_PATH"
echo "[+] Timeout: ${TIMEOUT}s"
echo "[+] Video: $VIDEO_ENABLED"
echo "[+] Output: $OUTPUT_DIR"

mkdir -p "$OUTPUT_DIR" "$MEMORY_DIR" "$SCREENSHOT_DIR"

# Record start time
echo "$(date +%s)" > "$OUTPUT_DIR/start_time"

# ============================================
# VIDEO RECORDING FUNCTIONS
# ============================================

start_video_recording() {
    if [ "$VIDEO_ENABLED" != "true" ]; then
        echo "[VIDEO] Recording disabled"
        return
    fi

    echo "[VIDEO] Starting virtual display and recording..."

    # Start Xvfb (virtual framebuffer)
    export DISPLAY=:99
    Xvfb :99 -screen 0 1280x720x24 &
    XVFB_PID=$!
    echo $XVFB_PID > "$OUTPUT_DIR/xvfb.pid"
    sleep 1

    # Verify Xvfb is running
    if ! kill -0 $XVFB_PID 2>/dev/null; then
        echo "[VIDEO] Warning: Xvfb failed to start"
        return
    fi

    # Start a basic window manager for GUI apps
    fluxbox -display :99 &
    FLUXBOX_PID=$!
    echo $FLUXBOX_PID > "$OUTPUT_DIR/fluxbox.pid"
    sleep 0.5

    # Start video recording with ffmpeg
    ffmpeg -f x11grab -video_size 1280x720 -framerate 15 -i :99 \
        -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
        -t $TIMEOUT "$OUTPUT_DIR/recording.mp4" 2>/dev/null &
    FFMPEG_PID=$!
    echo $FFMPEG_PID > "$OUTPUT_DIR/ffmpeg.pid"

    # Start screenshot capture loop
    (
        SCREENSHOT_COUNT=0
        while [ ! -f "$OUTPUT_DIR/stop_recording" ]; do
            import -window root -display :99 "$SCREENSHOT_DIR/screenshot_$(date +%s%N).png" 2>/dev/null || true
            SCREENSHOT_COUNT=$((SCREENSHOT_COUNT + 1))
            sleep 5
        done
    ) &
    SCREENSHOT_PID=$!
    echo $SCREENSHOT_PID > "$OUTPUT_DIR/screenshot.pid"

    # Start user simulation for anti-evasion
    (
        while [ ! -f "$OUTPUT_DIR/stop_recording" ]; do
            # Random mouse movements
            xdotool mousemove --sync $(shuf -i 100-1100 -n 1) $(shuf -i 100-600 -n 1) 2>/dev/null || true
            sleep 0.5

            # Occasional clicks
            if [ $((RANDOM % 10)) -eq 0 ]; then
                xdotool click 1 2>/dev/null || true
            fi

            # Occasional keyboard input
            if [ $((RANDOM % 15)) -eq 0 ]; then
                xdotool type "search" 2>/dev/null || true
            fi

            sleep $(shuf -i 1-3 -n 1)
        done
    ) &
    USER_SIM_PID=$!
    echo $USER_SIM_PID > "$OUTPUT_DIR/user_sim.pid"

    echo "[VIDEO] Recording started"
}

stop_video_recording() {
    if [ "$VIDEO_ENABLED" != "true" ]; then
        return
    fi

    echo "[VIDEO] Stopping recording..."
    touch "$OUTPUT_DIR/stop_recording"

    # Stop ffmpeg gracefully
    if [ -f "$OUTPUT_DIR/ffmpeg.pid" ]; then
        FFMPEG_PID=$(cat "$OUTPUT_DIR/ffmpeg.pid")
        kill -INT $FFMPEG_PID 2>/dev/null || true
        sleep 2
        kill -TERM $FFMPEG_PID 2>/dev/null || true
    fi

    # Stop screenshot capture
    if [ -f "$OUTPUT_DIR/screenshot.pid" ]; then
        kill $(cat "$OUTPUT_DIR/screenshot.pid") 2>/dev/null || true
    fi

    # Stop user simulation
    if [ -f "$OUTPUT_DIR/user_sim.pid" ]; then
        kill $(cat "$OUTPUT_DIR/user_sim.pid") 2>/dev/null || true
    fi

    # Stop Xvfb and fluxbox
    if [ -f "$OUTPUT_DIR/xvfb.pid" ]; then
        kill $(cat "$OUTPUT_DIR/xvfb.pid") 2>/dev/null || true
    fi
    if [ -f "$OUTPUT_DIR/fluxbox.pid" ]; then
        kill $(cat "$OUTPUT_DIR/fluxbox.pid") 2>/dev/null || true
    fi

    # Wait for video to finalize
    sleep 1

    # Log video info
    if [ -f "$OUTPUT_DIR/recording.mp4" ]; then
        VIDEO_SIZE=$(ls -lh "$OUTPUT_DIR/recording.mp4" 2>/dev/null | awk '{print $5}')
        SCREENSHOT_COUNT=$(ls -1 "$SCREENSHOT_DIR"/*.png 2>/dev/null | wc -l)
        echo "[VIDEO] Recording saved: $VIDEO_SIZE"
        echo "[VIDEO] Screenshots: $SCREENSHOT_COUNT captured"

        # Generate video metadata
        ffprobe -v error -show_entries format=duration:stream=width,height,codec_name \
            -of default=noprint_wrappers=1 "$OUTPUT_DIR/recording.mp4" \
            > "$OUTPUT_DIR/video_info.txt" 2>/dev/null || true
    else
        echo "[VIDEO] Warning: No video recording found"
    fi
}

# ============================================
# MEMORY DUMP FUNCTIONS
# ============================================

capture_memory_dump() {
    local pid=$1
    local trigger=$2
    local timestamp=$(date +%s%N)
    local dump_file="$MEMORY_DIR/dump_${pid}_${trigger}_${timestamp}.bin"
    local maps_file="$MEMORY_DIR/maps_${pid}_${trigger}_${timestamp}.txt"

    echo "[MEMORY] Capturing dump for PID $pid (trigger: $trigger)"

    # Save memory maps
    if [ -f "/proc/$pid/maps" ]; then
        cp "/proc/$pid/maps" "$maps_file" 2>/dev/null || true
    fi

    # Try gcore first (full core dump)
    if command -v gcore &> /dev/null; then
        timeout 5 gcore -o "$MEMORY_DIR/core_${pid}_${trigger}_${timestamp}" "$pid" 2>/dev/null || true
    fi

    # Also dump interesting memory regions directly
    if [ -f "/proc/$pid/maps" ] && [ -r "/proc/$pid/mem" ]; then
        while IFS= read -r line; do
            local start_addr=$(echo "$line" | awk '{print $1}' | cut -d'-' -f1)
            local end_addr=$(echo "$line" | awk '{print $1}' | cut -d'-' -f2)
            local perms=$(echo "$line" | awk '{print $2}')
            local region=$(echo "$line" | awk '{print $6}' | xargs 2>/dev/null || echo "anon")

            if [[ "$perms" == *"x"* ]] || [[ "$region" == "[heap]" ]] || [[ "$region" == "[stack]" ]] || [[ "$perms" == "rwx"* ]]; then
                local region_file="$MEMORY_DIR/region_${pid}_${start_addr}_${perms// /_}.bin"
                local start_dec=$((16#$start_addr))
                local end_dec=$((16#$end_addr))
                local size=$((end_dec - start_dec))

                if [ $size -gt 0 ] && [ $size -lt 67108864 ]; then
                    dd if="/proc/$pid/mem" of="$region_file" bs=1 skip=$start_dec count=$size 2>/dev/null || true
                fi
            fi
        done < "/proc/$pid/maps"
    fi

    echo "[MEMORY] Dump complete for PID $pid"
}

is_suspicious_syscall() {
    local syscall="$1"
    local args="$2"

    case "$syscall" in
        mprotect)
            [[ "$args" == *"PROT_EXEC"* ]] && return 0
            ;;
        mmap)
            [[ "$args" == *"PROT_EXEC"* ]] && [[ "$args" == *"PROT_WRITE"* ]] && return 0
            ;;
        ptrace|process_vm_writev|process_vm_readv|memfd_create|execve|execveat)
            return 0
            ;;
    esac

    return 1
}

# ============================================
# START MONITORING
# ============================================

# Start video recording first (for GUI samples)
start_video_recording

# 1. Start network capture
if command -v tcpdump &> /dev/null; then
    echo "[+] Starting network capture..."
    tcpdump -i any -w "$OUTPUT_DIR/network.pcap" 2>/dev/null &
    TCPDUMP_PID=$!
else
    echo "[!] tcpdump not available, skipping network capture"
    TCPDUMP_PID=""
fi

# 2. Start file monitoring
echo "[+] Starting file monitor..."
inotifywait -m -r -e create,modify,delete,move,access,open /sandbox /tmp /home 2>/dev/null \
    --format '%T %w %e %f' --timefmt '%s' \
    -o "$OUTPUT_DIR/file_events.log" &
INOTIFY_PID=$!

sleep 0.5

# 3. Capture initial state
echo "[+] Capturing initial system state..."
ps aux > "$OUTPUT_DIR/processes_start.log" 2>/dev/null || true
netstat -an > "$OUTPUT_DIR/network_start.log" 2>/dev/null || true
ls -laR /sandbox > "$OUTPUT_DIR/filesystem_start.log" 2>/dev/null || true

# ============================================
# SAMPLE EXECUTION WITH MEMORY MONITORING
# ============================================

echo "[+] Executing sample with syscall tracing..."
if [ -x "$SAMPLE_PATH" ] || file "$SAMPLE_PATH" 2>/dev/null | grep -qE "executable|ELF|PE32"; then
    chmod +x "$SAMPLE_PATH" 2>/dev/null || true

    # Create named pipe for syscall monitoring
    SYSCALL_PIPE="/tmp/syscall_pipe_$$"
    mkfifo "$SYSCALL_PIPE" 2>/dev/null || true

    # Start strace with output to pipe
    strace -f -o "$SYSCALL_PIPE" -tt -T -e trace=all \
        timeout "${TIMEOUT}s" "$SAMPLE_PATH" \
        > "$OUTPUT_DIR/stdout.log" 2> "$OUTPUT_DIR/stderr.log" &
    STRACE_PID=$!
    SAMPLE_PID=$!

    # Process syscall output and trigger memory dumps on suspicious calls
    (
        LAST_DUMP_TIME=0
        DUMP_COOLDOWN=5

        while IFS= read -r line; do
            echo "$line" >> "$OUTPUT_DIR/syscalls.log"

            if [[ "$line" =~ ([a-z_]+)\( ]]; then
                syscall="${BASH_REMATCH[1]}"
                current_time=$(date +%s)

                if [[ "$line" =~ ^([0-9]+) ]]; then
                    traced_pid="${BASH_REMATCH[1]}"

                    if is_suspicious_syscall "$syscall" "$line"; then
                        if [ $((current_time - LAST_DUMP_TIME)) -gt $DUMP_COOLDOWN ]; then
                            echo "[!] Suspicious syscall detected: $syscall"
                            capture_memory_dump "$traced_pid" "syscall_${syscall}" &
                            LAST_DUMP_TIME=$current_time
                        fi
                    fi
                fi
            fi
        done < "$SYSCALL_PIPE"
    ) &
    SYSCALL_MONITOR_PID=$!

else
    echo "[!] Sample is not executable, analyzing as data file"
    file "$SAMPLE_PATH" > "$OUTPUT_DIR/file_info.log"
    strings "$SAMPLE_PATH" | head -1000 > "$OUTPUT_DIR/strings.log" 2>/dev/null || true
    hexdump -C "$SAMPLE_PATH" | head -500 > "$OUTPUT_DIR/hexdump.log" 2>/dev/null || true
    STRACE_PID=""
    SAMPLE_PID=""
    SYSCALL_MONITOR_PID=""
fi

# ============================================
# PROCESS MONITORING LOOP
# ============================================

echo "[+] Monitoring processes..."
MONITOR_COUNT=0
DUMPED_PIDS=""

while [ $MONITOR_COUNT -lt $TIMEOUT ]; do
    if [ -n "$STRACE_PID" ] && ! kill -0 $STRACE_PID 2>/dev/null; then
        break
    fi

    ps aux > "$OUTPUT_DIR/processes_$(date +%s).log" 2>/dev/null || true

    if [ -n "$SAMPLE_PID" ]; then
        for child_pid in $(pgrep -P $SAMPLE_PID 2>/dev/null); do
            if [[ ! "$DUMPED_PIDS" == *"$child_pid"* ]]; then
                echo "[+] New child process detected: $child_pid"
                capture_memory_dump "$child_pid" "child_spawn" &
                DUMPED_PIDS="$DUMPED_PIDS $child_pid"
            fi
        done
    fi

    sleep 1
    MONITOR_COUNT=$((MONITOR_COUNT + 1))
done

# ============================================
# FINAL CLEANUP
# ============================================

echo "[+] Capturing exit memory dumps..."
if [ -n "$SAMPLE_PID" ] && kill -0 $SAMPLE_PID 2>/dev/null; then
    capture_memory_dump "$SAMPLE_PID" "exit"
    for child_pid in $(pgrep -P $SAMPLE_PID 2>/dev/null); do
        capture_memory_dump "$child_pid" "exit"
    done
fi

if [ -n "$STRACE_PID" ]; then
    wait $STRACE_PID 2>/dev/null || true
    EXIT_CODE=$?
else
    EXIT_CODE=0
fi

echo "[+] Cleaning up monitors..."
[ -n "$TCPDUMP_PID" ] && kill $TCPDUMP_PID 2>/dev/null || true
[ -n "$INOTIFY_PID" ] && kill $INOTIFY_PID 2>/dev/null || true
[ -n "$SYSCALL_MONITOR_PID" ] && kill $SYSCALL_MONITOR_PID 2>/dev/null || true
rm -f "$SYSCALL_PIPE" 2>/dev/null || true

# Stop video recording
stop_video_recording

# Capture final state
echo "[+] Capturing final state..."
ps aux > "$OUTPUT_DIR/processes_end.log" 2>/dev/null || true
netstat -an > "$OUTPUT_DIR/network_end.log" 2>/dev/null || true
ls -laR /sandbox > "$OUTPUT_DIR/filesystem_end.log" 2>/dev/null || true
df -h > "$OUTPUT_DIR/disk_usage.log" 2>/dev/null || true

# Record end time and exit code
echo "$(date +%s)" > "$OUTPUT_DIR/end_time"
echo "$EXIT_CODE" > "$OUTPUT_DIR/exit_code"

# ============================================
# GENERATE SUMMARY
# ============================================

echo "[+] Generating execution summary..."
{
    echo "=== Athena Sandbox Execution Summary v2.1 ==="
    echo "Sample: $SAMPLE_PATH"
    echo "Exit Code: $EXIT_CODE"
    echo "Duration: $(($(cat $OUTPUT_DIR/end_time) - $(cat $OUTPUT_DIR/start_time))) seconds"
    echo ""
    echo "=== File Events ==="
    wc -l < "$OUTPUT_DIR/file_events.log" 2>/dev/null || echo "0"
    echo ""
    echo "=== Syscall Summary ==="
    if [ -f "$OUTPUT_DIR/syscalls.log" ]; then
        grep -oP '^\d+\s+\d+:\d+:\d+\.\d+\s+\K[a-z_]+' "$OUTPUT_DIR/syscalls.log" 2>/dev/null | sort | uniq -c | sort -rn | head -20
    else
        echo "No syscalls captured"
    fi
    echo ""
    echo "=== Memory Dumps ==="
    ls -lh "$MEMORY_DIR" 2>/dev/null | wc -l
    echo "Files captured:"
    ls -lh "$MEMORY_DIR" 2>/dev/null | head -20
    echo ""
    echo "=== Video Recording ==="
    if [ -f "$OUTPUT_DIR/recording.mp4" ]; then
        echo "Recording: $(ls -lh $OUTPUT_DIR/recording.mp4 | awk '{print $5}')"
        echo "Screenshots: $(ls -1 $SCREENSHOT_DIR/*.png 2>/dev/null | wc -l)"
    else
        echo "No video recording"
    fi
    echo ""
    echo "=== Network Connections ==="
    if [ -f "$OUTPUT_DIR/network.pcap" ]; then
        echo "PCAP captured: $(ls -lh $OUTPUT_DIR/network.pcap 2>/dev/null | awk '{print $5}')"
    else
        echo "No network capture"
    fi
    echo ""
    echo "=== Suspicious Activity Detected ==="
    if [ -f "$OUTPUT_DIR/syscalls.log" ]; then
        echo "Code injection indicators:"
        grep -c "mprotect.*PROT_EXEC" "$OUTPUT_DIR/syscalls.log" 2>/dev/null || echo "0"
        echo "Process injection indicators:"
        grep -c "ptrace\|process_vm" "$OUTPUT_DIR/syscalls.log" 2>/dev/null || echo "0"
        echo "Fileless execution indicators:"
        grep -c "memfd_create" "$OUTPUT_DIR/syscalls.log" 2>/dev/null || echo "0"
    fi
} > "$OUTPUT_DIR/summary.log"

echo "[+] Analysis complete"
echo "[+] Exit code: $EXIT_CODE"
echo "[+] Memory dumps: $(ls -1 $MEMORY_DIR 2>/dev/null | wc -l) files"
echo "[+] Screenshots: $(ls -1 $SCREENSHOT_DIR/*.png 2>/dev/null | wc -l) files"
if [ -f "$OUTPUT_DIR/recording.mp4" ]; then
    echo "[+] Video: $(ls -lh $OUTPUT_DIR/recording.mp4 | awk '{print $5}')"
fi
echo "[+] Output saved to: $OUTPUT_DIR"

exit $EXIT_CODE

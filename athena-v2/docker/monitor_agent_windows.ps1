<#
.SYNOPSIS
    Athena Windows Sandbox Monitor Agent

.DESCRIPTION
    Monitors malware sample execution in a Windows container using:
    - ETW (Event Tracing for Windows) for syscall and kernel-level events
    - Process Monitor for file, registry, and network activity
    - procdump for memory dumps on suspicious activity
    - Network trace for packet capture

.PARAMETER SamplePath
    Full path to the sample to execute

.PARAMETER TimeoutSecs
    Maximum execution time in seconds (default: 120)

.PARAMETER CaptureMemory
    Enable memory dump capture (default: true)

.PARAMETER CaptureNetwork
    Enable network capture (default: true)

.EXAMPLE
    .\monitor_agent_windows.ps1 -SamplePath C:\sandbox\input\sample.exe -TimeoutSecs 60

.NOTES
    Requires: Windows Server 2019+ or Windows 10/11
    Requires: Sysinternals tools installed in C:\tools
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$SamplePath,

    [Parameter(Mandatory=$false)]
    [int]$TimeoutSecs = 120,

    [Parameter(Mandatory=$false)]
    [bool]$CaptureMemory = $true,

    [Parameter(Mandatory=$false)]
    [bool]$CaptureNetwork = $true
)

# Configuration
$OutputDir = "C:\sandbox\output"
$MemoryDir = "$OutputDir\memory"
$NetworkDir = "$OutputDir\network"
$ProcmonDir = "$OutputDir\procmon"
$EtwDir = "$OutputDir\etw"
$ToolsDir = "C:\tools"

# Timing
$StartTime = Get-Date

# Results object
$Results = @{
    session_id = [guid]::NewGuid().ToString()
    sample_path = $SamplePath
    sample_name = [System.IO.Path]::GetFileName($SamplePath)
    start_time = $StartTime.ToString("o")
    end_time = $null
    exit_code = $null
    execution_time_ms = 0
    behavioral_events = @()
    file_operations = @()
    registry_operations = @()
    network_connections = @()
    processes_created = @()
    memory_dumps = @()
    syscall_summary = @{}
    mitre_attacks = @()
    screenshots = @()
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    Write-Host "[$timestamp] [$Level] $Message"
}

function Add-BehavioralEvent {
    param(
        [string]$EventType,
        [string]$Description,
        [string]$Severity = "Low",
        [string]$MitreId = $null
    )

    $event = @{
        timestamp = [int]((Get-Date) - $StartTime).TotalMilliseconds
        event_type = $EventType
        description = $Description
        severity = $Severity
        mitre_attack_id = $MitreId
    }
    $Results.behavioral_events += $event
    Write-Log "Behavioral event: $Description" $Severity
}

function Start-ETWTracing {
    Write-Log "Starting ETW tracing..."

    try {
        # Create ETW trace session for process events
        $traceProcess = Start-Process -FilePath "logman" -ArgumentList @(
            "create", "trace", "AthenaProcess",
            "-p", "{22FB2CD6-0E7B-422B-A0C7-2FAD1FD0E716}",  # Microsoft-Windows-Kernel-Process
            "-o", "$EtwDir\process.etl",
            "-ets"
        ) -PassThru -NoNewWindow -Wait

        # Create ETW trace session for network events
        $traceNetwork = Start-Process -FilePath "logman" -ArgumentList @(
            "create", "trace", "AthenaNetwork",
            "-p", "{7DD42A49-5329-4832-8DFD-43D979153A88}",  # Microsoft-Windows-Kernel-Network
            "-o", "$EtwDir\network.etl",
            "-ets"
        ) -PassThru -NoNewWindow -Wait

        # Create ETW trace session for file I/O events
        $traceFile = Start-Process -FilePath "logman" -ArgumentList @(
            "create", "trace", "AthenaFile",
            "-p", "{EDD08927-9CC4-4E65-B970-C2560FB5C289}",  # Microsoft-Windows-Kernel-File
            "-o", "$EtwDir\file.etl",
            "-ets"
        ) -PassThru -NoNewWindow -Wait

        # Create ETW trace session for registry events
        $traceRegistry = Start-Process -FilePath "logman" -ArgumentList @(
            "create", "trace", "AthenaRegistry",
            "-p", "{70EB4F03-C1DE-4F73-A051-33D13D5413BD}",  # Microsoft-Windows-Kernel-Registry
            "-o", "$EtwDir\registry.etl",
            "-ets"
        ) -PassThru -NoNewWindow -Wait

        Write-Log "ETW tracing started successfully"
        return $true
    }
    catch {
        Write-Log "Failed to start ETW tracing: $_" "WARNING"
        return $false
    }
}

function Stop-ETWTracing {
    Write-Log "Stopping ETW tracing..."

    $sessions = @("AthenaProcess", "AthenaNetwork", "AthenaFile", "AthenaRegistry")
    foreach ($session in $sessions) {
        try {
            Start-Process -FilePath "logman" -ArgumentList @("stop", $session, "-ets") -NoNewWindow -Wait
        }
        catch {
            Write-Log "Failed to stop session $session" "WARNING"
        }
    }
}

function Start-ProcMon {
    Write-Log "Starting Process Monitor..."

    $procmonPath = "$ToolsDir\procmon.exe"
    if (-not (Test-Path $procmonPath)) {
        Write-Log "Process Monitor not found at $procmonPath" "WARNING"
        return $null
    }

    try {
        # Start Process Monitor in background logging mode
        $procmonArgs = @(
            "/Quiet",
            "/Minimized",
            "/BackingFile", "$ProcmonDir\procmon.pml",
            "/AcceptEula"
        )

        $procmonProcess = Start-Process -FilePath $procmonPath -ArgumentList $procmonArgs -PassThru -NoNewWindow
        Write-Log "Process Monitor started (PID: $($procmonProcess.Id))"
        return $procmonProcess
    }
    catch {
        Write-Log "Failed to start Process Monitor: $_" "WARNING"
        return $null
    }
}

function Stop-ProcMon {
    param($ProcMonProcess)

    Write-Log "Stopping Process Monitor..."

    try {
        # Send terminate signal to Process Monitor
        Start-Process -FilePath "$ToolsDir\procmon.exe" -ArgumentList "/Terminate" -NoNewWindow -Wait
        Start-Sleep -Seconds 2

        # Convert PML to CSV for easier parsing
        if (Test-Path "$ProcmonDir\procmon.pml") {
            $csvPath = "$ProcmonDir\procmon.csv"
            Start-Process -FilePath "$ToolsDir\procmon.exe" -ArgumentList @(
                "/OpenLog", "$ProcmonDir\procmon.pml",
                "/SaveAs", $csvPath,
                "/AcceptEula"
            ) -NoNewWindow -Wait

            if (Test-Path $csvPath) {
                Write-Log "Process Monitor log saved to $csvPath"
            }
        }
    }
    catch {
        Write-Log "Failed to stop Process Monitor: $_" "WARNING"
    }
}

function Start-NetworkCapture {
    Write-Log "Starting network capture..."

    try {
        # Use netsh trace for network capture
        $netshArgs = @(
            "trace", "start",
            "capture=yes",
            "tracefile=$NetworkDir\capture.etl",
            "maxsize=100",  # MB
            "persistent=no"
        )

        Start-Process -FilePath "netsh" -ArgumentList $netshArgs -NoNewWindow -Wait
        Write-Log "Network capture started"
        return $true
    }
    catch {
        Write-Log "Failed to start network capture: $_" "WARNING"
        return $false
    }
}

function Stop-NetworkCapture {
    Write-Log "Stopping network capture..."

    try {
        Start-Process -FilePath "netsh" -ArgumentList @("trace", "stop") -NoNewWindow -Wait
        Write-Log "Network capture stopped"
    }
    catch {
        Write-Log "Failed to stop network capture: $_" "WARNING"
    }
}

function Capture-MemoryDump {
    param(
        [int]$Pid,
        [string]$Trigger,
        [string]$ProcessName
    )

    $procdumpPath = "$ToolsDir\procdump.exe"
    if (-not (Test-Path $procdumpPath)) {
        Write-Log "procdump not found at $procdumpPath" "WARNING"
        return $null
    }

    try {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $dumpPath = "$MemoryDir\dump_${Pid}_${Trigger}_${timestamp}.dmp"

        Write-Log "Capturing memory dump for PID $Pid ($ProcessName) - Trigger: $Trigger"

        # Capture full memory dump
        $dumpProcess = Start-Process -FilePath $procdumpPath -ArgumentList @(
            "-ma",  # Full dump
            "-accepteula",
            $Pid,
            $dumpPath
        ) -PassThru -NoNewWindow -Wait

        if (Test-Path $dumpPath) {
            $dumpInfo = Get-Item $dumpPath
            $dump = @{
                pid = $Pid
                process_name = $ProcessName
                timestamp = [int]((Get-Date) - $StartTime).TotalMilliseconds
                trigger = $Trigger
                dump_path = $dumpPath
                size_bytes = $dumpInfo.Length
            }
            $Results.memory_dumps += $dump
            Write-Log "Memory dump saved: $dumpPath ($($dumpInfo.Length) bytes)"
            return $dump
        }
    }
    catch {
        Write-Log "Failed to capture memory dump: $_" "ERROR"
    }

    return $null
}

function Monitor-ChildProcesses {
    param([int]$ParentPid)

    # Get child processes of the sample
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentPid" -ErrorAction SilentlyContinue

    foreach ($child in $children) {
        $procInfo = @{
            pid = $child.ProcessId
            name = $child.Name
            command_line = $child.CommandLine
            parent_pid = $ParentPid
        }
        $Results.processes_created += $procInfo

        Add-BehavioralEvent -EventType "ProcessCreated" `
            -Description "Child process: $($child.Name) (PID: $($child.ProcessId))" `
            -Severity "Medium"

        # Check for suspicious process names
        $suspiciousProcesses = @("powershell", "cmd", "wscript", "cscript", "mshta", "regsvr32", "rundll32", "certutil")
        if ($suspiciousProcesses | Where-Object { $child.Name -like "*$_*" }) {
            Add-BehavioralEvent -EventType "SuspiciousProcess" `
                -Description "Suspicious child process: $($child.Name)" `
                -Severity "High" `
                -MitreId "T1059"

            if ($CaptureMemory) {
                Capture-MemoryDump -Pid $child.ProcessId -Trigger "SuspiciousProcess" -ProcessName $child.Name
            }
        }

        # Recursively monitor grandchildren
        Monitor-ChildProcesses -ParentPid $child.ProcessId
    }
}

function Parse-ProcMonLog {
    $csvPath = "$ProcmonDir\procmon.csv"
    if (-not (Test-Path $csvPath)) {
        Write-Log "ProcMon log not found" "WARNING"
        return
    }

    Write-Log "Parsing Process Monitor log..."

    try {
        $content = Get-Content $csvPath -ErrorAction SilentlyContinue
        if (-not $content) { return }

        foreach ($line in $content | Select-Object -Skip 1 | Select-Object -First 5000) {
            $parts = $line -split ','
            if ($parts.Count -lt 7) { continue }

            $operation = $parts[4] -replace '"', ''
            $path = $parts[5] -replace '"', ''
            $result = $parts[6] -replace '"', ''

            # Categorize operations
            if ($operation -match "RegSet|RegCreate|RegDelete") {
                $regOp = @{
                    timestamp = 0
                    operation = $operation
                    key_path = $path
                    value = $result
                }
                $Results.registry_operations += $regOp

                # Check for persistence
                if ($path -match "Run|RunOnce|Startup|Services") {
                    Add-BehavioralEvent -EventType "RegistryPersistence" `
                        -Description "Registry persistence: $path" `
                        -Severity "High" `
                        -MitreId "T1547"
                }
            }
            elseif ($operation -match "CreateFile|WriteFile|DeleteFile") {
                $fileOp = @{
                    timestamp = 0
                    operation = $operation
                    path = $path
                }
                $Results.file_operations += $fileOp

                # Check for suspicious file operations
                if ($path -match "\\System32\\|\\Temp\\|\\AppData\\") {
                    Add-BehavioralEvent -EventType "FileModified" `
                        -Description "File operation in sensitive location: $path" `
                        -Severity "Medium"
                }
            }
        }

        Write-Log "Parsed $(($Results.file_operations).Count) file operations and $(($Results.registry_operations).Count) registry operations"
    }
    catch {
        Write-Log "Failed to parse ProcMon log: $_" "WARNING"
    }
}

function Map-MitreAttacks {
    # Analyze behavioral events to map MITRE ATT&CK techniques
    $attacks = @()

    # Check for process injection indicators
    if ($Results.behavioral_events | Where-Object { $_.event_type -match "SuspiciousProcess|Injection" }) {
        $attacks += @{
            id = "T1055"
            name = "Process Injection"
            description = "Potential process injection detected"
            confidence = 0.75
        }
    }

    # Check for persistence
    if ($Results.registry_operations | Where-Object { $_.key_path -match "Run|RunOnce|Services" }) {
        $attacks += @{
            id = "T1547"
            name = "Boot or Logon Autostart Execution"
            description = "Registry-based persistence detected"
            confidence = 0.85
        }
    }

    # Check for defense evasion
    if ($Results.file_operations | Where-Object { $_.path -match "\\System32\\" }) {
        $attacks += @{
            id = "T1070"
            name = "Indicator Removal"
            description = "Modification of system files detected"
            confidence = 0.6
        }
    }

    # Check for network activity
    if (($Results.network_connections).Count -gt 0) {
        $attacks += @{
            id = "T1071"
            name = "Application Layer Protocol"
            description = "Network communication detected"
            confidence = 0.7
        }
    }

    $Results.mitre_attacks = $attacks
}

function Execute-Sample {
    Write-Log "=========================================="
    Write-Log "Athena Windows Sandbox Monitor Agent"
    Write-Log "=========================================="
    Write-Log "Session ID: $($Results.session_id)"
    Write-Log "Sample: $SamplePath"
    Write-Log "Timeout: $TimeoutSecs seconds"
    Write-Log "Memory capture: $CaptureMemory"
    Write-Log "Network capture: $CaptureNetwork"
    Write-Log "=========================================="

    # Validate sample exists
    if (-not (Test-Path $SamplePath)) {
        Write-Log "Sample not found: $SamplePath" "ERROR"
        $Results.exit_code = -1
        return
    }

    # Start monitoring
    $etwStarted = Start-ETWTracing
    $procmonProcess = Start-ProcMon

    if ($CaptureNetwork) {
        $networkStarted = Start-NetworkCapture
    }

    # Initial memory dump
    Add-BehavioralEvent -EventType "AnalysisStarted" `
        -Description "Starting analysis of $($Results.sample_name)" `
        -Severity "Info"

    try {
        # Execute the sample
        Write-Log "Executing sample..."
        $sampleProcess = Start-Process -FilePath $SamplePath -PassThru -ErrorAction Stop
        $samplePid = $sampleProcess.Id

        Add-BehavioralEvent -EventType "ProcessCreated" `
            -Description "Sample process started (PID: $samplePid)" `
            -Severity "Info"

        # Capture initial memory dump
        if ($CaptureMemory) {
            Capture-MemoryDump -Pid $samplePid -Trigger "Initial" -ProcessName $Results.sample_name
        }

        # Monitor execution with timeout
        $monitoringInterval = 5  # seconds
        $elapsed = 0

        while (-not $sampleProcess.HasExited -and $elapsed -lt $TimeoutSecs) {
            Start-Sleep -Seconds $monitoringInterval
            $elapsed += $monitoringInterval

            # Monitor child processes
            Monitor-ChildProcesses -ParentPid $samplePid

            # Check for suspicious activity
            if ($elapsed % 30 -eq 0) {
                Write-Log "Still running... ($elapsed/$TimeoutSecs seconds)"
            }
        }

        # Check if process timed out
        if (-not $sampleProcess.HasExited) {
            Write-Log "Sample execution timed out, terminating..." "WARNING"

            # Capture final memory dump before termination
            if ($CaptureMemory) {
                Capture-MemoryDump -Pid $samplePid -Trigger "Timeout" -ProcessName $Results.sample_name
            }

            Stop-Process -Id $samplePid -Force -ErrorAction SilentlyContinue
            Add-BehavioralEvent -EventType "Timeout" `
                -Description "Sample execution timed out after $TimeoutSecs seconds" `
                -Severity "Warning"
        }
        else {
            $Results.exit_code = $sampleProcess.ExitCode
            Add-BehavioralEvent -EventType "ProcessExited" `
                -Description "Sample exited with code $($Results.exit_code)" `
                -Severity "Info"
        }
    }
    catch {
        Write-Log "Execution error: $_" "ERROR"
        Add-BehavioralEvent -EventType "ExecutionError" `
            -Description "Failed to execute sample: $_" `
            -Severity "High"
        $Results.exit_code = -1
    }
    finally {
        # Stop monitoring
        Stop-ETWTracing
        if ($procmonProcess) {
            Stop-ProcMon -ProcMonProcess $procmonProcess
        }
        if ($CaptureNetwork) {
            Stop-NetworkCapture
        }
    }

    # Parse logs and analyze results
    Parse-ProcMonLog
    Map-MitreAttacks

    # Finalize results
    $Results.end_time = (Get-Date).ToString("o")
    $Results.execution_time_ms = [int]((Get-Date) - $StartTime).TotalMilliseconds

    # Export results
    $resultsPath = "$OutputDir\results.json"
    $Results | ConvertTo-Json -Depth 10 | Set-Content $resultsPath
    Write-Log "Results saved to $resultsPath"

    # Summary
    Write-Log "=========================================="
    Write-Log "Analysis Complete"
    Write-Log "=========================================="
    Write-Log "Duration: $($Results.execution_time_ms)ms"
    Write-Log "Exit code: $($Results.exit_code)"
    Write-Log "Behavioral events: $(($Results.behavioral_events).Count)"
    Write-Log "File operations: $(($Results.file_operations).Count)"
    Write-Log "Registry operations: $(($Results.registry_operations).Count)"
    Write-Log "Processes created: $(($Results.processes_created).Count)"
    Write-Log "Memory dumps: $(($Results.memory_dumps).Count)"
    Write-Log "MITRE ATT&CK techniques: $(($Results.mitre_attacks).Count)"
    Write-Log "=========================================="

    # Output JSON results to stdout for collection
    $Results | ConvertTo-Json -Depth 10
}

# Main entry point
Execute-Sample

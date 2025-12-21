<#
.SYNOPSIS
    Athena Windows Anti-Evasion Script

.DESCRIPTION
    Obfuscates the Windows container environment to appear as a legitimate
    user workstation, making sandbox detection more difficult for malware.

    Techniques include:
    - Creating realistic user files and browser history
    - Setting realistic environment variables
    - Creating fake background processes
    - Randomizing system identifiers
    - Hiding container-specific artifacts

.NOTES
    Run this before executing malware samples to maximize evasion coverage.
#>

$ErrorActionPreference = "SilentlyContinue"

function Write-Log {
    param([string]$Message)
    Write-Host "[ANTI-EVASION] $Message"
}

Write-Log "Starting Windows environment obfuscation..."

# ============================================
# HIDE CONTAINER ARTIFACTS
# ============================================

function Hide-ContainerArtifacts {
    Write-Log "Hiding container artifacts..."

    # Remove Docker-specific environment variables
    $dockerVars = @("DOCKER_HOST", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH")
    foreach ($var in $dockerVars) {
        [Environment]::SetEnvironmentVariable($var, $null, "Process")
    }

    # Modify container-specific registry keys
    try {
        # Hide container detection registry keys
        $containerKey = "HKLM:\SOFTWARE\Microsoft\Virtual Machine\Guest\Parameters"
        if (Test-Path $containerKey) {
            Remove-ItemProperty -Path $containerKey -Name * -Force
        }
    }
    catch {
        # May not have permissions, continue anyway
    }

    Write-Log "Container artifacts hidden"
}

# ============================================
# SET REALISTIC COMPUTER NAME
# ============================================

function Set-RealisticComputerName {
    Write-Log "Setting realistic computer name..."

    $prefixes = @("DESKTOP", "LAPTOP", "WORKSTATION", "PC")
    $suffixes = @("WORK", "HOME", "OFFICE", "")
    $usernames = @("JOHN", "MIKE", "SARAH", "ADMIN", "USER")

    $randomPrefix = $prefixes | Get-Random
    $randomSuffix = $suffixes | Get-Random
    $randomUser = $usernames | Get-Random
    $randomNum = Get-Random -Minimum 1 -Maximum 999

    $newName = if ($randomSuffix) {
        "$randomPrefix-$randomUser-$randomSuffix"
    } else {
        "$randomPrefix-$randomUser$randomNum"
    }

    # Set computer name in environment
    [Environment]::SetEnvironmentVariable("COMPUTERNAME", $newName, "Process")
    $env:COMPUTERNAME = $newName

    Write-Log "Computer name set to $newName"
}

# ============================================
# CREATE REALISTIC USER ENVIRONMENT
# ============================================

function Create-UserEnvironment {
    Write-Log "Creating realistic user environment..."

    $userHome = $env:USERPROFILE

    # Create standard user directories
    $dirs = @(
        "$userHome\Desktop",
        "$userHome\Documents",
        "$userHome\Downloads",
        "$userHome\Pictures",
        "$userHome\Videos",
        "$userHome\Music",
        "$userHome\AppData\Local\Google\Chrome\User Data\Default",
        "$userHome\AppData\Local\Microsoft\Edge\User Data\Default",
        "$userHome\AppData\Roaming\Microsoft\Windows\Recent"
    )

    foreach ($dir in $dirs) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    # Create fake documents
    $docsPath = "$userHome\Documents"

    # Meeting notes
    @"
Meeting Notes - December 2025

Attendees: John, Sarah, Mike, Lisa

Agenda:
1. Q4 Review
2. 2026 Planning
3. Budget Discussion

Action Items:
- John: Finalize report by Friday
- Sarah: Schedule follow-up meeting
- Mike: Update project timeline
"@ | Set-Content "$docsPath\meeting_notes.txt"

    # TODO list
    @"
TODO List:
- [ ] Finish quarterly report
- [ ] Call dentist for appointment
- [ ] Buy groceries
- [x] Update laptop software
- [ ] Review team feedback
- [ ] Plan vacation for March
"@ | Set-Content "$docsPath\todo_list.txt"

    # Fake passwords file (honeypot)
    @"
Email: john.smith@gmail.com / Summer2025!
Bank: checking123 / Banking#456
Work VPN: jsmith / Corp@ccess2025
Amazon: john.smith / ShopNow$99
"@ | Set-Content "$docsPath\passwords.txt"

    # Create fake browser bookmarks
    $chromeBookmarks = @"
{
   "checksum": "abcd1234",
   "roots": {
      "bookmark_bar": {
         "children": [
            {"name": "Google", "type": "url", "url": "https://www.google.com/"},
            {"name": "YouTube", "type": "url", "url": "https://www.youtube.com/"},
            {"name": "Amazon", "type": "url", "url": "https://www.amazon.com/"},
            {"name": "Facebook", "type": "url", "url": "https://www.facebook.com/"},
            {"name": "Gmail", "type": "url", "url": "https://mail.google.com/"},
            {"name": "LinkedIn", "type": "url", "url": "https://www.linkedin.com/"}
         ],
         "name": "Bookmarks Bar",
         "type": "folder"
      }
   }
}
"@
    Set-Content "$userHome\AppData\Local\Google\Chrome\User Data\Default\Bookmarks" $chromeBookmarks

    # Create fake browsing history text file
    @"
2025-12-18 09:15:00 https://www.google.com - Google Search
2025-12-18 09:20:00 https://mail.google.com - Gmail
2025-12-18 10:00:00 https://www.youtube.com/watch?v=abc123 - YouTube
2025-12-18 11:30:00 https://www.amazon.com - Shopping
2025-12-18 14:00:00 https://github.com/user/project - GitHub
2025-12-18 15:45:00 https://www.linkedin.com - LinkedIn
2025-12-19 08:30:00 https://news.google.com - News
2025-12-19 09:00:00 https://www.reddit.com/r/technology - Reddit
"@ | Set-Content "$userHome\AppData\Local\Google\Chrome\User Data\Default\History.txt"

    # Create some random files
    $random = New-Object byte[] 50000
    (New-Object Random).NextBytes($random)
    [IO.File]::WriteAllBytes("$userHome\Pictures\vacation_2024.jpg", $random[0..30000])
    [IO.File]::WriteAllBytes("$userHome\Pictures\family_photo.png", $random[0..25000])
    [IO.File]::WriteAllBytes("$userHome\Downloads\invoice_12345.pdf", $random[0..15000])
    [IO.File]::WriteAllBytes("$userHome\Downloads\presentation.pptx", $random[0..75000])

    # Create a fake executable in Downloads (common target for malware)
    New-Item -ItemType File -Path "$userHome\Downloads\setup_latest.exe" -Force | Out-Null

    Write-Log "User environment created"
}

# ============================================
# SET REALISTIC ENVIRONMENT VARIABLES
# ============================================

function Set-EnvironmentVariables {
    Write-Log "Setting realistic environment variables..."

    $userNames = @("John Smith", "Michael Johnson", "Sarah Williams", "Robert Brown")
    $selectedUser = $userNames | Get-Random
    $firstName = ($selectedUser -split " ")[0]

    # Set environment variables
    $envVars = @{
        "USERNAME" = $firstName
        "USER" = $firstName
        "USERDOMAIN" = "CORP"
        "LOGONSERVER" = "\\DC01"
        "HOMEPATH" = "\Users\$firstName"
        "HOMEDRIVE" = "C:"
        "OS" = "Windows_NT"
        "PROCESSOR_ARCHITECTURE" = "AMD64"
        "PROCESSOR_IDENTIFIER" = "Intel64 Family 6 Model 142 Stepping 10, GenuineIntel"
        "NUMBER_OF_PROCESSORS" = "8"
    }

    foreach ($key in $envVars.Keys) {
        [Environment]::SetEnvironmentVariable($key, $envVars[$key], "Process")
    }

    Write-Log "Environment variables set for user: $firstName"
}

# ============================================
# CREATE FAKE PROCESSES
# ============================================

function Spawn-FakeProcesses {
    Write-Log "Spawning fake background processes..."

    # PowerShell jobs that appear as common processes
    $fakeProcesses = @{
        "Chrome" = { while($true) { Start-Sleep 3600 } }
        "Outlook" = { while($true) { Start-Sleep 3600 } }
        "Teams" = { while($true) { Start-Sleep 3600 } }
    }

    foreach ($name in $fakeProcesses.Keys) {
        Start-Job -Name $name -ScriptBlock $fakeProcesses[$name] | Out-Null
    }

    Write-Log "Fake processes spawned"
}

# ============================================
# ADD REGISTRY ENTRIES
# ============================================

function Add-RealisticRegistry {
    Write-Log "Adding realistic registry entries..."

    try {
        # Add some common software registry keys
        $softwareKeys = @(
            "HKCU:\Software\Microsoft\Office",
            "HKCU:\Software\Google\Chrome",
            "HKCU:\Software\Microsoft\Teams",
            "HKCU:\Software\Slack"
        )

        foreach ($key in $softwareKeys) {
            if (-not (Test-Path $key)) {
                New-Item -Path $key -Force | Out-Null
            }
        }

        # Set last used times
        $now = Get-Date
        Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "LastCheckedDefaultBrowser" -Value $now.Ticks -Force

        Write-Log "Registry entries added"
    }
    catch {
        Write-Log "Warning: Could not modify some registry keys"
    }
}

# ============================================
# MODIFY SYSTEM TIME
# ============================================

function Set-RealisticSystemTime {
    Write-Log "Checking system time..."

    # Ensure the system time is during business hours
    $currentHour = (Get-Date).Hour

    if ($currentHour -lt 8 -or $currentHour -gt 18) {
        Write-Log "System time is outside business hours (current: $currentHour:00)"
        # Note: Changing system time requires admin privileges
        # Just log the discrepancy
    }
    else {
        Write-Log "System time is within business hours"
    }
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Log "=========================================="
Write-Log "Windows Anti-Evasion Tier 1"
Write-Log "=========================================="

Hide-ContainerArtifacts
Set-RealisticComputerName
Create-UserEnvironment
Set-EnvironmentVariables
Spawn-FakeProcesses
Add-RealisticRegistry
Set-RealisticSystemTime

Write-Log "=========================================="
Write-Log "Anti-evasion setup complete"
Write-Log "=========================================="

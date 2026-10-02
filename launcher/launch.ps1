param([switch]$Windowed)

# Keep -Windowed compatible with the previous CMD entry; all launches are windowed.

# Windows PowerShell 5.1; local files only; no server or installation.
$ErrorActionPreference = 'Stop'

function Find-BatteryBrowser {
    foreach ($browser in @(
        @{ Name = 'Chrome'; Executable = 'chrome.exe'; RelativePath = 'Google\Chrome\Application\chrome.exe' },
        @{ Name = 'Edge'; Executable = 'msedge.exe'; RelativePath = 'Microsoft\Edge\Application\msedge.exe' }
    )) {
        $candidates = @()
        foreach ($registryRoot in @(
            'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths',
            'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths',
            'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths'
        )) {
            $key = Get-Item -LiteralPath (Join-Path $registryRoot $browser.Executable) -ErrorAction SilentlyContinue
            if ($null -ne $key) {
                $registeredPath = $key.GetValue('')
                if ($registeredPath) { $candidates += ([string]$registeredPath).Trim('"') }
            }
        }
        foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
            if ($base) { $candidates += Join-Path $base $browser.RelativePath }
        }
        foreach ($candidate in $candidates) {
            if (Test-Path -LiteralPath $candidate -PathType Leaf) {
                return @{ Name = $browser.Name; Path = $candidate }
            }
        }
    }
    throw 'Chrome or Microsoft Edge was not found. Install one of these browsers, then try again.'
}

try {
    $appRoot = Split-Path -Parent $PSScriptRoot
    $indexPath = Join-Path $appRoot 'index.html'
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
        throw 'index.html was not found. Extract the entire ZIP before running START-WINDOW.vbs.'
    }
    $browser = Find-BatteryBrowser
    if (-not $env:LOCALAPPDATA) { throw 'The Windows local application data folder is unavailable.' }

    # A persistent, separate profile preserves settings and isolates normal tabs.
    # Browser state stays outside this distributable folder.
    $profilePath = Join-Path $env:LOCALAPPDATA ('WindowStarter\' + $browser.Name + 'Profile')
    [System.IO.Directory]::CreateDirectory($profilePath) | Out-Null
    $appUri = [System.Uri]::new([System.IO.Path]::GetFullPath($indexPath)).AbsoluteUri
    $browserArguments = @(
        ('--user-data-dir="' + $profilePath + '"'),
        '--no-first-run',
        '--no-default-browser-check',
        ('--app="' + $appUri + '"')
    )
    Start-Process -FilePath $browser.Path -ArgumentList ($browserArguments -join ' ') | Out-Null
    # Scope the taskbar identity to Battery windows in our dedicated profile.
    # Best effort: failure here never prevents the offline HTML app from opening.
    try {
        Add-Type -Path (Join-Path $PSScriptRoot 'TaskbarIdentity.cs')
        $iconPath = Join-Path $appRoot 'assets\branding\app-icon.ico'
        $relaunch = '"' + (Join-Path $env:WINDIR 'System32\wscript.exe') + '" "' + (Join-Path $appRoot 'START-WINDOW.vbs') + '"'
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        $applied = 0
        do {
            $processIds = @(Get-CimInstance Win32_Process -Filter ("Name='" + [IO.Path]::GetFileName($browser.Path) + "'") |
                Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($profilePath, [StringComparison]::OrdinalIgnoreCase) -ge 0 } |
                ForEach-Object { [int]$_.ProcessId })
            if ($processIds.Count) { $applied = [WindowTaskbarIdentity]::Apply([int[]]$processIds, $iconPath, $relaunch) }
            if (-not $applied) { Start-Sleep -Milliseconds 300 }
        } while (-not $applied -and [DateTime]::UtcNow -lt $deadline)
        if ($applied) { [WindowTaskbarIdentity]::KeepIconsAlive() }
    } catch { }
    exit 0
} catch {
    # A visible failure message even when launched by double-click.
    $message = $_.Exception.Message
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($message, 'Window Starter') | Out-Null
    } catch {
        Write-Error -Message $message -ErrorAction Continue
    }
    exit 1
}



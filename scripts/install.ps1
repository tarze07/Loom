# Installs the Loom CLI from a release archive on Windows (GitHub, internal mirror, or local offline zip).
# Needs only PowerShell 5.1+; no Node, npm, or compiler.
#
#   irm https://loom.local/install.ps1 | iex
#   .\install.ps1 -ArchivePath .\loom-0.1.9-minimal-win32-x64.zip -ChecksumsPath .\SHA256SUMS
#
# Environment (or matching parameters):
#   LOOM_CHANNEL           release train to follow: stable, nightly, or preview
#                            (default: stable; preview is a maintainers' test train)
#   LOOM_VERSION           exact version to install (overrides LOOM_CHANNEL)
#   LOOM_PROFILE           dependency profile: full or minimal (default: full)
#   LOOM_HOME              Loom home directory (default: ~\.loom)
#   LOOM_INSTALL_BIN_DIR   where loom.cmd is written (default: ~\.local\bin)
#   LOOM_RELEASE_BASE_URL  mirror for releases/download (default: GitHub)
#   LOOM_ARCHIVE_PATH      local zip archive path for 100% offline/air-gapped installation
#   LOOM_CHECKSUMS_PATH    local SHA256SUMS file for offline verification
#   LOOM_SKIP_CHECKSUM     set to 1 to skip checksum verification in offline mode
#   LOOM_NO_MODIFY_PATH    set to 1 to avoid mutating PATH or printing PATH instructions
#   LOOM_NON_INTERACTIVE   set to 1 to force non-interactive output
#
# The archive is unpacked into $LOOM_HOME\runtime\versions\<version>, the
# same layout `loom service install` uses, so the service reuses this download.
param(
  [string] $ArchivePath = $env:LOOM_ARCHIVE_PATH,
  [string] $ChecksumsPath = $env:LOOM_CHECKSUMS_PATH,
  [switch] $SkipChecksum,
  [string] $Profile = $env:LOOM_PROFILE,
  [string] $Version = $env:LOOM_VERSION,
  [string] $Channel = $env:LOOM_CHANNEL,
  [string] $LoomHome = $env:LOOM_HOME,
  [string] $BinDir = $env:LOOM_INSTALL_BIN_DIR,
  [string] $ReleaseBaseUrl = $env:LOOM_RELEASE_BASE_URL,
  [switch] $NoModifyPath,
  [switch] $NonInteractive
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo = "tarze07/Loom"
$defaultBaseUrl = "https://github.com/$repo/releases/download"
$baseUrl = if ($ReleaseBaseUrl) { $ReleaseBaseUrl.TrimEnd("/") } else { $defaultBaseUrl }
$loomHome = if ($LoomHome) { $LoomHome } else { Join-Path $HOME ".loom" }
$binDir = if ($BinDir) { $BinDir } else { Join-Path $HOME ".local\bin" }
# Absolute, so PATH never gets a folder that changes with the working directory.
$binDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($binDir)
$profile = if ($Profile) { $Profile } else { "full" }
$skipChecksumFlag = $SkipChecksum.IsPresent -or ($env:LOOM_SKIP_CHECKSUM -eq "1")
$noModifyPathFlag = $NoModifyPath.IsPresent -or ($env:LOOM_NO_MODIFY_PATH -eq "1")
$nonInteractiveFlag = $NonInteractive.IsPresent -or ($env:LOOM_NON_INTERACTIVE -eq "1")

function Fail([string] $message) {
  Write-Error "loom install: $message"
  exit 1
}

if ($profile -notin @("full", "minimal")) {
  Fail "LOOM_PROFILE must be full or minimal"
}

$terminal = -not $nonInteractiveFlag -and -not [Console]::IsErrorRedirected -and $env:TERM -ne "dumb"
$interactive = $terminal -and $Host.UI.SupportsVirtualTerminal
if ($interactive) {
  # Legacy code pages may support ANSI escapes but not the logo or bar glyphs.
  $glyphs = -join [char[]](0x2588, 0x2580, 0x2584, 0x25A0, 0x00B7)
  $encoding = [Console]::Error.Encoding
  $interactive = $encoding.GetString($encoding.GetBytes($glyphs)) -eq $glyphs
}
$esc = [char]27
$reset = $bold = $muted = $accent = $green = ""
if ($interactive -and -not $env:NO_COLOR) {
  $reset = "$esc[0m"; $bold = "$esc[1m"; $muted = "$esc[2m"
  $accent = "$esc[94m"; $green = "$esc[32m"
}
function Step([string] $message) {
  if ($interactive) { [Console]::Error.Write("`r$esc[2K  $muted$message$reset") }
  else { [Console]::Error.WriteLine("  $message") }
}
function Draw-Download([long] $bytes, [long] $total) {
  if (-not $interactive) { return }
  $columns = [Console]::WindowWidth
  if ($columns -le 0) { $columns = 80 }
  if ($total -gt 0 -and $columns -ge 9) {
    $percent = [Math]::Min(100, [Math]::Floor($bytes * 100.0 / $total))
    $width = [Math]::Min(32, $columns - 8)
    $filled = [int][Math]::Floor($percent * $width / 100)
    $bar = ([string][char]0x25A0) * $filled
    $rest = ([string][char]0x00B7) * ($width - $filled)
    $sizes = ("  {0:F1} / {1:F1} MB" -f ($bytes / 1MB), ($total / 1MB))
    if ($width + 7 + $sizes.Length -ge $columns) { $sizes = "" }
    [Console]::Error.Write(("`r$esc[2K  $accent$bar$reset$muted$rest$reset {0,3}%" -f $percent) + "$muted$sizes$reset")
  } else {
    $line = if ($columns -ge 32) { "  Downloading  {0:F1} MB" -f ($bytes / 1MB) } else { "  {0:F1} MB" -f ($bytes / 1MB) }
    [Console]::Error.Write("`r$esc[2K" + $line.Substring(0, [Math]::Min($line.Length, $columns - 1)))
  }
}
# Waits 1, 2, then 4 s before retrying a 408, 429, 5xx, or network error (status 0).
# Retry-After is ignored so a throttled GitHub cannot stall the install for minutes.
function Wait-Retry([int] $status, [int] $attempt) {
  if ($attempt -ge 4 -or ($status -ge 400 -and $status -lt 500 -and $status -ne 408 -and $status -ne 429)) { return $false }
  Start-Sleep -Seconds ([Math]::Pow(2, $attempt - 1))
  return $true
}
function Invoke-Retrying([scriptblock] $request) {
  for ($attempt = 1; ; $attempt++) {
    try { return & $request }
    catch { if (-not (Wait-Retry ([int]$_.Exception.Response.StatusCode) $attempt)) { throw } }
  }
}
function Fetch([string] $uri, [string] $destination, [switch] $progress) {
  if (-not $progress -or -not $interactive) {
    $ProgressPreference = if ($progress -and $terminal) { "Continue" } else { "SilentlyContinue" }
    Invoke-Retrying { Invoke-WebRequest -Uri $uri -OutFile $destination -UseBasicParsing -ProxyUseDefaultCredentials }
    return
  }
  Add-Type -AssemblyName System.Net.Http
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.UseProxy = $true
  $handler.DefaultProxyCredentials = [System.Net.CredentialCache]::DefaultNetworkCredentials
  $client = New-Object System.Net.Http.HttpClient($handler)
  $response = $source = $file = $null
  try {
    for ($attempt = 1; ; $attempt++) {
      try { $response = $client.GetAsync($uri, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult() }
      catch { if (Wait-Retry 0 $attempt) { continue } throw }
      if ($response.IsSuccessStatusCode -or -not (Wait-Retry ([int]$response.StatusCode) $attempt)) { break }
      $response.Dispose()
    }
    $response.EnsureSuccessStatusCode() | Out-Null
    $source = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $file = [IO.File]::Create($destination)
    $buffer = New-Object byte[] 65536
    $bytes = 0L
    $clock = [Diagnostics.Stopwatch]::StartNew()
    Draw-Download 0 $response.Content.Headers.ContentLength
    while (($count = $source.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $file.Write($buffer, 0, $count)
      $bytes += $count
      if ($clock.ElapsedMilliseconds -ge 100) {
        Draw-Download $bytes $response.Content.Headers.ContentLength
        $clock.Restart()
      }
    }
    Draw-Download $bytes $bytes
    [Console]::Error.WriteLine()
  } finally {
    if ($file) { $file.Dispose() }
    if ($source) { $source.Dispose() }
    if ($response) { $response.Dispose() }
    $client.Dispose()
    $handler.Dispose()
  }
}
if ($interactive) {
  # Block characters are constructed so this file also loads correctly in PowerShell 5.1.
  $mark = @(
    "########## ######## ",
    "    ###       _##^  ",
    "    ###       ####_ ",
    "    ###    _     ###",
    "    ###    #######^ "
  )
  [Console]::Error.WriteLine()
  for ($i = 0; $i -lt $mark.Length; $i++) {
    $row = $mark[$i].Replace('#', [char]0x2588).Replace('^', [char]0x2580).Replace('_', [char]0x2584)
    $label = if ($i -eq 1) { "     ${bold}Loom$reset" } elseif ($i -eq 2) { "     ${muted}CLI installer$reset" } else { "" }
    [Console]::Error.WriteLine("  $bold$row$reset$label")
  }
  [Console]::Error.WriteLine()
}
Step "Finding your release..."

# PROCESSOR_ARCHITEW6432 bypasses WOW64 emulation; 5.1 hosts can lack RuntimeInformation's required .NET version.
$rawArch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$arch = switch ($rawArch) {
  "AMD64" { "x64" }
  "ARM64" { "arm64" }
  default { Fail "unsupported architecture $rawArch" }
}

$channel = if ($Channel) { $Channel } else { "stable" }
$version = $Version
$explicitVersion = [bool]$Version

if ($ArchivePath) {
  if (-not (Test-Path -LiteralPath $ArchivePath)) {
    Fail "offline archive not found: $ArchivePath"
  }
  $archive = [System.IO.Path]::GetFileName($ArchivePath)
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($archive)
  if (-not $version) {
    if ($archive -match "^loom-([0-9][0-9A-Za-z._-]*?)(?:-minimal)?-win32-$([regex]::Escape($arch))\.zip$") {
      $version = $Matches[1]
    } else {
      Fail "could not infer version from $archive; set LOOM_VERSION or -Version"
    }
  }
} else {
  if (-not $version) {
    $tagPattern = switch ($channel) {
      "stable" { '^v\d+\.\d+\.\d+$' }
      "nightly" { '^v\d+\.\d+\.\d+-nightly\.\d+\.\d+$' }
      "preview" { '^v\d+\.\d+\.\d+-preview\.\d+\.\d+$' }
      default { Fail "LOOM_CHANNEL must be stable, nightly, or preview" }
    }
    if ($baseUrl -ne $defaultBaseUrl) {
      $mirrorIndexName = if ($channel -eq "stable") { "latest.txt" } else { "channel-$channel.txt" }
      try {
        $mirrorVer = (Invoke-Retrying { Invoke-RestMethod -Uri "$baseUrl/$mirrorIndexName" -ProxyUseDefaultCredentials }).ToString().Trim().TrimStart("v")
        if ($mirrorVer -match '^\d+\.\d+\.\d+') { $version = $mirrorVer }
      } catch {
        # Fall through to GitHub lookup if the mirror does not publish an index file.
      }
    }
    if (-not $version) {
      if ($channel -eq "stable") {
        # release.yml marks only plain stable releases latest. This is a github.com
        # page, so it is not cut off by a page of newer nightlies or the API quota.
        $release = Invoke-Retrying { Invoke-RestMethod -Uri "https://github.com/$repo/releases/latest" -Headers @{ "User-Agent" = "loom-install"; "Accept" = "application/json" } -ProxyUseDefaultCredentials }
        $tag = ($release | Where-Object { $_.tag_name -match $tagPattern }).tag_name
      } else {
        $tag = $null
        for ($page = 1; -not $tag -and $page -le 10; $page++) {
          $releases = Invoke-Retrying { Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases?per_page=100&page=$page" -Headers @{ "User-Agent" = "loom-install" } -ProxyUseDefaultCredentials }
          $tag = ($releases | Where-Object { -not $_.draft -and $_.tag_name -match $tagPattern } | Select-Object -First 1).tag_name
          if (-not $releases) { break }
        }
      }
      if (-not $tag) { Fail "could not find a $channel release; set LOOM_VERSION" }
      $version = $tag.Substring(1)
    }
  }
  $profileSuffix = if ($profile -eq "minimal") { "-minimal" } else { "" }
  $stem = "loom-$version$profileSuffix-win32-$arch"
  $archive = "$stem.zip"
}

if ($version -match '-preview\.') {
  Write-Warning "loom $version is a preview build. Preview builds are cut by maintainers from unreleased branches to exercise the release pipeline. They can be broken, receive no fixes, and are never offered as updates. Set LOOM_CHANNEL=stable (the default) for a supported build."
  if ($channel -ne "preview" -and -not $explicitVersion -and -not $ArchivePath) {
    Fail "refusing a preview build that was not explicitly requested"
  }
}

$versionsDir = Join-Path $loomHome "runtime\versions"
$targetDir = Join-Path $versionsDir $version
$marker = Join-Path $targetDir ".install-complete"

if ((Test-Path $marker) -and ((Get-Content $marker -Raw).Trim() -eq $version)) {
  Step "Version $version is already downloaded."
} else {
  New-Item -ItemType Directory -Force -Path $versionsDir | Out-Null
  $staging = Join-Path $versionsDir (".staging-" + [System.IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Path $staging | Out-Null
  try {
    if ($interactive) { [Console]::Error.Write("`r$esc[2K") }
    [Console]::Error.WriteLine("  ${muted}Installing$reset Loom $bold$version$reset`n")

    if ($ArchivePath) {
      Step "Using offline archive..."
      Copy-Item -LiteralPath $ArchivePath -Destination (Join-Path $staging $archive)
      if (-not $skipChecksumFlag) {
        if (-not $ChecksumsPath) {
          $siblingChecksums = Join-Path ([System.IO.Path]::GetDirectoryName((Resolve-Path -LiteralPath $ArchivePath).Path)) "SHA256SUMS"
          if (Test-Path -LiteralPath $siblingChecksums) { $ChecksumsPath = $siblingChecksums }
        }
        if (-not $ChecksumsPath -or -not (Test-Path -LiteralPath $ChecksumsPath)) {
          Fail "offline install requires SHA256SUMS beside the archive, -ChecksumsPath <file>, or -SkipChecksum"
        }
        Step "Verifying the archive..."
        $expected = (Get-Content -LiteralPath $ChecksumsPath | Where-Object { $_ -match "\s\*?$([regex]::Escape($archive))$" } | Select-Object -First 1)
        if (-not $expected) { Fail "$archive is not listed in $ChecksumsPath" }
        $expected = ($expected -split "\s+")[0].ToLowerInvariant()
        $actual = (Get-FileHash -Algorithm SHA256 (Join-Path $staging $archive)).Hash.ToLowerInvariant()
        if ($actual -ne $expected) { Fail "checksum mismatch for $archive" }
      }
    } else {
      Step "Downloading..."
      try {
        Fetch "$baseUrl/v$version/SHA256SUMS" (Join-Path $staging "SHA256SUMS")
      } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 404) {
          Fail "loom $version has no release archive for win32-$arch; releases before the self-contained CLI can only be installed with 'npm install -g loom@$version'"
        }
        throw
      }
      Fetch "$baseUrl/v$version/$archive" (Join-Path $staging $archive) -progress

      Step "Verifying the download..."

      $expected = (Get-Content (Join-Path $staging "SHA256SUMS") | Where-Object { $_ -match "\s\*?$([regex]::Escape($archive))$" } | Select-Object -First 1)
      if (-not $expected) { Fail "$archive is not listed in SHA256SUMS" }
      $expected = ($expected -split "\s+")[0].ToLowerInvariant()
      $actual = (Get-FileHash -Algorithm SHA256 (Join-Path $staging $archive)).Hash.ToLowerInvariant()
      if ($actual -ne $expected) { Fail "checksum mismatch for $archive" }
    }

    Step "Extracting Loom..."
    # The archive module reads the global preference, not the caller's local scope.
    $savedProgress = $global:ProgressPreference
    try {
      $global:ProgressPreference = "SilentlyContinue"
      Expand-Archive -Path (Join-Path $staging $archive) -DestinationPath $staging -Force
    } finally { $global:ProgressPreference = $savedProgress }
    Get-ChildItem (Join-Path $staging $stem) | Move-Item -Destination $staging
    Remove-Item (Join-Path $staging $stem), (Join-Path $staging $archive) -Recurse -Force
    if (Test-Path (Join-Path $staging "SHA256SUMS")) {
      Remove-Item (Join-Path $staging "SHA256SUMS") -Force
    }

    & (Join-Path $staging "loom.exe") --version | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "the downloaded executable does not run" }
    Set-Content -Path (Join-Path $staging ".install-complete") -Value $version -NoNewline

    if (Test-Path $targetDir) { Remove-Item $targetDir -Recurse -Force }
    Move-Item $staging $targetDir
  } catch {
    if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
    throw
  }
}

Step "Setting up the loom command..."
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
$shim = Join-Path $binDir "loom.cmd"
# Replace only a shim that runs a version in this home; never the desktop app's or another loom.
if (Test-Path -LiteralPath $shim) {
  $existingTarget = ""
  # The shim is UTF-8 without a BOM; Windows PowerShell 5.1 reads files as ANSI by default.
  # Only a shim exactly as written here counts; a user's wrapper that also runs loom.exe does not.
  $existing = [System.IO.File]::ReadAllText($shim, [System.Text.Encoding]::UTF8)
  if ($existing -match '^@echo off\r?\n"([^"]+)" %\*\s*$') { $existingTarget = $Matches[1] }
  # Full paths, so a target like versions\..\other cannot pass as ours.
  $ownedPrefix = [System.IO.Path]::GetFullPath($versionsDir).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  if ($existingTarget) { $existingTarget = [System.IO.Path]::GetFullPath($existingTarget) }
  # Exactly <version>\loom.exe, never another program inside a version.
  $owned = $existingTarget.StartsWith($ownedPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and
    ($existingTarget.Substring($ownedPrefix.Length) -match '^[^\\/]+\\loom\.exe$')
  if (-not $owned) {
    Fail "another loom is already at $shim. Remove it and run this again, or run $(Join-Path $targetDir 'loom.exe') directly."
  }
}
# UTF-8 without a BOM: cmd.exe reads the shim as-is, and ASCII would corrupt
# non-ASCII characters in the user's home path.
[System.IO.File]::WriteAllText($shim, "@echo off`r`n`"$(Join-Path $targetDir 'loom.exe')`" %*", (New-Object System.Text.UTF8Encoding $false))
# Pruning keeps what this shim points at; a background service cannot see $binDir otherwise.
$launchers = Join-Path $loomHome "runtime\launchers"
$shimPath = (Resolve-Path -LiteralPath $shim).Path
if (-not ((Test-Path $launchers) -and ((Get-Content $launchers) -contains $shimPath))) {
  [System.IO.File]::AppendAllText($launchers, "$shimPath`r`n", (New-Object System.Text.UTF8Encoding $false))
}
if ($interactive) { [Console]::Error.Write("`r$esc[2K") }
[Console]::Error.WriteLine("  ${green}Installed Loom $version$reset`n")
if ($noModifyPathFlag) {
  exit 0
}
if ($binDir.Contains(";")) {
  # PATH would split the folder at the `;`, so name the command in full instead.
  Write-Host "  Run ${bold}& '$($shim.Replace("'", "''"))'$reset to get started.`n"
} else {
  # Either side may end in a separator. Trim only here: a drive root keeps its `\` for Join-Path.
  $added = ($env:PATH -split ";" | ForEach-Object { $_.TrimEnd('\', '/') }) -notcontains $binDir.TrimEnd('\', '/')
  # `irm | iex` runs in the user's own session, so loom works in this window right away.
  # Last, so it never shadows another loom.
  if ($added) { $env:Path = "$env:Path;$binDir" }
  # A loom earlier on PATH runs instead, so name this one in full.
  $first = Get-Command loom -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($first -and [System.IO.Path]::GetFullPath($first.Source) -ne [System.IO.Path]::GetFullPath($shimPath)) {
    Write-Host "  Another loom at $($first.Source) runs first, so run ${bold}& '$($shim.Replace("'", "''"))'$reset to use this one.`n"
  } elseif ($added) {
    Write-Host "  Run ${bold}loom$reset to get started. For new windows, add $binDir to your PATH.`n"
  } else {
    Write-Host "  Run ${bold}loom$reset to use Loom here, or ${bold}loom up$reset to use it from your other devices.`n"
  }
}

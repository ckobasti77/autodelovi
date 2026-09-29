<#
.SYNOPSIS
  SKLOP build pipeline: runs the Claude Code (Opus 5.5) prompts from pipeline/steps.json one after another, unattended.

.DESCRIPTION
  - Preflight: tools, versions, Claude login, auto mode, Blender, Convex, skills sync, git snapshot, keep-awake.
  - Each step: model, effort, new or resumed session, mode (plan / auto / goal) from steps.json.
  - Streams Claude's output to pipeline/logs, updates pipeline/STATUS.md, commits to git after every step.
  - Usage limit reached  -> waits for the reset, then resumes the same session where it stopped.
  - Errors / hangs       -> resumes the session with a "continue" prompt, then a fresh recovery session.
  - Safe to re-run: completed steps are skipped (state in pipeline/state.json).

.EXAMPLE
  .\pipeline\run-pipeline.ps1                 # run everything that is not done yet
  .\pipeline\run-pipeline.ps1 -From 08        # re-run from step 08 onward
  .\pipeline\run-pipeline.ps1 -Only 12        # run just step 12
  .\pipeline\run-pipeline.ps1 -ListSteps      # print the plan
  .\pipeline\run-pipeline.ps1 -DryRun         # print the exact commands, run nothing
#>
[CmdletBinding()]
param(
  [string]$From = '',
  [string]$Only = '',
  [switch]$ListSteps,
  [switch]$DryRun,
  [switch]$SkipPreflight,
  [switch]$NoUpdate,
  [ValidateSet('max', 'balanced', 'lean')][string]$EffortProfile = 'max',
  [string]$Model = '',
  [string]$ClaudeExe = '',
  [string]$BlenderExe = '',
  [ValidateSet('stop', 'bypassPermissions')][string]$IfAutoModeUnavailable = 'stop',
  [string]$NtfyTopic = '',
  [int]$MaxLimitWaitHours = 192,
  [double]$WaitScale = 1.0
)

$ErrorActionPreference = 'Continue'
$IsWin = ($env:OS -eq 'Windows_NT')
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
try { [Console]::OutputEncoding = $Utf8NoBom } catch { }
$OutputEncoding = $Utf8NoBom

# ---------------------------------------------------------------- paths
$PipelineDir = $PSScriptRoot
$ProjectDir = Split-Path -Parent $PipelineDir
$LogsDir = Join-Path $PipelineDir 'logs'
$EnvDir = Join-Path $PipelineDir 'env'
$StatePath = Join-Path $PipelineDir 'state.json'
$StatusPath = Join-Path $PipelineDir 'STATUS.md'
$StepsPath = Join-Path $PipelineDir 'steps.json'
$SystemPromptPath = Join-Path (Join-Path $PipelineDir 'system') 'UNATTENDED.md'
$ContinueTplPath = Join-Path (Join-Path $PipelineDir 'prompts') '_continue.md'
$RecoveryTplPath = Join-Path (Join-Path $PipelineDir 'prompts') '_recovery.md'
foreach ($d in @($LogsDir, $EnvDir)) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null } }

$MinClaudeVersion = [version]'2.1.259'
$GoalMinVersion = [version]'2.1.234'
$UltracodeMinVersion = [version]'2.1.203'

$script:State = $null
$script:Manifest = $null
$script:Claude = $null
$script:Features = @{ Effort = $true; PermissionPrompts = $true; Name = $true; AppendFile = $true; Goal = $true; Ultracode = $true }
$script:PermissionMode = 'auto'
$script:ChildEnv = @{}
$script:Current = $null
$script:LastActivity = ''
$script:LastStatusWrite = [datetime]::MinValue
$script:RunStartedAt = Get-Date
$script:KeepAwakeOn = $false
$script:GitExe = $null
$script:BlenderPath = ''
$script:BlenderVersion = ''
$script:ChromePath = ''
$script:ClaudeVersion = ''

# ---------------------------------------------------------------- small helpers
function Write-PLog {
  param([string]$Message, [string]$Level = 'INFO')
  $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
  $color = 'Gray'
  if ($Level -eq 'ERROR') { $color = 'Red' } elseif ($Level -eq 'WARN') { $color = 'Yellow' } elseif ($Level -eq 'OK') { $color = 'Green' } elseif ($Level -eq 'STEP') { $color = 'Cyan' }
  Write-Host $line -ForegroundColor $color
  try { [System.IO.File]::AppendAllText((Join-Path $LogsDir 'pipeline.log'), $line + [Environment]::NewLine, $Utf8NoBom) } catch { }
}

function Write-Activity {
  param([string]$Text)
  $t = ($Text -replace '\s+', ' ').Trim()
  if ($t.Length -gt 160) { $t = $t.Substring(0, 160) + '...' }
  $script:LastActivity = $t
  Write-Host ('  {0}  {1}' -f (Get-Date -Format 'HH:mm:ss'), $t) -ForegroundColor DarkGray
}

function Get-Prop {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  if ($Object -is [System.Collections.IDictionary]) { if ($Object.Contains($Name)) { return $Object[$Name] } else { return $Default } }
  $p = $Object.PSObject.Properties[$Name]
  if ($null -ne $p) { return $p.Value }
  return $Default
}

function ConvertTo-HashtableDeep {
  param($InputObject)
  if ($null -eq $InputObject) { return $null }
  if ($InputObject -is [System.Collections.IDictionary]) {
    $h = @{}
    foreach ($k in $InputObject.Keys) { $h[$k] = ConvertTo-HashtableDeep $InputObject[$k] }
    return $h
  }
  if ($InputObject -is [System.Management.Automation.PSCustomObject]) {
    $h = @{}
    foreach ($p in $InputObject.PSObject.Properties) { $h[$p.Name] = ConvertTo-HashtableDeep $p.Value }
    return $h
  }
  if (($InputObject -is [System.Collections.IEnumerable]) -and -not ($InputObject -is [string])) {
    $list = New-Object System.Collections.ArrayList
    foreach ($i in $InputObject) { [void]$list.Add((ConvertTo-HashtableDeep $i)) }
    return , $list.ToArray()
  }
  return $InputObject
}

function Format-Duration {
  param([double]$Seconds)
  if ($Seconds -lt 0) { $Seconds = 0 }
  $ts = [TimeSpan]::FromSeconds([math]::Round($Seconds))
  if ($ts.TotalHours -ge 1) { return ('{0}h {1:00}m' -f [math]::Floor($ts.TotalHours), $ts.Minutes) }
  if ($ts.TotalMinutes -ge 1) { return ('{0}m' -f [math]::Floor($ts.TotalMinutes)) }
  return ('{0}s' -f $ts.Seconds)
}

function Read-TextFile {
  param([string]$Path)
  return [System.IO.File]::ReadAllText($Path, $Utf8NoBom)
}

function Write-TextFile {
  param([string]$Path, [string]$Text)
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function Join-Args {
  # Quote arguments for CreateProcess / MSVCRT argv parsing.
  param([string[]]$ArgList)
  $parts = New-Object System.Collections.ArrayList
  foreach ($a in $ArgList) {
    if ($null -eq $a) { continue }
    if ($a -eq '') { [void]$parts.Add('""'); continue }
    if ($a -notmatch '[\s"]') { [void]$parts.Add($a); continue }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    $bs = 0
    foreach ($ch in $a.ToCharArray()) {
      if ($ch -eq '\') { $bs++; continue }
      if ($ch -eq '"') { [void]$sb.Append(('\' * ($bs * 2 + 1))); [void]$sb.Append('"'); $bs = 0; continue }
      if ($bs -gt 0) { [void]$sb.Append(('\' * $bs)); $bs = 0 }
      [void]$sb.Append($ch)
    }
    if ($bs -gt 0) { [void]$sb.Append(('\' * ($bs * 2))) }
    [void]$sb.Append('"')
    [void]$parts.Add($sb.ToString())
  }
  return ($parts -join ' ')
}

function Resolve-Exe {
  # Returns @{ File; Prefix; ViaCmd } for an executable name or path (.exe, .cmd/.bat, or a script on non-Windows).
  param([string]$NameOrPath)
  $path = $null
  if ($NameOrPath -and (Test-Path $NameOrPath -PathType Leaf)) { $path = (Resolve-Path $NameOrPath).Path }
  else {
    $cmd = Get-Command $NameOrPath -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) { $path = $cmd.Source }
  }
  if (-not $path) { return $null }
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($IsWin -and ($ext -eq '.cmd' -or $ext -eq '.bat')) { return @{ File = $path; Prefix = @(); ViaCmd = $true } }
  if ($IsWin -and $ext -eq '.ps1') {
    $sibling = [System.IO.Path]::ChangeExtension($path, '.cmd')
    if (Test-Path $sibling) { return @{ File = $sibling; Prefix = @(); ViaCmd = $true } }
    return $null
  }
  return @{ File = $path; Prefix = @(); ViaCmd = $false }
}

function New-StartInfo {
  param([hashtable]$Exe, [string[]]$ArgList, [hashtable]$ExtraEnv)
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $all = @() + $Exe.Prefix + $ArgList
  if ($Exe.ViaCmd) {
    $psi.FileName = $env:ComSpec
    $psi.Arguments = '/d /s /c "' + (Join-Args (@($Exe.File) + $all)) + '"'
  } else {
    $psi.FileName = $Exe.File
    $psi.Arguments = Join-Args $all
  }
  $psi.WorkingDirectory = $ProjectDir
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $psi.StandardOutputEncoding = $Utf8NoBom
  $psi.StandardErrorEncoding = $Utf8NoBom
  if ($ExtraEnv) { foreach ($k in $ExtraEnv.Keys) { $psi.EnvironmentVariables[$k] = [string]$ExtraEnv[$k] } }
  return $psi
}

function Stop-ProcessTree {
  param([System.Diagnostics.Process]$Process)
  if ($null -eq $Process) { return }
  try {
    if ($Process.HasExited) { return }
    if ($IsWin) { & taskkill.exe /PID $Process.Id /T /F 2>&1 | Out-Null }
    else { try { $Process.Kill($true) } catch { $Process.Kill() } }
  } catch { }
}

function Invoke-Native {
  param([hashtable]$Exe, [string[]]$ArgList = @(), [int]$TimeoutSec = 600, [hashtable]$ExtraEnv = $null)
  $r = @{ ExitCode = -1; StdOut = ''; StdErr = ''; TimedOut = $false }
  if ($null -eq $Exe) { $r.StdErr = 'executable not found'; return $r }
  $psi = New-StartInfo -Exe $Exe -ArgList $ArgList -ExtraEnv $ExtraEnv
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  try { [void]$p.Start() } catch { $r.StdErr = $_.Exception.Message; return $r }
  try { $p.StandardInput.Close() } catch { }
  $o = $p.StandardOutput.ReadToEndAsync()
  $e = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit($TimeoutSec * 1000)) { $r.TimedOut = $true; Stop-ProcessTree $p; [void]$p.WaitForExit(10000) }
  if ($o.Wait(10000)) { $r.StdOut = $o.Result }
  if ($e.Wait(10000)) { $r.StdErr = $e.Result }
  if ($p.HasExited) { $r.ExitCode = $p.ExitCode }
  return $r
}

function Get-SemVer {
  param([string]$Text)
  $m = [regex]::Match([string]$Text, '(\d+)\.(\d+)(?:\.(\d+))?')
  if ($m.Success) {
    $patch = '0'
    if ($m.Groups[3].Success) { $patch = $m.Groups[3].Value }
    return [version]('{0}.{1}.{2}' -f $m.Groups[1].Value, $m.Groups[2].Value, $patch)
  }
  return $null
}

function Send-Notify {
  param([string]$Title, [string]$Message)
  if (-not $NtfyTopic) { return }
  try {
    $asciiTitle = ($Title -replace '[^\x20-\x7E]', '')
    Invoke-RestMethod -Uri ('https://ntfy.sh/' + $NtfyTopic) -Method Post -Body ([System.Text.Encoding]::UTF8.GetBytes($Message)) -Headers @{ Title = $asciiTitle } -TimeoutSec 15 | Out-Null
  } catch { }
}

# ---------------------------------------------------------------- state & status
function Load-State {
  if (Test-Path $StatePath) {
    try { $script:State = ConvertTo-HashtableDeep ((Read-TextFile $StatePath) | ConvertFrom-Json) } catch { $script:State = $null }
  }
  if ($null -eq $script:State) { $script:State = @{ createdAt = (Get-Date).ToString('s'); steps = @{} } }
  if (-not $script:State.ContainsKey('steps') -or $null -eq $script:State.steps) { $script:State.steps = @{} }
}

function Save-State {
  try { Write-TextFile $StatePath ($script:State | ConvertTo-Json -Depth 12) } catch { Write-PLog ('Ne mogu da sačuvam state.json: ' + $_.Exception.Message) 'WARN' }
}

function Get-StepState {
  param([string]$Id)
  if (-not $script:State.steps.ContainsKey($Id) -or $null -eq $script:State.steps[$Id]) {
    $script:State.steps[$Id] = @{ status = 'pending'; attempts = 0; sessionId = ''; costUsd = 0; turns = 0; startedAt = ''; endedAt = ''; durationSec = 0; lastError = ''; note = '' }
  }
  return $script:State.steps[$Id]
}

function Get-StatusLabel {
  param([string]$Status)
  if ($Status -eq 'completed') { return 'gotovo' }
  if ($Status -eq 'recovered') { return 'gotovo (posle oporavka)' }
  if ($Status -eq 'running') { return 'RADI' }
  if ($Status -eq 'waiting_limit') { return 'čeka reset limita' }
  if ($Status -eq 'failed') { return 'GREŠKA' }
  if ($Status -eq 'skipped') { return 'preskočeno' }
  return 'čeka'
}

function Get-SessionLabel {
  param($Step)
  $s = [string]$Step.session
  if ($s -like 'resume:*') { return ('nastavak #' + $s.Substring(7)) }
  return 'NOVA'
}

function Write-Status {
  param([switch]$Force)
  $now = Get-Date
  if (-not $Force -and ($now - $script:LastStatusWrite).TotalSeconds -lt 30) { return }
  $script:LastStatusWrite = $now
  if ($null -eq $script:Manifest) { return }
  $steps = @($script:Manifest.steps)
  $done = 0; $failed = 0
  foreach ($s in $steps) {
    $st = $script:State.steps[[string]$s.id]
    if ($st) {
      if ($st.status -eq 'completed' -or $st.status -eq 'recovered') { $done++ }
      if ($st.status -eq 'failed') { $failed++ }
    }
  }
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('# SKLOP pipeline — status')
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine(('Ažurirano: {0} · Pokrenuto: {1} · Proteklo: {2}' -f $now.ToString('dd.MM.yyyy. HH:mm:ss'), $script:RunStartedAt.ToString('dd.MM. HH:mm'), (Format-Duration ($now - $script:RunStartedAt).TotalSeconds)))
  [void]$sb.AppendLine('')
  if ($script:Current) {
    $c = $script:Current
    $line = '**Sada:** korak {0}/{1} — {2} · {3} · effort {4} · {5} · radi {6}' -f $c.Id, $steps.Count, $c.Title, $script:Manifest.modelLabel, $c.Effort, $c.Mode, (Format-Duration ($now - $c.StartedAt).TotalSeconds)
    if ($c.WaitUntil) {
      if ($c.WaitReason -eq 'internet') { $line += (' · **nema interneta, sledeća provera u {0}**' -f $c.WaitUntil.ToString('HH:mm')) }
      else { $line += (' · **čeka reset limita do {0}**' -f $c.WaitUntil.ToString('dd.MM. HH:mm')) }
    }
    [void]$sb.AppendLine($line)
    if ($script:LastActivity) { [void]$sb.AppendLine(('Poslednja aktivnost: `{0}`' -f ($script:LastActivity -replace '`', "'"))) }
  } else {
    [void]$sb.AppendLine('**Sada:** ništa ne radi.')
  }
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine(('Završeno: {0}/{1} · Greške: {2}' -f $done, $steps.Count, $failed))
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine('| # | Korak | Model | Effort | Sesija | Mode | Status | Trajanje |')
  [void]$sb.AppendLine('|---|---|---|---|---|---|---|---|')
  foreach ($s in $steps) {
    $id = [string]$s.id
    $st = $script:State.steps[$id]
    $status = 'pending'; $dur = ''
    if ($st) {
      $status = [string]$st.status
      if ($st.durationSec) { $dur = Format-Duration ([double]$st.durationSec) }
    }
    if ($script:Current -and $script:Current.Id -eq $id) { $dur = Format-Duration ($now - $script:Current.StartedAt).TotalSeconds }
    [void]$sb.AppendLine(('| {0} | {1} | {2} | {3} | {4} | {5} | {6} | {7} |' -f $id, $s.title, $script:Manifest.modelLabel, (Get-Effort $s), (Get-SessionLabel $s), $s.mode, (Get-StatusLabel $status), $dur))
  }
  [void]$sb.AppendLine('')
  [void]$sb.AppendLine('Logovi: `pipeline/logs/` · izveštaj svakog koraka: `pipeline/logs/<korak>-result.md` · stanje: `pipeline/state.json`')
  try { Write-TextFile $StatusPath $sb.ToString() } catch { }
}

# ---------------------------------------------------------------- manifest helpers
function Get-Effort {
  param($Step)
  $e = [string]$Step.effort
  if ($EffortProfile -eq 'balanced') {
    if ($e -eq 'ultracode') { return 'xhigh' }
    if ($e -eq 'max' -and (@('01', '07', '08') -notcontains [string]$Step.id)) { return 'xhigh' }
  } elseif ($EffortProfile -eq 'lean') {
    if ($e -eq 'max' -or $e -eq 'ultracode') { return 'xhigh' }
    if ($e -eq 'xhigh') { return 'high' }
  }
  if ($e -eq 'ultracode' -and -not $script:Features.Ultracode) { return 'xhigh' }
  return $e
}

function Get-StepNumber { param($Step) return [int]([string]$Step.id) }

function Fill-Template {
  param([string]$Text, [hashtable]$Values)
  $t = $Text
  foreach ($k in $Values.Keys) { $t = $t.Replace('{{' + $k + '}}', [string]$Values[$k]) }
  return $t
}

function Get-PromptText {
  param($Step)
  $t = Read-TextFile (Join-Path $PipelineDir ([string]$Step.prompt))
  return [regex]::Replace($t, '^\s*<!--\s*META[\s\S]*?-->\s*', '')
}

function Get-GoalText {
  param($Step)
  $t = (Read-TextFile (Join-Path $PipelineDir ([string]$Step.goal))).Trim()
  $t = $t -replace '[\r\n]+', ' '
  $t = $t -replace '["%^&|<>]', ''
  if ($t.Length -gt 3900) { $t = $t.Substring(0, 3900) }
  return $t
}

# ---------------------------------------------------------------- claude runs
function New-ClaudeArgs {
  param([string]$Effort, [string]$PermMode, [string]$ResumeId, [string]$SessionName, [string]$OutputFormat = 'stream-json')
  $a = New-Object System.Collections.ArrayList
  [void]$a.Add('-p')
  [void]$a.AddRange(@('--model', $Model))
  [void]$a.AddRange(@('--output-format', $OutputFormat))
  if ($OutputFormat -eq 'stream-json') { [void]$a.Add('--verbose') }
  if ($Effort -and $script:Features.Effort) { [void]$a.AddRange(@('--effort', $Effort)) }
  if ($PermMode -eq 'bypassPermissions') { [void]$a.Add('--dangerously-skip-permissions') }
  elseif ($PermMode) { [void]$a.AddRange(@('--permission-mode', $PermMode)) }
  if ($script:Features.PermissionPrompts) { [void]$a.AddRange(@('--permission-prompts', 'none')) }
  if (Test-Path $SystemPromptPath) {
    if ($script:Features.AppendFile) { [void]$a.AddRange(@('--append-system-prompt-file', $SystemPromptPath)) }
    else { [void]$a.AddRange(@('--append-system-prompt', (Read-TextFile $SystemPromptPath))) }
  }
  if ($ResumeId) { [void]$a.AddRange(@('--resume', $ResumeId)) }
  elseif ($SessionName -and $script:Features.Name) { [void]$a.AddRange(@('--name', $SessionName)) }
  return , $a.ToArray()
}

function New-RunResult {
  return @{
    SessionId = ''; Model = ''; PermissionMode = ''; ModeMismatch = $false
    ResultObj = $null; ResultText = ''; PlanText = ''; LastText = ''
    IsError = $false; Subtype = ''; NumTurns = 0; CostUsd = 0.0; DurationMs = 0; Denials = 0
    ToolCalls = 0; Lines = 0; Killed = $false; KillReason = ''; ExitCode = $null; Stderr = ''
    SlashCommands = @(); Skills = @(); RequestedMode = ''; PlanFile = ''
  }
}

function Get-ToolSummary {
  param($Block)
  $name = [string](Get-Prop $Block 'name' '')
  $inp = Get-Prop $Block 'input' $null
  $detail = ''
  foreach ($k in @('command', 'file_path', 'path', 'skill', 'pattern', 'url', 'query', 'description', 'prompt')) {
    $v = Get-Prop $inp $k $null
    if ($v) { $detail = [string]$v; break }
  }
  $detail = ($detail -replace '\s+', ' ').Trim()
  if ($detail.Length -gt 110) { $detail = $detail.Substring(0, 110) + '...' }
  return ('{0} {1}' -f $name, $detail).Trim()
}

function Invoke-StreamLine {
  param([string]$Line, [hashtable]$Res)
  if ($Line.Length -lt 2 -or $Line[0] -ne '{') { return }
  if ($Line.Length -gt 1500000) { return }
  $o = $null
  try { $o = $Line | ConvertFrom-Json } catch { return }
  if ($null -eq $o) { return }
  $type = [string](Get-Prop $o 'type' '')
  if ($type -eq 'system') {
    $sub = [string](Get-Prop $o 'subtype' '')
    if ($sub -eq 'init') {
      $sid = [string](Get-Prop $o 'session_id' '')
      if ($sid) { $Res.SessionId = $sid }
      $Res.Model = [string](Get-Prop $o 'model' '')
      $Res.PermissionMode = [string](Get-Prop $o 'permissionMode' '')
      $sc = Get-Prop $o 'slash_commands' $null
      if ($sc) { $Res.SlashCommands = @($sc | ForEach-Object { [string]$_ }) }
      $sk = Get-Prop $o 'skills' $null
      if ($sk) { $Res.Skills = @($sk | ForEach-Object { if ($_ -is [string]) { $_ } else { [string](Get-Prop $_ 'name' '') } }) }
      Write-Activity ('session {0} · model {1} · mode {2}' -f $Res.SessionId, $Res.Model, $Res.PermissionMode)
      if ($Res.RequestedMode -eq 'auto' -and $Res.PermissionMode -eq 'default') {
        $Res.ModeMismatch = $true
        Write-PLog ('Traženi mode "{0}", a sesija je krenula u "{1}".' -f $Res.RequestedMode, $Res.PermissionMode) 'WARN'
      }
    } elseif ($sub -eq 'api_retry') {
      Write-Activity ('API retry {0}/{1} ({2}), čekam {3}s' -f (Get-Prop $o 'attempt' '?'), (Get-Prop $o 'max_retries' '?'), (Get-Prop $o 'error' ''), [math]::Round([double](Get-Prop $o 'retry_delay_ms' 0) / 1000))
    }
    return
  }
  if ($type -eq 'assistant') {
    $msg = Get-Prop $o 'message' $null
    $content = Get-Prop $msg 'content' $null
    foreach ($b in @($content)) {
      if ($null -eq $b) { continue }
      $bt = [string](Get-Prop $b 'type' '')
      if ($bt -eq 'tool_use') {
        $Res.ToolCalls++
        $tn = [string](Get-Prop $b 'name' '')
        if ($tn -eq 'ExitPlanMode') {
          $plan = [string](Get-Prop (Get-Prop $b 'input' $null) 'plan' '')
          if ($plan.Length -gt $Res.PlanText.Length) { $Res.PlanText = $plan }
        }
        if ($tn -eq 'Write' -or $tn -eq 'Edit' -or $tn -eq 'MultiEdit') {
          $fp = [string](Get-Prop (Get-Prop $b 'input' $null) 'file_path' '')
          if ($fp -match '[\\/]\.claude[\\/]plans[\\/][^\\/]+\.md$') { $Res.PlanFile = $fp }
        }
        Write-Activity ('> ' + (Get-ToolSummary $b))
      } elseif ($bt -eq 'text') {
        $t = [string](Get-Prop $b 'text' '')
        if ($t.Trim()) { $Res.LastText = $t; Write-Activity ('" ' + $t) }
      }
    }
    return
  }
  if ($type -eq 'result') {
    $Res.ResultObj = $o
    $Res.ResultText = [string](Get-Prop $o 'result' '')
    $Res.IsError = [bool](Get-Prop $o 'is_error' $false)
    $Res.Subtype = [string](Get-Prop $o 'subtype' '')
    $Res.NumTurns = [int](Get-Prop $o 'num_turns' 0)
    $Res.CostUsd = [double](Get-Prop $o 'total_cost_usd' 0)
    $Res.DurationMs = [double](Get-Prop $o 'duration_ms' 0)
    $sid = [string](Get-Prop $o 'session_id' '')
    if ($sid) { $Res.SessionId = $sid }
    $pd = Get-Prop $o 'permission_denials' $null
    if ($pd) { $Res.Denials = @($pd).Count }
  }
}

function Invoke-ClaudeRun {
  param([string[]]$ArgList, [string]$StdinText, [string]$LogBase, [int]$TimeoutMin = 360, [int]$StallMin = 90, [string]$RequestedMode = '', [string]$StepId = '', [string]$SessionField = 'sessionId')
  $res = New-RunResult
  $sessionSaved = $false
  $res.RequestedMode = $RequestedMode
  $jsonlPath = Join-Path $LogsDir ($LogBase + '.jsonl')
  $errPath = Join-Path $LogsDir ($LogBase + '.stderr.txt')
  $cmdPath = Join-Path $LogsDir ($LogBase + '.cmd.txt')
  $shown = @()
  foreach ($x in $ArgList) { if ($x.Length -gt 200) { $shown += ($x.Substring(0, 200) + '...') } else { $shown += $x } }
  Write-TextFile $cmdPath ('claude ' + (Join-Args $shown) + [Environment]::NewLine + '(stdin: ' + ([string]$StdinText).Length + ' chars)')
  if ($DryRun) {
    Write-Host ('  claude ' + (Join-Args $shown)) -ForegroundColor DarkCyan
    Write-Host ('  stdin: {0} chars' -f ([string]$StdinText).Length) -ForegroundColor DarkCyan
    $res.ResultText = 'DRY RUN'
    $res.ResultObj = @{ dry = $true }
    $res.ExitCode = 0
    return $res
  }
  $psi = New-StartInfo -Exe $script:Claude -ArgList $ArgList -ExtraEnv $script:ChildEnv
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  try { [void]$p.Start() } catch {
    $res.Stderr = 'Ne mogu da pokrenem claude: ' + $_.Exception.Message
    $res.ExitCode = -1
    Write-TextFile $errPath $res.Stderr
    return $res
  }
  # stdin is written asynchronously so a large first stdout burst can never deadlock the pipes
  $stdinStream = $p.StandardInput.BaseStream
  $stdinTask = $null
  $stdinClosed = $false
  if ($StdinText) {
    $bytes = $Utf8NoBom.GetBytes($StdinText)
    try { $stdinTask = $stdinStream.WriteAsync($bytes, 0, $bytes.Length) } catch { $stdinTask = $null }
  }
  $errTask = $p.StandardError.ReadToEndAsync()
  $log = New-Object System.IO.StreamWriter($jsonlPath, $false, $Utf8NoBom)
  $log.AutoFlush = $true
  $reader = $p.StandardOutput
  $readTask = $reader.ReadLineAsync()
  $start = Get-Date
  $lastOut = Get-Date
  $exitSeenAt = $null
  while ($true) {
    if (-not $stdinClosed -and ($null -eq $stdinTask -or $stdinTask.IsCompleted)) {
      try { $stdinStream.Flush() } catch { }
      try { $stdinStream.Close() } catch { }
      $stdinClosed = $true
    }
    $gotLine = $false
    try { $gotLine = $readTask.Wait(1000) } catch { break }
    if ($gotLine) {
      $line = $null
      try { $line = $readTask.Result } catch { break }
      if ($null -eq $line) { break }
      $lastOut = Get-Date
      $res.Lines++
      $log.WriteLine($line)
      Invoke-StreamLine -Line $line -Res $res
      if (-not $sessionSaved -and $StepId -and $res.SessionId) {
        # persist the session id immediately, so a crash or restart can resume this exact session
        $stSave = Get-StepState $StepId
        $stSave[$SessionField] = $res.SessionId
        Save-State
        $sessionSaved = $true
      }
      if ($res.ModeMismatch) { $res.Killed = $true; $res.KillReason = 'modemismatch'; Stop-ProcessTree $p; break }
      $readTask = $reader.ReadLineAsync()
      Write-Status
      continue
    }
    $now = Get-Date
    if ($p.HasExited) {
      if ($null -eq $exitSeenAt) { $exitSeenAt = $now }
      elseif (($now - $exitSeenAt).TotalSeconds -gt 20) { break }
    }
    if (($now - $start).TotalMinutes -ge $TimeoutMin) {
      Write-PLog ('Korak prekoračio vremensko ograničenje ({0} min) — prekidam.' -f $TimeoutMin) 'WARN'
      $res.Killed = $true; $res.KillReason = 'timeout'; Stop-ProcessTree $p; break
    }
    if (($now - $lastOut).TotalMinutes -ge $StallMin) {
      Write-PLog ('Nema izlaza {0} min — proces je verovatno zaglavljen, prekidam.' -f $StallMin) 'WARN'
      $res.Killed = $true; $res.KillReason = 'stall'; Stop-ProcessTree $p; break
    }
    Write-Status
  }
  if (-not $stdinClosed) { try { $stdinStream.Close() } catch { } }
  if (-not $p.HasExited) { [void]$p.WaitForExit(30000) }
  if (-not $p.HasExited) { Stop-ProcessTree $p; [void]$p.WaitForExit(10000) }
  if ($p.HasExited) { $res.ExitCode = $p.ExitCode } else { $res.ExitCode = -1 }
  if ($errTask.Wait(15000)) { $res.Stderr = [string]$errTask.Result }
  try { $log.Flush(); $log.Close() } catch { }
  Write-TextFile $errPath $res.Stderr
  return $res
}

$LimitStrict = "(?i)(hit your [a-z ]{0,30}limit|usage limit|limit reached|out of extra usage|credit balance is too low|spend limit)"
$LimitLoose = '(?i)(rate.?limit|too many requests|\b429\b|temporarily limiting)'
$TransientRx = '(?i)(overloaded|\b529\b|\b50[0234]\b|internal server error|econnreset|etimedout|socket hang up|fetch failed|network error|connection (lost|reset|error)|stalled before a response|went to sleep before a response)'
$AuthRx = '(?i)(not logged in|please run /login|invalid api key|authentication_failed|authentication failed|oauth token (has )?expired|account_on_hold|oauth_org_not_allowed)'
$NetworkRx = "(?i)(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|getaddrinfo|can.t reach the api server|check your internet|network is unreachable|unable to connect|connection refused|no internet)"

function Get-RunOutcome {
  param([hashtable]$Run, [bool]$IsPlan = $false)
  $text = [string]$Run.ResultText
  $err = [string]$Run.Stderr
  if ($err.Length -gt 6000) { $err = $err.Substring($err.Length - 6000) }
  $noResult = ($null -eq $Run.ResultObj)
  $errorish = $noResult -or $Run.IsError
  $probe = $err
  if ($errorish -or $text.Length -lt 800) { $probe = $text + "`n" + $err }
  if ($Run.KillReason -eq 'modemismatch') { return 'modemismatch' }
  if ($probe -match $LimitStrict) { return 'limit' }
  if ($errorish -and ($probe -match $NetworkRx)) { return 'network' }
  if ($errorish -and ($probe -match $AuthRx)) { return 'auth' }
  if ($errorish -and ($probe -match $LimitLoose)) { return 'transient' }
  if ($Run.Killed) { return [string]$Run.KillReason }
  if (-not $noResult -and -not $Run.IsError) { return 'success' }
  if ($IsPlan -and (($Run.PlanText.Length -gt 3000) -or ($text.Length -gt 4000))) { return 'success' }
  if ($errorish -and ($probe -match $TransientRx)) { return 'transient' }
  return 'error'
}

function Get-ResetTime {
  param([string]$Text)
  if (-not $Text) { return $null }
  $now = Get-Date
  $m = [regex]::Match($Text, '\|(\d{10})\b')
  if ($m.Success) { return ([DateTimeOffset]::FromUnixTimeSeconds([int64]$m.Groups[1].Value)).LocalDateTime }
  $m = [regex]::Match($Text, '(?i)resets?\s+in\s+(?:(\d+)\s*h[a-z]*)?\s*(?:(\d+)\s*m[a-z]*)?')
  if ($m.Success -and ($m.Groups[1].Success -or $m.Groups[2].Success)) {
    $h = 0; $mi = 0
    if ($m.Groups[1].Success) { $h = [int]$m.Groups[1].Value }
    if ($m.Groups[2].Success) { $mi = [int]$m.Groups[2].Value }
    return $now.AddHours($h).AddMinutes($mi)
  }
  $rx = '(?i)resets?\s+(?:at\s+|on\s+)?(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?'
  $m = [regex]::Match($Text, $rx)
  if ($m.Success) {
    $h = [int]$m.Groups[3].Value
    $mi = 0
    if ($m.Groups[4].Success) { $mi = [int]$m.Groups[4].Value }
    $ampm = $m.Groups[5].Value.ToLowerInvariant()
    if (-not $ampm -and -not $m.Groups[4].Success) { return $null }
    if ($ampm -eq 'pm' -and $h -lt 12) { $h += 12 }
    if ($ampm -eq 'am' -and $h -eq 12) { $h = 0 }
    if ($h -gt 23 -or $mi -gt 59) { return $null }
    if ($m.Groups[1].Success) {
      $months = @{ jan = 1; feb = 2; mar = 3; apr = 4; may = 5; jun = 6; jul = 7; aug = 8; sep = 9; oct = 10; nov = 11; dec = 12 }
      $mon = $months[$m.Groups[1].Value.ToLowerInvariant()]
      $day = [int]$m.Groups[2].Value
      try {
        $d = New-Object DateTime($now.Year, $mon, $day, $h, $mi, 0)
        if ($d -lt $now.AddDays(-1)) { $d = $d.AddYears(1) }
        return $d
      } catch { return $null }
    }
    $d = $now.Date.AddHours($h).AddMinutes($mi)
    if ($d -le $now) { $d = $d.AddDays(1) }
    return $d
  }
  return $null
}

function Wait-Until {
  param([datetime]$Until)
  if ($WaitScale -lt 1) { Start-Sleep -Milliseconds 300; return }
  while ((Get-Date) -lt $Until) {
    $remaining = ($Until - (Get-Date)).TotalSeconds
    $chunk = [math]::Min(60, [math]::Max(1, $remaining))
    Start-Sleep -Seconds ([int][math]::Ceiling($chunk))
    Write-Status
  }
}

function Wait-Seconds {
  param([int]$Seconds)
  Wait-Until ((Get-Date).AddSeconds($Seconds))
}

function Test-ClaudeReady {
  $a = @('-p', '--model', $Model, '--output-format', 'json', '--permission-mode', 'dontAsk', '--no-session-persistence')
  if ($script:Features.Effort) { $a += @('--effort', 'low') }
  $a += 'Reply with the single word READY.'
  $r = Invoke-Native -Exe $script:Claude -ArgList $a -TimeoutSec 300 -ExtraEnv $script:ChildEnv
  $json = $null
  foreach ($ln in ($r.StdOut -split "`r?`n")) { if ($ln.Trim().StartsWith('{')) { try { $json = $ln | ConvertFrom-Json } catch { } } }
  $text = ''
  $isErr = $true
  if ($json) { $text = [string](Get-Prop $json 'result' ''); $isErr = [bool](Get-Prop $json 'is_error' $false) }
  $ready = ($json -and -not $isErr -and $r.ExitCode -eq 0)
  return @{ Ready = $ready; Text = ($text + "`n" + $r.StdErr); Json = $json; Raw = $r }
}

function Wait-ForLimit {
  param([string]$Text)
  $waitStart = Get-Date
  $reason = $Text
  while ($true) {
    $reset = Get-ResetTime $reason
    $now = Get-Date
    $until = $now.AddMinutes(30)
    if ($reset -and $reset -gt $now) { $until = $reset.AddMinutes(4) }
    if (($until - $waitStart).TotalHours -gt $MaxLimitWaitHours) { throw ('Čekanje na limit bi trajalo duže od {0}h — zaustavljam pipeline.' -f $MaxLimitWaitHours) }
    if ($script:Current) {
      $script:Current.WaitUntil = $until
      $st = Get-StepState $script:Current.Id
      $st.status = 'waiting_limit'
      Save-State
    }
    $snippet = ($reason -replace '\s+', ' ').Trim()
    if ($snippet.Length -gt 160) { $snippet = $snippet.Substring(0, 160) }
    Write-PLog ('Usage limit: "{0}". Čekam do {1}.' -f $snippet, $until.ToString('dd.MM. HH:mm')) 'WARN'
    Send-Notify 'SKLOP pipeline: limit' ('Limit dostignut, nastavljam oko ' + $until.ToString('dd.MM. HH:mm'))
    Write-Status -Force
    Wait-Until $until
    $probe = Test-ClaudeReady
    if ($probe.Ready) {
      if ($script:Current) {
        $script:Current.WaitUntil = $null
        $st = Get-StepState $script:Current.Id
        $st.status = 'running'
        Save-State
      }
      Write-PLog 'Limit je resetovan — nastavljam.' 'OK'
      Write-Status -Force
      return
    }
    $reason = [string]$probe.Text
    if (-not ($reason -match $LimitStrict)) {
      Write-PLog ('Provera posle čekanja nije uspela (nije limit): {0}' -f (($reason -replace '\s+', ' ').Trim())) 'WARN'
      $reason = ''
    }
  }
}

function Wait-ForNetwork {
  # Internet / DNS is down on this PC: wait (without counting failures) until Claude answers again.
  $waitStart = Get-Date
  $delayMin = 3
  while ($true) {
    $until = (Get-Date).AddMinutes($delayMin)
    if ($script:Current) { $script:Current.WaitUntil = $until; $script:Current.WaitReason = 'internet' }
    Write-PLog ('Nema interneta / API nije dostupan — čekam i proveravam ponovo u {0}.' -f $until.ToString('HH:mm')) 'WARN'
    Write-Status -Force
    Wait-Until $until
    $probe = Test-ClaudeReady
    if ($probe.Ready) {
      if ($script:Current) { $script:Current.WaitUntil = $null; $script:Current.WaitReason = '' }
      Write-PLog ('Internet je ponovo tu (čekanje {0}) — nastavljam istu sesiju.' -f (Format-Duration ((Get-Date) - $waitStart).TotalSeconds)) 'OK'
      Write-Status -Force
      return
    }
    if ([string]$probe.Text -match $LimitStrict) {
      if ($script:Current) { $script:Current.WaitReason = '' }
      Wait-ForLimit ([string]$probe.Text)
      return
    }
    if (((Get-Date) - $waitStart).TotalHours -gt 48) { throw 'Internet nije dostupan duže od 48h — zaustavljam pipeline.' }
    $delayMin = [math]::Min(10, $delayMin + 2)
  }
}

# Runs one task (a step or a recovery) with retries, limit waits and session continuation.
function Invoke-ClaudeTask {
  param(
    [string]$StepId, [string]$Title, [string]$Mode, [string]$Effort, [string]$PermMode,
    [string]$InitialResumeId, [string]$SessionName, [string]$InitialStdin, [string]$GoalArg,
    [int]$MaxRetries, [int]$TimeoutMin, [int]$StallMin, [string]$LogTag,
    [switch]$StartWithContinue, [string]$ContinueReason = ''
  )
  $st = Get-StepState $StepId
  $continueTpl = Read-TextFile $ContinueTplPath
  $currentSession = $InitialResumeId
  $isPlan = ($Mode -eq 'plan')
  $failures = 0; $transient = 0; $mismatch = 0
  $continuation = $false
  $lastReason = ''
  if ($StartWithContinue -and $InitialResumeId) { $continuation = $true; $lastReason = $ContinueReason }
  $lastErrorText = ''
  $costTotal = 0.0
  while ($true) {
    $st.attempts = [int]$st.attempts + 1
    Save-State
    $sessionForRun = $null
    if ($continuation -and $currentSession) { $sessionForRun = $currentSession }
    elseif (-not $continuation) { $sessionForRun = $InitialResumeId }
    $a = New-ClaudeArgs -Effort $Effort -PermMode $PermMode -ResumeId $sessionForRun -SessionName $SessionName
    $stdin = $InitialStdin
    $positional = $GoalArg
    if ($continuation -and $sessionForRun) {
      if ($GoalArg) { $stdin = '' }
      else {
        $stdin = Fill-Template $continueTpl @{ STEP_ID = $StepId; STEP_TITLE = $Title; REASON = $lastReason }
        $positional = ''
      }
    }
    if ($positional) { $a = @($a) + @($positional) }
    $logBase = '{0}{1}-{2:00}' -f $StepId, $LogTag, [int]$st.attempts
    Write-PLog ('Korak {0}{1} · pokušaj {2} · {3} · effort {4} · {5}{6}' -f $StepId, $LogTag, $st.attempts, $Mode, $Effort, $PermMode, $(if ($sessionForRun) { ' · nastavak sesije ' + $sessionForRun } else { ' · nova sesija' })) 'STEP'
    $sessionField = 'sessionId'
    if ($LogTag) { $sessionField = 'recoverySessionId' }
    $run = Invoke-ClaudeRun -ArgList $a -StdinText $stdin -LogBase $logBase -TimeoutMin $TimeoutMin -StallMin $StallMin -RequestedMode $PermMode -StepId $StepId -SessionField $sessionField
    if ($run.SessionId) { $currentSession = $run.SessionId; $st[$sessionField] = $run.SessionId }
    $costTotal += [double]$run.CostUsd
    $st.turns = [int]$st.turns + [int]$run.NumTurns
    if ($run.CostUsd) { $st.costUsd = [math]::Round([double]$run.CostUsd, 2) }
    $outcome = Get-RunOutcome -Run $run -IsPlan $isPlan
    $summary = ($run.ResultText -replace '\s+', ' ').Trim()
    if ($summary.Length -gt 300) { $summary = $summary.Substring(0, 300) + '...' }
    Write-PLog ('Rezultat: {0} (exit {1}, turns {2}, alati {3}, odbijeno {4}) {5}' -f $outcome, $run.ExitCode, $run.NumTurns, $run.ToolCalls, $run.Denials, $summary)
    if ($run.Denials -gt 30) { Write-PLog ('Mnogo odbijenih akcija ({0}) — proveri log {1}.jsonl' -f $run.Denials, $logBase) 'WARN' }
    Save-State

    if ($outcome -eq 'success') { return @{ Outcome = 'completed'; Run = $run; SessionId = $currentSession } }

    if ($outcome -eq 'limit') {
      Wait-ForLimit ($run.ResultText + "`n" + $run.Stderr)
      $continuation = $true
      $lastReason = 'a usage limit was reached; it has reset now'
      continue
    }
    if ($outcome -eq 'network') {
      Wait-ForNetwork
      $continuation = $true
      $lastReason = 'the internet connection of this PC dropped; it is back now'
      continue
    }
    if ($outcome -eq 'auth') {
      $lastErrorText = ($run.ResultText + ' ' + $run.Stderr)
      Write-PLog ('Claude nije ulogovan / problem sa nalogom: {0}' -f $lastErrorText) 'ERROR'
      return @{ Outcome = 'fatal'; Run = $run; SessionId = $currentSession; Error = 'Claude login / nalog: ' + $lastErrorText }
    }
    if ($outcome -eq 'modemismatch') {
      $mismatch++
      if ($mismatch -ge 3) {
        return @{ Outcome = 'fatal'; Run = $run; SessionId = $currentSession; Error = ('Auto mode nije dostupan (sesija krenula u "{0}").' -f $run.PermissionMode) }
      }
      Write-PLog 'Auto mode trenutno nije dostupan za sesiju — čekam 15 min pa pokušavam ponovo.' 'WARN'
      Wait-Seconds 900
      $continuation = $false
      continue
    }
    if ($outcome -eq 'transient') {
      $transient++
      if ($transient -le 6) {
        $delay = [math]::Min(1800, 300 * $transient)
        Write-PLog ('Privremena greška API-ja/mreže — čekam {0} min.' -f [math]::Round($delay / 60)) 'WARN'
        Wait-Seconds $delay
        $continuation = $true
        $lastReason = 'a temporary API or network error'
        continue
      }
    }
    $failures++
    $lastErrorText = ('outcome={0}; exit={1}; result={2}; stderr={3}' -f $outcome, $run.ExitCode, $summary, ((($run.Stderr -replace '\s+', ' ').Trim()) | ForEach-Object { if ($_.Length -gt 800) { $_.Substring($_.Length - 800) } else { $_ } }))
    $st.lastError = $lastErrorText
    Save-State
    if ($failures -lt $MaxRetries) {
      $lastReason = 'the process ended with: ' + $outcome
      Write-PLog ('Neuspeh ({0}/{1}) — nastavljam istu sesiju za minut.' -f $failures, $MaxRetries) 'WARN'
      Wait-Seconds 60
      $continuation = $true
      continue
    }
    return @{ Outcome = 'failed'; Run = $run; SessionId = $currentSession; Error = $lastErrorText }
  }
}

function Complete-Step {
  param($Step, [hashtable]$Run, [string]$StatusValue = 'completed')
  $id = [string]$Step.id
  $st = Get-StepState $id
  $text = [string]$Run.ResultText
  if ($Run.PlanFile -and (Test-Path $Run.PlanFile)) {
    # plan mode keeps the plan in its own plan file; prefer it when it is longer than what came back in the final message
    try {
      $pf = Read-TextFile $Run.PlanFile
      if ($pf.Length -gt $Run.PlanText.Length) { $Run.PlanText = $pf }
    } catch { }
  }
  if ($Run.PlanText -and ($Run.PlanText.Length -gt 200) -and -not $text.Contains($Run.PlanText.Substring(0, 200))) {
    $text = $Run.PlanText + [Environment]::NewLine + [Environment]::NewLine + '---' + [Environment]::NewLine + [Environment]::NewLine + $text
  }
  Write-TextFile (Join-Path $LogsDir ($id + '-result.md')) $text
  $save = [string](Get-Prop $Step 'saveResultTo' '')
  if ($save) { Write-TextFile (Join-Path $ProjectDir $save) $text }
  $st.status = $StatusValue
  $st.endedAt = (Get-Date).ToString('s')
  if ($script:Current) { $st.durationSec = [math]::Round(((Get-Date) - $script:Current.StartedAt).TotalSeconds) }
  Save-State
  Invoke-GitCheckpoint ('pipeline({0}): {1}' -f $id, $Step.title)
  Clear-DevPorts
}

# ---------------------------------------------------------------- git, ports, keep-awake
function Invoke-Git {
  param([string[]]$ArgList, [int]$TimeoutSec = 300)
  return Invoke-Native -Exe $script:GitExe -ArgList $ArgList -TimeoutSec $TimeoutSec
}

function Invoke-GitCheckpoint {
  param([string]$Message)
  if ($DryRun -or $null -eq $script:GitExe) { return }
  if (-not (Test-Path (Join-Path $ProjectDir '.git'))) { return }
  $s = Invoke-Git @('status', '--porcelain')
  if (-not $s.StdOut.Trim()) { return }
  [void](Invoke-Git @('add', '-A') 600)
  $c = Invoke-Git @('commit', '-m', $Message, '--no-verify', '--quiet') 300
  if ($c.ExitCode -eq 0) { Write-PLog ('Git commit: ' + $Message) 'OK' } else { Write-PLog ('Git commit nije uspeo: ' + $c.StdErr.Trim()) 'WARN' }
}

function Clear-DevPorts {
  if (-not $IsWin -or $DryRun) { return }
  foreach ($port in @(3000, 3100, 3200, 9323)) {
    try {
      $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
      foreach ($c in @($conns)) {
        if ($null -eq $c) { continue }
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and ($proc.ProcessName -match '^(node|bun)$')) {
          Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
          Write-PLog ('Ugašen zaostali server na portu {0} (PID {1}).' -f $port, $proc.Id)
        }
      }
    } catch { }
  }
}

function Set-KeepAwake {
  param([bool]$On)
  if (-not $IsWin) { return }
  try {
    if (-not ('SklopPower.Native' -as [type])) {
      Add-Type -Namespace SklopPower -Name Native -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);' | Out-Null
    }
    # ES_CONTINUOUS (0x80000000) | ES_SYSTEM_REQUIRED (0x1): the PC stays awake while this script runs; the display may sleep
    if ($On) { [void][SklopPower.Native]::SetThreadExecutionState([uint32]2147483649); $script:KeepAwakeOn = $true }
    else { [void][SklopPower.Native]::SetThreadExecutionState([uint32]2147483648); $script:KeepAwakeOn = $false }
  } catch { Write-PLog ('Keep-awake nije uspeo: ' + $_.Exception.Message) 'WARN' }
}

# ---------------------------------------------------------------- preflight
function Find-Blender {
  if ($BlenderExe -and (Test-Path $BlenderExe)) { return (Resolve-Path $BlenderExe).Path }
  if ($env:BLENDER_EXE -and (Test-Path $env:BLENDER_EXE)) { return $env:BLENDER_EXE }
  $cmd = Get-Command blender -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd) { return $cmd.Source }
  if (-not $IsWin) { return $null }
  $roots = @(
    (Join-Path $env:ProgramFiles 'Blender Foundation'),
    (Join-Path ${env:ProgramFiles(x86)} 'Blender Foundation'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Blender Foundation'),
    (Join-Path ${env:ProgramFiles(x86)} 'Steam\steamapps\common\Blender'),
    (Join-Path $env:ProgramFiles 'Steam\steamapps\common\Blender'),
    (Join-Path $env:USERPROFILE 'scoop\apps\blender\current')
  )
  $found = @()
  foreach ($r in $roots) {
    if ($r -and (Test-Path $r)) {
      $found += @(Get-ChildItem -Path $r -Filter 'blender.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue)
    }
  }
  try {
    $assoc = (Get-ItemProperty -Path 'Registry::HKEY_CLASSES_ROOT\blendfile\shell\open\command' -ErrorAction SilentlyContinue).'(default)'
    if ($assoc) {
      $m = [regex]::Match($assoc, '"([^"]+blender(-launcher)?\.exe)"')
      if ($m.Success) {
        $p = $m.Groups[1].Value -replace 'blender-launcher\.exe$', 'blender.exe'
        if (Test-Path $p) { $found += @(Get-Item $p) }
      }
    }
  } catch { }
  if ($found.Count -eq 0) { return $null }
  $best = $found | Sort-Object -Property @{ Expression = { $v = Get-SemVer ($_.Directory.Name); if ($v) { $v } else { [version]'0.0.0' } } }, LastWriteTime -Descending | Select-Object -First 1
  return $best.FullName
}

function Find-Chrome {
  if (-not $IsWin) { return $null }
  $cands = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
  )
  foreach ($c in $cands) { if ($c -and (Test-Path $c)) { return $c } }
  return $null
}

function Resolve-Claude {
  if ($ClaudeExe) { return (Resolve-Exe $ClaudeExe) }
  if ($IsWin) {
    $native = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
    if (Test-Path $native) { return (Resolve-Exe $native) }
  }
  $r = Resolve-Exe 'claude'
  if ($r -and $r.ViaCmd) {
    # npm shim: prefer running the package entry with node directly (more robust quoting)
    $dir = Split-Path -Parent $r.File
    $cli = Join-Path $dir 'node_modules\@anthropic-ai\claude-code\cli.js'
    $binExe = Join-Path $dir 'node_modules\@anthropic-ai\claude-code\bin\claude.exe'
    if (Test-Path $binExe) { return @{ File = $binExe; Prefix = @(); ViaCmd = $false } }
    $node = Resolve-Exe 'node'
    if ((Test-Path $cli) -and $node -and -not $node.ViaCmd) { return @{ File = $node.File; Prefix = @($cli); ViaCmd = $false } }
  }
  return $r
}

function Sync-Skills {
  $claudeSkills = Join-Path (Join-Path $ProjectDir '.claude') 'skills'
  if (-not (Test-Path $claudeSkills)) { New-Item -ItemType Directory -Force -Path $claudeSkills | Out-Null }
  $added = New-Object System.Collections.ArrayList
  $agents = Join-Path (Join-Path $ProjectDir '.agents') 'skills'
  if (Test-Path $agents) {
    foreach ($d in @(Get-ChildItem -Path $agents -Directory)) {
      $dest = Join-Path $claudeSkills $d.Name
      if (-not (Test-Path $dest)) { Copy-Item -Path $d.FullName -Destination $dest -Recurse -Force; [void]$added.Add($d.Name) }
    }
  }
  $zip = Join-Path (Join-Path $PipelineDir 'assets') 'claude-skills.zip'
  if (Test-Path $zip) {
    $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ('sklop-skills-' + [guid]::NewGuid().ToString('N'))
    try {
      Expand-Archive -Path $zip -DestinationPath $tmp -Force
      foreach ($d in @(Get-ChildItem -Path $tmp -Directory)) {
        $dest = Join-Path $claudeSkills $d.Name
        if (-not (Test-Path $dest)) { Copy-Item -Path $d.FullName -Destination $dest -Recurse -Force; [void]$added.Add($d.Name) }
      }
    } catch { Write-PLog ('Raspakivanje skillova nije uspelo: ' + $_.Exception.Message) 'WARN' }
    finally { if (Test-Path $tmp) { Remove-Item -Path $tmp -Recurse -Force -ErrorAction SilentlyContinue } }
  }
  $own = Join-Path $PipelineDir 'skills'
  if (Test-Path $own) {
    foreach ($d in @(Get-ChildItem -Path $own -Directory)) {
      $dest = Join-Path $claudeSkills $d.Name
      if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Force -Path $dest | Out-Null; [void]$added.Add($d.Name) }
      Copy-Item -Path (Join-Path $d.FullName '*') -Destination $dest -Recurse -Force
    }
  }
  $count = @(Get-ChildItem -Path $claudeSkills -Directory).Count
  if ($added.Count -gt 0) { Write-PLog ('Skillovi dodati u .claude/skills: {0}' -f ($added -join ', ')) 'OK' }
  Write-PLog ('Ukupno skillova u .claude/skills: {0}' -f $count)
}

function Initialize-AdminCredentials {
  $credPath = Join-Path $EnvDir 'ADMIN-CREDENTIALS.txt'
  if (-not (Test-Path $credPath)) {
    $chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $bytes = New-Object byte[] 18
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $pw = -join ($bytes | ForEach-Object { $chars[[int]$_ % $chars.Length] })
    $pw = 'Sk' + $pw + '7!'
    Write-TextFile $credPath ("email=admin@sklop.test`r`npassword=$pw`r`n")
    Write-PLog 'Napravljen lokalni admin nalog (pipeline/env/ADMIN-CREDENTIALS.txt).' 'OK'
  }
  $email = ''; $pass = ''
  foreach ($ln in ((Read-TextFile $credPath) -split "`r?`n")) {
    if ($ln -like 'email=*') { $email = $ln.Substring(6) }
    if ($ln -like 'password=*') { $pass = $ln.Substring(9) }
  }
  return @{ Email = $email; Password = $pass }
}

function Update-GitIgnore {
  $gi = Join-Path $ProjectDir '.gitignore'
  $content = ''
  if (Test-Path $gi) { $content = Read-TextFile $gi }
  $needed = @('pipeline/logs/', 'pipeline/state.json', 'pipeline/env/', 'pipeline/STATUS.md', '*.blend1', 'test-results/', 'playwright-report/', '3d/renders/')
  $add = @()
  foreach ($n in $needed) { if ($content -notmatch ('(?m)^' + [regex]::Escape($n) + '\s*$')) { $add += $n } }
  if ($add.Count -gt 0) {
    $nl = [Environment]::NewLine
    $block = $nl + '# SKLOP pipeline' + $nl + ($add -join $nl) + $nl
    [System.IO.File]::AppendAllText($gi, $block, $Utf8NoBom)
  }
}

function Write-EnvironmentFile {
  param([hashtable]$Info)
  $nl = [Environment]::NewLine
  $bashBlender = ''
  if ($script:BlenderPath) {
    $bashBlender = $script:BlenderPath -replace '\\', '/'
    if ($bashBlender -match '^([A-Za-z]):/(.*)$') { $bashBlender = '/' + $Matches[1].ToLower() + '/' + $Matches[2] }
  }
  $lines = @(
    '# Pipeline environment (auto-generated by run-pipeline.ps1)',
    '',
    ('Generated: {0}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm')),
    '',
    ('- OS: {0}' -f $Info.OS),
    ('- Project root: {0}  (the path contains spaces — always quote it)' -f $ProjectDir),
    ('- Node: {0} · npm: {1} · git: {2}' -f $Info.Node, $Info.Npm, $Info.Git),
    ('- Claude Code: {0} · model: {1}' -f $script:ClaudeVersion, $Model),
    ('- Blender: {0}' -f $script:BlenderVersion),
    ('  - BLENDER_EXE (Windows): {0}' -f $script:BlenderPath),
    ('  - Git Bash form: {0}' -f $bashBlender),
    ('  - Run headless: "$BLENDER_EXE" -b --factory-startup --python-exit-code 1 -P <script.py> -- <args>'),
    ('- Chrome/Edge for Lighthouse (CHROME_PATH): {0}' -f $script:ChromePath),
    ('- Convex deployment: {0}' -f $Info.Convex),
    '- Local admin login for development: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD environment variables (stored in pipeline/env/ADMIN-CREDENTIALS.txt, git-ignored).',
    '- Ports: 3000 dev, 3100 e2e / production checks.',
    ''
  )
  Write-TextFile (Join-Path $EnvDir 'ENVIRONMENT.md') ($lines -join $nl)
}

function Invoke-Preflight {
  Write-PLog '=== Preflight ===' 'STEP'
  if (-not $IsWin) { Write-PLog 'Ovo nije Windows — pokrećem u test režimu.' 'WARN' }
  if (-not (Test-Path $StepsPath)) { throw 'Nema pipeline/steps.json' }

  # --- Claude Code
  $script:Claude = Resolve-Claude
  if ($null -eq $script:Claude) { throw 'Claude Code (claude) nije pronađen. Instaliraj ga ili prosledi -ClaudeExe.' }
  Write-PLog ('Claude: {0} {1}' -f $script:Claude.File, ($script:Claude.Prefix -join ' '))
  $v = Invoke-Native -Exe $script:Claude -ArgList @('--version') -TimeoutSec 120
  $ver = Get-SemVer $v.StdOut
  if (-not $NoUpdate -and -not $DryRun) {
    Write-PLog 'Ažuriram Claude Code (claude update)...'
    $u = Invoke-Native -Exe $script:Claude -ArgList @('update') -TimeoutSec 900
    $ut = (($u.StdOut + ' ' + $u.StdErr) -replace '\s+', ' ').Trim()
    if ($ut.Length -gt 200) { $ut = $ut.Substring(0, 200) }
    Write-PLog ('claude update: ' + $ut)
    $v = Invoke-Native -Exe $script:Claude -ArgList @('--version') -TimeoutSec 120
    $ver = Get-SemVer $v.StdOut
  }
  $script:ClaudeVersion = [string]$ver
  Write-PLog ('Claude Code verzija: {0}' -f $ver)
  $help = Invoke-Native -Exe $script:Claude -ArgList @('--help') -TimeoutSec 120
  $h = $help.StdOut + $help.StdErr
  $script:Features.Effort = ($h -match '--effort') -or ($ver -and $ver -ge [version]'2.1.200')
  $script:Features.PermissionPrompts = ($h -match '--permission-prompts')
  $script:Features.Name = ($h -match '--name')
  $script:Features.AppendFile = ($h -match '--append-system-prompt-file')
  if ($ver) {
    $script:Features.Goal = ($ver -ge $GoalMinVersion)
    $script:Features.Ultracode = ($ver -ge $UltracodeMinVersion)
    if ($ver -lt $MinClaudeVersion) { Write-PLog ('Claude Code {0} je stariji od preporučenog {1}. Pokreni "claude update".' -f $ver, $MinClaudeVersion) 'WARN' }
  }
  Write-PLog ('Podržano: effort={0} permission-prompts={1} name={2} append-file={3} goal={4} ultracode={5}' -f $script:Features.Effort, $script:Features.PermissionPrompts, $script:Features.Name, $script:Features.AppendFile, $script:Features.Goal, $script:Features.Ultracode)

  # --- tools
  $script:GitExe = Resolve-Exe 'git'
  if ($null -eq $script:GitExe) { throw 'git nije pronađen.' }
  $nodeExe = Resolve-Exe 'node'
  if ($null -eq $nodeExe) { throw 'Node.js nije pronađen.' }
  $npmExe = Resolve-Exe 'npm'
  $info = @{ OS = [System.Environment]::OSVersion.VersionString; Node = ''; Npm = ''; Git = ''; Convex = '' }
  $info.Node = (Invoke-Native -Exe $nodeExe -ArgList @('--version') -TimeoutSec 60).StdOut.Trim()
  if ($npmExe) { $info.Npm = (Invoke-Native -Exe $npmExe -ArgList @('--version') -TimeoutSec 120).StdOut.Trim() }
  $info.Git = (Invoke-Git @('--version') 60).StdOut.Trim()
  Write-PLog ('Node {0} · npm {1} · {2}' -f $info.Node, $info.Npm, $info.Git)

  # --- Convex
  $envLocal = Join-Path $ProjectDir '.env.local'
  if (Test-Path $envLocal) {
    $m = [regex]::Match((Read-TextFile $envLocal), '(?m)^CONVEX_DEPLOYMENT=([^\s#]+)')
    if ($m.Success) { $info.Convex = $m.Groups[1].Value }
  }
  if (-not $info.Convex) { Write-PLog 'U .env.local nema CONVEX_DEPLOYMENT — pokreni "npx convex dev" jednom.' 'WARN' }
  if ($IsWin) {
    $convexCfg = Join-Path $env:USERPROFILE '.convex\config.json'
    if (-not (Test-Path $convexCfg)) { Write-PLog 'Nije pronađen Convex login (~/.convex/config.json). Pokreni "npx convex login".' 'WARN' }
  }
  Write-PLog ('Convex deployment: {0}' -f $info.Convex)

  # --- Blender, Chrome
  $script:BlenderPath = Find-Blender
  if ($script:BlenderPath) {
    $bv = Invoke-Native -Exe (Resolve-Exe $script:BlenderPath) -ArgList @('-b', '--factory-startup', '--version') -TimeoutSec 240
    $bm = [regex]::Match($bv.StdOut, 'Blender\s+(\d+\.\d+(\.\d+)?)')
    if ($bm.Success) { $script:BlenderVersion = $bm.Groups[1].Value } else { $script:BlenderVersion = 'nepoznata (proveri ručno)' }
    Write-PLog ('Blender {0}: {1}' -f $script:BlenderVersion, $script:BlenderPath) 'OK'
  } else {
    throw 'Blender nije pronađen. Instaliraj Blender ili pokreni sa -BlenderExe "C:\...\blender.exe".'
  }
  $script:ChromePath = Find-Chrome
  if ($script:ChromePath) { Write-PLog ('Browser za Lighthouse: ' + $script:ChromePath) }

  # --- skills, credentials, env file, gitignore
  Sync-Skills
  $cred = Initialize-AdminCredentials
  Write-EnvironmentFile $info
  Update-GitIgnore

  # --- child environment
  $script:ChildEnv = @{
    'BLENDER_EXE' = $script:BlenderPath
    'SEED_ADMIN_EMAIL' = $cred.Email
    'SEED_ADMIN_PASSWORD' = $cred.Password
    'npm_config_yes' = 'true'
    'NEXT_TELEMETRY_DISABLED' = '1'
    'BASH_DEFAULT_TIMEOUT_MS' = '900000'
    'BASH_MAX_TIMEOUT_MS' = '3600000'
    'CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS' = '10800000'
    'CLAUDE_CODE_RESUME_INTERRUPTED_TURN' = '1'
    'DISABLE_AUTOUPDATER' = '1'
    'SLASH_COMMAND_TOOL_CHAR_BUDGET' = '60000'
    'MCP_TIMEOUT' = '60000'
    'PLAYWRIGHT_HTML_OPEN' = 'never'
    'PW_TEST_HTML_REPORT_OPEN' = 'never'
    'BROWSER' = 'none'
    'GIT_TERMINAL_PROMPT' = '0'
    'NO_UPDATE_NOTIFIER' = '1'
    'FORCE_COLOR' = '0'
  }
  if ($script:ChromePath) { $script:ChildEnv['CHROME_PATH'] = $script:ChromePath }

  # --- Claude login + auto mode probe
  if (-not $DryRun) {
    Write-PLog 'Proveravam Claude login i model...'
    $ready = Test-ClaudeReady
    if (-not $ready.Ready) {
      if ($ready.Text -match $LimitStrict) { Wait-ForLimit $ready.Text }
      elseif ($ready.Text -match $NetworkRx) { Wait-ForNetwork }
      else { throw ('Claude ne odgovara kako treba: ' + (($ready.Text -replace '\s+', ' ').Trim())) }
    }
    Write-PLog ('Claude odgovara ({0}).' -f $Model) 'OK'
    $probeFile = Join-Path $EnvDir 'auto-probe.txt'
    if (Test-Path $probeFile) { Remove-Item $probeFile -Force }
    Write-PLog 'Proveravam auto mode...'
    $pa = @('-p', '--model', $Model, '--output-format', 'stream-json', '--verbose', '--permission-mode', 'auto', '--no-session-persistence')
    if ($script:Features.Effort) { $pa += @('--effort', 'low') }
    if ($script:Features.PermissionPrompts) { $pa += @('--permission-prompts', 'none') }
    $pa += 'Run the shell command: node --version . Then write its exact output into the file pipeline/env/auto-probe.txt (create it). Reply with the single word DONE.'
    $probe = Invoke-ClaudeRun -ArgList $pa -StdinText '' -LogBase '00-auto-probe' -TimeoutMin 15 -StallMin 10 -RequestedMode 'auto'
    $probeOk = (Test-Path $probeFile) -and ((Read-TextFile $probeFile) -match 'v\d+')
    if ($probe.Skills.Count -gt 0) { Write-PLog ('Claude vidi {0} skillova.' -f $probe.Skills.Count) }
    if ($probeOk) {
      $script:PermissionMode = 'auto'
      Write-PLog 'Auto mode radi.' 'OK'
    } else {
      $why = ('mode={0}; denials={1}; result={2}' -f $probe.PermissionMode, $probe.Denials, (($probe.ResultText -replace '\s+', ' ').Trim()))
      if ($IfAutoModeUnavailable -eq 'bypassPermissions') {
        $script:PermissionMode = 'bypassPermissions'
        Write-PLog ('Auto mode ne radi ({0}) — po parametru prelazim na bypassPermissions.' -f $why) 'WARN'
      } else {
        throw ('Auto mode ne radi na ovom nalogu/verziji ({0}). Pokreni ponovo sa -IfAutoModeUnavailable bypassPermissions ako prihvataš rad bez provera.' -f $why)
      }
    }
  }

  # --- git snapshot
  if (-not (Test-Path (Join-Path $ProjectDir '.git'))) { [void](Invoke-Git @('init')) }
  $ue = Invoke-Git @('config', 'user.email')
  if (-not $ue.StdOut.Trim()) {
    [void](Invoke-Git @('config', 'user.email', 'pipeline@sklop.local'))
    [void](Invoke-Git @('config', 'user.name', 'SKLOP pipeline'))
  }
  Invoke-GitCheckpoint 'chore(pipeline): snapshot before pipeline run'
  Write-PLog '=== Preflight OK ===' 'OK'
}

# ---------------------------------------------------------------- main
function Show-Plan {
  $steps = @($script:Manifest.steps)
  Write-Host ''
  Write-Host ('{0} — {1} koraka, model {2}, effort profil: {3}' -f $script:Manifest.project, $steps.Count, $script:Manifest.modelLabel, $EffortProfile) -ForegroundColor Cyan
  Write-Host ('{0,-3} {1,-62} {2,-9} {3,-11} {4,-12} {5}' -f '#', 'Korak', 'Model', 'Effort', 'Sesija', 'Mode')
  foreach ($s in $steps) {
    $st = $script:State.steps[[string]$s.id]
    $flag = ''
    if ($st -and ($st.status -eq 'completed' -or $st.status -eq 'recovered')) { $flag = '  (gotovo)' }
    $title = [string]$s.title
    if ($title.Length -gt 60) { $title = $title.Substring(0, 60) }
    Write-Host ('{0,-3} {1,-62} {2,-9} {3,-11} {4,-12} {5}{6}' -f $s.id, $title, $script:Manifest.modelLabel, (Get-Effort $s), (Get-SessionLabel $s), $s.mode, $flag)
  }
  Write-Host ''
}

$exitCode = 0
try {
  $script:Manifest = (Read-TextFile $StepsPath) | ConvertFrom-Json
  if (-not $Model) { $Model = [string]$script:Manifest.model }
  if (-not $Model) { $Model = 'opus' }
  Load-State
  if ($ListSteps) { Show-Plan; return }

  Write-Host ''
  Write-Host '  SKLOP — autonomni build pipeline (Claude Code · Opus 5.5)' -ForegroundColor Cyan
  Write-Host '  Ne zatvaraj ovaj prozor. Status: pipeline\STATUS.md' -ForegroundColor Cyan
  Write-Host ''
  Write-PLog ('Projekat: ' + $ProjectDir)
  Set-KeepAwake $true
  if ($SkipPreflight -or $DryRun) {
    $script:Claude = Resolve-Claude
    if ($null -eq $script:Claude) { $script:Claude = @{ File = 'claude'; Prefix = @(); ViaCmd = $false } }
    $script:GitExe = Resolve-Exe 'git'
    if (-not $script:BlenderPath) { $script:BlenderPath = Find-Blender }
    if ($SkipPreflight -and -not $DryRun) {
      $cred = Initialize-AdminCredentials
      $script:ChildEnv = @{ 'BLENDER_EXE' = [string]$script:BlenderPath; 'SEED_ADMIN_EMAIL' = $cred.Email; 'SEED_ADMIN_PASSWORD' = $cred.Password; 'npm_config_yes' = 'true'; 'PLAYWRIGHT_HTML_OPEN' = 'never'; 'PW_TEST_HTML_REPORT_OPEN' = 'never'; 'CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS' = '10800000'; 'BASH_DEFAULT_TIMEOUT_MS' = '900000'; 'BASH_MAX_TIMEOUT_MS' = '3600000'; 'CLAUDE_CODE_RESUME_INTERRUPTED_TURN' = '1'; 'DISABLE_AUTOUPDATER' = '1'; 'SLASH_COMMAND_TOOL_CHAR_BUDGET' = '60000'; 'BROWSER' = 'none'; 'GIT_TERMINAL_PROMPT' = '0' }
    }
  } else {
    Invoke-Preflight
  }
  Show-Plan
  $script:State.lastRunStartedAt = (Get-Date).ToString('s')
  $script:State.permissionMode = $script:PermissionMode
  $script:State.effortProfile = $EffortProfile
  Save-State
  Write-Status -Force

  $defaults = $script:Manifest.defaults
  $consecutiveFailures = 0
  $stopReason = ''
  foreach ($step in @($script:Manifest.steps)) {
    $id = [string]$step.id
    $st = Get-StepState $id
    if ($Only -and $id -ne $Only) { continue }
    if ($From -and ((Get-StepNumber $step) -lt [int]$From)) { continue }
    if (-not $Only -and -not $From -and ($st.status -eq 'completed' -or $st.status -eq 'recovered')) { continue }

    $mode = [string]$step.mode
    $effort = Get-Effort $step
    $permMode = $script:PermissionMode
    if ($mode -eq 'plan') { $permMode = 'plan' }
    $timeout = [int](Get-Prop $step 'timeoutMinutes' (Get-Prop $defaults 'timeoutMinutes' 360))
    $stall = [int](Get-Prop $step 'stallMinutes' (Get-Prop $defaults 'stallMinutes' 90))
    $maxRetries = [int](Get-Prop $step 'maxRetries' (Get-Prop $defaults 'maxRetries' 3))

    $resumeId = ''
    $sessionSpec = [string]$step.session
    $preface = ''
    $startWithContinue = $false
    $wasInterrupted = ([int]$st.attempts -gt 0) -and ([string]$st.sessionId) -and ($st.status -ne 'completed') -and ($st.status -ne 'recovered')
    if ($wasInterrupted -and -not $From -and -not $Only) {
      # the pipeline was stopped or crashed in the middle of this step: pick up the same Claude session
      $resumeId = [string]$st.sessionId
      $startWithContinue = $true
      Write-PLog ('Korak {0} je ranije prekinut — nastavljam njegovu sesiju {1}.' -f $id, $resumeId) 'WARN'
    } elseif ($sessionSpec -like 'resume:*') {
      $ref = $sessionSpec.Substring(7)
      $refState = $script:State.steps[$ref]
      if ($refState -and $refState.sessionId) { $resumeId = [string]$refState.sessionId }
      else {
        Write-PLog ('Sesija koraka {0} nije poznata — korak {1} kreće u novoj sesiji uz kontekst iz docs/.' -f $ref, $id) 'WARN'
        $preface = ('(Context note from the orchestrator: the Claude session of step {0} is not available, so this run starts fresh. Read pipeline/BRIEF.md, docs/ (especially docs/plans/, docs/PROGRESS.md and docs/progress/) and pipeline/logs/{0}-result.md before you start.)' -f $ref) + [Environment]::NewLine + [Environment]::NewLine
      }
    }
    $stdin = ''
    $goalArg = ''
    if ($mode -eq 'goal') {
      $goal = Get-GoalText $step
      if ($script:Features.Goal) {
        $goalArg = '/goal ' + $goal
        if ($preface) { $goalArg = '/goal ' + $goal + ' Before anything else read pipeline/BRIEF.md, docs/PROGRESS.md and pipeline/logs/' + $sessionSpec.Substring(7) + '-result.md for context.' }
      } else {
        $stdin = $preface + 'Keep working until every item below is demonstrably true (show command output as evidence), then finish with the Step report.' + [Environment]::NewLine + [Environment]::NewLine + $goal
      }
    } else {
      $stdin = $preface + (Get-PromptText $step)
    }

    $st.status = 'running'
    $st.startedAt = (Get-Date).ToString('s')
    $st.effort = $effort
    $st.mode = $mode
    Save-State
    $script:Current = @{ Id = $id; Title = [string]$step.title; Effort = $effort; Mode = $mode; StartedAt = (Get-Date); WaitUntil = $null; WaitReason = '' }
    Write-Host ''
    Write-PLog ('━━━ Korak {0}: {1} · {2} · effort {3} · {4} · {5}' -f $id, $step.title, $script:Manifest.modelLabel, $effort, (Get-SessionLabel $step), $mode) 'STEP'
    Write-Status -Force
    Send-Notify ('SKLOP korak ' + $id) ('Počinje: ' + $step.title)

    $task = Invoke-ClaudeTask -StepId $id -Title ([string]$step.title) -Mode $mode -Effort $effort -PermMode $permMode `
      -InitialResumeId $resumeId -SessionName ('sklop-{0}-{1}' -f $id, $step.slug) -InitialStdin $stdin -GoalArg $goalArg `
      -MaxRetries $maxRetries -TimeoutMin $timeout -StallMin $stall -LogTag '' `
      -StartWithContinue:$startWithContinue -ContinueReason 'the pipeline was stopped or restarted in the middle of this step'

    if ($task.Outcome -eq 'completed') {
      Complete-Step -Step $step -Run $task.Run -StatusValue 'completed'
      $consecutiveFailures = 0
      Write-PLog ('Korak {0} završen za {1}.' -f $id, (Format-Duration ((Get-Date) - $script:Current.StartedAt).TotalSeconds)) 'OK'
      Send-Notify ('SKLOP korak ' + $id + ' OK') ('Gotovo: ' + $step.title)
    } elseif ($task.Outcome -eq 'fatal') {
      $st.status = 'failed'; $st.lastError = [string]$task.Error; Save-State
      $stopReason = [string]$task.Error
      Write-PLog ('Fatalna greška u koraku {0}: {1}' -f $id, $task.Error) 'ERROR'
      break
    } else {
      Write-PLog ('Korak {0} nije uspeo ni posle {1} pokušaja — pokrećem recovery sesiju.' -f $id, $maxRetries) 'WARN'
      $recoveryTpl = Read-TextFile $RecoveryTplPath
      $promptFile = 'pipeline/' + [string](Get-Prop $step 'prompt' (Get-Prop $step 'goal' ''))
      $recStdin = Fill-Template $recoveryTpl @{ STEP_ID = $id; STEP_TITLE = [string]$step.title; ATTEMPTS = $maxRetries; LAST_ERROR = [string]$task.Error; PROMPT_FILE = $promptFile }
      $recEffort = 'xhigh'
      if ($effort -eq 'max') { $recEffort = 'max' }
      if (-not $script:Features.Effort) { $recEffort = '' }
      $rec = Invoke-ClaudeTask -StepId $id -Title ([string]$step.title) -Mode 'auto' -Effort $recEffort -PermMode $script:PermissionMode `
        -InitialResumeId '' -SessionName ('sklop-{0}-recovery' -f $id) -InitialStdin $recStdin -GoalArg '' `
        -MaxRetries 2 -TimeoutMin $timeout -StallMin $stall -LogTag 'r'
      if ($rec.Outcome -eq 'completed') {
        Complete-Step -Step $step -Run $rec.Run -StatusValue 'recovered'
        $consecutiveFailures = 0
        Write-PLog ('Korak {0} završen posle oporavka.' -f $id) 'OK'
      } elseif ($rec.Outcome -eq 'fatal') {
        $st.status = 'failed'; $st.lastError = [string]$rec.Error; Save-State
        $stopReason = [string]$rec.Error
        Write-PLog ('Fatalna greška u oporavku koraka {0}: {1}' -f $id, $rec.Error) 'ERROR'
        break
      } else {
        $st.status = 'failed'; $st.lastError = [string]$rec.Error; $st.endedAt = (Get-Date).ToString('s'); Save-State
        Invoke-GitCheckpoint ('pipeline({0}): partial work (step failed)' -f $id)
        $consecutiveFailures++
        Write-PLog ('Korak {0} NIJE uspeo. Nastavljam sa sledećim (greške zaredom: {1}).' -f $id, $consecutiveFailures) 'ERROR'
        Send-Notify ('SKLOP korak ' + $id + ' GRESKA') ('Nije uspeo: ' + $step.title)
        if ($consecutiveFailures -ge 2) { $stopReason = 'Dva koraka zaredom nisu uspela.'; break }
      }
    }
    $script:Current = $null
    Write-Status -Force
  }

  $script:Current = $null
  Write-Status -Force
  if ($stopReason) {
    $exitCode = 2
    Write-PLog ('Pipeline ZAUSTAVLJEN: {0}' -f $stopReason) 'ERROR'
    Write-PLog 'Kad središ uzrok, samo ponovo pokreni START-PIPELINE.cmd — nastavlja od prvog nezavršenog koraka.' 'WARN'
    Send-Notify 'SKLOP pipeline ZAUSTAVLJEN' $stopReason
  } else {
    Write-PLog ('Pipeline završen. Ukupno: {0}.' -f (Format-Duration ((Get-Date) - $script:RunStartedAt).TotalSeconds)) 'OK'
    Send-Notify 'SKLOP pipeline gotov' 'Svi koraci su prošli. Pogledaj pipeline/STATUS.md i docs/PREDAJA.md.'
  }
} catch {
  $exitCode = 1
  Write-PLog ('Neočekivana greška: {0}' -f $_.Exception.Message) 'ERROR'
  Write-PLog ($_.ScriptStackTrace) 'ERROR'
  Send-Notify 'SKLOP pipeline GRESKA' $_.Exception.Message
} finally {
  if ($script:Current) {
    $st = Get-StepState $script:Current.Id
    if ($st.status -eq 'running' -or $st.status -eq 'waiting_limit') { $st.status = 'pending'; Save-State }
    $script:Current = $null
  }
  Write-Status -Force
  Set-KeepAwake $false
}
exit $exitCode

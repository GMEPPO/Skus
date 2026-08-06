# Fase 2B.2 R5 — Auth/RPC runner pass1 (PowerShell, sin Node)
# Barreras GGMPI (todas obligatorias para pmovliksftlcjvjxvqhm):
#   SUPABASE_PROJECT_REF=pmovliksftlcjvjxvqhm
#   PHASE2B2_ALLOW_GGMPI_AUTHORIZED_WINDOW=true
#   REFUSE_GGMPI_PRODUCTION_LIKE=true
#   PHASE2B2_TEST_PASSWORD=...
# Carga también .env.test-supabase (URL/anon/service). No imprime secretos.

$ErrorActionPreference = "Stop"
$GGMPI = "pmovliksftlcjvjxvqhm"

function Load-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    $t = $_.Trim()
    if (-not $t -or $t.StartsWith("#")) { return }
    $i = $t.IndexOf("=")
    if ($i -lt 1) { return }
    $k = $t.Substring(0, $i).Trim()
    $v = $t.Substring($i + 1).Trim()
    if (-not [string]::IsNullOrWhiteSpace($k)) {
      Set-Item -Path "Env:$k" -Value $v
    }
  }
}

Load-EnvFile (Join-Path (Get-Location) ".env.test-supabase")

function Require-Env([string[]]$names) {
  foreach ($n in $names) {
    $v = [Environment]::GetEnvironmentVariable($n)
    if ($v -and $v.Trim()) { return $v.Trim() }
  }
  throw "Missing required env: $($names -join ' | ')"
}

function Mask-Uuid([string]$id) {
  if (-not $id -or $id.Length -lt 12) { return "***" }
  return ($id.Substring(0, 8) + "..." + $id.Substring($id.Length - 4))
}

function New-Uuid { [guid]::NewGuid().ToString() }

$url = Require-Env @("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
$anon = Require-Env @("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY")
$service = Require-Env @("SUPABASE_SERVICE_ROLE_KEY")
$password = Require-Env @("PHASE2B2_TEST_PASSWORD")
$projectRef = Require-Env @("SUPABASE_PROJECT_REF")

$hostRef = ([uri]$url).Host.Split(".")[0]
if ($projectRef -ne $hostRef) {
  throw "SUPABASE_PROJECT_REF='$projectRef' != URL host ref '$hostRef'"
}

$refuse = ($env:REFUSE_GGMPI_PRODUCTION_LIKE -eq "true")
$allowWin = ($env:PHASE2B2_ALLOW_GGMPI_AUTHORIZED_WINDOW -eq "true")
$isGgmpi = ($projectRef -eq $GGMPI)

if (-not $refuse) { throw "REFUSE_GGMPI_PRODUCTION_LIKE must be true" }
if ($isGgmpi -and -not $allowWin) { throw "GGMPI execution refused: authorized window not enabled" }
if (-not $isGgmpi -and $allowWin) { throw "PHASE2B2_ALLOW_GGMPI_AUTHORIZED_WINDOW only valid for GGMPI" }

$rest = "$url/rest/v1"
$auth = "$url/auth/v1"
$testRunId = if ($env:PHASE2B2_TEST_RUN_ID) { $env:PHASE2B2_TEST_RUN_ID } else { New-Uuid }

function Invoke-Admin([string]$method, [string]$path, $body = $null, [hashtable]$query = $null) {
  $headers = @{
    apikey = $service
    Authorization = "Bearer $service"
    "Content-Type" = "application/json"
    Prefer = "return=representation"
  }
  $uri = if ($path.StartsWith("http")) { $path } else { "$rest$path" }
  if ($query) {
    $qs = ($query.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString([string]$_.Value))" }) -join "&"
    $uri = "$uri`?$qs"
  }
  if ($null -eq $body) {
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers
  }
  $json = if ($body -is [string]) { $body } else { ($body | ConvertTo-Json -Depth 20 -Compress) }
  return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body $json
}

function Invoke-AuthAdmin([string]$method, [string]$path, $body = $null) {
  $headers = @{
    apikey = $service
    Authorization = "Bearer $service"
    "Content-Type" = "application/json"
  }
  $uri = "$auth$path"
  if ($null -eq $body) {
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers
  }
  $json = ($body | ConvertTo-Json -Depth 10 -Compress)
  return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body $json
}

function Sign-In([string]$email) {
  $headers = @{ apikey = $anon; "Content-Type" = "application/json" }
  $body = @{ email = $email; password = $password } | ConvertTo-Json -Compress
  $resp = Invoke-RestMethod -Method POST -Uri "$auth/token?grant_type=password" -Headers $headers -Body $body
  return $resp.access_token
}

function Get-HttpErrorBody($err) {
  try {
    if ($err.ErrorDetails -and $err.ErrorDetails.Message) {
      return [string]$err.ErrorDetails.Message
    }
  } catch {}
  try {
    $resp = $err.Exception.Response
    if ($resp -and $resp.GetResponseStream) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $text = $reader.ReadToEnd()
      $reader.Close()
      if ($text) { return $text }
    }
  } catch {}
  return [string]$err.Exception.Message
}

function Invoke-UserRpc([string]$token, [string]$fn, $payload) {
  $headers = @{
    apikey = $anon
    Authorization = "Bearer $token"
    "Content-Type" = "application/json"
    Prefer = "return=representation"
  }
  $body = ($payload | ConvertTo-Json -Depth 20 -Compress)
  try {
    $data = Invoke-RestMethod -Method POST -Uri "$rest/rpc/$fn" -Headers $headers -Body $body
    return @{ ok = $true; data = $data; error = $null; status = 200 }
  } catch {
    $raw = Get-HttpErrorBody $_
    return @{ ok = $false; data = $null; error = $raw.Substring(0, [Math]::Min(500, $raw.Length)); status = 0 }
  }
}

function Invoke-AnonRpc([string]$fn, $payload) {
  $headers = @{
    apikey = $anon
    Authorization = "Bearer $anon"
    "Content-Type" = "application/json"
  }
  $body = ($payload | ConvertTo-Json -Depth 20 -Compress)
  try {
    $data = Invoke-RestMethod -Method POST -Uri "$rest/rpc/$fn" -Headers $headers -Body $body
    return @{ ok = $true; data = $data; error = $null }
  } catch {
    $raw = Get-HttpErrorBody $_
    return @{ ok = $false; data = $null; error = $raw.Substring(0, [Math]::Min(500, $raw.Length)) }
  }
}

$USERS = @(
  @{ key = "viewer"; email = "phase2b2.viewer@ggmpi.local"; role = "viewer"; name = "P2B2 Viewer"; inactive = $false }
  @{ key = "editor1"; email = "phase2b2.editor1@ggmpi.local"; role = "editor"; name = "P2B2 Editor1"; inactive = $false }
  @{ key = "editor2"; email = "phase2b2.editor2@ggmpi.local"; role = "editor"; name = "P2B2 Editor2"; inactive = $false }
  @{ key = "manager"; email = "phase2b2.manager@ggmpi.local"; role = "manager"; name = "P2B2 Manager"; inactive = $false }
  @{ key = "admin"; email = "phase2b2.admin@ggmpi.local"; role = "admin"; name = "P2B2 Admin"; inactive = $false }
  @{ key = "inactive"; email = "phase2b2.inactive@ggmpi.local"; role = "editor"; name = "P2B2 Inactive"; inactive = $true }
  @{ key = "noprofile"; email = "phase2b2.noprofile@ggmpi.local"; role = $null; name = "P2B2 NoProfile"; inactive = $false }
)

$startedAt = (Get-Date).ToUniversalTime().ToString("o")
$cases = New-Object System.Collections.Generic.List[object]

function Push-Case([string]$name, [bool]$ok, $detail) {
  $cases.Add([ordered]@{ name = $name; ok = $ok; detail = $detail }) | Out-Null
}

# Roles
$roles = Invoke-Admin GET "/skus_roles" -query @{ select = "id,code" }
$roleByCode = @{}
foreach ($r in $roles) { $roleByCode[$r.code] = $r.id }

# Ensure users
$ids = @{}
foreach ($u in $USERS) {
  $list = Invoke-AuthAdmin GET "/admin/users"
  $existing = $null
  if ($list.users) {
    $existing = $list.users | Where-Object { $_.email -eq $u.email } | Select-Object -First 1
  }
  if (-not $existing) {
    $created = Invoke-AuthAdmin POST "/admin/users" @{
      email = $u.email
      password = $password
      email_confirm = $true
      user_metadata = @{ skus_test = $true; phase = "2b2-r5"; role = $u.role }
    }
    $ids[$u.key] = $created.id
  } else {
    $ids[$u.key] = $existing.id
    Invoke-AuthAdmin PUT "/admin/users/$($existing.id)" @{ password = $password; email_confirm = $true } | Out-Null
  }

  $uid = $ids[$u.key]
  if ($null -eq $u.role) {
    try { Invoke-Admin DELETE "/skus_profiles" -query @{ id = "eq.$uid" } | Out-Null } catch {}
  } else {
    $row = @{
      id = $uid
      role_id = $roleByCode[$u.role]
      name = $u.name
      email = $u.email
      department = "SKUS_TEST_P2B2"
      is_active = -not $u.inactive
    }
    # upsert via POST Prefer resolution
    $headers = @{
      apikey = $service
      Authorization = "Bearer $service"
      "Content-Type" = "application/json"
      Prefer = "resolution=merge-duplicates,return=minimal"
    }
    $json = ($row | ConvertTo-Json -Compress)
    Invoke-RestMethod -Method POST -Uri "$rest/skus_profiles?on_conflict=id" -Headers $headers -Body $json | Out-Null
  }
}

function Test-Denied($name, $result) {
  $err = [string]$result.error
  $ok = ($result.ok -eq $false) -and ($err -match "forbidden|permission|not_authenticated|JWT|Unauthorized|401|42501|PGRST301")
  Push-Case $name $ok $err
}

function Test-InvalidPayload($name, $result) {
  $err = [string]$result.error
  $ok = ($result.ok -eq $false) -and ($err -match "invalid_payload")
  Push-Case $name $ok $err
}

# Auth matrix
Test-Denied "anon_denied" (Invoke-AnonRpc "generate_sku_secure" @{ p_payload = @{ requestId = (New-Uuid) } })
Test-Denied "viewer_denied" (Invoke-UserRpc (Sign-In "phase2b2.viewer@ggmpi.local") "generate_sku_secure" @{ p_payload = @{ requestId = (New-Uuid) } })
Test-Denied "inactive_denied" (Invoke-UserRpc (Sign-In "phase2b2.inactive@ggmpi.local") "generate_sku_secure" @{ p_payload = @{ requestId = (New-Uuid) } })
Test-Denied "noprofile_denied" (Invoke-UserRpc (Sign-In "phase2b2.noprofile@ggmpi.local") "generate_sku_secure" @{ p_payload = @{ requestId = (New-Uuid) } })
Test-InvalidPayload "editor_reaches_validation" (Invoke-UserRpc (Sign-In "phase2b2.editor1@ggmpi.local") "generate_sku_secure" @{ p_payload = @{ requestId = (New-Uuid) } })
Test-InvalidPayload "manager_reaches_validation" (Invoke-UserRpc (Sign-In "phase2b2.manager@ggmpi.local") "generate_sku_secure" @{ p_payload = @{ requestId = (New-Uuid) } })
Test-InvalidPayload "admin_reaches_validation" (Invoke-UserRpc (Sign-In "phase2b2.admin@ggmpi.local") "generate_sku_secure" @{ p_payload = @{ requestId = (New-Uuid) } })

# Fresh combination (category cosmetica)
$category = Invoke-Admin GET "/skus_categories" -query @{ select = "id,slug,name"; slug = "eq.cosmetica"; is_active = "eq.true"; limit = "1" }
if (-not $category -or $category.Count -lt 1) { throw "category cosmetica not found" }
$catId = $category[0].id

$levels = Invoke-Admin GET "/skus_category_levels" -query @{
  select = "id,key,label,sort_order,is_enabled,is_required,participates_in_code"
  category_id = "eq.$catId"
  is_enabled = "eq.true"
  order = "sort_order.asc"
}
$levelIds = ($levels | ForEach-Object { $_.id }) -join ","
$words = Invoke-Admin GET "/skus_words" -query @{
  select = "id,category_level_id,reference_code,is_active"
  category_level_id = "in.($levelIds)"
  is_active = "eq.true"
}

$byLevel = @{}
foreach ($w in $words) {
  $code = ([string]$w.reference_code).Trim().ToUpper()
  if ($code -notmatch '^[A-Z0-9&.]{1,3}$') { continue }
  if (-not $byLevel.ContainsKey($w.category_level_id)) { $byLevel[$w.category_level_id] = New-Object System.Collections.Generic.List[object] }
  $byLevel[$w.category_level_id].Add(@{ id = $w.id; code = $code }) | Out-Null
}

$eligible = @($levels | Where-Object { $byLevel.ContainsKey($_.id) -and $byLevel[$_.id].Count -gt 0 })
if ($eligible.Count -lt 2) { throw "need >=2 eligible levels" }

$existing = Invoke-Admin GET "/skus_sku_generations" -query @{ select = "generated_code"; limit = "10000" }
$existingCodes = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($e in @($existing)) { [void]$existingCodes.Add([string]$e.generated_code) }

# Prefer rare/extra word pairs; try RPC until created=true.
$l1 = $eligible[$eligible.Count - 1]
$l2 = $eligible[[Math]::Max(0, $eligible.Count - 2)]
if ($l1.id -eq $l2.id -and $eligible.Count -ge 2) { $l2 = $eligible[0] }
$words1 = @($byLevel[$l1.id] | Sort-Object { $_.code } -Descending)
$words2 = @($byLevel[$l2.id] | Sort-Object { $_.code } -Descending)

$editorToken = Sign-In "phase2b2.editor1@ggmpi.local"

# Build candidate list and try until created=true (skip pre-existing fingerprints/codes).
$candidates = New-Object System.Collections.Generic.List[object]
foreach ($w1 in $words1) {
  foreach ($w2 in $words2) {
    $segments = @()
    foreach ($l in $levels) {
      if (-not $l.participates_in_code) { continue }
      if ($l.id -eq $l1.id) { $segments += $w1.code }
      elseif ($l.id -eq $l2.id) { $segments += $w2.code }
      else { $segments += "000" }
    }
    $expected = $segments -join "-"
    if ($existingCodes.Contains($expected)) { continue }
    $selections = @{}
    foreach ($l in $levels) {
      if ($l.id -eq $l1.id) { $selections[$l.id] = @{ kind = "word"; wordId = $w1.id } }
      elseif ($l.id -eq $l2.id) { $selections[$l.id] = @{ kind = "word"; wordId = $w2.id } }
      else { $selections[$l.id] = @{ kind = "empty" } }
    }
    $candidates.Add(@{
      categoryId = $catId
      expectedCode = $expected
      selections = $selections
      measures = @{
        unitsPerBox = 12; unitsPerBoxStatus = "real"
        multiples = 6; multiplesStatus = "estimated"
        weight = 1.25; weightStatus = "real"
      }
    }) | Out-Null
    if ($candidates.Count -ge 40) { break }
  }
  if ($candidates.Count -ge 40) { break }
}
if ($candidates.Count -lt 1) { throw "NO_FRESH_COMBINATION" }

$fresh = $null
$g1 = $null
$genId = $null
$R1 = $null
foreach ($cand in $candidates) {
  $tryR1 = New-Uuid
  $pTry = @{
    categoryId = $cand.categoryId
    selections = $cand.selections
    measures = $cand.measures
    requestId = $tryR1
  }
  $try = Invoke-UserRpc $editorToken "generate_sku_secure" @{ p_payload = $pTry }
  if (-not $try.ok) { continue }
  if ($try.data.created -eq $true -and [string]$try.data.generatedCode -eq $cand.expectedCode) {
    $fresh = $cand
    $g1 = $try
    $genId = [string]$try.data.generationId
    $R1 = $tryR1
    break
  }
  # Non-fresh hit: remove history rows for this requestId only
  try {
    $rows = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "id"; request_id = "eq.$tryR1" }
    foreach ($row in @($rows)) {
      if ($null -eq $row -or -not $row.id) { continue }
      Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ id = "eq.$($row.id)" } | Out-Null
    }
  } catch {}
}
if (-not $fresh -or -not $g1) { throw "NO_FRESH_COMBINATION_AFTER_TRIES count=$($candidates.Count)" }

Push-Case "editor_first_create" (
  $g1.ok -and ($g1.data.created -eq $true) -and ([string]$g1.data.generatedCode -eq $fresh.expectedCode)
) $(if ($g1.ok) { @{ created = $g1.data.created; code = $g1.data.generatedCode; generationId = (Mask-Uuid $genId); fingerprintLen = ([string]$g1.data.selectionFingerprint).Length } } else { $g1.error })

$p1b = @{
  categoryId = $fresh.categoryId
  selections = $fresh.selections
  measures = $fresh.measures
  requestId = $R1
}
$g1b = Invoke-UserRpc $editorToken "generate_sku_secure" @{ p_payload = $p1b }
Push-Case "editor_retry_same_request" (
  $g1b.ok -and ($g1b.data.created -eq $false) -and ([string]$g1b.data.generationId -eq $genId)
) $(if ($g1b.ok) { @{ created = $g1b.data.created; generationId = (Mask-Uuid $g1b.data.generationId) } } else { $g1b.error })

$R2 = New-Uuid
$p2 = @{
  categoryId = $fresh.categoryId
  selections = $fresh.selections
  measures = $fresh.measures
  requestId = $R2
}
$g2 = Invoke-UserRpc $editorToken "generate_sku_secure" @{ p_payload = $p2 }
Push-Case "editor_new_request_same_combo" (
  $g2.ok -and ($g2.data.created -eq $false) -and ([string]$g2.data.generationId -eq $genId)
) $(if ($g2.ok) { @{ created = $g2.data.created; generationId = (Mask-Uuid $g2.data.generationId) } } else { $g2.error })

# Manager/admin same combo -> created=false
$mgrToken = Sign-In "phase2b2.manager@ggmpi.local"
$admToken = Sign-In "phase2b2.admin@ggmpi.local"
$pMgr = @{
  categoryId = $fresh.categoryId
  selections = $fresh.selections
  measures = $fresh.measures
  requestId = (New-Uuid)
}
$gMgr = Invoke-UserRpc $mgrToken "generate_sku_secure" @{ p_payload = $pMgr }
Push-Case "manager_reuses_generation" (
  $gMgr.ok -and ($gMgr.data.created -eq $false) -and ([string]$gMgr.data.generationId -eq $genId)
) $(if ($gMgr.ok) { @{ created = $gMgr.data.created; generationId = (Mask-Uuid $gMgr.data.generationId) } } else { $gMgr.error })

$pAdm = @{
  categoryId = $fresh.categoryId
  selections = $fresh.selections
  measures = $fresh.measures
  requestId = (New-Uuid)
}
$gAdm = Invoke-UserRpc $admToken "generate_sku_secure" @{ p_payload = $pAdm }
Push-Case "admin_reuses_generation" (
  $gAdm.ok -and ($gAdm.data.created -eq $false) -and ([string]$gAdm.data.generationId -eq $genId)
) $(if ($gAdm.ok) { @{ created = $gAdm.data.created; generationId = (Mask-Uuid $gAdm.data.generationId) } } else { $gAdm.error })

if ($genId) {
  $hist1 = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "field_name"; request_id = "eq.$R1" }
  $hist2 = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "field_name"; request_id = "eq.$R2" }
  Push-Case "history_r1_three_fields" (@($hist1).Count -eq 3) @{ count = @($hist1).Count }
  Push-Case "history_r2_three_fields" (@($hist2).Count -eq 3) @{ count = @($hist2).Count }
}

# Cleanup
$deleted = @{ history = 0; generations = 0; profiles = 0; authUsers = 0 }
foreach ($rid in @($R1, $R2)) {
  try {
    $rows = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "id"; request_id = "eq.$rid" }
    foreach ($row in @($rows)) {
      Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ id = "eq.$($row.id)" } | Out-Null
      $deleted.history++
    }
  } catch {}
}
if ($genId) {
  try {
    Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ sku_generation_id = "eq.$genId" } | Out-Null
    Invoke-Admin DELETE "/skus_sku_generations" -query @{ id = "eq.$genId" } | Out-Null
    $deleted.generations = 1
  } catch {}
}
foreach ($u in $USERS) {
  $uid = $ids[$u.key]
  if (-not $uid) { continue }
  try { Invoke-Admin DELETE "/skus_profiles" -query @{ id = "eq.$uid" } | Out-Null; $deleted.profiles++ } catch {}
  try { Invoke-AuthAdmin DELETE "/admin/users/$uid" | Out-Null; $deleted.authUsers++ } catch {}
}

$leftoverProfiles = @()
try {
  $leftoverProfiles = Invoke-Admin GET "/skus_profiles" -query @{ select = "id"; email = "like.phase2b2.*" }
} catch {}
Push-Case "cleanup_profiles_zero" (@($leftoverProfiles).Count -eq 0) @{ count = @($leftoverProfiles).Count }

if ($genId) {
  $leftoverGen = @()
  try { $leftoverGen = Invoke-Admin GET "/skus_sku_generations" -query @{ select = "id"; id = "eq.$genId" } } catch {}
  Push-Case "cleanup_generation_zero" (@($leftoverGen).Count -eq 0) @{ count = @($leftoverGen).Count }
}

$report = [ordered]@{
  scope = "phase2b2_r5_auth_rpc_pass1_powershell"
  environment_ref = $projectRef
  is_ggmpi = $isGgmpi
  authorized_ggmpi_window = $allowWin
  test_run_id = $testRunId
  started_at = $startedAt
  ended_at = (Get-Date).ToUniversalTime().ToString("o")
  flag_v2 = "false"
  expected_code = $fresh.expectedCode
  generation_id_masked = (Mask-Uuid $genId)
  request_ids = @{ R1 = $R1; R2 = $R2 }
  fixtures_deleted = $deleted
  users_masked = @{}
  cases = $cases
  passed = -not ($cases | Where-Object { -not $_.ok })
}
foreach ($u in $USERS) {
  $report.users_masked[$u.key] = @{ id = (Mask-Uuid $ids[$u.key]); email = $u.email; role = $u.role }
}

$report | ConvertTo-Json -Depth 8
if (-not $report.passed) { exit 1 }

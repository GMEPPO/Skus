# Fase 2B.2 R5 — Auth/RPC runner PASS2 (PowerShell)
# Concurrencia, conflictos requestId, payloads inválidos, colisiones.
# Barreras GGMPI obligatorias (igual que pass1).

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
    if (-not [string]::IsNullOrWhiteSpace($k)) { Set-Item -Path "Env:$k" -Value $v }
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
if ($projectRef -ne $hostRef) { throw "SUPABASE_PROJECT_REF mismatch host" }
$refuse = ($env:REFUSE_GGMPI_PRODUCTION_LIKE -eq "true")
$allowWin = ($env:PHASE2B2_ALLOW_GGMPI_AUTHORIZED_WINDOW -eq "true")
$isGgmpi = ($projectRef -eq $GGMPI)
if (-not $refuse) { throw "REFUSE_GGMPI_PRODUCTION_LIKE must be true" }
if ($isGgmpi -and -not $allowWin) { throw "GGMPI execution refused: authorized window not enabled" }
if (-not $isGgmpi -and $allowWin) { throw "ALLOW window only for GGMPI" }

$rest = "$url/rest/v1"
$auth = "$url/auth/v1"
$testRunId = if ($env:PHASE2B2_TEST_RUN_ID) { $env:PHASE2B2_TEST_RUN_ID } else { New-Uuid }
$startedAt = (Get-Date).ToUniversalTime().ToString("o")
$cases = New-Object System.Collections.Generic.List[object]
function Push-Case([string]$name, [bool]$ok, $detail) {
  $cases.Add([ordered]@{ name = $name; ok = $ok; detail = $detail }) | Out-Null
}

function Invoke-Admin([string]$method, [string]$path, $body = $null, [hashtable]$query = $null) {
  $headers = @{
    apikey = $service; Authorization = "Bearer $service"
    "Content-Type" = "application/json"; Prefer = "return=representation"
  }
  $uri = "$rest$path"
  if ($query) {
    $qs = ($query.GetEnumerator() | ForEach-Object { "$($_.Key)=$([uri]::EscapeDataString([string]$_.Value))" }) -join "&"
    $uri = "$uri`?$qs"
  }
  try {
    if ($null -eq $body) { return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers }
    $json = ($body | ConvertTo-Json -Depth 20 -Compress)
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body $json
  } catch {
    $raw = Get-HttpErrorBody $_
    throw "ADMIN $method $path failed: $($raw.Substring(0, [Math]::Min(400, $raw.Length)))"
  }
}

function New-Hex64([string]$seed) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($seed)
  $hash = $sha.ComputeHash($bytes)
  return (-join ($hash | ForEach-Object { $_.ToString("x2") }))
}
function Invoke-AuthAdmin([string]$method, [string]$path, $body = $null) {
  $headers = @{ apikey = $service; Authorization = "Bearer $service"; "Content-Type" = "application/json" }
  if ($null -eq $body) { return Invoke-RestMethod -Method $method -Uri "$auth$path" -Headers $headers }
  return Invoke-RestMethod -Method $method -Uri "$auth$path" -Headers $headers -Body ($body | ConvertTo-Json -Depth 10 -Compress)
}
function Sign-In([string]$email) {
  $headers = @{ apikey = $anon; "Content-Type" = "application/json" }
  $body = @{ email = $email; password = $password } | ConvertTo-Json -Compress
  return (Invoke-RestMethod -Method POST -Uri "$auth/token?grant_type=password" -Headers $headers -Body $body).access_token
}
function Get-HttpErrorBody($err) {
  try { if ($err.ErrorDetails -and $err.ErrorDetails.Message) { return [string]$err.ErrorDetails.Message } } catch {}
  try {
    $resp = $err.Exception.Response
    if ($resp -and $resp.GetResponseStream) {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $text = $reader.ReadToEnd(); $reader.Close()
      if ($text) { return $text }
    }
  } catch {}
  return [string]$err.Exception.Message
}
function Invoke-UserRpc([string]$token, [hashtable]$payloadObj) {
  $headers = @{
    apikey = $anon; Authorization = "Bearer $token"
    "Content-Type" = "application/json"; Prefer = "return=representation"
  }
  $body = (@{ p_payload = $payloadObj } | ConvertTo-Json -Depth 20 -Compress)
  try {
    $data = Invoke-RestMethod -Method POST -Uri "$rest/rpc/generate_sku_secure" -Headers $headers -Body $body
    return @{ ok = $true; data = $data; error = $null }
  } catch {
    $raw = Get-HttpErrorBody $_
    return @{ ok = $false; data = $null; error = $raw.Substring(0, [Math]::Min(500, $raw.Length)) }
  }
}
function Err-Has($result, [string]$needle) {
  return ($result.ok -eq $false) -and ([string]$result.error -match $needle)
}

$USERS = @(
  @{ key = "editor1"; email = "phase2b2.editor1@ggmpi.local"; role = "editor"; name = "P2B2 Editor1"; inactive = $false }
  @{ key = "editor2"; email = "phase2b2.editor2@ggmpi.local"; role = "editor"; name = "P2B2 Editor2"; inactive = $false }
  @{ key = "admin"; email = "phase2b2.admin@ggmpi.local"; role = "admin"; name = "P2B2 Admin"; inactive = $false }
)

$roles = Invoke-Admin GET "/skus_roles" -query @{ select = "id,code" }
$roleByCode = @{}
foreach ($r in $roles) { $roleByCode[$r.code] = $r.id }
$ids = @{}
foreach ($u in $USERS) {
  $list = Invoke-AuthAdmin GET "/admin/users"
  $existing = $list.users | Where-Object { $_.email -eq $u.email } | Select-Object -First 1
  if (-not $existing) {
    $created = Invoke-AuthAdmin POST "/admin/users" @{
      email = $u.email; password = $password; email_confirm = $true
      user_metadata = @{ skus_test = $true; phase = "2b2-r5-pass2"; role = $u.role }
    }
    $ids[$u.key] = $created.id
  } else {
    $ids[$u.key] = $existing.id
    Invoke-AuthAdmin PUT "/admin/users/$($existing.id)" @{ password = $password; email_confirm = $true } | Out-Null
  }
  $row = @{
    id = $ids[$u.key]; role_id = $roleByCode[$u.role]; name = $u.name; email = $u.email
    department = "SKUS_TEST_P2B2"; is_active = $true
  }
  $headers = @{
    apikey = $service; Authorization = "Bearer $service"; "Content-Type" = "application/json"
    Prefer = "resolution=merge-duplicates,return=minimal"
  }
  Invoke-RestMethod -Method POST -Uri "$rest/skus_profiles?on_conflict=id" -Headers $headers -Body ($row | ConvertTo-Json -Compress) | Out-Null
}

# Catalog helpers
$category = Invoke-Admin GET "/skus_categories" -query @{ select = "id"; slug = "eq.cosmetica"; is_active = "eq.true"; limit = "1" }
$catId = $category[0].id
$levels = Invoke-Admin GET "/skus_category_levels" -query @{
  select = "id,sort_order,participates_in_code,is_enabled"
  category_id = "eq.$catId"; is_enabled = "eq.true"; order = "sort_order.asc"
}
$levelIds = ($levels | ForEach-Object { $_.id }) -join ","
$words = Invoke-Admin GET "/skus_words" -query @{
  select = "id,category_level_id,reference_code"; category_level_id = "in.($levelIds)"; is_active = "eq.true"
}
$byLevel = @{}
foreach ($w in $words) {
  $code = ([string]$w.reference_code).Trim().ToUpper()
  if ($code -notmatch '^[A-Z0-9&.]{1,3}$') { continue }
  if (-not $byLevel.ContainsKey($w.category_level_id)) { $byLevel[$w.category_level_id] = New-Object System.Collections.Generic.List[object] }
  $byLevel[$w.category_level_id].Add(@{ id = $w.id; code = $code }) | Out-Null
}
$eligible = @($levels | Where-Object { $byLevel.ContainsKey($_.id) -and $byLevel[$_.id].Count -gt 0 })
$existing = Invoke-Admin GET "/skus_sku_generations" -query @{ select = "generated_code"; limit = "10000" }
$existingCodes = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($e in @($existing)) { [void]$existingCodes.Add([string]$e.generated_code) }

function Build-Candidates([int]$max = 50) {
  $l1 = $eligible[$eligible.Count - 1]
  $l2 = $eligible[[Math]::Max(0, $eligible.Count - 2)]
  if ($l1.id -eq $l2.id -and $eligible.Count -ge 2) { $l2 = $eligible[0] }
  $w1s = @($byLevel[$l1.id] | Sort-Object { $_.code } -Descending)
  $w2s = @($byLevel[$l2.id] | Sort-Object { $_.code } -Descending)
  $list = New-Object System.Collections.Generic.List[object]
  foreach ($w1 in $w1s) {
    foreach ($w2 in $w2s) {
      $segments = @()
      foreach ($l in $levels) {
        if (-not $l.participates_in_code) { continue }
        if ($l.id -eq $l1.id) { $segments += $w1.code }
        elseif ($l.id -eq $l2.id) { $segments += $w2.code }
        else { $segments += "000" }
      }
      $expected = $segments -join "-"
      if ($existingCodes.Contains($expected)) { continue }
      $sel = @{}
      foreach ($l in $levels) {
        if ($l.id -eq $l1.id) { $sel[$l.id] = @{ kind = "word"; wordId = $w1.id } }
        elseif ($l.id -eq $l2.id) { $sel[$l.id] = @{ kind = "word"; wordId = $w2.id } }
        else { $sel[$l.id] = @{ kind = "empty" } }
      }
      $list.Add(@{
        categoryId = $catId; expectedCode = $expected; selections = $sel
        measures = @{
          unitsPerBox = 12; unitsPerBoxStatus = "real"
          multiples = 6; multiplesStatus = "estimated"
          weight = 1.25; weightStatus = "real"
        }
      }) | Out-Null
      if ($list.Count -ge $max) { return $list }
    }
  }
  return $list
}

function New-FreshGeneration([string]$token, $candidates) {
  foreach ($cand in $candidates) {
    $rid = New-Uuid
    $payload = @{
      categoryId = $cand.categoryId; selections = $cand.selections
      measures = $cand.measures; requestId = $rid
    }
    $r = Invoke-UserRpc $token $payload
    if ($r.ok -and $r.data.created -eq $true -and [string]$r.data.generatedCode -eq $cand.expectedCode) {
      return @{ cand = $cand; result = $r; requestId = $rid; generationId = [string]$r.data.generationId }
    }
    if ($r.ok) {
      try {
        $rows = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "id"; request_id = "eq.$rid" }
        foreach ($row in @($rows)) {
          if ($row -and $row.id) { Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ id = "eq.$($row.id)" } | Out-Null }
        }
      } catch {}
    }
  }
  throw "NO_FRESH_COMBINATION"
}

$measuresAlt = @{
  unitsPerBox = 12; unitsPerBoxStatus = "real"
  multiples = 6; multiplesStatus = "estimated"
  weight = 9.99; weightStatus = "estimated"
}

$editor1 = Sign-In "phase2b2.editor1@ggmpi.local"
$editor2 = Sign-In "phase2b2.editor2@ggmpi.local"
$cands = Build-Candidates 60

# --- Invalid payloads ---
$invalids = @(
  @{ name = "invalid_empty_object"; payload = @{} }
  @{ name = "invalid_category_not_uuid"; payload = @{ categoryId = "not-a-uuid"; requestId = (New-Uuid) } }
  @{ name = "invalid_measures_string"; payload = @{ categoryId = $catId; requestId = (New-Uuid); measures = "invalid" } }
  @{ name = "invalid_measures_array"; payload = @{ categoryId = $catId; requestId = (New-Uuid); measures = @() } }
  @{ name = "invalid_measures_bool"; payload = @{ categoryId = $catId; requestId = (New-Uuid); measures = $false } }
  @{ name = "invalid_measures_number"; payload = @{ categoryId = $catId; requestId = (New-Uuid); measures = 123 } }
  @{ name = "invalid_requestId_empty"; payload = @{ categoryId = $catId; requestId = "" } }
  @{ name = "invalid_requestId_number"; payload = @{ categoryId = $catId; requestId = 123 } }
  @{ name = "invalid_partial_measures"; payload = @{ categoryId = $catId; requestId = (New-Uuid); measures = @{ unitsPerBox = 12 } } }
)
foreach ($inv in $invalids) {
  $r = Invoke-UserRpc $editor1 $inv.payload
  Push-Case $inv.name (Err-Has $r "invalid_payload") $r.error
}
foreach ($nan in @("NaN","nan","Infinity","infinity","Inf","inf","-Infinity","-Inf")) {
  $r = Invoke-UserRpc $editor1 @{
    categoryId = $catId; requestId = (New-Uuid)
    measures = @{
      unitsPerBox = 12; unitsPerBoxStatus = "real"
      multiples = 6; multiplesStatus = "real"
      weight = $nan; weightStatus = "real"
    }
  }
  Push-Case "invalid_weight_$nan" (Err-Has $r "invalid_payload") $r.error
}

# --- Fresh base for conflicts / concurrency ---
$freshA = New-FreshGeneration $editor1 $cands
[void]$existingCodes.Add($freshA.cand.expectedCode)
Push-Case "pass2_seed_create" ($freshA.result.data.created -eq $true) @{
  code = $freshA.cand.expectedCode; generationId = (Mask-Uuid $freshA.generationId)
}

# Same requestId same values -> idempotent
$rSame = Invoke-UserRpc $editor1 @{
  categoryId = $freshA.cand.categoryId; selections = $freshA.cand.selections
  measures = $freshA.cand.measures; requestId = $freshA.requestId
}
Push-Case "conflict_same_request_same_values_ok" (
  $rSame.ok -and ($rSame.data.created -eq $false) -and ([string]$rSame.data.generationId -eq $freshA.generationId)
) $(if ($rSame.ok) { @{ created = $rSame.data.created } } else { $rSame.error })

# Same requestId different values -> measurement_request_conflict
$rDiff = Invoke-UserRpc $editor1 @{
  categoryId = $freshA.cand.categoryId; selections = $freshA.cand.selections
  measures = $measuresAlt; requestId = $freshA.requestId
}
Push-Case "conflict_same_request_diff_values" (Err-Has $rDiff "measurement_request_conflict") $rDiff.error

# Same requestId other user -> conflict
$rOtherUser = Invoke-UserRpc $editor2 @{
  categoryId = $freshA.cand.categoryId; selections = $freshA.cand.selections
  measures = $freshA.cand.measures; requestId = $freshA.requestId
}
Push-Case "conflict_same_request_other_user" (Err-Has $rOtherUser "measurement_request_conflict") $rOtherUser.error

# Same requestId other combination -> conflict
$freshB = $null
foreach ($cand in $cands) {
  if ($cand.expectedCode -eq $freshA.cand.expectedCode) { continue }
  $freshB = $cand; break
}
if ($freshB) {
  $rOtherCombo = Invoke-UserRpc $editor1 @{
    categoryId = $freshB.categoryId; selections = $freshB.selections
    measures = $freshB.measures; requestId = $freshA.requestId
  }
  Push-Case "conflict_same_request_other_combo" (Err-Has $rOtherCombo "measurement_request_conflict") $rOtherCombo.error
} else {
  Push-Case "conflict_same_request_other_combo" $false "no alternate candidate"
}

# --- Concurrency: two editors, two requestIds, same fresh combo ---
$cands2 = Build-Candidates 60
$seedToken = $editor1
# Find a candidate that is still fresh by probing with one editor first? Better: race on never-created combo.
$raceCand = $null
foreach ($cand in $cands2) {
  if ($existingCodes.Contains($cand.expectedCode)) { continue }
  $raceCand = $cand; break
}
if (-not $raceCand) { throw "NO_RACE_CANDIDATE" }
$R3 = New-Uuid; $R4 = New-Uuid
$p3 = @{ categoryId = $raceCand.categoryId; selections = $raceCand.selections; measures = $raceCand.measures; requestId = $R3 }
$p4 = @{ categoryId = $raceCand.categoryId; selections = $raceCand.selections; measures = $raceCand.measures; requestId = $R4 }

# Parallel jobs (pass JSON to avoid hashtable serialization issues in Start-Job)
$p3Json = (@{ p_payload = $p3 } | ConvertTo-Json -Depth 20 -Compress)
$p4Json = (@{ p_payload = $p4 } | ConvertTo-Json -Depth 20 -Compress)

$job1 = Start-Job -ScriptBlock {
  param($Url,$Anon,$Token,$BodyJson)
  $headers = @{ apikey=$Anon; Authorization="Bearer $Token"; "Content-Type"="application/json"; Prefer="return=representation" }
  try {
    $data = Invoke-RestMethod -Method POST -Uri "$Url/rest/v1/rpc/generate_sku_secure" -Headers $headers -Body $BodyJson
    return @{ ok = $true; data = $data; error = $null }
  } catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
    return @{ ok = $false; data = $null; error = [string]$msg }
  }
} -ArgumentList $url,$anon,$editor1,$p3Json

$job2 = Start-Job -ScriptBlock {
  param($Url,$Anon,$Token,$BodyJson)
  $headers = @{ apikey=$Anon; Authorization="Bearer $Token"; "Content-Type"="application/json"; Prefer="return=representation" }
  try {
    $data = Invoke-RestMethod -Method POST -Uri "$Url/rest/v1/rpc/generate_sku_secure" -Headers $headers -Body $BodyJson
    return @{ ok = $true; data = $data; error = $null }
  } catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
    return @{ ok = $false; data = $null; error = [string]$msg }
  }
} -ArgumentList $url,$anon,$editor2,$p4Json

$raceResults = Receive-Job -Job $job1,$job2 -Wait
Remove-Job -Job $job1,$job2 -Force
$okRace = @($raceResults | Where-Object { $_.ok })
$createdTrue = @($okRace | Where-Object { $_.data.created -eq $true })
$createdFalse = @($okRace | Where-Object { $_.data.created -eq $false })
$genIds = @($okRace | ForEach-Object { [string]$_.data.generationId } | Select-Object -Unique)
Push-Case "concurrency_both_fulfilled" ($okRace.Count -eq 2) @{ fulfilled = $okRace.Count; rawErrors = @($raceResults | Where-Object { -not $_.ok } | ForEach-Object { $_.error }) }
Push-Case "concurrency_one_created" ($createdTrue.Count -eq 1 -and $createdFalse.Count -eq 1) @{ createdTrue = $createdTrue.Count; createdFalse = $createdFalse.Count }
Push-Case "concurrency_same_generation" ($genIds.Count -eq 1 -and $genIds[0]) @{ generationIds = ($genIds | ForEach-Object { Mask-Uuid $_ }) }
$raceGenId = $null
if ($genIds.Count -ge 1) { $raceGenId = $genIds[0] }
if ($raceGenId) {
  $cnt = Invoke-Admin GET "/skus_sku_generations" -query @{ select = "id"; generated_code = "eq.$($raceCand.expectedCode)" }
  Push-Case "concurrency_single_row" (@($cnt).Count -eq 1) @{ count = @($cnt).Count }
  $h3 = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "field_name"; request_id = "eq.$R3" }
  $h4 = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "field_name"; request_id = "eq.$R4" }
  Push-Case "concurrency_history_r3" (@($h3).Count -eq 3) @{ count = @($h3).Count }
  Push-Case "concurrency_history_r4" (@($h4).Count -eq 3) @{ count = @($h4).Count }
}

# Cleanup leftovers from prior failed pass2 runs (fixture designations)
try {
  $old = Invoke-Admin GET "/skus_sku_generations" -query @{
    select = "id,generated_code"
    designation = "like.P2B2%"
    limit = "50"
  }
  foreach ($g in @($old)) {
    if (-not $g -or -not $g.id) { continue }
    Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ sku_generation_id = "eq.$($g.id)" } | Out-Null
    Invoke-Admin DELETE "/skus_sku_generations" -query @{ id = "eq.$($g.id)" } | Out-Null
  }
} catch {}

# --- Collisions (service-role fixtures) ---
function Code-Exists([string]$code) {
  try {
    $hit = Invoke-Admin GET "/skus_sku_generations" -query @{ select = "id"; generated_code = "eq.$code"; limit = "1" }
    if ($null -eq $hit) { return $false }
    if ($hit -is [System.Array]) { return $hit.Count -gt 0 }
    return $true
  } catch { return $false }
}

function New-UnusedCode() {
  foreach ($cand in (Build-Candidates 120)) {
    if ($existingCodes.Contains($cand.expectedCode)) { continue }
    if (Code-Exists $cand.expectedCode) {
      [void]$existingCodes.Add($cand.expectedCode)
      continue
    }
    return $cand
  }
  throw "NO_COLLISION_CANDIDATE"
}

# Legacy collision: insert generation with fingerprint NULL snapshot_version 1
$legacyCand = New-UnusedCode
$legacyCode = $legacyCand.expectedCode
$legacyRow = @{
  generated_code = $legacyCode
  designation = "P2B2 LEGACY FIXTURE"
  designation_pt = "P2B2 LEGACY FIXTURE"
  designation_es = "P2B2 LEGACY FIXTURE"
  designation_en = "P2B2 LEGACY FIXTURE"
  sequence_value = 1
  prefix_snapshot = $legacyCode
  selection_snapshot = @{ fixture = "legacy"; test_run_id = $testRunId }
  selection_fingerprint = $null
  snapshot_version = 1
  category_id = $catId
  generated_by = $ids.admin
}
Invoke-Admin POST "/skus_sku_generations" $legacyRow | Out-Null
$rLegacy = Invoke-UserRpc $editor1 @{
  categoryId = $legacyCand.categoryId; selections = $legacyCand.selections
  measures = $legacyCand.measures; requestId = (New-Uuid)
}
Push-Case "collision_legacy" (Err-Has $rLegacy "sku_code_collision_legacy") $rLegacy.error
[void]$existingCodes.Add($legacyCode)

# V2 collision: same code different fingerprint
$v2Cand = New-UnusedCode
$fakeFp = New-Hex64 "v2-collision-$testRunId"
$v2Row = @{
  generated_code = $v2Cand.expectedCode
  designation = "P2B2 V2 COLLISION"
  designation_pt = "P2B2 V2 COLLISION"
  designation_es = "P2B2 V2 COLLISION"
  designation_en = "P2B2 V2 COLLISION"
  sequence_value = 1
  prefix_snapshot = $v2Cand.expectedCode
  selection_snapshot = @{ fixture = "v2"; test_run_id = $testRunId }
  selection_fingerprint = $fakeFp
  snapshot_version = 2
  category_id = $catId
  generated_by = $ids.admin
}
Invoke-Admin POST "/skus_sku_generations" $v2Row | Out-Null
$rV2 = Invoke-UserRpc $editor1 @{
  categoryId = $v2Cand.categoryId; selections = $v2Cand.selections
  measures = $v2Cand.measures; requestId = (New-Uuid)
}
Push-Case "collision_v2" (Err-Has $rV2 "sku_code_collision") $rV2.error
[void]$existingCodes.Add($v2Cand.expectedCode)

# Invariant: different code, fingerprint of payload
$invCand = New-UnusedCode
# First compute fingerprint by creating then we'll instead insert wrong code with right fp from a probe.
# Probe: create ephemeral to read fingerprint then delete? Or call and catch.
# Simpler: create real gen, read fingerprint, delete gen, insert different code with that fingerprint, then RPC.
$probe = New-FreshGeneration $editor1 (Build-Candidates 80)
$fp = [string]$probe.result.data.selectionFingerprint
$probeCode = [string]$probe.result.data.generatedCode
# delete probe generation + history
Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ sku_generation_id = "eq.$($probe.generationId)" } | Out-Null
Invoke-Admin DELETE "/skus_sku_generations" -query @{ id = "eq.$($probe.generationId)" } | Out-Null
$otherCode = "P2B2-" + $testRunId.Substring(0, 8).ToUpper()
# ensure unique short-ish code - generated_code may allow longer text
$invRow = @{
  generated_code = $otherCode
  designation = "P2B2 INVARIANT"
  designation_pt = "P2B2 INVARIANT"
  designation_es = "P2B2 INVARIANT"
  designation_en = "P2B2 INVARIANT"
  sequence_value = 1
  prefix_snapshot = $otherCode
  selection_snapshot = @{ fixture = "invariant"; test_run_id = $testRunId }
  selection_fingerprint = $fp
  snapshot_version = 2
  category_id = $catId
  generated_by = $ids.admin
}
Invoke-Admin POST "/skus_sku_generations" $invRow | Out-Null
$rInv = Invoke-UserRpc $editor1 @{
  categoryId = $probe.cand.categoryId; selections = $probe.cand.selections
  measures = $probe.cand.measures; requestId = (New-Uuid)
}
Push-Case "collision_invariant" (Err-Has $rInv "sku_generation_invariant_violation") $rInv.error

# --- Cleanup fixtures ---
$deleted = @{ history = 0; generations = 0; profiles = 0; authUsers = 0; fixtureCodes = @() }
$fixtureCodes = @($legacyCode, $v2Cand.expectedCode, $otherCode, $freshA.cand.expectedCode, $raceCand.expectedCode)
if ($probeCode) { $fixtureCodes += $probeCode }
foreach ($code in ($fixtureCodes | Select-Object -Unique)) {
  try {
    $gens = Invoke-Admin GET "/skus_sku_generations" -query @{ select = "id"; generated_code = "eq.$code" }
    foreach ($g in @($gens)) {
      if (-not $g -or -not $g.id) { continue }
      Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ sku_generation_id = "eq.$($g.id)" } | Out-Null
      Invoke-Admin DELETE "/skus_sku_generations" -query @{ id = "eq.$($g.id)" } | Out-Null
      $deleted.generations++
      $deleted.fixtureCodes += $code
    }
  } catch {}
}
foreach ($rid in @($freshA.requestId, $R3, $R4)) {
  try {
    $rows = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "id"; request_id = "eq.$rid" }
    foreach ($row in @($rows)) {
      if ($row -and $row.id) {
        Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ id = "eq.$($row.id)" } | Out-Null
        $deleted.history++
      }
    }
  } catch {}
}
foreach ($u in $USERS) {
  $uid = $ids[$u.key]
  try { Invoke-Admin DELETE "/skus_profiles" -query @{ id = "eq.$uid" } | Out-Null; $deleted.profiles++ } catch {}
  try { Invoke-AuthAdmin DELETE "/admin/users/$uid" | Out-Null; $deleted.authUsers++ } catch {}
}

$report = [ordered]@{
  scope = "phase2b2_r5_auth_rpc_pass2_powershell"
  environment_ref = $projectRef
  is_ggmpi = $isGgmpi
  authorized_ggmpi_window = $allowWin
  test_run_id = $testRunId
  started_at = $startedAt
  ended_at = (Get-Date).ToUniversalTime().ToString("o")
  flag_v2 = "false"
  secretsPrinted = $false
  fixtures_deleted = $deleted
  cases = $cases
  passed = -not ($cases | Where-Object { -not $_.ok })
}
$report | ConvertTo-Json -Depth 8
if (-not $report.passed) { exit 1 }

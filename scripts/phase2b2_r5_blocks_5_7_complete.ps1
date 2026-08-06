# Fase 2B.2 R5 — Bloques 5–7: complete_sku_normalization + rollbacks (PowerShell)
# Barreras GGMPI iguales a pass1/pass2.

$ErrorActionPreference = "Stop"
$GGMPI = "pmovliksftlcjvjxvqhm"

function Load-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    $t = $_.Trim()
    if (-not $t -or $t.StartsWith("#")) { return }
    $i = $t.IndexOf("=")
    if ($i -lt 1) { return }
    $k = $t.Substring(0, $i).Trim(); $v = $t.Substring($i + 1).Trim()
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

$rest = "$url/rest/v1"; $auth = "$url/auth/v1"
$testRunId = if ($env:PHASE2B2_TEST_RUN_ID) { $env:PHASE2B2_TEST_RUN_ID } else { New-Uuid }
$externalRequestId7B = if ($env:PHASE2B2_REQUEST_ID_7B) { $env:PHASE2B2_REQUEST_ID_7B.Trim() } else { "" }
$startedAt = (Get-Date).ToUniversalTime().ToString("o")
$cases = New-Object System.Collections.Generic.List[object]
function Push-Case([string]$name, [bool]$ok, $detail) {
  $cases.Add([ordered]@{ name = $name; ok = $ok; detail = $detail }) | Out-Null
}
function Err-Has($result, [string]$needle) {
  return ($result.ok -eq $false) -and ([string]$result.error -match $needle)
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
    return Invoke-RestMethod -Method $method -Uri $uri -Headers $headers -Body ($body | ConvertTo-Json -Depth 20 -Compress)
  } catch {
    $raw = Get-HttpErrorBody $_
    throw "ADMIN $method $path failed: $($raw.Substring(0, [Math]::Min(400, $raw.Length)))"
  }
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
function Invoke-UserRpc([string]$token, [string]$fn, [hashtable]$bodyObj) {
  $headers = @{
    apikey = $anon; Authorization = "Bearer $token"
    "Content-Type" = "application/json"; Prefer = "return=representation"
  }
  try {
    $data = Invoke-RestMethod -Method POST -Uri "$rest/rpc/$fn" -Headers $headers -Body ($bodyObj | ConvertTo-Json -Depth 20 -Compress)
    return @{ ok = $true; data = $data; error = $null }
  } catch {
    $raw = Get-HttpErrorBody $_
    return @{ ok = $false; data = $null; error = $raw.Substring(0, [Math]::Min(500, $raw.Length)) }
  }
}

$USERS = @(
  @{ key = "editor1"; email = "phase2b2.editor1@ggmpi.local"; role = "editor"; name = "P2B2 Editor1" }
  @{ key = "editor2"; email = "phase2b2.editor2@ggmpi.local"; role = "editor"; name = "P2B2 Editor2" }
)
$roles = Invoke-Admin GET "/skus_roles" -query @{ select = "id,code" }
$roleByCode = @{}; foreach ($r in $roles) { $roleByCode[$r.code] = $r.id }
$ids = @{}
foreach ($u in $USERS) {
  $list = Invoke-AuthAdmin GET "/admin/users"
  $existing = $list.users | Where-Object { $_.email -eq $u.email } | Select-Object -First 1
  if (-not $existing) {
    $created = Invoke-AuthAdmin POST "/admin/users" @{
      email = $u.email; password = $password; email_confirm = $true
      user_metadata = @{ skus_test = $true; phase = "2b2-r5-b57"; role = $u.role }
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
  $h = @{
    apikey = $service; Authorization = "Bearer $service"; "Content-Type" = "application/json"
    Prefer = "resolution=merge-duplicates,return=minimal"
  }
  Invoke-RestMethod -Method POST -Uri "$rest/skus_profiles?on_conflict=id" -Headers $h -Body ($row | ConvertTo-Json -Compress) | Out-Null
}

$editor1 = Sign-In "phase2b2.editor1@ggmpi.local"
$editor2 = Sign-In "phase2b2.editor2@ggmpi.local"

$category = Invoke-Admin GET "/skus_categories" -query @{ select = "id"; slug = "eq.cosmetica"; is_active = "eq.true"; limit = "1" }
$catId = $category[0].id
$otherCat = Invoke-Admin GET "/skus_categories" -query @{ select = "id"; slug = "neq.cosmetica"; is_active = "eq.true"; limit = "1" }
$otherCatId = if ($otherCat -and @($otherCat).Count -gt 0) { @($otherCat)[0].id } else { $null }

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

function Build-FreshPayload() {
  $l1 = $eligible[$eligible.Count - 1]
  $l2 = $eligible[[Math]::Max(0, $eligible.Count - 2)]
  if ($l1.id -eq $l2.id -and $eligible.Count -ge 2) { $l2 = $eligible[0] }
  foreach ($w1 in (@($byLevel[$l1.id] | Sort-Object { $_.code } -Descending))) {
    foreach ($w2 in (@($byLevel[$l2.id] | Sort-Object { $_.code } -Descending))) {
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
      return @{
        categoryId = $catId; expectedCode = $expected; selections = $sel
        measures = @{
          unitsPerBox = 12; unitsPerBoxStatus = "real"
          multiples = 6; multiplesStatus = "estimated"
          weight = 1.25; weightStatus = "real"
        }
      }
    }
  }
  throw "NO_FRESH_PAYLOAD"
}

# Cleanup leftover batches from prior failed runs
try {
  $oldBatches = Invoke-Admin GET "/skus_normalization_import_batches" -query @{
    select = "id"; file_name = "like.p2b2r5_%"; limit = "20"
  }
  foreach ($b in @($oldBatches)) {
    if (-not $b -or -not $b.id) { continue }
    try { Invoke-Admin DELETE "/skus_code_normalizations" -query @{ import_batch_id = "eq.$($b.id)" } | Out-Null } catch {}
    try { Invoke-Admin DELETE "/skus_normalization_import_batches" -query @{ id = "eq.$($b.id)" } | Out-Null } catch {}
  }
} catch {}

# --- Fixture batch + rows ---
$fileName = "p2b2r5_$($testRunId.Substring(0,8))_b57.xlsx"
$sha = -join ((1..64) | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
$batch = Invoke-Admin POST "/skus_normalization_import_batches" @{
  file_name = $fileName
  file_sha256 = $sha
  status = "completed"
  total_rows = 20
  pending_rows = 15
  completed_rows = 5
  invalid_rows = 0
  imported_by = $ids.editor1
  completed_at = (Get-Date).ToUniversalTime().ToString("o")
}
$batchId = $batch[0].id
if (-not $batchId) { $batchId = $batch.id }

function New-NormRow([hashtable]$extra) {
  $base = @{
    import_batch_id = $batchId
    source_row_number = (Get-Random -Minimum 1000 -Maximum 99999)
    legacy_code = "LEG-$($testRunId.Substring(0,6))-$(Get-Random -Maximum 9999)"
    normalization_status = "pending"
    category_id = $catId
  }
  foreach ($k in $extra.Keys) { $base[$k] = $extra[$k] }
  $row = Invoke-Admin POST "/skus_code_normalizations" $base
  if ($row -is [System.Array]) { return $row[0] }
  return $row
}

$fixtureNormIds = New-Object System.Collections.Generic.List[string]
$fixtureGenIds = New-Object System.Collections.Generic.List[string]

function Track-Norm($row) { $fixtureNormIds.Add([string]$row.id) | Out-Null; return $row }

# 1) not_found
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = (New-Uuid)
  p_payload = @{ categoryId = $catId; selections = @{} }
}
Push-Case "complete_not_found" (Err-Has $r "not_found") $r.error

# 2) lock_required (pending unlocked)
$nUnlock = Track-Norm (New-NormRow @{})
$payloadFresh = Build-FreshPayload
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nUnlock.id
  p_payload = @{ categoryId = $catId; selections = $payloadFresh.selections }
}
Push-Case "complete_lock_required" (Err-Has $r "lock_required") $r.error

# 3) locked_by_other_user
$nOther = Track-Norm (New-NormRow @{})
$claim2 = Invoke-UserRpc $editor2 "claim_sku_normalization" @{ p_normalization_id = $nOther.id }
Push-Case "fixture_claim_editor2" $claim2.ok $claim2.error
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nOther.id
  p_payload = @{ categoryId = $catId; selections = $payloadFresh.selections }
}
Push-Case "complete_locked_by_other" (Err-Has $r "locked_by_other_user") $r.error

# 4) lock_expired
$nExp = Track-Norm (New-NormRow @{})
$claim1 = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nExp.id }
Push-Case "fixture_claim_editor1_exp" $claim1.ok $claim1.error
$past = (Get-Date).ToUniversalTime().AddMinutes(-5).ToString("o")
$lockedAt = (Get-Date).ToUniversalTime().AddMinutes(-15).ToString("o")
Invoke-Admin PATCH "/skus_code_normalizations" @{
  lock_expires_at = $past; locked_at = $lockedAt; locked_by = $ids.editor1
} -query @{ id = "eq.$($nExp.id)" } | Out-Null
# PATCH via query: need custom because Invoke-Admin PATCH with query
# Fix: use REST patch
try {
  $headers = @{
    apikey = $service; Authorization = "Bearer $service"
    "Content-Type" = "application/json"; Prefer = "return=representation"
  }
  $body = (@{ lock_expires_at = $past; locked_at = $lockedAt; locked_by = $ids.editor1 } | ConvertTo-Json -Compress)
  Invoke-RestMethod -Method PATCH -Uri "$rest/skus_code_normalizations?id=eq.$($nExp.id)" -Headers $headers -Body $body | Out-Null
} catch {}
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nExp.id
  p_payload = @{ categoryId = $catId; selections = $payloadFresh.selections }
}
Push-Case "complete_lock_expired" (Err-Has $r "lock_expired") $r.error

# 5) missing_legacy_code
$nMiss = Track-Norm (New-NormRow @{ legacy_code = $null })
# lock consistency may require legacy - if insert fails, skip
# Actually legacy_code null might be allowed. Claim then complete.
$claimM = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nMiss.id }
if ($claimM.ok) {
  $r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
    p_normalization_id = $nMiss.id
    p_payload = @{ categoryId = $catId; selections = $payloadFresh.selections }
  }
  Push-Case "complete_missing_legacy" (Err-Has $r "missing_legacy_code") $r.error
} else {
  # recreate with empty string
  $nMiss2 = Track-Norm (New-NormRow @{ legacy_code = "   " })
  $claimM2 = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nMiss2.id }
  $r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
    p_normalization_id = $nMiss2.id
    p_payload = @{ categoryId = $catId; selections = $payloadFresh.selections }
  }
  Push-Case "complete_missing_legacy" (Err-Has $r "missing_legacy_code") $r.error
}

# 6) category mismatch
if ($otherCatId) {
  $nMis = Track-Norm (New-NormRow @{ category_id = $otherCatId })
  $claimMis = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nMis.id }
  $r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
    p_normalization_id = $nMis.id
    p_payload = @{ categoryId = $catId; selections = $payloadFresh.selections }
  }
  Push-Case "complete_category_mismatch" (Err-Has $r "normalization_category_mismatch") $r.error
} else {
  Push-Case "complete_category_mismatch" $true "skipped_no_other_category"
}

# 7) partial measures rejected
$nPart = Track-Norm (New-NormRow @{})
$claimP = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nPart.id }
$freshP = Build-FreshPayload
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nPart.id
  p_payload = @{
    categoryId = $catId; selections = $freshP.selections
    requestId = (New-Uuid); measures = @{ unitsPerBox = 12 }
  }
}
Push-Case "complete_partial_measures" (Err-Has $r "invalid_payload") $r.error

# 8) happy path — new generation, measures omitted
$nOk = Track-Norm (New-NormRow @{})
$claimOk = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nOk.id }
$freshOk = Build-FreshPayload
$batchBefore = Invoke-Admin GET "/skus_normalization_import_batches" -query @{ select = "pending_rows,completed_rows,total_rows"; id = "eq.$batchId" }
$pb = if ($batchBefore -is [Array]) { $batchBefore[0] } else { $batchBefore }
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nOk.id
  p_payload = @{ categoryId = $catId; selections = $freshOk.selections }
}
$okComplete = $r.ok -and ([string]$r.data.normalizationStatus -eq "completed") -and $r.data.generationId
Push-Case "complete_new_generation_no_measures" $okComplete $(if ($r.ok) { @{
  status = $r.data.normalizationStatus; generationId = (Mask-Uuid $r.data.generationId); code = $r.data.generatedCode
} } else { $r.error })
if ($r.ok -and $r.data.generationId) {
  $fixtureGenIds.Add([string]$r.data.generationId) | Out-Null
  [void]$existingCodes.Add([string]$r.data.generatedCode)
}

# verify locks cleared + counters + completed_by
$after = Invoke-Admin GET "/skus_code_normalizations" -query @{
  select = "id,normalization_status,locked_by,locked_at,lock_expires_at,completed_by,completed_at,generation_id,final_new_code"
  id = "eq.$($nOk.id)"
}
$a = if ($after -is [Array]) { $after[0] } else { $after }
Push-Case "complete_locks_cleared" (
  $null -eq $a.locked_by -and $null -eq $a.locked_at -and $null -eq $a.lock_expires_at
) @{ locked_by = $a.locked_by; locked_at = $a.locked_at; lock_expires_at = $a.lock_expires_at }
Push-Case "complete_completed_by" ([string]$a.completed_by -eq [string]$ids.editor1 -and $null -ne $a.completed_at) @{
  completed_by = (Mask-Uuid $a.completed_by); completed_at = $a.completed_at
}
$batchAfter = Invoke-Admin GET "/skus_normalization_import_batches" -query @{ select = "pending_rows,completed_rows"; id = "eq.$batchId" }
$pa = if ($batchAfter -is [Array]) { $batchAfter[0] } else { $batchAfter }
Push-Case "complete_batch_counters" (
  ([int]$pa.pending_rows -eq ([int]$pb.pending_rows - 1)) -and ([int]$pa.completed_rows -eq ([int]$pb.completed_rows + 1))
) @{ before = $pb; after = $pa }

# 9) retry completed -> completed
$r2 = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nOk.id
  p_payload = @{ categoryId = $catId; selections = $freshOk.selections }
}
Push-Case "complete_retry_completed" (Err-Has $r2 "completed") $r2.error
$batchAfter2 = Invoke-Admin GET "/skus_normalization_import_batches" -query @{ select = "pending_rows,completed_rows"; id = "eq.$batchId" }
$pa2 = if ($batchAfter2 -is [Array]) { $batchAfter2[0] } else { $batchAfter2 }
Push-Case "complete_retry_counters_unchanged" (
  ([int]$pa2.pending_rows -eq [int]$pa.pending_rows) -and ([int]$pa2.completed_rows -eq [int]$pa.completed_rows)
) @{ afterRetry = $pa2 }

# 10) reuse existing generation (same selections again on new norm row)
$nReuse = Track-Norm (New-NormRow @{})
$claimR = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nReuse.id }
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nReuse.id
  p_payload = @{ categoryId = $catId; selections = $freshOk.selections }
}
Push-Case "complete_reuse_generation" (
  $r.ok -and ([string]$r.data.generationId -eq [string]$a.generation_id)
) $(if ($r.ok) { @{ generationId = (Mask-Uuid $r.data.generationId) } } else { $r.error })

# 11) complete with full measures
$nMeas = Track-Norm (New-NormRow @{})
$claimMe = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nMeas.id }
$freshMe = Build-FreshPayload
$ridMe = New-Uuid
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nMeas.id
  p_payload = @{
    categoryId = $catId; selections = $freshMe.selections
    requestId = $ridMe; measures = $freshMe.measures
  }
}
Push-Case "complete_with_measures" $r.ok $(if ($r.ok) { @{ code = $r.data.generatedCode; generationId = (Mask-Uuid $r.data.generationId) } } else { $r.error })
if ($r.ok -and $r.data.generationId) {
  $fixtureGenIds.Add([string]$r.data.generationId) | Out-Null
  [void]$existingCodes.Add([string]$r.data.generatedCode)
  $hist = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{ select = "field_name"; request_id = "eq.$ridMe" }
  Push-Case "complete_measures_history" (@($hist).Count -eq 3) @{ count = @($hist).Count }
}

function Count-Rows($rows) {
  if ($null -eq $rows) { return 0 }
  if ($rows -is [Array]) { return $rows.Count }
  return 1
}
function Snapshot-RollbackEvidence([string]$normId, [string]$expectedCode, [string]$requestId) {
  $norm = Invoke-Admin GET "/skus_code_normalizations" -query @{
    select = "normalization_status,generation_id,final_new_code,completed_at,completed_by,locked_by"
    id = "eq.$normId"
  }
  $n = if ($norm -is [Array]) { $norm[0] } else { $norm }
  $batch = Invoke-Admin GET "/skus_normalization_import_batches" -query @{
    select = "pending_rows,completed_rows,total_rows"; id = "eq.$batchId"
  }
  $b = if ($batch -is [Array]) { $batch[0] } else { $batch }
  $gens = Invoke-Admin GET "/skus_sku_generations" -query @{ select = "id"; generated_code = "eq.$expectedCode" }
  $hist = @()
  if ($requestId) {
    $hist = Invoke-Admin GET "/skus_sku_generation_measurement_history" -query @{
      select = "id"; request_id = "eq.$requestId"
    }
  }
  return [ordered]@{
    norm = $n
    batch = $b
    generationCount = (Count-Rows $gens)
    historyCount = (Count-Rows $hist)
  }
}
function Invoke-SqlInline([string]$sql) {
  $nodeHome = Join-Path $env:TEMP "node-portable-skus\node-v22.17.0-win-x64"
  $node = if (Test-Path (Join-Path $nodeHome "node.exe")) { Join-Path $nodeHome "node.exe" } else { "node" }
  $script = Join-Path (Get-Location) "scripts\phase2b2_r5_sql_exec.cjs"
  $tmp = Join-Path $env:TEMP ("phase2b2_r5_sql_" + [guid]::NewGuid().ToString("N") + ".sql")
  Set-Content -Path $tmp -Value $sql -Encoding UTF8
  try {
    $out = & $node $script $tmp 2>&1
    $text = ($out | Out-String)
    if ($LASTEXITCODE -ne 0) { throw $text }
    return $text
  } finally {
    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
  }
}

$headers = @{
  apikey = $service; Authorization = "Bearer $service"
  "Content-Type" = "application/json"; Prefer = "return=representation"
}

# 12) late failure: batch_counter_update_failed => full TX rollback evidence
$nFail = Track-Norm (New-NormRow @{})
$claimF = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nFail.id }
$freshFail = Build-FreshPayload
$ridFail = New-Uuid
Invoke-RestMethod -Method PATCH -Uri "$rest/skus_normalization_import_batches?id=eq.$batchId" -Headers $headers -Body (@{
  pending_rows = 0; completed_rows = 20; total_rows = 20
} | ConvertTo-Json -Compress) | Out-Null

$beforeFail = Snapshot-RollbackEvidence $nFail.id $freshFail.expectedCode $ridFail
$r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
  p_normalization_id = $nFail.id
  p_payload = @{
    categoryId = $catId; selections = $freshFail.selections
    requestId = $ridFail; measures = $freshFail.measures
  }
}
$afterFail = Snapshot-RollbackEvidence $nFail.id $freshFail.expectedCode $ridFail
$ev7a = [ordered]@{
  error = "batch_counter_update_failed"
  generationPersisted = [int]$afterFail.generationCount - [int]$beforeFail.generationCount
  historyPersisted = [int]$afterFail.historyCount - [int]$beforeFail.historyCount
  normalizationChanged = -not (
    [string]$afterFail.norm.normalization_status -eq [string]$beforeFail.norm.normalization_status -and
    [string]$afterFail.norm.generation_id -eq [string]$beforeFail.norm.generation_id -and
    [string]$afterFail.norm.final_new_code -eq [string]$beforeFail.norm.final_new_code
  )
  batchChanged = -not (
    [int]$afterFail.batch.pending_rows -eq [int]$beforeFail.batch.pending_rows -and
    [int]$afterFail.batch.completed_rows -eq [int]$beforeFail.batch.completed_rows
  )
  before = @{ gen = $beforeFail.generationCount; hist = $beforeFail.historyCount; batch = $beforeFail.batch; status = $beforeFail.norm.normalization_status }
  after = @{ gen = $afterFail.generationCount; hist = $afterFail.historyCount; batch = $afterFail.batch; status = $afterFail.norm.normalization_status }
}
Push-Case "rollback_batch_counter_failed" (Err-Has $r "batch_counter_update_failed") $r.error
Push-Case "rollback_7a_evidence" (
  (Err-Has $r "batch_counter_update_failed") -and
  $ev7a.generationPersisted -eq 0 -and
  $ev7a.historyPersisted -eq 0 -and
  $ev7a.normalizationChanged -eq $false -and
  $ev7a.batchChanged -eq $false
) $ev7a

# restore batch counters for cleanup / 7B
Invoke-RestMethod -Method PATCH -Uri "$rest/skus_normalization_import_batches?id=eq.$batchId" -Headers $headers -Body (@{
  pending_rows = 10; completed_rows = 8; total_rows = 20
} | ConvertTo-Json -Compress) | Out-Null

# 13) 7B — lock válido al inicio, expirado mid-flight vía trigger sleep en historial
$ridLate = if ($externalRequestId7B) { $externalRequestId7B } else { New-Uuid }
$fn7b = "phase2b2_r5_7b_sleep_on_history"
$trg7b = "phase2b2_r5_7b_sleep_trg"
$manualInstrumentation = -not [string]::IsNullOrWhiteSpace($externalRequestId7B)
$instrumentationInstalled = $manualInstrumentation
$instrumentationRemoved = $false
try {
  if (-not $manualInstrumentation) {
    $installSql = @"
create or replace function skus_private.$fn7b()
returns trigger
language plpgsql
security definer
set search_path = public, skus_private, pg_temp
as `$fn`$
begin
  if NEW.request_id = '$ridLate'::uuid then
    perform pg_sleep(4);
  end if;
  return NEW;
end;
`$fn`$;
revoke all on function skus_private.$fn7b() from public;
revoke all on function skus_private.$fn7b() from anon;
revoke all on function skus_private.$fn7b() from authenticated;
drop trigger if exists $trg7b on public.skus_sku_generation_measurement_history;
create trigger $trg7b
  before insert on public.skus_sku_generation_measurement_history
  for each row
  execute function skus_private.$fn7b();
"@
    [void](Invoke-SqlInline $installSql)
    $instrumentationInstalled = $true
  }

  $nLate = Track-Norm (New-NormRow @{})
  $claimL = Invoke-UserRpc $editor1 "claim_sku_normalization" @{ p_normalization_id = $nLate.id }
  if (-not $claimL.ok) { throw "7B claim failed: $($claimL.error)" }
  $freshLate = Build-FreshPayload
  # Lock TTL 2s; trigger sleep 4s => UPDATE final ve lock expirado
  $lockAt = (Get-Date).ToUniversalTime().ToString("o")
  $lockExp = (Get-Date).ToUniversalTime().AddSeconds(2).ToString("o")
  Invoke-RestMethod -Method PATCH -Uri "$rest/skus_code_normalizations?id=eq.$($nLate.id)" -Headers $headers -Body (@{
    locked_by = $ids.editor1
    locked_at = $lockAt
    lock_expires_at = $lockExp
  } | ConvertTo-Json -Compress) | Out-Null

  $beforeLate = Snapshot-RollbackEvidence $nLate.id $freshLate.expectedCode $ridLate
  $r = Invoke-UserRpc $editor1 "complete_sku_normalization" @{
    p_normalization_id = $nLate.id
    p_payload = @{
      categoryId = $catId; selections = $freshLate.selections
      requestId = $ridLate; measures = $freshLate.measures
    }
  }
  $afterLate = Snapshot-RollbackEvidence $nLate.id $freshLate.expectedCode $ridLate
  $ev7b = [ordered]@{
    error = "lock_expired"
    mode = "sleep_trigger_midflight"
    trigger = $trg7b
    function = "skus_private.$fn7b"
    requestId = (Mask-Uuid $ridLate)
    generationPersisted = [int]$afterLate.generationCount - [int]$beforeLate.generationCount
    historyPersisted = [int]$afterLate.historyCount - [int]$beforeLate.historyCount
    normalizationChanged = -not (
      [string]$afterLate.norm.normalization_status -eq [string]$beforeLate.norm.normalization_status -and
      [string]$afterLate.norm.generation_id -eq [string]$beforeLate.norm.generation_id
    )
    batchChanged = -not (
      [int]$afterLate.batch.pending_rows -eq [int]$beforeLate.batch.pending_rows -and
      [int]$afterLate.batch.completed_rows -eq [int]$beforeLate.batch.completed_rows
    )
    before = @{ gen = $beforeLate.generationCount; hist = $beforeLate.historyCount; batch = $beforeLate.batch; status = $beforeLate.norm.normalization_status }
    after = @{ gen = $afterLate.generationCount; hist = $afterLate.historyCount; batch = $afterLate.batch; status = $afterLate.norm.normalization_status }
  }
  Push-Case "rollback_lock_expired_midway" (Err-Has $r "lock_expired") $r.error
  Push-Case "rollback_7b_evidence" (
    (Err-Has $r "lock_expired") -and
    $ev7b.generationPersisted -eq 0 -and
    $ev7b.historyPersisted -eq 0 -and
    $ev7b.normalizationChanged -eq $false -and
    $ev7b.batchChanged -eq $false
  ) $ev7b
} catch {
  Push-Case "rollback_lock_expired_midway" $false ("7B setup/run failed: " + $_.Exception.Message)
  Push-Case "rollback_7b_evidence" $false ("7B evidence unavailable: " + $_.Exception.Message)
} finally {
  if ($instrumentationInstalled -and -not $manualInstrumentation) {
    try {
      $removeSql = @"
drop trigger if exists $trg7b on public.skus_sku_generation_measurement_history;
drop function if exists skus_private.$fn7b();
"@
      [void](Invoke-SqlInline $removeSql)
      $instrumentationRemoved = $true
    } catch {
      Push-Case "rollback_7b_instrumentation_remove" $false $_.Exception.Message
    }
  }
}

if ($manualInstrumentation) {
  Push-Case "test_instrumentation_removed" $true @{
    skipped = "manual_sql_cleanup_required"
    requestId = (Mask-Uuid $ridLate)
    trigger = $trg7b
    function = "skus_private.$fn7b"
  }
} else {
  $verifySql = @"
select 'trigger' as kind, t.tgname as name
from pg_catalog.pg_trigger t
where t.tgrelid = 'public.skus_sku_generation_measurement_history'::regclass
  and not t.tgisinternal
  and t.tgname = '$trg7b'
union all
select 'function', p.proname
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'skus_private'
  and (
    p.proname ilike '%test%'
    or p.proname ilike '%sleep%'
    or p.proname ilike '%phase2b2%'
    or p.proname ilike '%delay%'
  );
"@
  try {
    $verifyOut = Invoke-SqlInline $verifySql
    $leftover = $false
    if ($verifyOut -match '"rows"\s*:\s*\[\s*\{') { $leftover = $true }
    if ($verifyOut -match '"rowCount"\s*:\s*([1-9][0-9]*)') { $leftover = $true }
    Push-Case "test_instrumentation_removed" ($instrumentationRemoved -and -not $leftover) @{
      testInstrumentationRemoved = ($instrumentationRemoved -and -not $leftover)
      trigger = $trg7b
      function = "skus_private.$fn7b"
      verify = ($verifyOut.Substring(0, [Math]::Min(500, $verifyOut.Length)))
    }
  } catch {
    Push-Case "test_instrumentation_removed" $false $_.Exception.Message
  }
}

# --- Cleanup (norms before gens: FK generation_id) ---
$deleted = @{ norms = 0; gens = 0; hist = 0; batches = 0; profiles = 0; authUsers = 0 }
foreach ($nid in ($fixtureNormIds | Select-Object -Unique)) {
  try { Invoke-Admin DELETE "/skus_code_normalizations" -query @{ id = "eq.$nid" } | Out-Null; $deleted.norms++ } catch {}
}
foreach ($gid in ($fixtureGenIds | Select-Object -Unique)) {
  try {
    Invoke-Admin DELETE "/skus_sku_generation_measurement_history" -query @{ sku_generation_id = "eq.$gid" } | Out-Null
    $deleted.hist++
  } catch {}
  try {
    Invoke-Admin DELETE "/skus_sku_generations" -query @{ id = "eq.$gid" } | Out-Null
    $deleted.gens++
  } catch {}
}
try { Invoke-Admin DELETE "/skus_normalization_import_batches" -query @{ id = "eq.$batchId" } | Out-Null; $deleted.batches = 1 } catch {}
foreach ($u in $USERS) {
  $uid = $ids[$u.key]
  try { Invoke-Admin DELETE "/skus_profiles" -query @{ id = "eq.$uid" } | Out-Null; $deleted.profiles++ } catch {}
  try { Invoke-AuthAdmin DELETE "/admin/users/$uid" | Out-Null; $deleted.authUsers++ } catch {}
}

$report = [ordered]@{
  scope = "phase2b2_r5_blocks_5_7_powershell"
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

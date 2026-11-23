param(
    [ValidateSet("dev", "build", "start")]
    [string]$Action = "dev"
)

$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "..\.env.staging.local"
if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Missing .env.staging.local staging configuration."
}

$values = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$' -and $_ -notmatch '^\s*#') {
        $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
}

$requiredNames = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "CRON_SECRET"
)

foreach ($name in $requiredNames) {
    if (-not $values.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($values[$name])) {
        throw "Missing required staging variable: $name"
    }
    if ($values[$name] -match "YOUR_|REPLACE_WITH") {
        throw "Staging variable is still a placeholder: $name"
    }
}

try {
    $supabaseUrl = [Uri]$values["NEXT_PUBLIC_SUPABASE_URL"]
    $projectRef = $supabaseUrl.Host.Split(".")[0]
    if ($supabaseUrl.Scheme -ne "https" -or $supabaseUrl.Host -ne "$projectRef.supabase.co") {
        throw "NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL."
    }
} catch {
    if ($_.Exception.Message -like "NEXT_PUBLIC_SUPABASE_URL must be*") {
        throw
    }
    throw "NEXT_PUBLIC_SUPABASE_URL is not a valid staging URL."
}

if ($projectRef -ne "hxlxqyukgngejkbysztz") {
    throw "Refusing to start staging: URL does not target the verified staging project."
}

if (-not $values["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"].StartsWith("sb_publishable_")) {
    throw "Refusing to start staging: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must use the sb_publishable_ prefix."
}
if (-not $values["SUPABASE_SECRET_KEY"].StartsWith("sb_secret_")) {
    throw "Refusing to start staging: SUPABASE_SECRET_KEY must use the sb_secret_ prefix."
}

$isolatedNames = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "CRON_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM"
)

foreach ($name in $isolatedNames) {
    Set-Item -Path "Env:$name" -Value ""
}

$productionEnvFile = Join-Path $PSScriptRoot "..\.env.local"
$systemEnvNames = @(
    "PATH",
    "PATHEXT",
    "PSMODULEPATH",
    "COMSPEC",
    "SYSTEMROOT",
    "WINDIR",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "HOMEDRIVE",
    "HOMEPATH",
    "USERNAME",
    "USERDOMAIN",
    "APPDATA",
    "LOCALAPPDATA",
    "PROGRAMFILES",
    "PROGRAMFILES(X86)",
    "PROGRAMDATA"
)
if (Test-Path -LiteralPath $productionEnvFile) {
    Get-Content -LiteralPath $productionEnvFile | ForEach-Object {
        if ($_ -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=' -and $matches[1] -notin $systemEnvNames) {
            Set-Item -Path "Env:$($matches[1])" -Value ""
        }
    }
}

foreach ($name in $isolatedNames) {
    Set-Item -Path "Env:$name" -Value ""
}

foreach ($name in @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "CRON_SECRET"
)) {
    Set-Item -Path "Env:$name" -Value $values[$name]
}

foreach ($name in @("RESEND_API_KEY", "EMAIL_FROM")) {
    if ($values.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace($values[$name])) {
        Set-Item -Path "Env:$name" -Value $values[$name]
    } else {
        Set-Item -Path "Env:$name" -Value ""
    }
}

Write-Output "Validated staging Supabase project and API key prefixes."

if ($Action -eq "build") {
    Write-Output "Building Next.js with staging environment project hxlxqyukgngejkbysztz."
    npm run build
} elseif ($Action -eq "start") {
    Write-Output "Starting Next.js with staging environment project hxlxqyukgngejkbysztz."
    npm run start
} else {
    Write-Output "Starting Next.js with staging environment project hxlxqyukgngejkbysztz."
    npm run dev
}

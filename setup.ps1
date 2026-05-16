# ========================================
# Automatic Setup Script for Booking Haircut App
# PowerShell Script (Windows)
# ========================================

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Booking Haircut App - Setup Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if command exists
function Test-CommandExists {
    param (
        [string]$command
    )

    try {
        Get-Command $command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to check folder exists
function Test-FolderExists {
    param (
        [string]$folderPath
    )

    if (Test-Path $folderPath) {
        return $true
    }
    else {
        Write-Host "❌ Folder not found: $folderPath" -ForegroundColor Red
        return $false
    }
}

# ========================================
# Check Node.js
# ========================================

Write-Host "[1/8] Checking Node.js installation..." -ForegroundColor Yellow

if (Test-CommandExists "node") {
    Write-Host "✅ Node.js is installed: $(node --version)" -ForegroundColor Green
}
else {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Download: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ========================================
# Check Git
# ========================================

Write-Host "[2/8] Checking Git installation..." -ForegroundColor Yellow

if (Test-CommandExists "git") {
    Write-Host "✅ Git is installed: $(git --version)" -ForegroundColor Green
}
else {
    Write-Host "❌ Git is not installed!" -ForegroundColor Red
    Write-Host "Download: https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# ========================================
# Check MySQL
# ========================================

Write-Host "[3/8] Checking MySQL installation..." -ForegroundColor Yellow

if (Test-CommandExists "mysql") {
    Write-Host "✅ MySQL is installed: $(mysql --version)" -ForegroundColor Green
}
else {
    Write-Host "⚠️ MySQL is not installed or not added to PATH" -ForegroundColor Yellow
    Write-Host "Download: https://www.mysql.com/downloads/" -ForegroundColor Yellow
}

Write-Host ""

# ========================================
# Install Main Dependencies
# ========================================

Write-Host "[4/8] Installing main dependencies..." -ForegroundColor Yellow

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install main dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Main dependencies installed" -ForegroundColor Green
Write-Host ""

# ========================================
# Install Backend Dependencies
# ========================================

Write-Host "[5/8] Installing backend dependencies..." -ForegroundColor Yellow

$backendPath = "flutter_booking_app\backend"

if (-not (Test-FolderExists $backendPath)) {
    exit 1
}

Set-Location $backendPath

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    Set-Location "..\.."
    exit 1
}

Set-Location "..\.."

Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
Write-Host ""

# ========================================
# Install Web App Dependencies
# ========================================

Write-Host "[6/8] Installing web app dependencies..." -ForegroundColor Yellow

$webApps = @(
    "admin-web",
    "login-web",
    "manager-web",
    "owner-web",
    "receptionist-web"
)

foreach ($app in $webApps) {

    if (-not (Test-FolderExists $app)) {
        exit 1
    }

    Write-Host "Installing $app..." -ForegroundColor Cyan

    Set-Location $app

    npm install

    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies for $app" -ForegroundColor Red
        Set-Location ..
        exit 1
    }

    Set-Location ..

    Write-Host "✅ $app installed successfully" -ForegroundColor Green
}

Write-Host ""
Write-Host "✅ All web app dependencies installed" -ForegroundColor Green
Write-Host ""

# ========================================
# Create Environment Files
# ========================================

Write-Host "[7/8] Creating environment files..." -ForegroundColor Yellow

# Backend .env
if (-not (Test-Path "flutter_booking_app\backend\.env")) {

    if (Test-Path "flutter_booking_app\backend\.env.example") {

        Copy-Item `
            "flutter_booking_app\backend\.env.example" `
            "flutter_booking_app\backend\.env"

        Write-Host "✅ Created backend .env file" -ForegroundColor Green
    }
}

# Admin .env.local
if (-not (Test-Path "admin-web\.env.local")) {

    if (Test-Path "admin-web\.env.local.example") {

        Copy-Item `
            "admin-web\.env.local.example" `
            "admin-web\.env.local"

        Write-Host "✅ Created admin-web .env.local file" -ForegroundColor Green
    }
}

Write-Host ""

# ========================================
# Setup Complete
# ========================================

Write-Host "[8/8] Setup completed!" -ForegroundColor Yellow
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "✅ Setup Completed Successfully!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""

Write-Host "1. Configure environment files:" -ForegroundColor White
Write-Host "   - flutter_booking_app\backend\.env" -ForegroundColor Gray
Write-Host "   - admin-web\.env.local" -ForegroundColor Gray
Write-Host "   - Repeat for other web apps" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Create MySQL database:" -ForegroundColor White
Write-Host "   mysql -u root -p" -ForegroundColor Gray
Write-Host "   CREATE DATABASE booking_haircut CHARACTER SET utf8mb4;" -ForegroundColor Gray
Write-Host ""

Write-Host "3. Start the application:" -ForegroundColor White
Write-Host "   Terminal 1:" -ForegroundColor Gray
Write-Host "   cd flutter_booking_app\backend" -ForegroundColor Gray
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""

Write-Host "   Terminal 2:" -ForegroundColor Gray
Write-Host "   cd admin-web" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""

Write-Host "4. Documentation:" -ForegroundColor White
Write-Host "   - docs\SETUP_NEW_MACHINE.md" -ForegroundColor Gray
Write-Host "   - README.md" -ForegroundColor Gray
Write-Host ""

Write-Host "GitHub Repository:" -ForegroundColor Cyan
Write-Host "https://github.com/truonghoangquan2308/booking-haircut-app" -ForegroundColor White
Write-Host ""
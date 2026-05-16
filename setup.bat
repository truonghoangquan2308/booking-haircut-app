@echo off
REM ========================================
REM Automatic Setup Script for Booking Haircut App
REM Windows Batch Script
REM ========================================

setlocal enabledelayedexpansion

echo.
echo ====================================
echo  Booking Haircut App - Setup Script
echo ====================================
echo.

REM Check if Node.js is installed
echo [1/8] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed!
    echo Please download from: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo ✅ Node.js is installed: 
    node --version
)

echo.

REM Check if Git is installed
echo [2/8] Checking Git installation...
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is not installed!
    echo Please download from: https://git-scm.com/download/win
    pause
    exit /b 1
) else (
    echo ✅ Git is installed:
    git --version
)

echo.

REM Check if MySQL is installed (optional)
echo [3/8] Checking MySQL installation...
mysql --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  MySQL is not installed (but required for database)
    echo Please download from: https://www.mysql.com/downloads/
) else (
    echo ✅ MySQL is installed:
    mysql --version
)

echo.

REM Install main dependencies
echo [4/8] Installing main dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install main dependencies
    pause
    exit /b 1
) else (
    echo ✅ Main dependencies installed
)

echo.

REM Install backend dependencies
echo [5/8] Installing backend dependencies...
cd flutter_booking_app\backend
call npm install
if errorlevel 1 (
    echo ❌ Failed to install backend dependencies
    cd ..\..
    pause
    exit /b 1
) else (
    echo ✅ Backend dependencies installed
)
cd ..\..

echo.

REM Install web app dependencies
echo [6/8] Installing web app dependencies...
for %%i in (admin-web login-web manager-web owner-web receptionist-web) do (
    echo   Installing %%i...
    cd %%i
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install %%i dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
)
echo ✅ All web app dependencies installed

echo.

REM Create .env files from templates
echo [7/8] Creating environment files...
if not exist "flutter_booking_app\backend\.env" (
    if exist "flutter_booking_app\backend\.env.example" (
        copy "flutter_booking_app\backend\.env.example" "flutter_booking_app\backend\.env"
        echo ✅ Created backend\.env (Please edit with your config)
    )
)

if not exist "admin-web\.env.local" (
    if exist "admin-web\.env.local.example" (
        copy "admin-web\.env.local.example" "admin-web\.env.local"
        echo ✅ Created admin-web\.env.local (Please edit with your config)
    )
)

echo.

REM Display setup completion message
echo [8/8] Setup completed!
echo.
echo ====================================
echo  ✅ Setup Completed Successfully!
echo ====================================
echo.
echo Next steps:
echo.
echo 1. Configure environment files:
echo    - Edit: flutter_booking_app\backend\.env
echo    - Edit: admin-web\.env.local
echo    - (Repeat for other web apps)
echo.
echo 2. Create MySQL database:
echo    mysql -u root -p
echo    CREATE DATABASE booking_haircut CHARACTER SET utf8mb4;
echo.
echo 3. Start the application:
echo    Terminal 1: cd flutter_booking_app\backend ^& npm start
echo    Terminal 2: cd admin-web ^& npm run dev
echo    (See SETUP_NEW_MACHINE.md for full instructions)
echo.
echo 4. Read the documentation:
echo    - docs\SETUP_NEW_MACHINE.md (Full setup guide)
echo    - README.md (Project overview)
echo.
echo Documentation: https://github.com/truonghoangquan2308/booking-haircut-app
echo.
pause

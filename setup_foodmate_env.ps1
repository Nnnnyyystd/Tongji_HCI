$ErrorActionPreference = "Stop"

$EnvName = "foodmate"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ProjectRoot "frontend"
$Requirements = Join-Path $ProjectRoot "backend-requirements.txt"

Write-Host "FoodMate environment setup"
Write-Host "Project root: $ProjectRoot"

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
    Write-Error "conda was not found. Please install Anaconda/Miniconda and reopen the terminal."
}

$envList = conda env list
$envExists = $envList | Select-String -Pattern "^\s*$EnvName\s"

if (-not $envExists) {
    Write-Host "Creating conda environment: $EnvName"
    conda clean -i -y
    conda create -n $EnvName python=3.11 -y
} else {
    Write-Host "Conda environment already exists: $EnvName"
}

Write-Host "Installing backend dependencies"
conda run -n $EnvName python -m pip install --upgrade pip
conda run -n $EnvName python -m pip install -r $Requirements

if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "Node version:"
    node -v
} else {
    Write-Warning "Node.js was not found. Install Node.js 20 LTS before running the frontend."
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "npm version:"
    npm -v

    if (Test-Path $FrontendDir) {
        Write-Host "Installing frontend dependencies"
        Push-Location $FrontendDir
        npm install
        npm install chart.js
        Pop-Location
    } else {
        Write-Host "Creating Vite frontend project"
        Push-Location $ProjectRoot
        npm create vite@5 frontend -- --template vanilla
        Push-Location $FrontendDir
        npm install
        npm install vite@^5.4.0 --save-dev
        npm install chart.js
        Pop-Location
        Pop-Location
    }
} else {
    Write-Warning "npm was not found. Frontend dependencies were not installed."
}

Write-Host ""
Write-Host "Setup complete."
Write-Host "Activate backend environment:"
Write-Host "  conda activate $EnvName"
Write-Host "Start frontend:"
Write-Host "  cd frontend"
Write-Host "  npm run dev"

# Start AI-SDR Environment

$ROOT = "C:\Users\shank\.gemini\antigravity\scratch\AI-SDR"
$NODE_PATH = "C:\Program Files\nodejs"
$GIT_PATH = "C:\Program Files\Git\cmd"

Write-Host "Starting AI-SDR..." -ForegroundColor Green

# 1. Start Database (if applicable) - Skipping as we use Neon

# 2. Start Backend
Write-Host "Launching Backend..."
# We explicitly set the PATH inside the new process to ensure npm is found
$BackendCommand = "`$env:Path = '$NODE_PATH;$GIT_PATH;' + `$env:Path; cd '$ROOT\backend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCommand

# 3. Start Frontend
Write-Host "Launching Frontend..."
$FrontendCommand = "`$env:Path = '$NODE_PATH;$GIT_PATH;' + `$env:Path; cd '$ROOT\app'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCommand

# 4. Start Ngrok (Optional)
# Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 4000"

Write-Host "Done! Backend running on port 4000, Frontend on port 3000."

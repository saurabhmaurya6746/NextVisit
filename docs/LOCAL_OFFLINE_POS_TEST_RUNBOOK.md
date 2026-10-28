# Local Desktop POS Backend and Offline Order Test

Use this runbook whenever the local test backend is requested. Always target the isolated `nextvisit_test` database on port `8001`; never redirect this test backend to `nextvisit_db`.

## Start the test backend (PowerShell)

Open PowerShell in the repository root and run:

```powershell
cd "C:\Users\hp\Desktop\Major Project\Nextvisit"

$raw = (Get-Content "Backend/.env" | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=', ''
$uri = [System.UriBuilder]$raw.Trim()
$uri.Path = "/nextvisit_test"
$env:DATABASE_URL = $uri.Uri.AbsoluteUri
$env:PYTHONPATH = "$PWD\Backend"

python -c "from urllib.parse import urlparse; import os; u=urlparse(os.environ['DATABASE_URL']); print('Backend database:', u.path.lstrip('/'), '| host:', u.hostname)"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --app-dir Backend
```

Confirm the first command prints `nextvisit_test`. Leave that PowerShell window open while using the app. The URL `http://127.0.0.1:8001/docs` should respond with HTTP 200.

This process reads connection credentials from `Backend/.env` but changes the database path only in that PowerShell process. It does not edit `.env`. Do not use port 8000 for this disposable test account.

## Stop the test backend

If it is running in the PowerShell window above, press **Ctrl+C** in that window. If it was started detached, first identify the listener and verify it is the test Uvicorn process, then stop only that PID:

```powershell
$listeners = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
$listeners | ForEach-Object {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"
    [PSCustomObject]@{ PID = $p.ProcessId; CommandLine = $p.CommandLine }
}
```

Only if the process is the local `python -m uvicorn app.main:app ... --port 8001` test backend, stop its listed PID with `Stop-Process -Id <PID>`. Do not stop an unrelated process or anything listening on port 8000.

## Prepare the desktop app before offline testing

1. Keep Wi-Fi and the port-8001 test backend on.
2. Launch the current desktop executable (not an old shortcut):
   `Frontend\src-tauri\target\release\app.exe`
3. Sign in to the smoke-test account. If prompted, register the POS terminal with prefix `POS01` and seed the local cache.
4. Wait until the menu and table layout have loaded. Confirm the cached menu items are visible.
5. Stop the port-8001 backend using the instructions above, then turn Wi-Fi off.
6. Open **Orders → New staff order**, select a table, add one item, and submit once.
7. Expected result: an order number such as `ORD-POS01-000001` and a confirmation that it is saved on this device and pending sync.

Offline orders are stored locally with a pending outbox record. They will not appear in the server Orders list while offline, and outbox synchronization is a later phase. Do not repeatedly submit after an error; first capture the exact message and diagnose it to avoid duplicate orders.

## API base URL when rebuilding the desktop app

The app bundle must target the test backend on port 8001. From `Frontend`, build with the API URL scoped to that build process:

```powershell
$env:VITE_API_BASE_URL = "http://127.0.0.1:8001"
npm run desktop:build
```

If installer packaging fails because WiX cannot download, check whether Tauri still produced `Frontend\src-tauri\target\release\app.exe`; report the executable build separately from installer packaging.

## Future backend-start requests

When asked to start the backend for this test, inspect port 8001 first. If it is already serving the isolated test backend, report that it is running instead of starting a duplicate. Otherwise start it using the PowerShell commands above, verify `/docs` returns HTTP 200, and confirm the process targets `nextvisit_test` without printing credentials. Leave port 8000 untouched.

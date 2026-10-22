Stitch MCP setup

1) Persist the Stitch API key for your Windows user (replace <YOUR_KEY>):

```powershell
setx STITCH_API_KEY "<YOUR_KEY>"
```

2) Restart VS Code (Developer: Reload Window) so it picks up the environment variable.
3) Open Copilot / MCP tools and verify the `stitch` server appears.

If you prefer temporary session setting instead of persisting, run in PowerShell before launching VS Code:

```powershell
$env:STITCH_API_KEY = "<YOUR_KEY>"
code .
```

Security: Rotate the key if it was exposed or committed. Do NOT commit actual keys to the repo.

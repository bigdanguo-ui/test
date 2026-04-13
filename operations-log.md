# Operations Log

- Date: 2026-04-13
- Executor: Codex

## Log

- Scanned the workspace with `Get-ChildItem -Force` and `rg --files`; the directory started as a near-empty project with `.codex/AGENTS.md`.
- Checked local tools: Python 3.12.7, Node.js v22.20.0, npm 10.9.3, FastAPI 0.119.0, CadQuery 2.5.2, no pytest.
- Confirmed the directory is not a git repository.
- Added backend FastAPI schemas, CadQuery shape classes, API routes, OpenAPI export script, and unittest schema tests.
- Added frontend Vite/React/Three source, generated OpenAPI TypeScript schema, API wrapper, styling, and package metadata.
- Installed frontend npm dependencies after the first sandboxed install timed out; audit reported 0 vulnerabilities.
- Removed an unintended local package self-link from frontend dependencies and pruned `node_modules`.
- Ran `python backend\export_openapi.py`, `npm run gen:types`, `python -m unittest discover backend\tests`, and `npm run build`.
- Ran an API smoke command for `/api/models`; it returned HTTP 200 payloads for box, sphere, and cylinder, then CadQuery crashed during Python process teardown on Windows.
- Started local dev servers and verified `http://127.0.0.1:8000/api/health`, `http://127.0.0.1:8000/api/models`, and `http://127.0.0.1:5173/`.
- Added `.gitignore` entries for dependency folders, build outputs, Python caches, and local server logs.
- Ran Playwright desktop and mobile screenshots with the local Chrome channel after the bundled Chromium install timed out; sampled screenshot pixels to confirm nonblank canvas rendering.

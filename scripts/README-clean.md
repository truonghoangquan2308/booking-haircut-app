# Clean submission scripts

Files:

- `scripts/clean-submission.sh` — Bash (Linux/macOS/Git Bash)
- `scripts/clean-submission.ps1` — PowerShell (Windows)

Usage:

- Windows (PowerShell):

  .\scripts\clean-submission.ps1

- Linux / macOS / Git Bash:

  chmod +x scripts/clean-submission.sh && ./scripts/clean-submission.sh

What the scripts do:

- Search and delete common build artifacts across the repository, including `node_modules`, `build`, `dist`, `coverage`, `.dart_tool`, `.next`, `.gradle`, `.cache`, and log files (`*.log`).
- For Flutter projects (if detected), attempt to run `flutter clean` in `flutter_booking_app`.
- Before deleting, scripts list all discovered items and ask for confirmation (Y/N).
- After deletion, scripts print the number of items removed and approximate freed space.

Files and folders that will NOT be deleted:

- Source code (typical folders like `lib/`, `src/`, `backend/src/`)
- `package.json`, `package-lock.json`, `pubspec.yaml`, `pubspec.lock`
- Any `.env` or `.env.example` files
- Firebase configuration files (left in place)

Notes & Risks:

- The scripts attempt to avoid deleting important config and source files, but custom build outputs with non-standard names may still be removed if they match the generic patterns (e.g., a folder literally named `build` inside source). Review the listed items before confirming.
- `git clean -fdx` is NOT used; untracked source files outside Git may be deleted if they match patterns (e.g., a local `build/` folder). Always run `git status` and commit or stash changes before cleaning.
- If you have additional custom build directories, update the `MATCH_DIRS` / `$matchNames` arrays in the scripts to exclude or include them explicitly.

Support:

If you want, I can add these scripts to `package.json` npm scripts or make them more conservative (dry-run mode, whitelist mode).

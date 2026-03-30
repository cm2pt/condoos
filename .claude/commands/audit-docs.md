# Audit Documentation

Cross-reference all CLAUDE.md files and .claude/rules/ against the actual codebase. Fix any inaccuracies found.

## Steps

1. Read every file in `.claude/rules/`, `.claude/agents/`, `.claude/commands/`
2. Read `CLAUDE.md`, `src/CLAUDE.md`, `backend/CLAUDE.md`, `tests/CLAUDE.md`
3. For each factual claim, verify against source:
   - `package.json` → tech stack versions
   - `backend/migrations/` listing → migration names and count
   - `backend/routes/` listing → route file names
   - `backend/services/` listing → service structure
   - `backend/config.js` → actual env vars
   - `backend/seeds/` → seed file name
   - `src/components/shared/` listing → component names
   - `src/contexts/` listing → context files
   - `src/features/` listing → feature directories
   - `src/hooks/` listing → hooks structure
   - `src/pages/` listing → page files and count
   - `src/index.css` brand tokens → actual hex values
   - `tests/ui/helpers/` → helper files and exported functions
   - `tests/ui/*.spec.js` → test count
   - `wc -l backend/server.js src/App.jsx` → line counts
   - `backend/auth.js` → authorize() signature
4. Flag every inaccuracy with actual vs documented value
5. Fix all inaccuracies directly (edit the files)
6. Report summary of what was fixed

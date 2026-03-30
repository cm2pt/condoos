#!/usr/bin/env bash
# Lightweight staleness check for .claude/ documentation.
# Compares a few key counts in docs against actual codebase.
# Exits non-zero if drift is detected.
# Compatible with macOS (BSD grep) and Linux (GNU grep).

set -euo pipefail

ERRORS=0

fail() {
  echo "❌ STALE: $1"
  ERRORS=$((ERRORS + 1))
}

ok() {
  echo "✅ $1"
}

# ── 1. Migration count ──
DOC_MIGRATIONS=$(grep -c '^- `[0-9]' backend/CLAUDE.md 2>/dev/null || echo 0)
ACTUAL_MIGRATIONS=$(ls backend/migrations/*.js 2>/dev/null | wc -l | tr -d ' ')
if [ "$DOC_MIGRATIONS" -eq "$ACTUAL_MIGRATIONS" ]; then
  ok "Migration count matches ($ACTUAL_MIGRATIONS)"
else
  fail "backend/CLAUDE.md lists $DOC_MIGRATIONS migrations, but $ACTUAL_MIGRATIONS exist on disk"
fi

# ── 2. Shared component count ──
# Count only indented component lines (2-space indent) between "components/shared/" and next section
DOC_COMPONENTS=$(sed -n '/components\/shared/,/^- /{ /^  - /p; }' src/CLAUDE.md | wc -l | tr -d ' ')
ACTUAL_COMPONENTS=$(ls src/components/shared/*.jsx 2>/dev/null | wc -l | tr -d ' ')
if [ "$DOC_COMPONENTS" -eq "$ACTUAL_COMPONENTS" ]; then
  ok "Shared component count matches ($ACTUAL_COMPONENTS)"
else
  fail "src/CLAUDE.md lists $DOC_COMPONENTS shared components, but $ACTUAL_COMPONENTS exist on disk"
fi

# ── 3. Page count ──
DOC_PAGES=$(grep 'páginas' src/CLAUDE.md | sed 's/[^0-9]//g' | head -1)
DOC_PAGES=${DOC_PAGES:-0}
ACTUAL_PAGES=$(ls src/pages/*Page.jsx 2>/dev/null | sort -u | wc -l | tr -d ' ')
if [ "$DOC_PAGES" -eq "$ACTUAL_PAGES" ]; then
  ok "Page count matches ($ACTUAL_PAGES)"
else
  fail "src/CLAUDE.md says $DOC_PAGES pages, but $ACTUAL_PAGES exist on disk"
fi

# ── 4. E2E spec file count ──
ACTUAL_SPECS=$(ls tests/ui/*.spec.js 2>/dev/null | wc -l | tr -d ' ')
if [ "$ACTUAL_SPECS" -gt 0 ]; then
  ok "E2E spec files present ($ACTUAL_SPECS)"
else
  fail "No E2E spec files found in tests/ui/"
fi

# ── 5. Finance route files match docs ──
DOC_HAS_RECONCILIATION=$(grep -c 'reconciliation' .claude/rules/api-conventions.md 2>/dev/null || echo 0)
ACTUAL_HAS_RECONCILIATION=$(ls backend/routes/finance/reconciliation.js 2>/dev/null | wc -l | tr -d ' ')
if [ "$DOC_HAS_RECONCILIATION" -gt 0 ] && [ "$ACTUAL_HAS_RECONCILIATION" -gt 0 ]; then
  ok "Finance route docs consistent with source"
elif [ "$DOC_HAS_RECONCILIATION" -eq 0 ] && [ "$ACTUAL_HAS_RECONCILIATION" -eq 0 ]; then
  ok "Finance route docs consistent with source"
else
  fail "Finance route docs out of sync with backend/routes/finance/"
fi

# ── 6. Seed file name ──
DOC_SEED=$(grep -o 'seeds/[^ `]*' backend/CLAUDE.md | head -1 || echo "")
ACTUAL_SEED="seeds/$(ls backend/seeds/*.js 2>/dev/null | head -1 | xargs basename)"
if [ "$DOC_SEED" = "$ACTUAL_SEED" ]; then
  ok "Seed filename matches ($ACTUAL_SEED)"
else
  fail "backend/CLAUDE.md says '$DOC_SEED' but actual seed is '$ACTUAL_SEED'"
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "⚠️  $ERRORS documentation staleness issue(s) found."
  echo "   Run: /audit-docs (Claude command) to fix them."
  exit 1
else
  echo "✅ All documentation checks passed."
  exit 0
fi

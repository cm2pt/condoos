# Code Style

## Language Convention

- **UI text**: Portuguese (PT-PT) — labels, placeholders, toasts, error messages, headings
- **Code identifiers**: English — variables, functions, classes, file names
- **Comments**: Portuguese preferred, English acceptable for technical notes
- **Commit messages**: Portuguese

## Frontend Design System

### CSS Custom Properties (Brand Tokens)

All colors use CSS custom properties defined in `:root` (index.css):

```css
--brand-deep: #0F766E;      /* Teal 700 — primary dark */
--brand-mid: #14B8A6;        /* Teal 500 — primary medium */
--brand-sand: #F0FDFA;       /* Teal 50 — light background */
--brand-highlight: #F59E0B;  /* Amber 500 — gold highlight */
--teal: ...;              /* Teal accent */
--teal-soft: ...;         /* Teal soft/muted */
--amber: ...;             /* Amber accent */
```

Dark mode overrides via `[data-theme="dark"]` selector.

### Typography

- **UI font**: `"Plus Jakarta Sans Variable", var(--font-ui)` — self-hosted via `@fontsource-variable/plus-jakarta-sans`
- **Accent font**: Same as UI font (unified)
- Body text: 15px base, 1.55 line-height
- Headings: 600-700 weight

### Icons

Use Lucide React exclusively via the `<Icon>` component:

```jsx
import Icon from "@/components/shared/Icon";
<Icon name="Wallet" size={18} className="optional-class" />
```

- Icon registry: `src/lib/icons.js` (centralized imports)
- Every button, navigation item, and action should have an icon
- Never use emoji as UI icons

### Animations (Framer Motion)

Spring physics for all transitions:
```js
// Standard entrance
{ type: "spring", stiffness: 350, damping: 28 }

// Gentle entrance (panels, overlays)
{ type: "spring", stiffness: 300, damping: 30 }

// Stagger children: 0.03-0.05s per item
```

Key animation components:
- `<AnimateSection>` — Scroll-triggered entrance wrapper
- `<AnimatedTableBody>` — Staggered table row entrance
- `<AnimatedNumber>` — Smooth counter for KPI values
- `<ProgressRing>` — SVG circular progress indicator

Respect `prefers-reduced-motion` — already handled in AnimateSection.

### Component Patterns

- Shared components: `src/components/shared/` (Icon, StatusPill, Toast, EmptyState, etc.)
- Feature components: `src/features/` (command-palette, notifications, quick-actions)
- Pages: `src/pages/` (one per module)
- Contexts: `src/contexts/` (AuthContext, RuntimeContext, ThemeContext)

### CSS Architecture

- Global styles in `src/index.css` using CSS custom properties
- Tailwind CSS 4 for utility classes (40-50% coverage, growing)
- Component-specific styles use BEM-like class naming in `index.css`
- Dark mode: `[data-theme="dark"]` on `<html>`, managed by ThemeContext

### Mobile Breakpoints

- Sidebar collapse: `930px` (controlled by CSS + state)
- Mobile navigation: below `930px`, bottom nav bar appears
- Touch targets: minimum 44x44px

## File Naming

- React components: `PascalCase.jsx` (e.g., `DashboardPage.jsx`)
- Utilities/hooks: `camelCase.js` (e.g., `useTheme.js`)
- CSS: Single `index.css` (global styles)
- Tests: `*.test.js` or `*.test.jsx` alongside source
- Migrations: `YYYYMMDD_NNN_descriptive_name.js`

---
name: figma-to-react
description: Implement a React Telegram MiniApp from a Figma design — extract assets, rewrite components incrementally, build, commit, merge.
---

# Figma → React Telegram MiniApp Implementation

Implements a React Telegram MiniApp from a Figma design mockup. Extracts exported assets, rewrites components to match the design, and delivers via git workflow.

## Prerequisites

- Existing React project (Vite + React recommended)
- Figma design URL or exported asset ZIP
- `dev` and `master` branches established

## Workflow

### 1. Gather context

```
Read project structure (glob **/*)
Read package.json, README, key source files
Read all existing components (JSX + CSS modules)
```

Understand what already exists before making changes.

### 2. Extract Figma assets

```
Expand-Archive the Figma ZIP → Downloads/<name>_extracted
List extracted files, identify key assets by name/size
Filter out variant duplicates (-1, -2, -3 suffixes) — prefer base or -3 (largest)
```

Key assets to identify:
- `desctop.png` — full design reference screenshot
- Avatar frames, gift images, icons, badges, backgrounds
- Navigation/shell images (usually belong to TG, not the app)

### 3. Copy assets to project

```
Copy-Item each relevant asset → public/assets/<meaningful-name>.png
Use descriptive names: avatar-frame.png, gift-cauldron.png, coin-badge.png
```

**CRITICAL**: Do NOT copy shell-provided assets (bottom nav, header bar) into the app — the Telegram MiniApp shell renders these.

### 4. Rewrite components INCREMENTALLY

**This is the most important rule.** Rewrite one component at a time, not all at once.

For each component:
1. Read the current JSX and CSS module
2. Compare with Figma reference (desctop.png or screenshots)
3. Update JSX to use new asset paths (`/assets/<name>.png`)
4. Update CSS to match Figma styling (gradients, shadows, spacing)
5. Verify: `npm run build` must pass after each component
6. Commit the component change with a meaningful message

**Anti-patterns (from real regressions):**
- Rewriting ALL components simultaneously → layout breaks, wrong images
- Re-adding removed components (e.g., BottomNav, Header) that the TG shell provides
- Using the wrong asset (e.g., `chat-bubble-bg.png` as avatar when it's actually a nav bar)

### 5. Build and verify

```
npm run build    # must pass with 0 errors
npm run lint     # should be clean
npm run dev      # verify visually in browser (devtools → mobile emulation)
```

### 6. Git workflow

```
git add -A
git diff --cached --stat    # review what changed
git commit -m "feat: <description of what improved>"
git checkout master
git merge dev
git push origin master
git checkout dev
git push origin dev
```

Make meaningful commits along the way — not one giant commit at the end.

## Rules

1. **Work on `dev` branch**; merge to `master` when feature is complete
2. **Incremental changes only** — one component per commit
3. **Never re-add shell-provided components** (BottomNav, Header for TG MiniApps)
4. **Verify build passes** after every change
5. **Use meaningful commit messages** that describe what improved
6. **Do NOT push broken code** — if a change breaks the UI, revert immediately

## Stopping condition

- All components match the Figma design
- Build passes cleanly
- Changes merged to master and pushed

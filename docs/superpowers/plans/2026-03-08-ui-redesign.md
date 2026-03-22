# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Yoontube frontend into a modern, minimal, editorial-style media experience without changing backend behavior.

**Architecture:** Centralize the visual system in a shared global stylesheet and keep route logic intact. Update the library, login, and media detail components to use consistent layout patterns, tokenized styling, and responsive composition while preserving the existing server-rendered data flow and fallback behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS via global stylesheet, Vitest.

---

### Task 1: Add failing render assertions for the new shared UI shell

**Files:**
- Modify: `web/src/app/page.test.tsx`
- Modify: `web/src/app/photos/[id]/page.test.tsx`
- Modify: `web/src/app/videos/[id]/page.test.tsx`

**Step 1: Write the failing test**

Add assertions that confirm the redesigned shell renders stable editorial markers such as `Your private drive cinema`, `Collection`, and `Back to library` within the updated layouts.

**Step 2: Run test to verify it fails**

Run: `npm --workspace web test -- --run src/app/page.test.tsx src/app/photos/[id]/page.test.tsx src/app/videos/[id]/page.test.tsx`

Expected: FAIL because the current markup does not include the new shell copy or structure.

**Step 3: Write minimal implementation**

Update the affected route and shell components so they render the approved editorial redesign while preserving the existing data flow.

**Step 4: Run test to verify it passes**

Run: `npm --workspace web test -- --run src/app/page.test.tsx src/app/photos/[id]/page.test.tsx src/app/videos/[id]/page.test.tsx`

Expected: PASS with the new shell copy and navigation structure present.

**Step 5: Commit**

```bash
git add web/src/app/page.test.tsx web/src/app/photos/[id]/page.test.tsx web/src/app/videos/[id]/page.test.tsx web/src/components web/src/app
git commit -m "feat: redesign yoontube viewing surfaces"
```

### Task 2: Add failing assertions for the redesigned login surface

**Files:**
- Create or Modify: `web/src/app/login/page.test.tsx`
- Modify: `web/src/app/login/page.tsx`
- Modify: `web/src/components/password-form.tsx`

**Step 1: Write the failing test**

Add a route render test that expects refined login copy and structure such as `Enter the private screening room` and a styled password action.

**Step 2: Run test to verify it fails**

Run: `npm --workspace web test -- --run src/app/login/page.test.tsx`

Expected: FAIL because the current login page is still plain.

**Step 3: Write minimal implementation**

Redesign the login page and password form using the new shared visual language while preserving the existing server action hookup and error handling.

**Step 4: Run test to verify it passes**

Run: `npm --workspace web test -- --run src/app/login/page.test.tsx src/app/login/actions.test.ts`

Expected: PASS with the redesigned login surface and unchanged action module contract.

**Step 5: Commit**

```bash
git add web/src/app/login/page.tsx web/src/app/login/page.test.tsx web/src/components/password-form.tsx
git commit -m "feat: redesign yoontube login page"
```

### Task 3: Add failing assertions for the redesigned card and filter treatment

**Files:**
- Modify: `web/src/components/media-card.test.tsx`
- Modify: `web/src/components/media-card.tsx`
- Modify: `web/src/components/filter-tabs.tsx`
- Modify: `web/src/components/library-shell.tsx`

**Step 1: Write the failing test**

Add assertions for the updated card vocabulary and metadata treatment, such as folder label presentation and richer media card framing.

**Step 2: Run test to verify it fails**

Run: `npm --workspace web test -- --run src/components/media-card.test.tsx`

Expected: FAIL because the current card markup is too bare.

**Step 3: Write minimal implementation**

Redesign the filter controls, library shell, and media cards to match the editorial gallery direction and mobile-responsive layout.

**Step 4: Run test to verify it passes**

Run: `npm --workspace web test -- --run src/components/media-card.test.tsx src/app/page.test.tsx`

Expected: PASS with the new card structure still rendering backend-driven media correctly.

**Step 5: Commit**

```bash
git add web/src/components/media-card.tsx web/src/components/media-card.test.tsx web/src/components/filter-tabs.tsx web/src/components/library-shell.tsx web/src/app/page.tsx
git commit -m "feat: redesign yoontube media library"
```

### Task 4: Build the shared global styling system

**Files:**
- Create: `web/src/app/globals.css`
- Modify: `web/src/app/layout.tsx`

**Step 1: Write the failing test**

Reuse the route render failures from Tasks 1-3 as proof that the old shared shell cannot satisfy the new design.

**Step 2: Run test to verify it fails**

Run: `npm --workspace web test -- --run src/app/page.test.tsx src/app/login/page.test.tsx`

Expected: FAIL until the shared design tokens and layout are introduced.

**Step 3: Write minimal implementation**

Create the global stylesheet with typography, color variables, surface styles, responsive spacing, and shared utility classes. Import it from the root layout.

**Step 4: Run test to verify it passes**

Run: `npm --workspace web test -- --run src/app/page.test.tsx src/app/login/page.test.tsx src/app/photos/[id]/page.test.tsx src/app/videos/[id]/page.test.tsx src/components/media-card.test.tsx`

Expected: PASS with the full redesign rendered through the shared shell.

**Step 5: Commit**

```bash
git add web/src/app/globals.css web/src/app/layout.tsx
git commit -m "feat: add yoontube design system shell"
```

### Task 5: Verify the redesign end to end

**Files:**
- Modify as needed: `web/src/app/*`, `web/src/components/*`, `web/src/app/globals.css`

**Step 1: Run targeted tests**

Run: `npm --workspace web test -- --run src/app/page.test.tsx src/app/login/page.test.tsx src/app/photos/[id]/page.test.tsx src/app/videos/[id]/page.test.tsx src/components/media-card.test.tsx`

Expected: PASS.

**Step 2: Run full web test suite**

Run: `npm --workspace web test`

Expected: PASS.

**Step 3: Run typecheck**

Run: `npm --workspace web run typecheck`

Expected: PASS.

**Step 4: Run build**

Run: `npm --workspace web run build`

Expected: PASS and produce a successful Next.js production build.

**Step 5: Commit**

```bash
git add web docs/plans
git commit -m "feat: complete yoontube ui redesign"
```

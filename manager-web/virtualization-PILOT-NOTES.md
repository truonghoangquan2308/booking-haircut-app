Virtualization pilot notes — manager-web

Purpose
- Conservative pilot: virtualize only the current appointments page (`APPT_PAGE_SIZE`) to reduce DOM cost for heavy pages while preserving API pagination and behavior.

What was implemented
- Added `@tanstack/react-virtual` and a `useVirtualizer` hook on the appointments table body.
- Kept table header static and synchronized horizontal scroll between header and body.
- Reset `scrollTop`/`scrollLeft` when page or filters change to avoid scroll jumps.
- Added minor accessibility tweaks: rows are focusable (`tabIndex=0`), `role="row"`, and `onKeyDown` Enter to select.

Known tradeoffs & risks
- Table semantics & accessibility: absolute-positioned `<tr>` elements inside `<tbody>` are not fully semantic and may break some screen readers or keyboard table navigation. We mitigated with ARIA attributes and keyboard handlers, but for perfect semantics consider a non-table grid implementation or virtualization library that preserves table semantics.
- Column alignment: header and body are in separate scroll containers; we synchronize `scrollLeft` but minor visual drift can occur. If you need pixel-perfect behavior, use a single scroll container and virtualize row rendering via div/grid layout.
- Small page sizes: with `APPT_PAGE_SIZE = 20`, DOM reduction is minor. Gains scale with larger pages (e.g., 100+ rows).
- Interaction safety: action buttons and selects inside rows still exist and stop propagation; ensure additional inline interactive controls use `e.stopPropagation()` to avoid accidental row select.

Non-breaking mitigations applied
- Scroll reset on filters/pages
- Horizontal scroll sync with guarded handlers
- Focusable rows + Enter key for keyboard users

Next steps (paused)
- Stop rollout: do not apply virtualization to other tables yet.
- Focus next optimizations away from table virtualization: image optimization, network/refetch reduction, React callback stabilization, Flutter rebuilds.

Measurement guidance
- DOM node count: `document.querySelectorAll('[data-test="appointments-table"] tr').length`
- Performance: use Chrome DevTools Performance & Memory tools, record scrolling, compare before/after snapshots.

Feature flag
- Environment variable: `NEXT_PUBLIC_VIRTUALIZE_APPTS` — set to `1` or `true` to enable at build/runtime.
- Local override (QA): set in the browser console or localStorage to toggle without rebuilding:
```js
localStorage.setItem('virtualize_appointments', '1') // enable
localStorage.setItem('virtualize_appointments', '0') // disable
localStorage.removeItem('virtualize_appointments') // fall back to env
```
- Default: flag is OFF unless `NEXT_PUBLIC_VIRTUALIZE_APPTS` is set to `1`/`true` or localStorage override used.

Rollback
- Turn off the flag (unset env / remove localStorage override) to revert to the non-virtualized path immediately.
- Full code revert: `git checkout -- manager-web/src/app/dashboard/page.tsx manager-web/virtualization-PILOT-NOTES.md`

If you'd like, I can now:
- Apply small fixes (reset scroll and header sync are applied), or
- Run an automated headless profile to collect exact metrics, or
- Prepare a PR summary and rollback switch (feature flag) for safer testing.

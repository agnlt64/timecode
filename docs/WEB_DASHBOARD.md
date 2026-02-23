# Web Dashboard Specification (V1)

## 1. Goals

- Immediate visibility of coding activity.
- Fast local interaction for common ranges.
- One-click export of current range.

## 2. Pages

Single-page dashboard at `/` with these sections:

1. Header
   - Date range picker
   - Presets: Today, 7D, 30D, Custom
   - Export PNG button
2. KPI cards
   - Total coding time
   - Active days
   - Avg per active day
3. Charts
   - Daily timeline (bar/area)
   - Language distribution (pie/bar)
   - Project distribution (bar)
4. Tables
   - Top languages
   - Top projects

## 3. UX Requirements

- Loading state for each panel.
- Empty states:
  - "No data in this range."
  - CTA to open VS Code and start coding.
- Error states with retry action.
- Date range persisted in URL query params.

## 4. Performance Targets

- Initial paint under 1s on local machine.
- Range change render under 300ms for common ranges.

## 5. Accessibility

- Keyboard-navigable controls.
- Sufficient color contrast.
- Tooltips with text alternatives.

## 6. Local Navigation

- `/` dashboard
- `/settings` future-ready stub (V1 optional)

## 7. State Handling

- Keep selected range in app state and URL.
- Fetch endpoints in parallel.
- Debounce custom range changes by 150ms.

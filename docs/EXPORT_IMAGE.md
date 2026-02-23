# PNG Export Specification (V1)

## 1. Purpose

Generate a shareable PNG summary for a custom date range, entirely locally.

## 2. Endpoint

`GET /api/v1/export/image?from=YYYY-MM-DD&to=YYYY-MM-DD&theme=light&title=My+Stats`

## 3. Input Rules

- `from` and `to` required.
- `from <= to`.
- Range max 366 days.
- `theme` optional: `light | dark` (default `light`).
- `title` optional, max 64 chars.

## 4. Output

- Content type: `image/png`
- Default size: `1200x630`
- Include:
  - Title
  - Date range
  - Total coding time
  - Top 3 languages
  - Top 3 projects
  - Mini timeline (spark bars)

## 5. Rendering Pipeline

1. Query stats endpoints internally.
2. Build render model.
3. Render image template (SVG/virtual layout).
4. Rasterize to PNG.
5. Return binary response.

## 6. Branding/Theming

- Keep visuals minimal and readable.
- Theme tokens:
  - background
  - text-primary
  - text-secondary
  - accent
  - muted

## 7. Failure Cases

- No data: still generate image with "No tracked activity in this period".
- Invalid range: return `400` JSON error.
- Rendering failure: return `500` JSON error with request id.

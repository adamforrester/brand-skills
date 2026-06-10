# Brand assets

Drop client brand assets here — `/brand-context:extract` (in Claude Code) will discover and use them automatically.

**Supported:**
- `.pdf` — brand guides, style guides, voice docs
- `.png` / `.jpg` / `.jpeg` / `.webp` / `.gif` — reference screenshots
- `.svg` — logos, hero assets

**Not directly readable** (export to PDF first):
- `.docx` / `.pptx` / `.key` / `.numbers`

You don't need to edit `.brandrc.yaml` by hand — the skill scans this directory, classifies what it finds, and asks you to confirm before extracting.

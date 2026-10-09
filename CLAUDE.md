# Notes for Claude

- Typography: never use the `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial` system font stack (or any system-font fallback as the face people actually see) for UI text in this project or its artifacts. Load Inter (the portfolio's face) and use `"Inter", system-ui, "Segoe UI", Roboto, sans-serif`.
- Art pieces (swan pond, tiger pond, meadow) share one look: the swan pond's brush pass and its torn, deckled paper edge (`featherEdge` in `app/swan-pond-engine.ts`). New pieces reuse both rather than approximating them.

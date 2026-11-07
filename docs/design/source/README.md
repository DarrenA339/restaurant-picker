# Design sources

Source files for the mockups in docs/design/. Each file matches the image with the same number.

Use these for exact values: spacing, sizes, radii, colors, font weights, and copy. They are mockups for a design canvas, not app code, so don't copy them into the app.

- `{{name}}` is a template value filled in by the script at the bottom of each file.
- `<sc-for>` repeats its contents for each item in a list; `<sc-if>` shows its contents only when a value is true.
- `<x-dc>`, `<helmet>`, and `support.js` belong to the canvas runtime. Ignore them.
- Photos marked as placeholders stand in for real Google Places photos.
- The map drawings stand in for a live Google Map.

Build the real screens in Next.js and Tailwind with the tokens in app/globals.css, matching the images and these values.

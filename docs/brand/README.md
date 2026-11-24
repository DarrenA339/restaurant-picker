# Chews brand assets

Copy each folder into the repo root; the paths match a Next.js App Router project.

| File | What it is |
| --- | --- |
| app/icon.svg | Browser tab icon. Next.js links it automatically |
| app/favicon.ico | 16, 32 and 48 px fallback for older browsers |
| app/apple-icon.png | 180 px iOS home-screen icon. Full-bleed square; iOS rounds the corners |
| app/opengraph-image.png | 1200x630 link preview for shared invites, with its alt text beside it |
| public/brand/chews-icon.svg | App icon tile, tomato with an oat c |
| public/brand/chews-mark.svg | The c alone in currentColor, for tight spaces |
| public/brand/chews-wordmark.svg | "chews" in Caprasimo, outlined, currentColor |
| public/brand/chews-lockup.svg | Icon plus wordmark, for light grounds |
| public/brand/chews-lockup-dark.svg | Butter icon plus oat wordmark, for espresso grounds |
| public/brand/hero-card.jpg | Front card photo in the Welcome hero (472x354). See "Photo credit" below |
| public/icons/icon-192.png, icon-512.png | Web app manifest icons. The c sits inside the maskable safe zone |
| docs/design/source/01-welcome*.dc.html | Welcome screen with the new brand, replacing the old ones |
| docs/design/source/brand.dc.html | The brand sheet: logo, palette, type, voice |

The SVG wordmarks are outlined, so they need no font. In the app, set the wordmark as text in Caprasimo instead, so it stays crisp and editable.

## Photo credit

`public/brand/hero-card.jpg` is a crop of a photo by Jakub Kapusnak on Unsplash (https://unsplash.com/photos/4f4YZfDMLeU), used under the Unsplash License (free to use, not Unsplash+). Any photo in the brand illustration must be a file we own or license like this one. Never use a Google Places photo here: those can't be stored.

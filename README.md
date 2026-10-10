# After Five Tint — website

Static site (plain HTML/CSS/JS, no build step). Deploys as-is on Vercel.

## Structure

- `index.html` — the whole page, all real content and contact links
- `assets/css/site.css` — design tokens (colors, type, spacing) at the top, then each section
- `assets/js/site.js` — menu, film selector, tint comparison, gallery, FAQ, timeline, and the intro scroll controller
- `assets/js/intro.js` + `assets/js/car-scene.js` — the 3D car intro (loads only on capable devices; everyone else gets the poster version)
- `assets/img/` — renders of the 3D scene (posters, comparison pair, service images, gallery, band, contact backdrop, social image) and the home-interior render
- `assets/models/car/` — the 3D car model
- `assets/fonts/` — Archivo + Inter (self-hosted, SIL Open Font License)
- `vendor/three/` — three.js r169 (MIT)

## Common edits

- **Hours / phone / address:** search `index.html` for `8AM`, `989`, or `Bay St` (also in the JSON-LD block in `<head>`).
- **Gallery photos:** put real job photos in `assets/img/work/` and list them in the `GALLERY` object at the top of `assets/js/site.js`. Until a category has real photos it shows studio renders labelled "Render" (Auto, Home) or a text panel (Boats & Powersports). Real photos replace the renders automatically.
- **Colors:** `:root` tokens at the top of `site.css`. The lime accent is `--volt`.

## Launch checklist (moving to the business's own domain)

1. Remove `<meta name="robots" content="noindex, nofollow">` from `index.html`.
2. Replace `robots.txt` with the "allow" version described inside it.
3. Add `<link rel="canonical" href="https://YOUR-DOMAIN/">` and make `og:image` an absolute URL.

## Credits

- Car: "Car Concept" from the [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), based on a CC0 model by Unity Fan, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified: graphite paint variant, tinted glass, and all Khronos logo textures removed. Credit appears in the site footer; keep it there.
- three.js © three.js authors, MIT license (`vendor/three/LICENSE`).
- Fonts: Archivo and Inter, SIL Open Font License (`assets/fonts/OFL-*.txt`).

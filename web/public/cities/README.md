# City / country hero photos

Drop a photo here as `<slug>.jpg` (or update the extension in `PlaceHero`), then
add the slug to `WITH_PHOTO` in `web/lib/cityImages.ts`. The place's hero then
switches from the tinted silhouette to the teal-duotone photo treatment
automatically. Slug = lowercase, spaces→hyphens (e.g. London → `london.jpg`,
United Kingdom → `united-kingdom.jpg`).

Rules:
- Public-domain or Unsplash-license only. Keep a credit line in the PR.
- Landscape, ≥1600px wide, skyline/streetscape (the duotone flattens color, so
  choose images with clear structure/contrast).

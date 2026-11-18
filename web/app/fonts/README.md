Schibsted Grotesk (variable, weights 400–900, normal + italic), latin subset.
Self-hosted copies of the files Google Fonts serves (fonts.gstatic.com, v7),
loaded with next/font/local. Licensed under the SIL Open Font License 1.1.

Why self-hosted: next/font/google in Next 14.2.15 crashed at build time
(`TypeError: Cannot read properties of null (reading '1')` in
google/loader.js) on the current Google Fonts response, which failed every
Vercel deployment. Local files remove the build-time network dependency.

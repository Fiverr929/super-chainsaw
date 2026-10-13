/** Etsy product gallery images use il_* filenames; review photos use other paths such as /iap/. */
export function isEtsyListingImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && /(^|\.)etsystatic\.com$/.test(url.hostname)
      && /\/il_[^/]+\.(?:jpe?g|png|webp)$/i.test(url.pathname);
  } catch { return false; }
}

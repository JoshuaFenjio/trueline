"""Remove the four baked-in UI cards from salary-radar-hero.png.

Each card region is reconstructed from real background pixels:
  1. a pull-push diffusion fill supplies the low-frequency colour (cream tint,
     shadow-free), guaranteeing a seamless join at the mask boundary;
  2. high-frequency detail (the dotted-map texture) is transplanted from an
     automatically chosen donor region elsewhere in the artwork -- the offset
     that best matches the ring of real pixels surrounding the card;
  3. the transplanted detail is modulated by a diffused "texture energy" field
     so dots only appear where the surrounding background actually has dots,
     and plain cream stays plain.
"""
import os

from PIL import Image
import numpy as np

SRC = 'salary-radar-hero.png'
DST = 'hero-cityscape.png'                  # lossless source, kept in the repo
WEBP = 'web/public/hero-cityscape.webp'     # what the site actually serves
WEBP_QUALITY = 82   # verified: max deviation of 2/255 across the cream, no banding

# Card interiors, measured from luminance profiles (left, top, right, bottom).
# Margins expand each rect over its drop shadow; card 4 is not expanded up/left
# because its shadow there falls on the dark buildings/trees we want to keep.
CARDS = [
    dict(rect=(156, 152, 427, 350), margin=(16, 12, 26, 34)),   # "Average total compensation"
    dict(rect=(1069, 205, 1281, 347), margin=(14, 10, 30, 38)),  # "Live data"
    dict(rect=(164, 725, 367, 889), margin=(14, 10, 30, 42)),    # "Top paying city"
    dict(rect=(971, 650, 1254, 809), margin=(2, 0, 34, 42)),     # "In demand role"
]


def _box(a, r, axis):
    """Box filter of radius r along one axis (edge-padded)."""
    a = np.swapaxes(a, 0, axis)
    p = np.pad(a, [(r, r)] + [(0, 0)] * (a.ndim - 1), mode='edge')
    c = np.cumsum(p, axis=0)
    c = np.concatenate([np.zeros_like(c[:1]), c], axis=0)
    out = (c[2 * r + 1:] - c[:-(2 * r + 1)]) / (2 * r + 1)
    return np.swapaxes(out, 0, axis)


def blur(arr, sigma):
    """Gaussian blur (three box passes) of an HxW or HxWxC float array."""
    r = max(1, int(round(sigma)))
    out = arr.astype(float)
    for _ in range(3):
        out = _box(_box(out, r, 0), r, 1)
    return out


def masked_blur(arr, known, sigma):
    """Blur using only known pixels, so a card's flat interior never pollutes
    the statistics measured just outside it."""
    k = known.astype(float)
    w = blur(k, sigma)
    if arr.ndim == 3:
        k, w = k[..., None], w[..., None]
    return blur(arr * k, sigma) / np.maximum(w, 1e-6)


def _down(a):
    """2x2 box-sum downsample (zero-padded to even dimensions)."""
    h, w = a.shape[:2]
    a = np.pad(a, [(0, h % 2), (0, w % 2)] + [(0, 0)] * (a.ndim - 2))
    h, w = a.shape[:2]
    a = a.reshape(h // 2, 2, w // 2, 2, *a.shape[2:])
    return a.sum(axis=(1, 3))


def _up(a, shape):
    """Bilinear upsample to shape (h, w)."""
    h, w = shape
    sh, sw = a.shape[:2]
    yi = (np.arange(h) + 0.5) * sh / h - 0.5
    xi = (np.arange(w) + 0.5) * sw / w - 0.5
    y0 = np.clip(np.floor(yi).astype(int), 0, sh - 1)
    x0 = np.clip(np.floor(xi).astype(int), 0, sw - 1)
    y1 = np.clip(y0 + 1, 0, sh - 1)
    x1 = np.clip(x0 + 1, 0, sw - 1)
    wy = np.clip(yi - y0, 0, 1)[:, None]
    wx = np.clip(xi - x0, 0, 1)[None, :]
    if a.ndim == 3:
        wy, wx = wy[..., None], wx[..., None]
    top = a[y0][:, x0] * (1 - wx) + a[y0][:, x1] * wx
    bot = a[y1][:, x0] * (1 - wx) + a[y1][:, x1] * wx
    return top * (1 - wy) + bot * wy


def pull_push(img, known):
    """Fill masked pixels by hierarchical (pull-push) interpolation of known ones."""
    single = img.ndim == 2
    if single:
        img = img[..., None]
    pyr = [(img * known[..., None], known.astype(float))]
    while min(pyr[-1][1].shape) > 2:
        i, k = pyr[-1]
        pyr.append((_down(i), _down(k)))
    i, k = pyr[-1]
    est = np.divide(i, k[..., None], out=np.zeros_like(i), where=k[..., None] > 0)
    for lvl in range(len(pyr) - 2, -1, -1):
        i, k = pyr[lvl]
        up = _up(est, k.shape)
        here = np.divide(i, k[..., None], out=np.zeros_like(i), where=k[..., None] > 0)
        a = np.clip(k, 0, 1)[..., None]
        est = here * a + up * (1 - a)
    return est[..., 0] if single else est


def laplace_fill(img, known, iters=1500):
    """Harmonic (Laplace) fill of the unknown pixels, seeded by pull_push.

    Pull-push alone drifts toward the regional average, which washes out a hole
    sitting inside the darker dotted map; relaxing to a harmonic solution makes
    the fill obey the colours immediately around each hole instead.
    """
    single = img.ndim == 2
    src = (img[..., None] if single else img).astype(float)
    u = pull_push(img, known)
    u = u[..., None] if single else u
    k = known[..., None]
    u = np.where(k, src, u)

    H, W = known.shape
    yy, xx = np.mgrid[0:H, 0:W]
    parity = ((yy + xx) % 2 == 0)[..., None]
    omega = 1.95
    for i in range(iters):
        for colour in (parity, ~parity):
            nb = (np.pad(u[1:], ((0, 1), (0, 0), (0, 0)), mode='edge')
                  + np.pad(u[:-1], ((1, 0), (0, 0), (0, 0)), mode='edge')
                  + np.pad(u[:, 1:], ((0, 0), (0, 1), (0, 0)), mode='edge')
                  + np.pad(u[:, :-1], ((0, 0), (1, 0), (0, 0)), mode='edge')) / 4.0
            upd = u + omega * (nb - u)
            u = np.where(k, src, np.where(colour, upd, u))
    return u[..., 0] if single else u


DARK = 185.0          # below this a pixel belongs to the drawn city, not the background
TEXTURE_GAIN = 1.4    # see the ratio computation in main()
CITY_BLEED = 0.3      # how much of the city's own colour is allowed to diffuse
                      # into a card gap: 0 cuts the park off with a hard edge,
                      # 1 smears tree-green far down into the cream.


def best_offset(lum, mask, box, forbidden, want_energy, want_tone, energy, tone):
    """Pick the donor shift whose texture matches what belongs in this card's hole.

    Matching raw pixels is the wrong criterion: dot phase never lines up, so a
    blank patch of cream always scores better than genuine dotted map. Instead
    compare local texture density (`energy`) and local tone against the values
    diffusion predicts for the hole. The donor is also rejected if it contains
    the drawn cityscape, so a card never gets filled with a smeared Eiffel Tower.
    """
    x0, y0, x1, y1 = box
    H, W = mask.shape
    ys, xs = np.nonzero(mask)
    ys, xs = ys[::5], xs[::5]
    e_want, t_want = want_energy[ys, xs], want_tone[ys, xs]
    best, best_off = None, None
    for dy in range(-620, 621, 10):
        for dx in range(-700, 701, 10):
            if abs(dx) < 80 and abs(dy) < 80:
                continue
            if not (0 <= y0 + dy and y1 + dy <= H and 0 <= x0 + dx and x1 + dx <= W):
                continue
            patch = (slice(y0 + dy, y1 + dy), slice(x0 + dx, x1 + dx))
            if forbidden[patch].any():
                continue
            dark_frac = (lum[patch] < DARK).mean()
            if dark_frac > 0.02:                 # donor holds part of the city
                continue
            ny, nx = ys + dy, xs + dx
            # A deficit of texture is unfixable (the fill can only attenuate the
            # donor, never invent dots), so weight it far above an excess.
            diff = energy[ny, nx] - e_want
            d = (30 * (np.minimum(diff, 0) ** 2).mean()
                 + 2 * (np.maximum(diff, 0) ** 2).mean()
                 + ((tone[ny, nx] - t_want) ** 2).mean()
                 + 4000 * dark_frac)
            if best is None or d < best:
                best, best_off = d, (dx, dy)
    if best_off is None:
        raise SystemExit('no clean donor region found for card %s' % (box,))
    return best_off, best


def main():
    im = Image.open(SRC).convert('RGB')
    img = np.asarray(im).astype(float)
    H, W, _ = img.shape

    masks = []
    for c in CARDS:
        x0, y0, x1, y1 = c['rect']
        ml, mt, mr, mb = c['margin']
        m = np.zeros((H, W), bool)
        m[max(0, y0 - mt):min(H, y1 + mb + 1), max(0, x0 - ml):min(W, x1 + mr + 1)] = True
        masks.append(m)
    all_mask = np.logical_or.reduce(masks)
    known = ~all_mask

    lum = img.mean(axis=2)
    dark = lum < DARK

    # Low-frequency base: every masked pixel gets the colour its neighbourhood
    # implies. Where a card abuts the drawn city (card 4 sits under the trees)
    # the boundary uses the local background tone instead of the city's own
    # colour, so diffusion cannot smear tree-green down into the gap.
    bg_est = masked_blur(img, known & ~dark, 30)
    boundary = np.where(dark[..., None], CITY_BLEED * img + (1 - CITY_BLEED) * bg_est, img)
    base = laplace_fill(boundary, known, iters=400)

    # Texture-energy field: how much high-frequency detail the background carries.
    energy = masked_blur(np.abs(img - masked_blur(img, known, 5)).mean(axis=2), known, 20)
    energy_filled = laplace_fill(energy, known, iters=200)

    img_lf = masked_blur(img, known, 14)
    tone = masked_blur(img, known, 20).mean(axis=2)
    tone_want = laplace_fill(tone, known, iters=200)

    out = img.copy()
    for c, mask in zip(CARDS, masks):
        x0, y0, x1, y1 = c['rect']
        ml, mt, mr, mb = c['margin']
        box = (x0 - ml, y0 - mt, x1 + mr + 1, y1 + mb + 1)
        (dx, dy), score = best_offset(lum, mask, box, all_mask,
                                      energy_filled, tone_want, energy, tone)
        ys, xs = np.nonzero(mask)
        donor_detail = img[ys + dy, xs + dx] - img_lf[ys + dy, xs + dx]
        # never transplant a fragment of the drawn city into a card region
        donor_detail[lum[ys + dy, xs + dx] < DARK] = 0.0
        e_t = energy_filled[ys, xs]
        e_d = energy[ys + dy, xs + dx]
        # Step, rather than fade, the transplanted texture: half-strength dots
        # everywhere read as haze, whereas full dots that stop at a line read as
        # the edge of a continent, which is what the map actually looks like.
        # Diffusion under-predicts density inside a wide hole (it averages the
        # dense and empty sides of the boundary), so bias the target upward.
        ratio = TEXTURE_GAIN * e_t / np.maximum(e_d, 1e-3)
        w = np.clip((ratio - 0.25) / 0.45, 0.0, 1.0)[:, None]
        out[ys, xs] = base[ys, xs] + donor_detail * w
        print('card %s -> donor offset (%d, %d)  match %.1f  mean texture weight %.2f'
              % (c['rect'], dx, dy, score, w.mean()))

    # Soften the seam so the join never reads as a hard edge.
    soft = blur(out, 1.2)
    edge = blur(all_mask.astype(float), 2.5)
    band = ((edge > 0.05) & (edge < 0.95))[..., None].astype(float)
    out = out * (1 - band) + soft * band

    out = np.clip(out, 0, 255).astype(np.uint8)
    result = Image.fromarray(out)
    result.save(DST)
    result.save(WEBP, 'WEBP', quality=WEBP_QUALITY, method=6)
    for path in (DST, WEBP):
        print('wrote %s  %s  %.0f KB' % (path, Image.open(path).size, os.path.getsize(path) / 1024))


if __name__ == '__main__':
    main()

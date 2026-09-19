# Las Vegas Press Package Week — Hero Landing Page

Single-viewport waitlist page. One goal: email capture.

Everything lives in `index.html`. No build step, no dependencies, no framework.
Open the file in a browser and it runs. Vanilla JS, real CSS, custom properties,
`clamp()` fluid type.

---

## You still need to supply three things

| What | Where | Notes |
|---|---|---|
| **`GHL_WEBHOOK_URL`** | Vercel → Project → Settings → Environment Variables | The GoHighLevel inbound webhook URL. See below. |
| **OG image** | `og:image` and `twitter:image` meta tags, plus `og:url` | 1200×630. Also update the two `https://example.com/` URLs. |

The backdrop plate is already in place at `assets/hero-bg.png` (copied from
`WEebsite Background Image.png`, 1536×1024). It replaced the `hero-base.jpg`
placeholder slot — that image *is* the hero base, so a second photo layer would
have doubled the camera, poster and film strip.

### Email capture → GoHighLevel

The page posts to **`/api/subscribe`** (a Vercel serverless function in
[`api/subscribe.js`](api/subscribe.js)), which forwards to a GHL **inbound
webhook** server-side.

**Why not post to GHL straight from the page.** Three reasons, in order of how
much they'd hurt:

1. The webhook URL is a bearer credential — anyone holding it can write contacts
   into your CRM. In client-side JS it's readable by anyone who views source.
2. The inbound webhook trigger is a **premium trigger, billed per event**. A
   scraper that finds the URL in your page source can run up the agency wallet a
   cent at a time.
3. GHL doesn't document CORS support on webhook URLs, so a browser `fetch` to it
   may just be blocked.

Server-to-server avoids all three, and gives real status codes so the page's
"Try Again" state means something.

#### Setting it up in GHL

1. **Enable premium triggers** — Agency Settings → enable LC Premium Triggers &
   Actions. You get 100 free executions, then **$0.01 per inbound event** off the
   agency wallet. For a waitlist that's pennies; worth knowing it isn't zero.
2. **Automation → Workflows → Create Workflow.**
3. Add trigger → **Inbound Webhook**. Copy the generated URL. It looks like
   `https://services.leadconnectorhq.com/hooks/<locationId>/webhook-trigger/<id>`.
4. Add action → **Create/Update Contact**, and map `email` from the webhook
   payload to the contact's Email field.
5. Add action → **Add Tag**, using `press-package-week-waitlist`.
6. **Publish the workflow.** A saved-but-unpublished workflow silently does
   nothing, which is the most common way this setup appears broken.
7. Put the URL in Vercel as `GHL_WEBHOOK_URL` (all three environments), then
   redeploy — env vars are read at runtime, but existing deployments don't pick
   up new values.

To see the payload shape in GHL's mapper, submit the form once after step 3;
the trigger captures a sample request you can then map fields from.

#### What gets sent

```json
{
  "email": "kent@example.com",
  "source": "press-package-week-waitlist",
  "tag": "press-package-week-waitlist",
  "page": "https://your-domain.com/",
  "submitted_at": "2026-09-19T12:00:00.000Z"
}
```

Flat on purpose — GHL's workflow mapper handles flat fields far more cleanly
than nested objects.

#### Spam

There's a honeypot field named `company`, hidden off-screen and out of the tab
order and the a11y tree. If it comes back filled, the function returns 200 (so
the bot doesn't retry) without spending a premium event. Emails are also
validated and normalised to lowercase server-side before anything is forwarded.

If you start seeing junk anyway, the next step is a Cloudflare Turnstile widget
or Vercel's bot protection — not more client-side validation, which bots skip
entirely by posting to `/api/subscribe` directly.

#### Testing locally

`/api/subscribe` doesn't exist when you open `index.html` off disk — the page
logs a console warning saying so. To exercise the real path:

```bash
npx vercel dev
```

The function has unit coverage for its branches (invalid email, honeypot,
missing env var, GHL failure, no-JS HTML response, wrong method). All nine pass.

#### If JavaScript is off

The form does a native POST to the same endpoint, and the function returns a
self-contained styled confirmation page instead of JSON. It detects this by
content type — browsers send `application/x-www-form-urlencoded` for a native
form submit, while the page's `fetch` sends JSON. Email still gets captured.

### The backdrop plate

`assets/hero-bg.png`, loaded as a CSS `background-image` (which fails silently —
if the file goes missing the page renders as `--bg` plus arc, bloom and stars,
and the layout does not break).

It sits at **z1**, below the stars and the arc, at `--backdrop-opacity: .24`, so
both read as foreground atmosphere over it. Its top edge is dissolved into the
background by a mask, so don't feather it yourself.

---

## Deploying to Vercel

Static site, no build step. From this folder:

```bash
npx vercel login      # interactive, opens a browser
npx vercel            # preview deployment
npx vercel --prod     # production
```

`vercel` is not on PATH here, so it has to run through `npx`.

**Set `GHL_WEBHOOK_URL` before the production deploy**, or the form will return
"Signup is temporarily unavailable" on every submit:

```bash
npx vercel env add GHL_WEBHOOK_URL production
npx vercel env add GHL_WEBHOOK_URL preview
npx vercel env add GHL_WEBHOOK_URL development
```

`api/subscribe.js` needs no build config — Vercel picks up the `api/` directory
automatically and runs it on the Node runtime.

**`.vercelignore` is doing real work — don't delete it.** This folder holds about
26MB of source material (the one-sheets, the Niagara Falls photo, the August
shoot, the design reference). Vercel deploys the whole working directory by
default, and anything deployed is publicly fetchable by URL. The ignore file
narrows the deployment to `index.html` + `assets/`. If you add more source files
here, check they match an ignore pattern.

`vercel.json` sets `cleanUrls`, a one-year immutable cache on `/assets/*`, and
three baseline security headers.

### Image weight

`assets/hero-bg.png` is 1.6MB, which would have blown the LCP budget on a phone.
It ships as **`hero-bg.webp` (59KB)** instead, wired up via `image-set()` with the
PNG kept as a fallback declaration for anything that doesn't understand it. The
plate is soft atmosphere so it compresses extremely well — 96% smaller with no
visible loss at 24% opacity.

If you re-export the plate, redo the conversion:

```bash
python -c "from PIL import Image; Image.open('assets/hero-bg.png').convert('RGB').save('assets/hero-bg.webp','WEBP',quality=86,method=6)"
```

## Analytics

Vercel Web Analytics is wired in via **script tag**, at the bottom of
`index.html`:

```html
<script>
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
</script>
<script defer src="/_vercel/insights/script.js"></script>
```

**`@vercel/analytics` is deliberately not installed.** Vercel's own docs say so
for plain HTML: *"When using the HTML implementation, there is no need to install
the `@vercel/analytics` package."* It's an ESM module meant for a bundler, and
this site has no build step, so nothing would ever pull it into the page. Adding
a `package.json` for it also risks Vercel treating this as a Node project and
running install/build steps it currently skips.

**You must enable it in the dashboard** — Vercel → your project → Analytics →
**Enable**. That's what creates the `/_vercel/insights/*` routes. Until then the
script 404s harmlessly; the page is unaffected, and it 404s locally too since
those routes only exist on a Vercel deployment.

To confirm it's live, load the deployed page and look for a `/_vercel/insights/view`
request in the Network tab.

Two caveats:

- **No route support.** The HTML implementation doesn't track client-side route
  changes. Irrelevant here — it's a single page with no navigation.
- **Ad blockers.** Enabling Analytics also provisions a project-specific path
  alongside `/_vercel/insights/*`. Substituting that unique path into the `src`
  gets past blockers that recognise the well-known one. The dashboard shows it
  when you enable the feature.

It's cookieless and does no fingerprinting, so it needs no consent banner.

If you later want Core Web Vitals from real visitors — worth it given the LCP
budget this page was built to — Speed Insights installs the same way and is a
separate toggle.

## Typography

Three families, loaded in one Google Fonts request.

| Token | Family | Used for |
|---|---|---|
| `--font-display` | **Josefin Sans** 700 | Headline |
| `--font-accent` | **Bodoni Moda** Italic 700 | The word "package"; the micro-line |
| `--font-body` | **Inter** | Subhead, form, button |

Bodoni Moda is the emphasis face because the contrast it provides is *structural*,
not just a change of shape. It is a true Didone — hairline serifs, abrupt
thick-to-thin stems — set against Josefin's near-uniform geometric strokes. A
humanist or transitional serif shares too much of Josefin's even weight and the
emphasis goes mushy at display size. Didone against geometric deco sans is also
period-correct for a Vegas marquee.

Two details that matter if you touch this:

- **`.headline em` is set at `0.9em`.** Bodoni's x-height is much larger than
  Josefin's, so at a shared font-size the emphasised word reads oversized. There
  is also a small `vertical-align` nudge, because Bodoni sits high against
  Josefin's low x-height.
- **`.l2` carries `padding-bottom: .16em`.** Bodoni italic descenders (the `p` and
  `g` in "package") run long against the 1.05 leading and would otherwise clip or
  collide with the gold underlight. The underlight itself is 32% wide, sized to
  sit under the word rather than the whole line.

Tracking differs per face: the headline runs at `-.005em` (a geometric sans at
display size wants near-neutral tracking; the `-.02em` that suited the previous
Didone crushed Josefin's round bowls together), and the emphasised word at
`+.005em`, because Didone italics set loose.

Playfair Display is no longer loaded.

## Tunable constants

### Backdrop and horizon arc — one dial drives both

The arc is one very large circle. Only its top curve enters the frame. Its fill
is `--bg`, so it doubles as the occluder that turns everything below the curve to
darkness, exactly as the reference does.

`hero-bg.png` has its own gold arc baked in, and the whole effect depends on the
CSS arc landing exactly on it so the two read as one light source. Rather than
eyeball that, the plate was measured: **its arc is a circle of radius 2848px —
diameter 3.708× the image width — with its apex 25.49% of the image height above
the image's bottom edge.**

Those two constants are what the arc tokens are built from:

```
backdrop width = 100vw * --bg-scale          (sized by width, not `cover`)
--arc-size     = 371vw * --bg-scale          (3.708 x that width)
--arc-apex     = (17vw - --bg-drop) * --bg-scale
```

| Token | Default | What it does |
|---|---|---|
| `--bg-scale` | `1` (mobile `1.9`) | Plate size as a multiple of viewport width. **The arc follows automatically.** |
| `--bg-drop` | `4vw` | How far the plate's bottom sits below the viewport bottom. |
| `--backdrop-opacity` | `.24` (mobile `.28`) | Plate opacity. |
| `--arc-size` | derived | Don't set by hand. |
| `--arc-apex` | derived | Don't set by hand. |

Sizing the plate **by width rather than `cover`** is the thing that makes this
hold: it puts the baked arc at a fixed multiple of viewport *width*, so the CSS
arc can track it with `vw` maths and stay welded at every aspect ratio. With
`cover` the baked arc drifts a couple of percent between a 16:10 laptop and a
phone, and you get two hairlines.

`--bg-drop` exists because geometry forces it. A full-width 3:2 plate on a 16:10
screen puts the baked arc at ~73% from the top; the reference sits at ~79%.
Dropping the plate lands it there and costs nothing, since the part pushed off
the bottom is the solid black below the arc. `--arc-apex` subtracts the same
drop, so the lock holds.

**If you replace `hero-bg.png`, re-measure it** and update the `371` and `17`
constants. Otherwise leave them alone and move `--bg-scale` / `--bg-drop`.

Note on the spec: "roughly 3× viewport width" would be `--arc-size: 300vw`. The
measured plate is much flatter than that — 371vw at `--bg-scale: 1`.

### Legibility scrim

| Token | Default | What it does |
|---|---|---|
| `--scrim-opacity` | `.72` | Strength of the dark pool behind the type. |

On a 16:10 screen the plate's poster and film strip ride up behind the form and
micro-line, and white italic text over the poster's own white lettering fails
contrast badly. The scrim is a soft dark ellipse at z2, painted before the bloom
so the purple still reads on top of it.

This is a **centre scrim, not a vignette** — it darkens the middle band where the
copy sits and leaves the edges alone. Set it to `0` to remove it, but check the
micro-line against the poster before you ship that.

Edge falloff is the horizontal `mask-image` on `.arc::before`. Its stops are in
`vw`, deliberately: percentages there resolve against the circle's own diameter
(several thousand px), so the entire viewport would sit inside a single opaque
stop and show no falloff at all. Using `vw` keeps the falloff in viewport space
and, usefully, independent of `--arc-size` — retune the arc without retuning the
falloff. Bring the `62vw` stops inward to dim the ends sooner.

Glow strength is the `box-shadow` stack on the same rule: a tight bright core,
two wider gold falloffs, and a very wide `--bloom` halo.

### Star field

| Constant | Default | What it does |
|---|---|---|
| `STAR_COUNT` | `52` | Desktop count. |
| `STAR_COUNT_SM` | `30` | Mobile count (≤640px). |
| `STAR_SEED` | `20260919` | Change for a different but still-repeatable scatter. |
| `STAR_FIELD_TOP` | `0.04` | Top of the generated field, as a fraction of viewport height. |
| `STAR_FIELD_BOT` | `0.56` | Bottom of the generated field. |
| `STAR_Y_BIAS` | `1.45` | `>1` packs stars toward the upper-middle, behind the headline. `1.0` is uniform. |
| `STAR_MIN_OP` / `STAR_MAX_OP` | `0.15` / `0.50` | Base opacity range. |
| `STAR_TWINKLE_MIN` / `_MAX` | `4.0s` / `9.0s` | Each star gets its own duration and a negative start offset, so they never sync. |
| `STAR_NEAR_PX` | `120` | Cursor proximity radius for brightening. |
| `STAR_NEAR_BOOST` | `1.9` | Brightness multiplier inside that radius. |

The seeded generator (mulberry32) means the field is byte-identical on every
reload. Horizontal placement is a triangular distribution, so the centre is dense
and the corners stay sparse without being empty.

### Star mask height

`:root`, CSS:

| Token | Default | What it does |
|---|---|---|
| `--star-mask-start` | `32%` | Where the field begins to fade. |
| `--star-mask-end` | `50%` (mobile `44%`) | Where it reaches zero. |

Stars must be fully gone before the camera, poster and film strip begin, or they
read as sensor dust rather than sky. With the plate full-bleed at `--bg-scale: 1`
those subjects start around 45% down, which is where the `50%` default comes
from. **If you change `--bg-scale` or swap the plate, re-check this.**

The spec describes this as "fades out below the arc line." The arc sits at about
79%, but the photo's subjects start well above that, so the mask ends earlier to
satisfy the actual requirement — nothing twinkling over the gear.

### Bloom haze

| Token | Default | What it does |
|---|---|---|
| `--bloom-y` | `62%` | Vertical centre of the haze. |
| `--bloom-radius` | `100%` | Outer edge of the core falloff. Inner stops derive from it as fractions, which is what keeps them monotonic. |
| `--bloom-opacity` | `0.55` | Master opacity of the whole layer. |

Held back from `0.85` because `hero-bg.png` already carries a purple haze of its
own; stacking both at full strength turns to mush.

**Don't set an inner stop past `--bloom-radius`.** CSS clamps an out-of-order
gradient stop to its predecessor's position, which collapses the falloff into
zero distance and produces a hard visible ring. That's why the inner stops are
written as `calc(var(--bloom-radius) * .25)` and so on rather than as literals.

Three rules keep this layer reading as haze rather than as a disc:

1. **Every falloff ends at a zero-alpha stop of its own hue**, never at
   `transparent`. `transparent` is `rgba(0,0,0,0)`, so interpolating toward it
   drags the ramp through darker, desaturated values and rings the edge.
2. **Nine stops on an eased curve** (alpha ≈ `(1-t)^2.2`) rather than four on a
   straight ramp. Measured on an isolated render, this cut the longest flat
   colour run from 17px to 10px.
3. **Wide ellipses, low peaks, heavy overlap.** A big soft field reads as
   atmosphere; a small dense one reads as an object.

### A note on residual banding

The bloom spans only about **24 distinct 8-bit levels** end to end — that's the
whole dynamic range available when a low-opacity violet sits on a near-black
ground. Some stepping is therefore inherent and no number of colour stops can
remove it; the fixes above spread it out rather than eliminate it.

The only true cure is dithering — a ~1.5% opacity noise overlay, which breaks the
quantisation up below the threshold of visibility. That was deliberately *not*
added, because the brief rules out grain and noise. If banding still bothers you
on a particular display, that's the remaining lever, and it is different in kind
from decorative grain: at that opacity it is invisible as texture and only serves
to hide the steps.

### Ambient load gate

The bloom, scrim and arc are pure CSS and paint instantly; the backdrop plate is
a network image. Fading them all on a fixed timer meant the violet field showed
over flat black for a beat while the plate was still in flight, so the section
flashed on first load.

`.ambient-ready` now releases all four together, once the plate has decoded:

- The gate script lives **inline in `<head>`, before the font `<link>`**. This
  placement is load-bearing — a stylesheet blocks execution of every script that
  follows it, and running the gate at the end of `<body>` made the whole
  atmosphere wait on Google Fonts. Measured at **3s** on a throttled connection.
- `<link rel="preload" as="image">` starts the plate fetch at parse time instead
  of waiting for CSS to be parsed and the layer painted.
- `decode()` is used rather than `onload`, because `onload` can fire while
  decoding still costs a frame.
- A **1200ms hard cap** fires the gate regardless, so a slow network, a 404, or a
  browser without WebP support can never leave the page sitting black.
- The CSS default is *visible*; only the `.js` class (set by that same inline
  script) opts into starting hidden. Verified: with JavaScript disabled the page
  renders identically to the normal path.

The bloom also has its own `bloom-in` keyframe rather than sharing `ambient-in`.
`ambient-in` ends at `opacity: 1`, but the bloom rests at `--bloom-opacity`
(0.55), so it used to fade to full brightness and then visibly step down when
`bloom-breathe` took over at the 2s mark.

Three stacked radial gradients: a primary purple core, a wider dimmer skirt, and
a warm gold wash just above the arc. The breathing loop drifts opacity and scale
by a few percent over 12s (`bloom-breathe`).

### Motion

| Constant | Default | What it does |
|---|---|---|
| `--stagger` | `0.08s` | Gap between entrance elements. Six items × 0.6s each, last finishes at 1.0s. |
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | The single entrance curve. |
| `CURSOR_LERP` | `0.06` | Lower = heavier, slower, more atmospheric. |
| `PARALLAX_MAX` | `4` px | Headline displacement ceiling. Vertical is 60% of this. |

Entrance order: badge → headline line 1 → headline line 2 → subhead → form →
micro-line. The arc, bloom and photo fade up underneath over 1.8s starting at
0.15s. Stars come in last, 1.2s, with a per-star random delay of 0.6–1.2s.

The entrance is **pure CSS**, so it still runs if JavaScript fails. The rise
animation lives on the headline's two `<span>`s rather than the `<h1>`, because
the parallax writes an inline transform to the `<h1>` and the two would otherwise
overwrite each other.

The cursor rAF loop stops itself once the glow settles, rather than running
forever in the background.

---

## Guardrails already handled

- **`prefers-reduced-motion`** — no stagger, no ambient drift, no cursor effects,
  no twinkle, no parallax. One 0.3s opacity fade. Stars render static at their
  base opacity. Page is fully usable.
- **Mobile (≤640px)** — no cursor glow, no parallax, no star brightening, 30
  stars. Form stacks to full-width input above full-width button with an 8px gap.
- **Transform and opacity only.** Nothing animates width, height, top or left.
- **Contrast** — every text pair clears WCAG AA against its own background.
  `--muted` on `--bg` is about 7.6:1, `--gold` on `--bg` about 9.8:1, and the
  button's `--bg` text on `--gold` about 9.8:1.
- **Success state** — the input and button fade to `opacity: 0` but keep their
  box, so the container height is identical before and after and nothing shifts.
  Focus moves to the confirmation so it is announced.
- **No grain, no noise, no vignette.** Deliberately.

---

## One documented exception to the spec

**Headline size.** The type spec calls for `clamp(2.8rem, 7vw, 6.5rem)`. Built
and measured, that is wrong for this layout in both directions — at 1440px `7vw`
is ~101px, which wraps both lines inside the 900px column and overflows the
viewport, and at 375px the `2.8rem` floor also wraps both lines, giving four
lines against a hard guardrail of three.

Shipped value: **`clamp(1.75rem, 5.2vw, 4.75rem)`**.

The ceiling is set by width, not taste. Josefin Sans sets about **0.467em per
character**, so the longer line ("The best act rarely wins.") needs 11.68em. In a
900px column that caps the type at ~77px, hence `4.75rem`. Above about 1450px the
column stops growing, so the type has to stop too.

Verified: one line per headline line at every width from 375px up, no horizontal
overflow.

If you widen the content column past 900px, raise the `4.75rem` ceiling to match
or the headline will look undersized on large displays.

There is also a `@media (max-height: 680px)` block that tightens the headline and
vertical rhythm, so the whole composition still fits one screen on short laptops
and landscape phones.

---

## Testing checklist

- [ ] 375px width — headline is 3 lines, form is stacked, nothing overflows
- [ ] Short viewport (e.g. 1280×620) — badge through micro-line all visible without scroll
- [ ] `prefers-reduced-motion: reduce` — single fade, static stars, no cursor glow
- [ ] Rename `assets/hero-bg.png` — layout holds, arc and bloom still read
- [ ] Resize the window slowly from 4:3 to 21:9 — exactly **one** arc hairline at every step
- [ ] Micro-line stays legible where it crosses the poster
- [ ] Disable JavaScript — entrance still animates, form still submits natively
- [ ] Submit an invalid email — inline rose border and message, no browser alert
- [ ] Kill the network and submit — button reads "Try Again", error message appears
- [ ] Tab through — badge, input, button all show visible focus rings

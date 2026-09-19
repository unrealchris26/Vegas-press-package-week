// POST /api/subscribe  ->  GoHighLevel inbound webhook
//
// Why this exists instead of posting to GHL from the browser:
//   1. GHL does not document CORS support on inbound webhook URLs, so a
//      browser fetch straight to it can be blocked outright.
//   2. The webhook URL is a bearer credential. In client-side JS it is
//      readable by anyone, and the inbound webhook trigger is a PREMIUM
//      trigger billed per event — a scraper could run up the agency wallet.
//   3. Server-to-server gives real status codes, so the page's retry state
//      means something.
//
// Env var required (Vercel > Project > Settings > Environment Variables):
//   GHL_WEBHOOK_URL = https://services.leadconnectorhq.com/hooks/<loc>/webhook-trigger/<id>

const SOURCE = "press-package-week-waitlist";
const TIMEOUT_MS = 8000;

// Deliberately permissive. GHL is the system of record; this only screens
// out obvious junk before it costs a premium event.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  // The no-JS path submits a normal form, so the browser expects a document
  // back rather than JSON.
  const ct = String(req.headers["content-type"] || "");
  const wantsHtml = ct.includes("application/x-www-form-urlencoded");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, wantsHtml, 405, { error: "Method not allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const email = String(body.email || "").trim().toLowerCase();
  const honeypot = String(body.company || "").trim();

  // Bot filled the hidden field. Report success so it doesn't retry, but
  // don't spend a premium event on it.
  if (honeypot) return send(res, wantsHtml, 200, { ok: true });

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return send(res, wantsHtml, 400, { error: "Enter a valid email address." });
  }

  const endpoint = process.env.GHL_WEBHOOK_URL;
  if (!endpoint) {
    console.error("GHL_WEBHOOK_URL is not set");
    // Don't tell the visitor about our config; the retry copy is right here.
    return send(res, wantsHtml, 502, { error: "Signup is temporarily unavailable." });
  }

  // Flat payload — flat fields are what GHL's workflow mapper handles most
  // cleanly when you wire the trigger to a Create/Update Contact action.
  const payload = {
    email,
    source: SOURCE,
    tag: SOURCE,
    page: String(req.headers["referer"] || ""),
    submitted_at: new Date().toISOString(),
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const ghl = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    if (!ghl.ok) {
      console.error("GHL webhook rejected:", ghl.status, await safeText(ghl));
      return send(res, wantsHtml, 502, { error: "Signup is temporarily unavailable." });
    }

    return send(res, wantsHtml, 200, { ok: true });
  } catch (err) {
    console.error("GHL webhook failed:", err && err.name === "AbortError" ? "timeout" : err);
    return send(res, wantsHtml, 502, { error: "Signup is temporarily unavailable." });
  } finally {
    clearTimeout(timer);
  }
};

async function safeText(r) {
  try { return (await r.text()).slice(0, 500); } catch { return "<unreadable>"; }
}

function send(res, wantsHtml, status, obj) {
  if (!wantsHtml) return res.status(status).json(obj);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(status).send(page(status < 400, obj.error));
}

// Returned only on the no-JS path. Kept self-contained so the repo doesn't
// need a second HTML file that would drift from index.html.
function page(ok, error) {
  const title = ok ? "You&rsquo;re on the list." : "That didn&rsquo;t go through.";
  const sub = ok
    ? "Dates and early pricing hit your inbox first."
    : (error || "Please try again.");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${ok ? "You're on the list" : "Something went wrong"} &middot; Press Package Week</title>
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@1,6..96,600..700&family=Inter:wght@400;500&display=swap">
<style>
  :root{--bg:#0A0708;--gold:#D4AF6A;--fg:#F7F4EF;--muted:#A79E94}
  *{box-sizing:border-box}
  body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;
       background:var(--bg);color:var(--fg);text-align:center;
       font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  h1{margin:0 0 .6rem;font-family:"Bodoni Moda",Didot,Georgia,serif;font-style:italic;
     font-weight:700;font-size:clamp(1.6rem,5vw,2.6rem);color:var(--gold);letter-spacing:.005em}
  p{margin:0 0 2rem;color:var(--muted);font-size:1rem;line-height:1.5;max-width:44ch}
  a{display:inline-block;padding:.85rem 1.6rem;border-radius:9px;background:var(--gold);
    color:var(--bg);font-weight:600;font-size:.95rem;text-decoration:none;
    transition:transform .3s cubic-bezier(.22,1,.36,1)}
  a:active{transform:scale(.985)}
  @media (prefers-reduced-motion:reduce){a{transition:none}}
</style></head>
<body><main><h1>${title}</h1><p>${sub}</p><a href="/">Back to the page</a></main></body></html>`;
}

# CLAUDE.md: Sherlock build brief

You are the lead engineer building **Sherlock**, a multilingual misinformation checker for Uganda and East Africa. Read this whole file before writing code. It is the source of truth for scope, stack, design, data, and rules. When this file and a request disagree, ask before acting.

---

## 1. Mission and context

- **What Sherlock does:** a citizen sends a suspicious claim (text or image) on WhatsApp or the web. Sherlock checks it against official sources and published fact-checks, replies with a *suggestive* assessment in the user's language (English, Luganda or Kiswahili), and routes uncertain claims to journalists. When a journalist publishes a verdict, Sherlock sends it back to everyone who asked.
- **Who it is for:** citizens (free) and newsrooms (paid). The pitch audience is **journalists**, so the newsroom dashboard must be the most polished part of the product.
- **Event:** AI in Journalism Hackathon, Team Sherlock. The build must produce a **working live demo**, not a slide.
- **Unique selling point:** multilingual (Luganda, Kiswahili, English) through Sunbird AI, plus a transparent, configurable watch of trusted Ugandan official sources.
- **Revenue model (show on the pricing page, nowhere else):**
  1. Citizens: free.
  2. Newsrooms: subscription. They get the rising-claims board, alerts and publishing tools, which show what the public is asking about.
  3. Platforms and researchers: API or data licence for **aggregated, anonymised** trend data only. Never individual messages or identities.

### Information disorders (the product handles each separately)
| Disorder | False? | Intent to harm? | Sherlock response |
|---|---|---|---|
| Disinformation | Yes | Yes | "Likely false, fabricated", cite the official source that disowns it, flag the cluster to journalists |
| Misinformation | Yes | No | Friendly correction in the user's language, no blame, shareable debunk card |
| Malinformation | No (true) | Yes | "True but misleading", redact personal data, route to a journalist for harm review |

Sherlock never claims to know intent. Intent is inferred from patterns (forgery, coordinated spread) and stated as such.

---

## 2. Non-negotiable rules

1. **Honesty in the demo.** All simulated data, counts and actions are labelled "demo" or "simulated" in the UI. Never present mocked behaviour as live.
2. **No impersonation.** Do not use real outlets (for example BBC, New Vision), real officials, or real presidents in demo data, fake posts, or journalist personas. Use clearly fictional names ("Demo Reporter, Sample Newsroom"; "a ministry notice").
3. **WhatsApp through Green API.** Decided by the team on 29 Oct 2026, replacing the earlier Meta-only rule. Green API (free Developer plan) links a dedicated demo phone as a WhatsApp Web device. All WhatsApp code stays in `engine/adapters/greenapi.ts`. Use a dedicated demo number, never a personal one: Green API is not Meta's official API and a linked number can be restricted. Move to Meta's Cloud API before any public launch.
4. **Privacy by design.** This falls under Uganda's Data Protection and Privacy Act 2019:
   - Never store raw phone numbers in claim or analytics tables.
   - `sender_hash = HMAC-SHA256(PHONE_HASH_SECRET, e164_phone)`. Never a plain hash, because phone numbers can be brute-forced.
   - The reply address is stored **encrypted** (AES-256-GCM, key `REPLY_ADDRESS_KEY`) in a separate table that only the service role can read (row-level security).
   - Strip phone numbers, names and other identifiers from any text before sending it to an external AI or search API.
   - Delete raw media after processing (24 hours at most).
   - Support the keywords STOP (opt out), DELETE (erase my data) and MYDATA (export).
5. **Suggestive, not conclusive.** The AI assessment uses hedged language ("The evidence we found suggests…"). Only a journalist's published verdict is final.
6. **No deepfake claims.** Do not claim to detect deepfakes or prove that a screenshot is fake. Say "we could not match this post to the official account's record" (`unverified`).
7. **Design rules (section 5).** No gradients, no decorative "AI aesthetic", no gratuitous shadows. Clean, editorial, confident.
8. **Secrets.** Never commit keys. Keep `.env.example` up to date. Read every key from the environment.
9. **Graceful degradation.** Every external API has a fallback. When a key is missing or `DEMO_MODE=true`, use canned responses that are clearly labelled, so the demo never crashes.

---

## 3. System overview

```
              ┌──────────────── Windows ────────────────┐
 Citizen ──▶  │ WhatsApp bot   │ Web checker (/check)   │
              └───────┬─────────────────┬──────────────┘
                      ▼                 ▼
              ┌──────────────── Engine ──────────────────┐
              │ 1 Intake → 2 Normalise → 3 Quick check →  │
              │ 4 Evidence → 5 Assessment → 6 Reply →     │
              │ 7 Newsroom case → 8 Publish + feedback    │
              └───────┬──────────────────────────────────┘
                      ▼
              Supabase (Postgres + pgvector + Realtime + Auth)
                      ▼
              Newsroom dashboard (/newsroom) ◀── Journalists
```

### Stack
| Layer | Choice |
|---|---|
| Front end | React 19, Vite, TypeScript (strict), Tailwind CSS v4, React Router, Recharts |
| Backend | Netlify Functions (TypeScript). Use background functions (`*-background.ts`) for the slow AI pipeline. Use scheduled functions for the source scraper |
| Database | Supabase: Postgres, `pgvector`, Realtime (live dashboard), Auth (magic-link login for journalists), RLS |
| WhatsApp | Green API (free Developer plan) with a dedicated demo number. Adapter: `engine/adapters/greenapi.ts` |
| Translation and speech | Sunbird AI API |
| LLM | **Zero budget:** one OpenAI-compatible chat adapter configured by env (`LLM_CHAT_URL`, `LLM_API_KEY`, `LLM_MODEL`). Default: **Groq free tier** (`https://api.groq.com/openai/v1/chat/completions`, a Llama 70B-class model; check Groq's model list). Optional: Sunbird Sunflower (`https://api.sunbird.ai/tasks/chat/completions`, `sunflower-14b`) for Luganda-native wording. Claude can be swapped in later when funded |
| OCR (screenshots) | Google Cloud Vision `TEXT_DETECTION` (first 1,000 units a month free; needs the Vision API enabled on the Google Cloud project) |
| Fact-check archive | Google Fact Check Tools API |
| Web search | Brave Search API (attribution required on the site) |
| Official sources | Own scraper: `rss-parser` + `cheerio`, configured by a source registry |
| Image checks | Google Cloud Vision OCR, then the LLM reads the extracted text. Perceptual hash (pHash) against our own image history, generated reverse-search links |
| Email | Nodemailer with Gmail SMTP (app password) for the demo. Swap to Resend when a domain exists |
| Tests | Vitest for the engine's pure functions; Playwright for the demo flow |
| Hosting | Netlify (free `*.netlify.app` subdomain) |

---

## 4. Repository layout

```
sherlock/
  CLAUDE.md
  .env.example
  netlify.toml
  docs/
    DESIGN.md                 # Slack-structure design system (provided by the team)
    references/               # UI reference images (provided by the team)
  public/
    sherlock-logo.svg         # request a clean SVG; PNG crop is temporary
    hero-journalism.jpg
  src/                        # React app
    main.tsx, App.tsx, router.tsx
    styles/index.css          # tokens (section 5)
    components/               # Button, Card, Pill, Kpi, Sparkline, Table, Drawer, Toast, Navbar, Footer
    pages/
      Landing.tsx  Check.tsx  Pricing.tsx  Team.tsx  Terms.tsx  Privacy.tsx
      newsroom/
        Login.tsx  Overview.tsx  Claims.tsx  ClaimDetail.tsx
        Library.tsx  Sources.tsx  Alerts.tsx  Settings.tsx
    lib/ supabase.ts  api.ts  format.ts
  netlify/functions/
    whatsapp-webhook.ts             # GET verify + POST receive (must return 200 fast)
    process-message-background.ts   # stages 2–6
    check.ts                        # web checker entry → same engine
    publish-verdict.ts              # stage 8 (journalist auth)
    simulate.ts                     # DEMO_MODE only
    scrape-sources-scheduled.ts     # official-source watch
  engine/                     # pure TypeScript, unit-tested, no framework code
    intake.ts  normalise.ts  quickCheck.ts  evidence.ts
    assess.ts  reply.ts  cluster.ts  privacy.ts
    adapters/ sunbird.ts  llm.ts  vision.ts  factcheck.ts  brave.ts  whatsapp.ts  email.ts  scraper.ts  phash.ts
    prompts/ assess.system.md  extract.system.md
  supabase/migrations/        # SQL (section 7)
  tests/
```

---

## 5. Design system

Use **`docs/DESIGN.md`** (Slack structure) for **everything except colour**: pill buttons (90px radius, 14px × 28px padding), 16px card radius, Inter type scale with negative tracking on display sizes, pricing-card patterns (one dark featured tier), stat cards, nav bar, footer band, pill eyebrows. Use reference images in `docs/references/` for layout and density. **Colour comes only from the logo.**

```css
@theme {
  --color-primary: #181818;      /* logo black: filled CTAs, featured tier, footer */
  --color-primary-press: #2c2c2c;
  --color-gold: #e0b008;         /* logo gold: highlight band, "rising" tile, key badges */
  --color-gold-soft: #fbf3d1;    /* secondary pill */
  --color-gold-cream: #fbf6e6;   /* cream cards, selected rows */
  --color-ink: #181818;
  --color-ink-mute: #5f5f5f;     /* 6.4:1 on white */
  --color-link: #7a5a00;         /* 6.4:1 on white */
  --color-on-dark-mute: #e7d88f; /* 12:1 on ink */
  --color-canvas: #ffffff;
  --color-hairline: #e6e6e6;
  --color-success: #007a5a;      /* rising arrows */
  --color-error: #cc4117;
}
```

Rules:
- **No gradients anywhere.** No mesh backgrounds, no glow, no glassmorphism.
- Hero: `hero-journalism.jpg` as the background with a **flat** `#181818` overlay at 80% opacity. White text, gold eyebrow pill, gold-soft primary pill, white outline secondary pill.
- One filled black CTA per viewport where possible.
- Every text and background pair must pass WCAG AA (4.5:1). Check new pairs.
- Responsive from 360px to 1440px. No horizontal scroll. Touch targets ≥ 44px.
- The dashboard should feel like a professional newsroom tool: dense but calm, data first, clear hierarchy, no toy charts.

---

## 6. Pages and features

### Public site
| Route | Content |
|---|---|
| `/` | Nav (logo, How it works, Pricing, Team, Newsroom pill, "Chat on WhatsApp" pill). Hero with the journalism image. "How it works" (send → check → confirm). Languages strip (English, Luganda, Kiswahili). The three information disorders and how Sherlock handles each. Trust section (official sources watched, human review, privacy). Pricing teaser. Footer band. |
| `/check` | Web checker: text box plus image upload, language picker, submit → streams stage progress → shows the suggestive assessment, evidence list, and "a journalist will review this" when queued. Same engine as WhatsApp. |
| `/pricing` | Three cards: Citizens (Free), Newsrooms (Subscription, featured black card), Platforms and Researchers (Data licence). FAQ below. |
| `/team` | Team cards: Team Lead Chihi Ivana Nyokabi (journalism), Odeke Harry Victor (journalism), Paul Ifemene Chukwumaobim (IT, system design and development), Supervisor Tumwine Edward. Photos to be provided; use initials avatars until then. |
| `/terms`, `/privacy` | Plain-language placeholders marked "Draft, legal review pending". Privacy explains hashing, encryption, retention and STOP/DELETE/MYDATA. |

The "Chat on WhatsApp" button is `https://wa.me/${VITE_WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi Sherlock')}`.

### Newsroom dashboard (`/newsroom/*`, Supabase Auth)
- **Overview:** KPI row (reports this week, rising now, open cases, published, median time to verdict). **Rising claims board**: ranked by velocity, each row with claim text, language chip, count, sparkline, green ▲ +delta. Live feed of new claims (Supabase Realtime). A "Simulate spread" control, visible only when `DEMO_MODE=true` and labelled "Demo".
- **Claims database (`/newsroom/claims`):** searchable, filterable table (status, language, label, date). Columns: ID, claim (English), original language, cluster count, AI label, status, first seen, last seen, and `sender_hash` (first 8 characters only, to show anonymisation). Never show phone numbers.
- **Claim detail (`/newsroom/claims/:id`):** original text and English translation side by side. Image (if any) with OCR text. Evidence panel grouped by source type (official source, fact-check archive, web). The AI suggestion with label, confidence and cited evidence. A verdict editor with a label picker, an explanation (English, auto-translated preview for Luganda and Kiswahili) and a source URL. **Publish** button. A history of actions.
- **Verified library (`/newsroom/library`):** published verdicts, reusable for instant matches.
- **Sources (`/newsroom/sources`):** the official-source registry: name, URL, type (RSS or page), selector, check interval, last success, status, and a "why trusted" note. Add, edit and disable. A health indicator for broken scrapers.
- **Alerts (`/newsroom/alerts`):** a log of rising-claim emails sent.
- **Settings:** rising threshold, alert recipients, journalist accounts.

---

## 7. Data model (Supabase migrations)

```sql
create extension if not exists vector;

create table journalists (
  id uuid primary key references auth.users(id),
  display_name text not null,
  newsroom text not null,
  email text not null,
  receives_alerts boolean default true,
  created_at timestamptz default now()
);

create table senders (                     -- analytics-safe
  sender_hash text primary key,            -- HMAC-SHA256
  language_pref text check (language_pref in ('eng','lug','swa')),
  consent_version text,
  consent_at timestamptz,
  opted_out boolean default false,
  last_message_at timestamptz
);

create table reply_addresses (             -- service role only (RLS deny all others)
  sender_hash text primary key references senders(sender_hash) on delete cascade,
  channel text not null check (channel in ('whatsapp','web')),
  address_ciphertext text not null,        -- AES-256-GCM, base64
  iv text not null,
  tag text not null
);

create table clusters (
  id uuid primary key default gen_random_uuid(),
  canonical_text_en text not null,
  embedding vector(1024),
  report_count int default 0,
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  status text default 'open' check (status in ('open','published')),
  is_demo boolean default false
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references clusters(id),
  sender_hash text references senders(sender_hash),
  channel text not null,
  original_text text,
  original_language text,
  text_en text,
  image_path text,                         -- deleted after processing
  image_phash text,
  ocr_text text,
  ai_label text check (ai_label in ('likely_false','likely_true','missing_context','under_investigation','unverified')),
  ai_confidence real,
  ai_rationale text,
  evidence jsonb default '[]',
  status text default 'received' check (status in ('received','assessed','queued','published')),
  received_at timestamptz default now(),
  is_demo boolean default false
);

create table cluster_counts (              -- time series for sparklines and velocity
  cluster_id uuid references clusters(id) on delete cascade,
  bucket timestamptz not null,             -- 5-minute buckets
  count int not null,
  primary key (cluster_id, bucket)
);

create table verdicts (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references clusters(id) unique,
  label text not null,
  explanation_en text not null,
  explanation_lug text,
  explanation_swa text,
  source_url text,
  journalist_id uuid references journalists(id),
  published_at timestamptz default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  kind text check (kind in ('rss','page')),
  selector text,
  interval_minutes int default 60,
  trusted_because text,
  enabled boolean default true,
  last_success_at timestamptz,
  last_error text
);

create table source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete cascade,
  title text, url text unique, published_at timestamptz,
  content_text text,
  embedding vector(1024)
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid references clusters(id),
  sent_to text[], sent_at timestamptz default now(),
  is_demo boolean default false
);

create table outbound_queue (              -- feedback after publish
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id),
  status text default 'pending' check (status in ('pending','sent','needs_template','failed')),
  attempts int default 0,
  last_error text
);
```

- Enable RLS on every table. Journalists can read clusters, claims (without `reply_addresses`), verdicts, sources and alerts, and can insert verdicts. Only the service role touches `reply_addresses` and `senders`.
- Seed: 3 to 6 **fictional** demo clusters (`is_demo = true`) and 5 to 8 source registry entries (official Ugandan government, regulator and media sites). Check each site's `robots.txt` and terms before enabling it.
- Velocity: `rising` when `report_count >= RISING_THRESHOLD` and the last hour's count exceeds the previous hour's.

---

## 8. Engine: stage by stage

All stages live in `engine/` as pure functions with injected adapters, so they can be tested with mocks.

1. **Intake** (`whatsapp-webhook.ts`)
   - `POST` only. Green API sends `Authorization: Bearer <GREENAPI_WEBHOOK_TOKEN>` (set as webhookUrlToken in the console); compare in constant time and reject on mismatch. Handle only `incomingMessageReceived` from one-to-one chats (`@c.us`); ignore groups, our own outgoing messages and status callbacks. Return `200` immediately, then trigger `process-message-background`.
   - Handle keywords: STOP, DELETE, MYDATA, and 1/2/3 for the language choice. On first contact, send the consent line and the language menu.
2. **Normalise**
   - Text: detect the language. Translate to English with Sunbird (`POST https://api.sunbird.ai/tasks/translate`, body `{source_language, target_language, text}`, codes `eng|lug|swa`). Bearer token from `/auth/token` expires every 7 days, so cache and refresh it.
   - Image: download from the `fileMessageData.downloadUrl` in the Green API webhook (HTTPS only). Google Cloud Vision extracts the visible text; the LLM then pulls out any post author/handle/date and the claim. Compute pHash.
   - Run `privacy.redact()` on all text before it leaves for any external API.
   - The LLM extracts **one checkable claim** (prompt `extract.system.md`).
3. **Quick check (target < 5 s)**
   - Embed the English claim and find the nearest cluster. If similarity ≥ `CLUSTER_SIMILARITY`, attach to it and increment counts.
   - If that cluster has a published verdict → reply with it immediately (stage 6). Done.
   - Also query Google Fact Check Tools: `GET https://factchecktools.googleapis.com/v1alpha1/claims:search?query=…&languageCode=en&key=…`.
4. **Evidence** (in parallel, timeouts of 6 s each)
   - `source_items` semantic search across the official-source registry.
   - Brave Search: `GET https://api.search.brave.com/res/v1/web/search?q=…`, header `X-Subscription-Token`.
   - Image: pHash match against previous claims, plus generated reverse-search links (Google Lens, TinEye, Yandex) for journalists.
   - Each evidence item: `{id, kind: 'official'|'factcheck'|'web'|'image', title, url, snippet, published_at}`.
5. **Assessment** (LLM adapter, `assess.system.md`, temperature 0, strict JSON). See section 9.
6. **Reply**
   - Build `reply_text` in English, then translate to the user's language with Sunbird. Keep it under 600 characters, with one source link.
   - Send a text through Green API: `POST {GREENAPI_URL}/waInstance{GREENAPI_ID_INSTANCE}/sendMessage/{GREENAPI_API_TOKEN_INSTANCE}` with `{chatId: "<digits>@c.us", message}`. Green API has no 24-hour window.
   - For `under_investigation`: "Received. Our check so far suggests [label]. A fact-checker is reviewing it. Ticket #XXXX."
7. **Newsroom case:** set the claim status to `queued`. Realtime pushes it to the dashboard. If the cluster just crossed the threshold, send the rising-claim email (branded Sherlock HTML template) and log it in `alerts`.
8. **Publish and feedback** (`publish-verdict.ts`, journalist JWT required)
   - Save the verdict, translate the explanation to Luganda and Kiswahili, and add every claim in the cluster to `outbound_queue`.
   - For each claim: decrypt the reply address in the function only, send in the user's language, and mark it `sent`. `needs_template` applies only to providers with a reply window (Meta); with Green API it is not used, but the status is kept for a later move to Meta.
   - Update the cluster status to `published` and add it to the verified library.

**Latency targets:** instant reply in under 30 s for new claims and under 5 s for library hits.

---

## 9. LLM contract

`engine/prompts/assess.system.md` must enforce:

- **Role:** a careful fact-checking assistant for East African audiences. It assists journalists; it does not replace them.
- **Input:** `claim_en`, `original_language`, `evidence[]` (with IDs), `image_context?`.
- **Output:** JSON only, validated with Zod. On a parse failure, retry once, then fall back to `under_investigation`.

```json
{
  "label": "likely_false | likely_true | missing_context | under_investigation | unverified",
  "confidence": 0.0,
  "evidence_ids": ["e1", "e3"],
  "disorder_hint": "disinformation | misinformation | malinformation | none | unknown",
  "rationale": "two sentences max, for journalists",
  "reply_text": "plain English, under 400 characters, hedged, for the citizen",
  "missing_evidence": "what would settle it"
}
```

- **Rules:**
  - No evidence IDs means `under_investigation`.
  - Never say "fake", "lie" or "hoax" in `reply_text`. Use "the evidence we found suggests…".
  - Never attribute intent to the sender.
  - Never repeat personal data.
  - Confidence below `CONFIDENCE_THRESHOLD` (default 0.75) means the case is queued for a journalist.
- **Settings:** temperature 0, max_tokens ~600, JSON mode where the provider supports it. Free tiers have daily request caps: cache results per claim, and fall back to `under_investigation` with a clear message when the cap is hit.
- **No fine-tuning** for now. Accuracy comes from retrieval and the rules above. Log every assessment and verdict pair so a classifier can be trained later.

---

## 10. Demo script (must work end to end)

1. A judge (one of the chats allowed on the Green API free plan) sends a **Luganda** message on WhatsApp claiming that Monday is a public holiday (fictional demo claim).
2. Within ~30 s they get a Luganda reply: received, under investigation, ticket number.
3. On the dashboard, the claim appears live. The presenter presses **Simulate spread (demo)** and the cluster climbs from 1 to 100 with a green ▲. A branded "Rising claim" email reaches the demo journalist inbox.
4. The demo journalist (fictional: "Demo Reporter, Sample Newsroom") opens the case, reviews the evidence, picks **Likely false**, writes an explanation, adds the fictional ministry notice URL and presses **Publish**.
5. The judge's phone receives the verdict **in Luganda** within seconds.
6. The presenter opens the Claims database to show that the sender appears only as a hash.

Provide `npm run demo:reset` to restore seed data.

---

## 11. Environment variables (`.env.example`)

```
# App
DEMO_MODE=true
RISING_THRESHOLD=20
CONFIDENCE_THRESHOLD=0.75
CLUSTER_SIMILARITY=0.86
VITE_WHATSAPP_NUMBER=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Privacy
PHONE_HASH_SECRET=
REPLY_ADDRESS_KEY=            # 32 bytes, base64

# WhatsApp through Green API (console.green-api.com)
GREENAPI_URL=                 # apiUrl shown on your instance, e.g. https://7103.api.greenapi.com
GREENAPI_ID_INSTANCE=
GREENAPI_API_TOKEN_INSTANCE=
GREENAPI_WEBHOOK_TOKEN=       # random string; also set as webhookUrlToken in the console

# AI and search (zero-budget defaults)
LLM_CHAT_URL=https://api.groq.com/openai/v1/chat/completions
LLM_API_KEY=
LLM_MODEL=                    # pick from Groq's current model list
GOOGLE_VISION_API_KEY=
SUNBIRD_USERNAME=
SUNBIRD_PASSWORD=
GOOGLE_FACTCHECK_API_KEY=
BRAVE_SEARCH_API_KEY=

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_APP_PASSWORD=
ALERT_FROM_NAME=Sherlock
```

---

## 12. Build order (milestones with acceptance checks)

Work in this order. After each milestone, run the app, take screenshots, fix what you see, and commit.

1. **Foundation:** repo layout, tokens, components (Button, Card, Pill, Kpi, Table, Drawer, Toast, Navbar, Footer), React Router, Supabase schema and seed. *Done when:* `npm run build` passes, and seeded data shows on `/newsroom` with no console errors.
2. **Public site:** `/`, `/check` (UI only), `/pricing`, `/team`, `/terms`, `/privacy`. *Done when:* every route renders at 360px and 1440px, and AA contrast passes.
3. **Newsroom dashboard:** Overview, Claims database, Claim detail, Library, Sources, Alerts, Settings, Realtime updates, simulate control. *Done when:* simulate drives 1 → 100 with a green arrow, publish moves a case to the library, all live.
4. **Engine core with fallbacks:** stages 2–6 behind adapters, canned mode, Vitest tests for privacy, cluster, assess-parsing and reply formatting. *Done when:* `/check` returns an assessment for text and an image in demo mode.
5. **Real adapters:** Sunbird, LLM (Groq), Vision, Fact Check, Brave, scraper. *Done when:* a real English and a real Luganda claim produce cited evidence.
6. **WhatsApp (Green API):** webhook token check, receive, reply, consent and keywords. *Done when:* the demo script steps 1–2 work on the linked demo number.
7. **Publish loop and email:** stages 7–8, outbound queue, Gmail alert email. *Done when:* demo script steps 3–5 work end to end.
8. **Polish and rehearsal:** loading and empty states, error toasts, `demo:reset`, Playwright test of the demo script, and a recorded backup video.

---

## 13. Engineering standards

- TypeScript `strict`. No `any` in `engine/`.
- Validate all external input with Zod: webhooks, API responses and LLM output.
- Timeouts on every network call. Retries with backoff only for idempotent calls.
- Structured logs (`stage`, `claim_id`, `duration_ms`). Never log phone numbers, tokens or decrypted addresses.
- Small, focused commits with clear messages.
- Before saying a task is done: run the build, the tests and the app, and look at the result.

## 14. Things to ask the team, not guess

- Final logo files (SVG), team photos, the exact source registry list, and the demo claim wording.
- The Green API instance (ID, API token, apiUrl), the dedicated demo phone number, and which judges' numbers will chat with it.
- Whether Sunbird has usage costs or limits for the hackathon.
- Any change to the revenue model or the pricing copy.

---

## 15. Current state (read this first in a new session)

Updated 29 Oct 2026.

**Decisions already made**
- WhatsApp: **Green API** free Developer plan with a dedicated demo number (team decision, 29 Oct 2026; supersedes the earlier Meta test-number decision). Move to Meta's Cloud API with a branded number after business registration.
- Budget is **zero**. Use free tiers only: Groq for the LLM, Sunbird, Google Fact Check, Google Cloud Vision (free units), Brave (free credit), Supabase, Netlify, Gmail SMTP.
- Revenue model: citizens free; newsroom subscription; platform and research data licence (aggregated only). No grants for now.
- Design: `docs/DESIGN.md` (Slack structure) with the logo palette. No gradients. Hero uses `public/hero-journalism.jpg` with a flat dark overlay. The team found the first prototype "too basic": aim for a richer, professional layout using `docs/references/`.

**Accounts ready:** Supabase, Netlify, Sunbird AI, Google Cloud, Brave Search, Gmail.
**Still pending:** Green API instance and linked demo phone; Gmail app password; Groq API key; Vision API enabled; logo as SVG; team photos; source list; demo claim in Luganda.

**Code that exists (prototype, to be replaced or extended):**
- `src/pages/Landing.tsx`: navbar, image hero, three steps, pricing cards, team placeholder, footer.
- `src/pages/Newsroom.tsx`: KPI tiles, rising-claims list with sparklines, simulate 1→100, verdict buttons. All local state, no database.
- `src/data.ts`: fictional seed claims. `src/config.ts`: WhatsApp number placeholder, rising threshold.
- Hash routing (`#/`, `#/newsroom`). Replace with React Router per section 4.

**Next action:** start Milestone 1, reusing the prototype's tokens and components where they fit.

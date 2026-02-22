# HN Daily Digest

Top 20 Hacker News stories every day — 300-word summaries, highlights, and comment sentiment analysis — published automatically as a GitHub Pages site.

**Live site:** `https://<your-username>.github.io/<repo-name>/`

---

## Setup (2 steps, ~2 minutes)

### Step 1 — Fork or create this repo on GitHub

Push all files to the `main` branch of a **public** GitHub repository.  
*(Public repos get free GitHub Pages and free Actions minutes.)*

### Step 2 — Add your Anthropic API key

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-…` |

That's it. GitHub Actions will handle everything else automatically.

---

## What happens next

1. **Go to Actions → Daily HN Digest → Run workflow** to trigger the first run.
2. The workflow detects an empty manifest and **auto-backfills the last 7 days** before generating today's digest.
3. GitHub Pages is **auto-configured** by the workflow — no manual Pages settings needed.
4. From day 2 onward, the digest runs **automatically every morning at 08:00 UTC**.

Your site will be live at:  
`https://<your-username>.github.io/<repo-name>/`

---

## How it works

```
Algolia HN Search API  ─┐
HN Firebase API        ─┼──▶  generate_daily.py  ──▶  site/YYYY-MM-DD.html
Claude Code CLI        ─┘                               site/index.html
  (claude-sonnet-4-6)                                   site/manifest.json
                                   │
                         GitHub Actions (daily cron)
                                   │
                         git commit → main branch
                                   │
                         actions/deploy-pages
                                   │
                           GitHub Pages (live)
```

**Story pipeline per story:**
1. Algolia returns top-N stories filtered by date + ranking
2. Article URL is fetched and stripped to plain text (~10K chars)
3. Top 30 HN comment threads (+ 3 replies each) fetched from Firebase
4. `claude -p "…" --model claude-sonnet-4-6 --output-format json` produces:
   - 3 summary paragraphs (300+ words total)
   - A pull-quote / key highlight
   - 5 key bullet points
   - 3–5 sentiment clusters with estimated agreement counts
   - Topic category (AI Fundamentals / AI Applications / Politics / Others)
5. Static HTML built and written to `site/`

---

## Sentiment analysis — how the "~XX users" count works

The estimate is based on **real comment data**, not guesswork:

1. The top 30 parent comments are fetched with `score` (upvote count) and reply counts.
2. Claude receives the full comment text plus metadata.
3. Claude is instructed to group comments into opinion clusters **from the actual text**, citing specific phrasing, then estimate the cluster size from the **relative distribution of upvote scores and reply volume**.

Example input given to Claude:
```
[throwaway_dev score=148]: The exoskeleton metaphor is elegant but breaks
down — exoskeletons have deterministic mechanics; LLMs have probabilistic
outputs. Failure modes are categorically different.
  ↳ [pmarca_fan]: Agreed — "co-pilot" handles this better since it has a
    built-in override assumption baked in.

[bengregory score=92]: This is exactly what the seam-visibility section
covers — each micro-agent has clear I/O so failures are diagnosable.
```

Claude then returns `"estimated_agreement": "~52 users"` by reasoning: *comment score 148 is the highest in this thread; if it represents ~30% of engaged commenters, the cluster is roughly 50 users.*

> **Caveat:** This is a reasoned estimate, not a literal count. HN per-comment scores are not exposed in the Firebase API at the same granularity as post scores. Treat "~XX users" as *"this view had meaningful upvote support"* rather than a precise head-count.

---

## Local usage

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Install Python deps
pip install -r requirements.txt

# Set your key
export ANTHROPIC_API_KEY=sk-ant-…

# Generate yesterday's digest
python generate_daily.py

# Specific date + ranking
python generate_daily.py --date 2026-02-20 --ranking top

# Open in browser
open site/index.html
```

---

## Manual backfill

Trigger the workflow manually with **backfill_days = 30** to generate the last 30 days at once.  
Each day costs ~$0.30–0.50 with `claude-sonnet-4-6` (20 stories × ~2 500 output tokens).

---

## Customisation

| What to change | Where |
|----------------|-------|
| Number of stories | `--stories` arg or workflow input |
| Model | `CLAUDE_MODEL` constant in `generate_daily.py` |
| Run time | `cron:` in `.github/workflows/daily.yml` |
| Page styling | `PAGE_CSS` constant in `generate_daily.py` |
| Summary depth / prompt | `analyze_story()` in `generate_daily.py` |

---

## File structure

```
.
├── generate_daily.py          # main pipeline (fetch → analyse → render)
├── requirements.txt           # only: requests
├── .gitignore
├── .github/
│   └── workflows/
│       └── daily.yml          # GitHub Actions — daily cron + Pages deploy
└── site/                      # generated output (served by Pages)
    ├── .nojekyll              # disables Jekyll processing
    ├── index.html             # calendar landing page (auto-generated)
    ├── manifest.json          # index of all available reports
    ├── 2026-02-20.html        # daily report (best = no suffix)
    ├── 2026-02-20-top.html    # same day, different ranking
    └── …
```

---

## License

MIT

# HN Daily Digest

> Top 20 Hacker News stories every day — with 300-word summaries, highlights, and comment sentiment analysis — published automatically as a GitHub Pages site.

**Live site:** `https://<your-username>.github.io/<repo-name>/`

---

## How It Works

```
Algolia HN Search API  ──┐
HN Firebase API        ──┼──▶  generate_daily.py  ──▶  site/YYYY-MM-DD.html
Anthropic Claude API   ──┘                              site/index.html
                                                        site/manifest.json
                                     ▼
                              GitHub Actions (daily cron)
                                     ▼
                              git push → GitHub Pages
```

1. **Story discovery** — Algolia's HN Search API (`hn.algolia.com`) returns the day's most-upvoted stories filtered by date.
2. **Article fetching** — each story's URL is downloaded and stripped to plain text.
3. **Comment fetching** — top 30 comment threads (with replies) pulled from `hacker-news.firebaseio.com`.
4. **Claude analysis** — for each story, Claude receives the article text + comment threads and returns:
   - 3 summary paragraphs (300+ words total)
   - A highlight / key insight
   - 5 key bullet points
   - 3–5 sentiment clusters with estimated agreement counts
   - Topic category (AI Fundamentals / AI Applications / Politics / Others)
5. **HTML generation** — styled static HTML written to `site/`, index and manifest updated.
6. **Deploy** — GitHub Actions commits and pushes; GitHub Pages serves everything.

---

## Quick Start

### 1. Fork / clone this repo

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
```

### 2. Add your Anthropic API key as a secret

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-…` |

### 3. Enable GitHub Pages

Repo → **Settings → Pages → Source: Deploy from a branch → Branch: `main` / folder: `/site`**

*(You can also use the `gh-pages` branch if you prefer; update the workflow accordingly.)*

### 4. Run it manually for the first time

GitHub repo → **Actions → Daily HN Digest → Run workflow**

This generates yesterday's report and pushes it. After that, it runs automatically every day at 08:00 UTC.

---

## Local Usage

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-…

# Yesterday (default)
python generate_daily.py

# Specific date
python generate_daily.py --date 2026-02-20

# Different ranking
python generate_daily.py --date 2026-02-20 --ranking top

# Available rankings: best | top | new | ask | show
```

Output is written to `site/`.

---

## Sentiment Analysis — How It Works

The sentiment analysis is **based on actual HN comment text**, not guesswork:

1. The script fetches the top 30 parent comments + up to 3 replies each via the Firebase API.
2. Claude receives the full comment text (truncated to 500 chars per comment) plus metadata (author, score).
3. Claude is instructed to:
   - Identify distinct opinion clusters in the actual comments
   - Quote or paraphrase specific things commenters said
   - Estimate how many commenters fall into each cluster based on comment **upvote scores** and **reply volume** (not the total comment count, which includes low-vote comments)

**Example prompt excerpt sent to Claude:**
```
[throwaway_dev score=148]: The exoskeleton metaphor is elegant but breaks
down — exoskeletons have deterministic mechanics, LLMs have probabilistic
outputs. The failure modes are categorically different.
  ↳ [pmarca_fan]: Agreed — a co-pilot framing handles this better since
    it has a built-in override assumption.
[bengregory score=92]: This is exactly the point I was trying to make
in the article — the seam visibility section covers exactly this concern.
```

Claude then groups comments by position and estimates: *"~52 users expressed this concern"* by reasoning from the upvote distribution visible in the thread.

**Important caveat:** The "~XX users" figure is a **reasoned estimate**, not a literal count. HN comment scores aren't publicly exposed per-comment in the same way post scores are, so Claude infers from relative upvote signals and reply engagement. Think of it as: *"this cluster of opinion had significant upvote support"* rather than a precise head count.

---

## File Structure

```
.
├── generate_daily.py          # main pipeline script
├── requirements.txt
├── .github/
│   └── workflows/
│       └── daily.yml          # GitHub Actions workflow
└── site/                      # generated output (served by Pages)
    ├── index.html             # calendar landing page
    ├── manifest.json          # list of all available reports
    ├── 2026-02-20.html        # daily reports (best ranking = no suffix)
    ├── 2026-02-20-top.html    # same day, different ranking
    └── …
```

---

## Costs

Each daily run makes approximately:
- **20 Claude API calls** (one per story) at ~2,500 output tokens each
- Model: `claude-opus-4-6`
- Approximate cost per day: **~$3–6 USD** depending on article lengths

To reduce cost, switch `MODEL` in `generate_daily.py` to `claude-sonnet-4-6` (~10× cheaper, still excellent quality).

---

## Customisation

| What | Where |
|------|-------|
| Number of stories | `--stories` arg or `workflow_dispatch` input |
| Model | `MODEL` constant in `generate_daily.py` |
| Cron schedule | `cron:` in `.github/workflows/daily.yml` |
| Page styling | `PAGE_CSS` constant in `generate_daily.py` |
| Summary depth | Edit the Claude prompt in `analyze_story()` |

---

## License

MIT

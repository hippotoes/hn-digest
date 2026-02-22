#!/usr/bin/env python3
"""
HN Daily Digest Generator
─────────────────────────
Fetches top HN stories for a given date via Algolia's HN Search API,
enriches each story with the full article text + HN comments via the
official Firebase API, then calls Claude to produce:
  • 300+ word article summary with highlights
  • Sentiment table with estimated agreement counts
  • Topic categorisation (AI Fundamentals / AI Applications / Politics / Others)

Usage:
  python generate_daily.py                      # yesterday, best ranking
  python generate_daily.py --date 2026-02-20    # specific date
  python generate_daily.py --ranking top        # ranking: top|best|new|ask|show
  python generate_daily.py --stories 20         # number of stories (default 20)
"""

import os, sys, re, json, time, argparse, textwrap, requests
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from html import escape
import anthropic

# ── Configuration ─────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
MODEL  = "claude-opus-4-6"

HN_FIREBASE  = "https://hacker-news.firebaseio.com/v0"
HN_ALGOLIA   = "https://hn.algolia.com/api/v1/search"

RANKING_TAGS = {
    "top":  "front_page",
    "best": "front_page",   # algolia doesn't distinguish; sort by points
    "new":  "story",
    "ask":  "ask_hn",
    "show": "show_hn",
}

OUTPUT_DIR   = Path("site")
OUTPUT_DIR.mkdir(exist_ok=True)
MANIFEST     = OUTPUT_DIR / "manifest.json"


# ── HN Data Fetching ──────────────────────────────────────────────────────────

def get_stories_for_date(target: date, n: int = 20, ranking: str = "best") -> list:
    """Get top-n HN stories for a given calendar date via Algolia."""
    start = int(datetime(target.year, target.month, target.day, 0, 0, 0,
                          tzinfo=timezone.utc).timestamp())
    end   = start + 86400

    params = {
        "tags":           RANKING_TAGS.get(ranking, "front_page"),
        "numericFilters": f"created_at_i>{start},created_at_i<{end}",
        "hitsPerPage":    n * 2,   # fetch extra, then trim after dedup
    }
    resp = requests.get(HN_ALGOLIA, params=params, timeout=20)
    resp.raise_for_status()
    hits = resp.json().get("hits", [])

    seen = set()
    deduped = []
    for h in hits:
        oid = h.get("objectID")
        if oid and oid not in seen:
            seen.add(oid)
            deduped.append(h)

    deduped.sort(key=lambda h: h.get("points", 0), reverse=True)
    return deduped[:n]


def get_hn_item(item_id: int) -> dict:
    try:
        r = requests.get(f"{HN_FIREBASE}/item/{item_id}.json", timeout=10)
        return r.json() or {}
    except Exception:
        return {}


def get_top_comments(item_id: int, max_top: int = 30, max_replies: int = 3) -> list:
    """Fetch top-level HN comments + shallow replies for sentiment input."""
    item   = get_hn_item(item_id)
    kids   = (item.get("kids") or [])[:max_top]
    result = []

    for kid_id in kids:
        c = get_hn_item(kid_id)
        if not c or c.get("dead") or c.get("deleted") or not c.get("text"):
            continue

        entry = {
            "author":  c.get("by", ""),
            "text":    c.get("text", ""),
            "score":   c.get("score", 0),
            "replies": [],
        }

        for r_id in (c.get("kids") or [])[:max_replies]:
            rep = get_hn_item(r_id)
            if rep and not rep.get("dead") and not rep.get("deleted") and rep.get("text"):
                entry["replies"].append({"author": rep.get("by",""), "text": rep.get("text","")})

        result.append(entry)

    return result


def fetch_article(url: str, max_chars: int = 10_000) -> str:
    """Download & strip HTML from an article URL."""
    if not url:
        return "[No URL provided]"
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; HNDigest/1.0)"}
        r = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        r.raise_for_status()
        text = r.text
        text = re.sub(r'<script[^>]*>.*?</script>', ' ', text, flags=re.DOTALL | re.I)
        text = re.sub(r'<style[^>]*>.*?</style>',  ' ', text, flags=re.DOTALL | re.I)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text[:max_chars]
    except Exception as e:
        return f"[Article fetch failed: {e}]"


# ── Claude Analysis ───────────────────────────────────────────────────────────

ANALYSIS_SCHEMA = """{
  "topic_category": "AI Fundamentals|AI Applications|Politics|Others",
  "summary_paragraphs": [
    "<paragraph 1: 100-150 words — core story, context, why it was submitted>",
    "<paragraph 2: 100-150 words — key data, quotes, technical or policy details>",
    "<paragraph 3:  80-100 words — why the HN/tech community cares>"
  ],
  "highlight": "<1-2 sentence compelling stat, quote, or insight from the article>",
  "key_points": [
    "<point 1>",
    "<point 2>",
    "<point 3>",
    "<point 4>",
    "<point 5>"
  ],
  "sentiments": [
    {
      "label":                "<2-4 word sentiment label>",
      "type":                 "positive|negative|mixed|neutral|debate",
      "description":          "<~100 words describing this cohort's view, with specific examples from comments>",
      "estimated_agreement":  "<~XX users>"
    }
  ]
}"""


def analyze_story(story: dict, article: str, comments: list) -> dict:
    """Ask Claude to produce a structured analysis of one HN story."""

    comments_block = "\n\n".join(
        f"[{c['author']} score={c.get('score',0)}]: {c['text'][:500]}"
        + "".join(f"\n  ↳ [{r['author']}]: {r['text'][:250]}" for r in c['replies'][:2])
        for c in comments[:25]
    ) or "[No comments fetched]"

    prompt = textwrap.dedent(f"""
        You are writing a daily tech digest for a sophisticated engineering audience.
        Analyse the following Hacker News story thoroughly.

        ──── STORY METADATA ────
        Title    : {story.get('title','')}
        URL      : {story.get('url','')}
        Points   : {story.get('points',0)}
        Comments : {story.get('num_comments',0)}
        Author   : {story.get('author','')}

        ──── ARTICLE TEXT (truncated to 10k chars) ────
        {article}

        ──── HN COMMENTS (top threads with shallow replies) ────
        {comments_block}

        ──── INSTRUCTIONS ────
        • summary_paragraphs: each must be >80 words.
        • highlight: a memorable insight or direct quote from the article.
        • sentiments: identify 3-5 distinct opinion clusters from the ACTUAL comments.
          For each cluster state what specific users said, not generalities.
          estimated_agreement = rough number of commenters you'd assign to this cluster,
          based on upvotes and reply volume visible in the comments block.
          If comments are sparse, note that and reason from the article topic and
          known HN community patterns.
        • topic_category must be exactly one of the four strings.

        Return ONLY valid JSON matching this schema (no markdown fences):
        {ANALYSIS_SCHEMA}
    """).strip()

    resp = claude.messages.create(
        model=MODEL,
        max_tokens=2800,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = resp.content[0].text.strip()

    # Graceful JSON extraction
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r'\{[\s\S]*\}', raw)
        if m:
            return json.loads(m.group())
        raise


# ── HTML Building Blocks ──────────────────────────────────────────────────────

SENT_CLASS = {
    "positive": "sent-positive",
    "negative": "sent-negative",
    "mixed":    "sent-mixed",
    "neutral":  "sent-neutral",
    "debate":   "sent-debate",
}

BADGE_CLASS = {
    "AI Fundamentals": "badge-ai-fund",
    "AI Applications": "badge-ai-app",
    "Politics":        "badge-pol",
    "Others":          "badge-others",
}

SECTION_ID = {
    "AI Fundamentals": "ai-fund",
    "AI Applications": "ai-app",
    "Politics":        "politics",
    "Others":          "others",
}


def story_card_html(rank: int, story: dict) -> str:
    a    = story.get("analysis", {})
    title     = escape(story.get("title", ""))
    url       = escape(story.get("url", "#"))
    pts       = story.get("points", 0)
    ncmts     = story.get("num_comments", 0)
    hn_id     = story.get("objectID") or story.get("story_id", "")
    paras     = a.get("summary_paragraphs", ["No summary."])
    highlight = a.get("highlight", "")
    kps       = a.get("key_points", [])
    sents     = a.get("sentiments", [])

    para_html = "".join(f"<p>{escape(p)}</p>" for p in paras)

    hl_html = (
        f'<div class="highlight-box"><p>{escape(highlight)}</p></div>'
        if highlight else ""
    )

    kp_html = ""
    if kps:
        items = "".join(f"<li>{escape(k)}</li>" for k in kps)
        kp_html = (
            f'<div class="key-points">'
            f'<div class="key-points-title">Key Highlights</div>'
            f'<ul>{items}</ul></div>'
        )

    rows = ""
    for s in sents:
        rc = SENT_CLASS.get(s.get("type", "neutral"), "sent-neutral")
        rows += (
            f'<tr class="{rc}">'
            f'<td>{escape(s.get("label",""))}</td>'
            f'<td>{escape(s.get("description",""))}</td>'
            f'<td><div class="vote-bar">'
            f'<span class="vote-count">{escape(str(s.get("estimated_agreement","")))}</span>'
            f'</div></td></tr>'
        )

    sent_html = ""
    if rows:
        sent_html = (
            f'<div class="sentiment-section">'
            f'<div class="sentiment-title">Comment Sentiment Analysis — {ncmts} comments</div>'
            f'<table class="sentiment-table">'
            f'<thead><tr><th>Sentiment</th><th>Community View</th><th>Approx. Agree</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div>'
        )

    return f"""
<div class="story-card">
  <div class="story-header">
    <div class="story-title-wrap">
      <div class="story-num">#{rank}</div>
      <div class="story-title"><a href="{url}" target="_blank" rel="noopener">{title}</a></div>
      <div class="story-meta">
        <span class="meta-pill">⬆ <span>{pts}</span> pts</span>
        <span class="meta-pill">💬 <a href="https://news.ycombinator.com/item?id={hn_id}"
              target="_blank" rel="noopener"><span>{ncmts}</span> comments on HN</a></span>
      </div>
    </div>
  </div>
  <div class="story-body">
    <div class="story-summary">{para_html}{hl_html}{kp_html}</div>
    {sent_html}
  </div>
</div>"""


def others_table_html(stories: list) -> str:
    rows = ""
    for rank, story in stories:
        a     = story.get("analysis", {})
        title = escape(story.get("title",""))
        url   = escape(story.get("url","#"))
        pts   = story.get("points",0)
        ncmts = story.get("num_comments",0)
        hn_id = story.get("objectID","")
        para  = (a.get("summary_paragraphs") or [""])[0]
        para  = escape(para[:200] + "…" if len(para) > 200 else para)
        rows += (
            f"<tr><td><span class='rank-num'>#{rank}</span></td>"
            f"<td><a href='{url}' target='_blank'>{title}</a></td>"
            f"<td><span class='pts-mono'>{pts}</span></td>"
            f"<td><a href='https://news.ycombinator.com/item?id={hn_id}' target='_blank'>"
            f"<span class='cmts-mono'>{ncmts}</span></a></td>"
            f"<td>{para}</td></tr>"
        )
    return f"""
<div class="story-card">
  <div class="story-body" style="padding:18px 26px;">
    <p style="font-size:14px;color:var(--text-dim);margin-bottom:18px;">
      Stories outside the main AI / Politics focus — concise reference table.
    </p>
    <div class="others-table-wrap">
      <table class="others-table">
        <thead><tr><th>#</th><th>Story</th><th>Pts</th><th>Cmts</th><th>Summary</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  </div>
</div>"""


# ── Full Page Template ────────────────────────────────────────────────────────

PAGE_CSS = """
:root{--bg:#0f0e0c;--bg2:#181613;--bg3:#211f1b;--surface:#242119;--border:#332f28;
--amber:#d4a017;--amber-light:#f0bf4c;--amber-dim:rgba(212,160,23,.12);
--text:#e8e2d6;--text-dim:#9c9285;--text-muted:#5a5446;
--red:#c45c3a;--green:#5a9e6f;--blue:#4a8ab5;--purple:#8a6bbf;}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'Source Serif 4',Georgia,serif;font-size:16px;line-height:1.7}
a{color:inherit;text-decoration:none}
a:hover{opacity:.75}
.masthead{border-bottom:1px solid var(--border);padding:28px 0 20px;text-align:center;background:var(--bg2);position:relative;overflow:hidden}
.masthead::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(212,160,23,.07) 0%,transparent 70%);pointer-events:none}
.masthead-sub{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.3em;color:var(--amber);text-transform:uppercase;margin-bottom:10px}
.masthead h1{font-family:'Playfair Display',serif;font-size:clamp(2rem,5vw,3.8rem);font-weight:900;letter-spacing:-.02em;color:var(--text);line-height:1}
.masthead h1 span{color:var(--amber)}
.masthead-date{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.15em;color:var(--text-dim);margin-top:10px}
.masthead-rule{width:60px;height:2px;background:var(--amber);margin:14px auto 0}
/* Controls bar */
.controls{background:var(--bg3);border-bottom:1px solid var(--border);padding:10px 0;position:sticky;top:0;z-index:100}
.controls-inner{max-width:1100px;margin:0 auto;padding:0 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.ctrl-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.2em;color:var(--text-muted);text-transform:uppercase;white-space:nowrap}
.ctrl-select{font-family:'DM Mono',monospace;font-size:12px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 10px;cursor:pointer;outline:none}
.ctrl-select:hover{border-color:var(--amber)}
.toc-sep{flex:1}
.toc a{font-family:'DM Mono',monospace;font-size:11px;padding:4px 10px;border-radius:3px;transition:opacity .15s}
.toc a.ai-fund{color:#e87a5a;border:1px solid rgba(196,92,58,.3)}
.toc a.ai-app{color:#7ec890;border:1px solid rgba(90,158,111,.3)}
.toc a.pol{color:#7ab8e0;border:1px solid rgba(74,138,181,.3)}
.toc a.others{color:var(--text-dim);border:1px solid var(--border)}
.toc a:hover{opacity:.7}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.section-header{display:flex;align-items:center;gap:16px;margin:48px 0 24px}
.section-badge{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;letter-spacing:.25em;text-transform:uppercase;padding:5px 14px;border-radius:3px;white-space:nowrap}
.badge-ai-fund{background:rgba(196,92,58,.15);color:#e87a5a;border:1px solid rgba(196,92,58,.3)}
.badge-ai-app{background:rgba(90,158,111,.15);color:#7ec890;border:1px solid rgba(90,158,111,.3)}
.badge-pol{background:rgba(74,138,181,.15);color:#7ab8e0;border:1px solid rgba(74,138,181,.3)}
.badge-others{background:rgba(122,106,90,.12);color:var(--text-dim);border:1px solid var(--border)}
.section-line{flex:1;height:1px;background:var(--border)}
.story-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;margin-bottom:28px;overflow:hidden;transition:border-color .2s}
.story-card:hover{border-color:rgba(212,160,23,.3)}
.story-header{padding:22px 26px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.story-title-wrap{flex:1}
.story-num{font-family:'DM Mono',monospace;font-size:11px;color:var(--amber);letter-spacing:.1em;margin-bottom:6px}
.story-title{font-family:'Playfair Display',serif;font-size:1.25rem;font-weight:700;line-height:1.3;color:var(--text)}
.story-title a{color:inherit}
.story-meta{display:flex;gap:12px;margin-top:8px;flex-wrap:wrap}
.meta-pill{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.05em;color:var(--text-dim)}
.meta-pill span{color:var(--amber-light)}
.story-body{padding:20px 26px}
.story-summary p{margin-bottom:14px;font-size:15px;color:#d0c9bc;font-weight:300}
.story-summary p:last-child{margin-bottom:0}
.highlight-box{margin:16px 0;padding:14px 18px;background:var(--amber-dim);border-left:3px solid var(--amber);border-radius:0 4px 4px 0}
.highlight-box p{font-size:14px!important;font-style:italic;color:var(--amber-light)!important;margin:0!important}
.key-points{margin:16px 0}
.key-points-title{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px}
.key-points ul{list-style:none;padding:0}
.key-points ul li{font-size:14px;color:#c8c0b0;padding:3px 0 3px 18px;position:relative;font-weight:300}
.key-points ul li::before{content:'▸';position:absolute;left:0;color:var(--amber);font-size:12px}
.sentiment-section{margin-top:20px;border-top:1px solid var(--border);padding-top:18px}
.sentiment-title{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px}
.sentiment-table{width:100%;border-collapse:collapse;font-size:13.5px}
.sentiment-table thead tr{border-bottom:1px solid var(--border)}
.sentiment-table thead th{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--text-muted);padding:6px 12px 8px;text-align:left;font-weight:400}
.sentiment-table thead th:last-child{text-align:right}
.sentiment-table tbody tr{border-bottom:1px solid rgba(51,47,40,.5)}
.sentiment-table tbody tr:last-child{border-bottom:none}
.sentiment-table td{padding:12px;vertical-align:top;color:#c8c0b0;font-weight:300;line-height:1.55}
.sentiment-table td:first-child{width:20%;font-family:'DM Mono',monospace;font-size:12px;padding-top:14px;color:var(--text);font-weight:500}
.sentiment-table td:last-child{width:12%;text-align:right;padding-top:14px;white-space:nowrap}
.sent-positive{border-left:2px solid var(--green)}
.sent-negative{border-left:2px solid var(--red)}
.sent-neutral{border-left:2px solid var(--text-muted)}
.sent-mixed{border-left:2px solid var(--amber)}
.sent-debate{border-left:2px solid var(--purple)}
.vote-bar{display:inline-flex;align-items:center;gap:6px}
.vote-count{font-family:'DM Mono',monospace;font-size:12px;color:var(--amber-light);font-weight:500}
.others-table-wrap{overflow-x:auto}
.others-table{width:100%;border-collapse:collapse;font-size:13px}
.others-table thead tr{background:var(--bg3);border-bottom:1px solid var(--border)}
.others-table thead th{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:9px 14px;text-align:left;font-weight:400}
.others-table tbody tr{border-bottom:1px solid var(--border)}
.others-table tbody tr:hover{background:rgba(255,255,255,.02)}
.others-table td{padding:11px 14px;vertical-align:top;color:#c0b8a8;font-weight:300;line-height:1.5}
.others-table td:first-child{font-weight:400;color:var(--text);font-size:13.5px}
.rank-num{font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted);padding-right:8px}
.pts-mono,.cmts-mono{font-family:'DM Mono',monospace;font-size:11px;white-space:nowrap}
.pts-mono{color:var(--amber-light)}
.cmts-mono{color:var(--text-dim)}
.footer{border-top:1px solid var(--border);margin-top:64px;padding:28px 0;text-align:center}
.footer p{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;color:var(--text-muted)}
@media(max-width:640px){.story-header{flex-direction:column}.controls-inner{gap:8px}}
"""

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>HN Digest · {date_iso}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>{css}</style>
</head>
<body>

<div class="masthead">
  <div class="masthead-sub">Daily Intelligence Brief</div>
  <h1>Hacker <span>News</span></h1>
  <div class="masthead-date">{date_str} · TOP {n_stories} STORIES · RANKED BY {ranking_label}</div>
  <div class="masthead-rule"></div>
</div>

<div class="controls">
  <div class="controls-inner">
    <span class="ctrl-label">Date</span>
    <select class="ctrl-select" id="dateSelect" onchange="navigateDate()">
      {date_options}
    </select>
    <span class="ctrl-label">Ranking</span>
    <select class="ctrl-select" id="rankSelect" onchange="navigateRanking()">
      {ranking_options}
    </select>
    <div class="toc-sep"></div>
    <div class="toc">
      <a href="#ai-fund" class="ai-fund">AI Fundamentals</a>
      <a href="#ai-app" class="ai-app">AI Applications</a>
      <a href="#politics" class="pol">Politics</a>
      <a href="#others" class="others">Others</a>
    </div>
  </div>
</div>

<div class="container">
{sections_html}
</div>

<div class="footer">
  <div class="container">
    <p>Data: Hacker News API &amp; Algolia HN Search · Summaries: Anthropic Claude</p>
    <p style="margin-top:6px;font-size:10px;">
      Sentiment analysis based on actual HN comment threads. Agreement estimates reflect
      comment upvote distribution and reply volume, not an exact count.
    </p>
  </div>
</div>

<script>
const MANIFEST = {manifest_json};
const TODAY_DATE = "{date_iso}";
const TODAY_RANKING = "{ranking}";

function navigateDate() {{
  const d = document.getElementById('dateSelect').value;
  const r = document.getElementById('rankSelect').value;
  const suffix = (r !== 'best') ? `-${{r}}` : '';
  const candidates = [`${{d}}${{suffix}}.html`, `${{d}}.html`];
  const available = MANIFEST.files || [];
  for (const c of candidates) {{
    if (available.includes(c)) {{ window.location.href = c; return; }}
  }}
  // fallback: try anyway
  window.location.href = candidates[0];
}}

function navigateRanking() {{
  const d = document.getElementById('dateSelect').value;
  const r = document.getElementById('rankSelect').value;
  const suffix = (r !== 'best') ? `-${{r}}` : '';
  window.location.href = `${{d}}${{suffix}}.html`;
}}
</script>
</body>
</html>"""

INDEX_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>HN Daily Digest</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900&family=Source+Serif+4:ital,wght@0,300;0,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
{css}
.calendar{{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:32px}}
.cal-entry{{background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:14px 16px;transition:border-color .2s,transform .15s;cursor:pointer}}
.cal-entry:hover{{border-color:var(--amber);transform:translateY(-2px)}}
.cal-entry a{{display:block;text-decoration:none;color:inherit}}
.cal-date{{font-family:'DM Mono',monospace;font-size:11px;color:var(--amber);letter-spacing:.1em;margin-bottom:4px}}
.cal-weekday{{font-size:13px;color:var(--text)}}
.cal-pts{{font-family:'DM Mono',monospace;font-size:10px;color:var(--text-muted);margin-top:4px}}
h2{{font-family:'Playfair Display',serif;font-size:1.4rem;font-style:italic;color:var(--text);margin-top:48px;margin-bottom:4px;padding-bottom:10px;border-bottom:1px solid var(--border)}}
.intro{{font-size:15px;color:var(--text-dim);font-weight:300;margin-top:12px;max-width:700px;line-height:1.6}}
</style>
</head>
<body>
<div class="masthead">
  <div class="masthead-sub">Daily Intelligence Brief</div>
  <h1>Hacker <span>News</span></h1>
  <div class="masthead-date">DIGEST ARCHIVE — AI &amp; TECH SUMMARIES</div>
  <div class="masthead-rule"></div>
</div>
<div class="container" style="padding-top:40px;padding-bottom:80px">
  <p class="intro">
    Each day's top 20 Hacker News stories — with 300-word article summaries, key highlights,
    and detailed comment sentiment analysis. Categorised into AI Fundamentals, AI Applications,
    Politics, and Others.
  </p>
  <h2>Available Reports</h2>
  <div class="calendar" id="calendar"></div>
</div>
<div class="footer">
  <div class="container">
    <p>Updated daily via GitHub Actions · Powered by HN API &amp; Anthropic Claude</p>
  </div>
</div>
<script>
const MANIFEST = {manifest_json};
const cal = document.getElementById('calendar');
(MANIFEST.entries || []).forEach(e => {{
  const div = document.createElement('div');
  div.className = 'cal-entry';
  const d = new Date(e.date + 'T12:00:00Z');
  const weekday = d.toLocaleDateString('en-US', {{weekday:'short', timeZone:'UTC'}});
  const pretty  = d.toLocaleDateString('en-US', {{month:'short', day:'numeric', year:'numeric', timeZone:'UTC'}});
  div.innerHTML = `<a href="${{e.file}}">
    <div class="cal-date">${{e.date}}</div>
    <div class="cal-weekday">${{weekday}} · ${{pretty}}</div>
    <div class="cal-pts">${{e.story_count}} stories · ${{e.ranking}}</div>
  </a>`;
  cal.appendChild(div);
}});
</script>
</body>
</html>"""


# ── Manifest + Index ──────────────────────────────────────────────────────────

def load_manifest() -> dict:
    if MANIFEST.exists():
        return json.loads(MANIFEST.read_text())
    return {"entries": [], "files": []}


def save_manifest(m: dict):
    MANIFEST.write_text(json.dumps(m, indent=2))


def update_manifest(target: date, filename: str, ranking: str, n: int):
    m = load_manifest()
    date_iso = target.isoformat()

    # Remove existing entry for same date+ranking
    m["entries"] = [e for e in m["entries"]
                    if not (e["date"] == date_iso and e["ranking"] == ranking)]
    m["entries"].insert(0, {
        "date":        date_iso,
        "file":        filename,
        "ranking":     ranking,
        "story_count": n,
    })
    m["entries"].sort(key=lambda e: e["date"], reverse=True)

    m["files"] = [e["file"] for e in m["entries"]]
    save_manifest(m)
    return m


def build_date_options(current_date: str, manifest: dict) -> str:
    opts = ""
    seen = set()
    for e in manifest.get("entries", []):
        d = e["date"]
        if d in seen:
            continue
        seen.add(d)
        sel = ' selected' if d == current_date else ''
        opts += f'<option value="{d}"{sel}>{d}</option>\n'
    return opts


def build_ranking_options(current: str) -> str:
    rankings = ["best", "top", "new", "ask", "show"]
    opts = ""
    for r in rankings:
        sel = ' selected' if r == current else ''
        opts += f'<option value="{r}"{sel}>{r.upper()}</option>\n'
    return opts


def regenerate_index(manifest: dict):
    html = INDEX_TEMPLATE.format(
        css=PAGE_CSS,
        manifest_json=json.dumps(manifest),
    )
    (OUTPUT_DIR / "index.html").write_text(html, encoding="utf-8")


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Generate HN Daily Digest")
    ap.add_argument("--date",     default=None,   help="YYYY-MM-DD (default: yesterday)")
    ap.add_argument("--ranking",  default="best", choices=list(RANKING_TAGS.keys()))
    ap.add_argument("--stories",  default=20, type=int)
    args = ap.parse_args()

    target = (date.fromisoformat(args.date) if args.date
              else date.today() - timedelta(days=1))

    print(f"▶ Date: {target}  Ranking: {args.ranking}  Stories: {args.stories}")

    # 1. Fetch story list
    print("  Fetching story list from Algolia…")
    stories = get_stories_for_date(target, n=args.stories, ranking=args.ranking)
    if not stories:
        print("  No stories found — exiting.")
        sys.exit(1)
    print(f"  Found {len(stories)} stories.")

    # 2. Analyze each story
    for i, story in enumerate(stories):
        title = story.get("title", "")[:70]
        print(f"  [{i+1:02}/{len(stories)}] {title}…")
        url       = story.get("url", "")
        hn_id     = story.get("objectID") or story.get("story_id")
        article   = fetch_article(url)
        comments  = get_top_comments(int(hn_id)) if hn_id else []

        try:
            story["analysis"] = analyze_story(story, article, comments)
        except Exception as e:
            print(f"         ⚠ Analysis failed: {e}")
            story["analysis"] = {
                "topic_category": "Others",
                "summary_paragraphs": [story.get("title", "Analysis unavailable.")],
                "highlight": "", "key_points": [], "sentiments": [],
            }
        time.sleep(0.5)   # gentle rate limiting

    # 3. Build HTML sections
    cats   = {"AI Fundamentals":[], "AI Applications":[], "Politics":[], "Others":[]}
    for i, s in enumerate(stories):
        cat = s.get("analysis",{}).get("topic_category","Others")
        if cat not in cats:
            cat = "Others"
        cats[cat].append((i+1, s))

    # Determine output filename
    suffix   = f"-{args.ranking}" if args.ranking != "best" else ""
    filename = f"{target.isoformat()}{suffix}.html"

    # Load manifest to build date selector
    manifest    = load_manifest()
    date_str    = target.strftime("%A, %B %d, %Y").upper()
    date_iso    = target.isoformat()

    # Temporarily add current entry so it appears in the selector
    tmp_manifest = dict(manifest)
    tmp_manifest["entries"] = [{"date": date_iso, "file": filename,
                                 "ranking": args.ranking, "story_count": len(stories)}] \
                               + [e for e in manifest.get("entries",[])
                                  if e["date"] != date_iso or e["ranking"] != args.ranking]
    tmp_manifest["entries"].sort(key=lambda e: e["date"], reverse=True)

    date_opts    = build_date_options(date_iso, tmp_manifest)
    ranking_opts = build_ranking_options(args.ranking)

    sections = ""
    for cat, stories_in_cat in cats.items():
        if not stories_in_cat:
            continue
        bid  = BADGE_CLASS[cat]
        sid  = SECTION_ID[cat]
        sections += f"""
<div class="section-header" id="{sid}">
  <span class="section-badge {bid}">{cat}</span>
  <div class="section-line"></div>
</div>
"""
        if cat == "Others":
            sections += others_table_html(stories_in_cat)
        else:
            for rank, story in stories_in_cat:
                sections += story_card_html(rank, story)

    html = PAGE_TEMPLATE.format(
        css           = PAGE_CSS,
        date_iso      = date_iso,
        date_str      = date_str,
        n_stories     = len(stories),
        ranking_label = args.ranking.upper(),
        ranking       = args.ranking,
        date_options  = date_opts,
        ranking_options = ranking_opts,
        sections_html = sections,
        manifest_json = json.dumps(tmp_manifest),
    )

    out = OUTPUT_DIR / filename
    out.write_text(html, encoding="utf-8")
    print(f"  ✔ Saved → {out}")

    # 4. Update manifest + index
    manifest = update_manifest(target, filename, args.ranking, len(stories))
    regenerate_index(manifest)
    print("  ✔ manifest.json + index.html updated")
    print("Done ✓")


if __name__ == "__main__":
    main()

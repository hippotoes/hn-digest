#!/usr/bin/env python3
"""
HN Daily Digest Generator - Multi-Provider Support
──────────────────────────────────────────────────────────────
Fetches top HN stories via Algolia + Firebase APIs, then calls
AI (Gemini or DeepSeek) for each story to produce deep reports.
"""

import os
import re
import json
import time
import argparse
import subprocess
import textwrap
import requests
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from html import escape
from concurrent.futures import ThreadPoolExecutor

# ── Configuration ─────────────────────────────────────────────────────────────


def load_config():
    conf_path = Path("config.json")
    if conf_path.exists():
        return json.loads(conf_path.read_text())
    return {
        "primary_provider": "gemini",
        "gemini_model": "gemini-2.0-flash",
        "deepseek_model": "deepseek-reasoner",
        "deepseek_api_base": "https://api.deepseek.com",
    }


CONFIG = load_config()
OUTPUT_DIR = Path("site")
OUTPUT_DIR.mkdir(exist_ok=True)
MANIFEST = OUTPUT_DIR / "manifest.json"

# ── HN APIs ───────────────────────────────────────────────────────────────────

HN_FIREBASE = "https://hacker-news.firebaseio.com/v0"
HN_ALGOLIA = "https://hn.algolia.com/api/v1/search"

RANKING_TAGS = {
    "best": "front_page",
    "top": "front_page",
    "new": "story",
    "ask": "ask_hn",
    "show": "show_hn",
}


def get_stories_for_date(target: date, n: int = 20, ranking: str = "top") -> list:
    """Fetch top stories for a specific date using a more robust search."""
    start_ts = int(
        datetime(target.year, target.month, target.day, tzinfo=timezone.utc).timestamp()
    )
    end_ts = start_ts + 86400

    params = {
        "tags": RANKING_TAGS.get(ranking, "front_page"),
        "numericFilters": f"created_at_i>={start_ts},created_at_i<{end_ts}",
        "hitsPerPage": 100,
    }

    try:
        resp = requests.get(f"{HN_ALGOLIA}", params=params, timeout=20)
        resp.raise_for_status()
        hits = resp.json().get("hits", [])
    except Exception as e:
        print(f"  ⚠ Algolia fetch failed: {e}")
        return []

    seen, deduped = set(), []
    for h in hits:
        oid = h.get("objectID")
        if oid and oid not in seen:
            seen.add(oid)
            deduped.append(h)

    # Final sort by points to ensure top stories
    deduped.sort(key=lambda h: h.get("points", 0), reverse=True)
    return deduped[:n]


def get_hn_item(item_id: int) -> dict:
    try:
        r = requests.get(f"{HN_FIREBASE}/item/{item_id}.json", timeout=10)
        return r.json() or {}
    except Exception:
        return {}


def get_top_comments(item_id: int, max_top: int = 50, max_replies: int = 3) -> list:
    """Return top-level comments + shallow replies using parallel fetching."""
    item = get_hn_item(item_id)
    kids = (item.get("kids") or [])[:max_top]

    def fetch_full_comment(kid_id):
        c = get_hn_item(kid_id)
        if not c or c.get("dead") or c.get("deleted") or not c.get("text"):
            return None

        entry = {
            "author": c.get("by", ""),
            "score": c.get("score", 0),
            "text": re.sub(r"<[^>]+>", " ", c.get("text", ""))[:600],
            "replies": [],
        }

        # Parallel fetch replies
        r_ids = (c.get("kids") or [])[:max_replies]
        if r_ids:
            with ThreadPoolExecutor(max_workers=len(r_ids)) as ex:
                replies = list(ex.map(get_hn_item, r_ids))
                for rep in replies:
                    if rep and not rep.get("dead") and rep.get("text"):
                        entry["replies"].append(
                            {
                                "author": rep.get("by", ""),
                                "text": re.sub(r"<[^>]+>", " ", rep.get("text", ""))[
                                    :300
                                ],
                            }
                        )
        return entry

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(fetch_full_comment, kids))

    return [r for r in results if r]


def fetch_article(url: str, max_chars: int = 20_000) -> str:
    if not url:
        return "[No article URL - likely an Ask/Show HN post]"
    if url.lower().endswith(".pdf"):
        return "[Article is a PDF - scraping not supported for binary files]"
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; HNDigest/1.0)"}
        r = requests.get(url, headers=headers, timeout=15, allow_redirects=True)
        r.raise_for_status()
        # Strip null bytes and non-printable characters that break JSON/CLI
        text = "".join(ch for ch in r.text if ch.isprintable() or ch in "\n\r\t")
        text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.I)
        text = re.sub(r"<style[^>]*>.*?</style>", " ", text, flags=re.DOTALL | re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:max_chars]
    except Exception as e:
        return f"[Article fetch failed: {e}]"


# ── AI API Calls ──────────────────────────────────────────────────────────────


def call_deepseek(prompt: str) -> str:
    """Invoke DeepSeek API directly."""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY env var not set")

    url = f"{CONFIG.get('deepseek_api_base', 'https://api.deepseek.com')}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": CONFIG.get("deepseek_model", "deepseek-reasoner"),
        "messages": [
            {
                "role": "system",
                "content": "You are a senior tech analyst. Return ONLY valid JSON.",
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }

    r = requests.post(url, headers=headers, json=payload, timeout=120)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def call_gemini_cli(prompt: str) -> str:
    """Invoke Gemini CLI."""
    proc = subprocess.run(
        [
            "gemini",
            "--model",
            CONFIG["gemini_model"],
            "--output-format",
            "json",
            "-p",
            prompt,
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    if proc.returncode == 0:
        try:
            outer = json.loads(proc.stdout)
            if isinstance(outer, dict) and "response" in outer:
                return outer["response"].strip()
            return proc.stdout.strip()
        except json.JSONDecodeError:
            return proc.stdout.strip()

    stderr = proc.stderr.strip()[:400]
    raise RuntimeError(f"Gemini CLI error: {stderr}")


def call_ai(prompt: str) -> str:
    if CONFIG["primary_provider"] == "deepseek":
        return call_deepseek(prompt)
    return call_gemini_cli(prompt)


# ── Analysis Schema & Prompt ───────────────────────────────────────────────────

ANALYSIS_SCHEMA = """{
  "topic_category": "AI Fundamentals|AI Applications|Tech|Politics|Others",
  "summary_paragraphs": [
    "<paragraph 1 (~150 words): core story, deep context, technical foundation>",
    "<paragraph 2 (~150 words): data points, specific quotes, implementation details, and societal impact>"
  ],
  "highlight": "<1-2 sentence compelling stat, quote, or key insight from the article>",
  "concise_sentiment": "<1-2 sentence extremely brief community reaction summary>",
  "key_points": ["<point 1>","<point 2>","<point 3>","<point 4>","<point 5>"],
  "sentiments": [
    {
      "label":               "<2-4 word label>",
      "type":                "positive|negative|mixed|neutral|debate",
      "description":         "<~100 words - describe this cohort, quote specific comment phrasing where visible>",
      "estimated_agreement": "~XX users"
    }
  ]
}"""


def analyze_story(story: dict, article: str, comments: list) -> dict:
    """Ask AI to produce a structured JSON analysis."""

    comments_block = (
        "\n\n".join(
            f"[{c['author']} score={c.get('score', 0)}]: {c['text']}"
            + "".join(
                f"\n  ↳ [{r['author']}]: {r['text']}" for r in c.get("replies", [])
            )
            for c in comments[:25]
        )
        or "[No comments available - reason from article topic and HN norms]"
    )

    prompt = textwrap.dedent(f"""
        You are writing a high-quality daily tech digest for a sophisticated engineering audience.
        Analyse the Hacker News story below and return ONLY valid JSON - no markdown fences, no preamble.

        ── STORY ─────────────────────────────────────────────────────────
        Title    : {story.get('title', '')}
        URL      : {story.get('url', '')}
        Points   : {story.get('points', 0)}
        Comments : {story.get('num_comments', 0)}

        ── ARTICLE TEXT (up to 20 000 chars) ────────────────────────────
        {article}

        ── HN COMMENTS (top threads + shallow replies) ───────────────────
        {comments_block}

        ── INSTRUCTIONS ─────────────────────────────────────────────────
        • summary_paragraphs: exactly two paragraphs, totaling approximately 300 words.
          Be deep, technical, and analytical. Don't just summarize; provide context.
        • highlight: a single memorable stat, pull-quote, or key insight.
        • sentiments: identify EXACTLY 4 distinct, deep opinion clusters from the REAL comments.
          For each cluster, provide approximately 100 words of analysis, citing specific phrasing
          or unique arguments visible in the comments.
          estimated_agreement = rough number of commenters for this cluster,
          inferred from upvote scores and reply counts in the comments block.
          If comments are sparse, say so and reason from known HN community patterns.
        • topic_category must be exactly one of the five enum values.
        • Return ONLY the JSON object - nothing else.

        JSON schema:
        {ANALYSIS_SCHEMA}
    """).strip()

    raw = call_ai(prompt)

    # Strip any accidental markdown fencing
    raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.I)
    raw = re.sub(r"\s*```$", "", raw.strip())

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Last resort: hunt for the outermost { … }
        m = re.search(r"\{[\s\S]*\}", raw)
        if m:
            return json.loads(m.group())
        raise ValueError(f"Could not parse JSON from AI response:\n{raw[:300]}")


# ── Styling & Constants ────────────────────────────────────────────────────────

SENT_CLASS = {
    "positive": "sent-positive",
    "negative": "sent-negative",
    "mixed": "sent-mixed",
    "neutral": "sent-neutral",
    "debate": "sent-debate",
}

BADGE_CLASS = {
    "AI Fundamentals": "badge-ai-fund",
    "AI Applications": "badge-ai-app",
    "Tech": "badge-tech",
    "Politics": "badge-pol",
    "Others": "badge-others",
}

SECTION_ID = {
    "AI Fundamentals": "ai-fund",
    "AI Applications": "ai-app",
    "Tech": "tech",
    "Politics": "politics",
    "Others": "others",
}

PAGE_CSS = """:root{--bg:#0f0e0c;--bg2:#181613;--bg3:#211f1b;--surface:#242119;--border:#332f28;
--amber:#d4a017;--amber-light:#f0bf4c;--amber-dim:rgba(212,160,23,.12);
--text:#e8e2d6;--text-dim:#9c9285;--text-muted:#5a5446;
--red:#c45c3a;--green:#5a9e6f;--blue:#4a8ab5;--purple:#8a6bbf;--teal:#4ab5a8;}
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
.nav-controls{background:var(--bg2); border-bottom:1px solid var(--border); padding:10px 0; position:sticky; top:0; z-index:1000; box-shadow:0 4px 20px rgba(0,0,0,0.3);}
.nav-inner{max-width:1100px; margin:0 auto; padding:0 24px; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;}
.ctrl-group{display:flex; align-items:center; gap:8px;}
.ctrl-label{font-family:'DM Mono',monospace; font-size:9px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.1em;}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.section-header{display:flex;align-items:center;gap:16px;margin:48px 0 24px}
.section-badge{font-family:'DM Mono',monospace;font-size:10px;font-weight:500;letter-spacing:.25em;text-transform:uppercase;padding:5px 14px;border-radius:3px;white-space:nowrap}
.badge-ai-fund{background:rgba(196,92,58,.15);color:#e87a5a;border:1px solid rgba(196,92,58,0.3)}
.badge-ai-app{background:rgba(90,158,111,.15);color:#7ec890;border:1px solid rgba(90,158,111,0.3)}
.badge-tech{background:rgba(74,181,168,.15);color:var(--teal);border:1px solid rgba(74,181,168,0.3)}
.badge-pol{background:rgba(74,138,181,.15);color:#7ab8e0;border:1px solid rgba(74,138,181,0.3)}
.badge-others{background:rgba(122,106,90,.12);color:var(--text-dim);border:1px solid var(--border)}
.section-line{flex:1;height:1px;background:var(--border)}
.story-card{background:var(--surface);border:1px solid var(--border);border-radius:6px;margin-bottom:28px;overflow:hidden;transition:border-color .2s}
.story-card:hover{border-color:rgba(212,160,23,.3)}
.story-header{padding:22px 26px 16px;border-bottom:1px solid var(--border)}
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
.vote-count{font-family:'DM Mono',monospace;font-size:12px;color:var(--amber-light);font-weight:500}
.others-table-wrap{overflow-x:auto}
.others-table{width:100%;border-collapse:collapse;font-size:13px}
.others-table thead tr{background:var(--bg3);border-bottom:1px solid var(--border)}
.others-table thead th{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-muted);padding:9px 14px;text-align:left;font-weight:400}
.others-table tbody tr{border-bottom:1px solid var(--border)}
.others-table tbody tr:hover{background:rgba(255,255,255,.02)}
.others-table td{padding:11px 14px;vertical-align:top;color:#c0b8a8;font-weight:300;line-height:1.5}
.others-table td:first-child{font-weight:400;color:var(--text)}
.rank-num{font-family:'DM Mono',monospace;font-size:11px;color:var(--text-muted)}
.pts-mono{font-family:'DM Mono',monospace;font-size:11px;color:var(--amber-light);white-space:nowrap}
.cmts-mono{font-family:'DM Mono',monospace;font-size:11px;color:var(--text-dim);white-space:nowrap}
.footer{border-top:1px solid var(--border);margin-top:64px;padding:28px 0;text-align:center}
.footer p{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.1em;color:var(--text-muted)}
.latest-label{font-family:'DM Mono',monospace; font-size:12px; color:var(--amber); text-transform:uppercase; letter-spacing:0.2em; margin-bottom:16px;}
@media(max-width:640px){.nav-inner{gap:8px}}"""


# ── HTML Builders ─────────────────────────────────────────────────────────────


def story_card_html(rank: int, story: dict) -> str:
    a = story.get("analysis", {})
    title = escape(story.get("title", "Untitled"))
    url = escape(story.get("url", "#") or "#")
    pts = story.get("points", 0)
    ncmts = story.get("num_comments", 0)
    hn_id = story.get("objectID", "")

    para_html = "".join(f"<p>{escape(p)}</p>" for p in a.get("summary_paragraphs", []))

    hl = a.get("highlight", "")
    hl_html = f'<div class="highlight-box"><p>{escape(hl)}</p></div>' if hl else ""

    kps = a.get("key_points", [])
    kp_html = ""
    if kps:
        items = "".join(f"<li>{escape(k)}</li>" for k in kps)
        kp_html = (
            f'<div class="key-points">'
            f'<div class="key-points-title">Key Highlights</div>'
            f"<ul>{items}</ul></div>"
        )

    rows = ""
    for s in a.get("sentiments", []):
        rc = SENT_CLASS.get(s.get("type", "neutral"), "sent-neutral")
        rows += (
            f'<tr class="{rc}">'
            f'<td>{escape(s.get("label", ""))}</td>'
            f'<td>{escape(s.get("description", ""))}</td>'
            f'<td><span class="vote-count">'
            f'{escape(str(s.get("estimated_agreement", "")))}'
            '</span></td></tr>'
        )

    sent_html = ""
    if rows:
        sent_html = (
            f'<div class="sentiment-section">'
            f'<div class="sentiment-title">Comment Sentiment Analysis - {ncmts} comments</div>'
            f'<table class="sentiment-table">'
            f"<thead><tr><th>Sentiment</th><th>Community View</th><th>Agree</th></tr></thead>"
            f"<tbody>{rows}</tbody></table></div>"
        )

    return f"""
<div class="story-card">
  <div class="story-header">
    <div class="story-num">#{rank}</div>
    <div class="story-title"><a href="{url}" target="_blank" rel="noopener">{title}</a></div>
    <div class="story-meta">
      <span class="meta-pill">⬆ <span>{pts}</span> pts</span>
      <span class="meta-pill">💬 <a href="https://news.ycombinator.com/item?id={hn_id}"
            target="_blank" rel="noopener"><span>{ncmts}</span> HN comments</a></span>
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
        a = story.get("analysis", {})
        title = escape(story.get("title", ""))
        url = escape(story.get("url", "#") or "#")
        pts = story.get("points", 0)
        ncmts = story.get("num_comments", 0)
        hn_id = story.get("objectID", "")

        # Build full summary (~200 words)
        para = " ".join(a.get("summary_paragraphs", []))
        summary_text = escape(para[:1200] + "..." if len(para) > 1200 else para)

        # Build inline sentiment badges
        sent_html = ""
        for s in a.get("sentiments", []):
            stype = s.get("type", "neutral")
            slabel = escape(s.get("label", ""))
            sdesc = escape(s.get("description", ""))
            agree = escape(str(s.get("estimated_agreement", "")))
            color = "#5a5446"
            if stype == "positive":
                color = "#5a9e6f"
            elif stype == "negative":
                color = "#c45c3a"
            elif stype == "mixed":
                color = "#d4a017"
            elif stype == "debate":
                color = "#8a6bbf"

            sent_html += (
                f'<div style="margin-top:8px; padding:6px 10px; background:rgba(255,255,255,0.03); border-left:2px solid {color}; border-radius:2px;">'
                f"<span style=\"font-family:'DM Mono',monospace; font-size:10px; color:{color}; text-transform:uppercase; font-weight:600;\">{slabel}</span> "
                f'<span style="font-size:11px; color:var(--text-dim); margin-left:6px;">{sdesc}</span> '
                f"<span style=\"font-family:'DM Mono',monospace; font-size:10px; color:var(--amber); margin-left:8px;\">({agree})</span>"
                f"</div>"
            )

        rows += (
            f"<tr>"
            f"<td style='width:120px;'>"
            f"<div class='rank-num' style='margin-bottom:4px'>#{rank}</div>"
            f"<div class='pts-mono' style='margin-bottom:2px'>{pts} pts</div>"
            f"<div class='cmts-mono'><a href='https://news.ycombinator.com/item?id={hn_id}' target='_blank'>{ncmts} c</a></div>"
            f"</td>"
            f"<td>"
            f"<div style='margin-bottom:8px;'><a href='{url}' target='_blank' style='font-family:\"Playfair Display\",serif; font-size:1.1rem; font-weight:700; color:var(--text);'>{title}</a></div>"
            f"<div style='font-size:14px; line-height:1.5; color:#c0b8a8;'>{summary_text}</div>"
            f"{sent_html}"
            f"</td>"
            f"</tr>"
        )
    return f"""
<div class="story-card">
  <div class="story-body" style="padding:18px 26px">
    <p style="font-size:14px;color:var(--text-dim);margin-bottom:18px">
      Remaining stories - comprehensive digest table.
    </p>
    <div class="others-table-wrap">
      <table class="others-table">
        <thead><tr><th>Stats</th><th>Digest</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  </div>
</div>"""


# ── UI Helpers ────────────────────────────────────────────────────────────────


def get_navbar_html() -> str:
    """Generate a consistent navigation bar without history."""
    return """
<div class="nav-controls">
  <div class="nav-inner">
    <div class="toc" style="display:flex; align-items:center; gap:8px;">
      <a href="./index.html" style="font-family:'DM Mono',monospace; font-size:11px; padding:5px 14px; background:var(--amber); color:var(--bg); border-radius:3px; margin-right:12px; font-weight:800; letter-spacing:0.05em;">HOME</a>
      <a href="#ai-fund" class="ai-fund" style="font-family:'DM Mono',monospace; font-size:10px; padding:4px 10px; border-radius:3px; border:1px solid rgba(196,92,58,0.3); color:#e87a5a;">AI Fundamentals</a>
      <a href="#ai-app"  class="ai-app"  style="font-family:'DM Mono',monospace; font-size:10px; padding:4px 10px; border-radius:3px; border:1px solid rgba(90,158,111,0.3); color:#7ec890;">AI Applications</a>
      <a href="#tech"    class="tech"    style="font-family:'DM Mono',monospace; font-size:10px; padding:4px 10px; border-radius:3px; border:1px solid rgba(74,181,168,0.3); color:var(--teal);">Tech</a>
      <a href="#politics" class="pol"     style="font-family:'DM Mono',monospace; font-size:10px; padding:4px 10px; border-radius:3px; border:1px solid rgba(74,138,181,0.3); color:#7ab8e0;">Politics</a>
      <a href="#others"  class="others"  style="font-family:'DM Mono',monospace; font-size:10px; padding:4px 10px; border-radius:3px; border:1px solid var(--border); color:var(--text-dim);">Others</a>
    </div>
  </div>
</div>"""


def wrap_with_layout(
    title: str, date_str: str, subtitle: str, content: str, navbar_html: str
) -> str:
    """Master layout wrapper for all pages."""
    model_str = (
        CONFIG["deepseek_model"]
        if CONFIG["primary_provider"] == "deepseek"
        else CONFIG["gemini_model"]
    )
    provider_str = CONFIG["primary_provider"].capitalize()

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Source+Serif+4:ital,wght@0,300;0,400;0,600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>{PAGE_CSS}</style>
</head>
<body>
<div class="masthead">
  <div class="masthead-sub">Intelligence Briefing</div>
  <h1>Hacker <span>News</span></h1>
  <div class="masthead-date">{date_str} - {subtitle}</div>
  <div class="masthead-rule"></div>
</div>
{navbar_html}
<div class="container">{content}</div>
<div class="footer">
  <div class="container">
    <p>Data: HN Algolia Search + Firebase APIs - Summaries: {model_str} via {provider_str}</p>
    <p style="margin-top:6px;font-size:10px">
      Sentiment analysis uses real HN comment threads fetched at generation time.
      Agreement estimates are inferred from comment upvote distribution and reply volume.
    </p>
  </div>
</div>
</body>
</html>"""


# ── Manifest & Retention ──────────────────────────────────────────────────────

# Manifest logic removed as per user request to remove data persistency.

# ── Page Templates ─────────────────────────────────────────────────────────────


def build_index(stories: list, target: date, ranking: str) -> str:
    cats: dict[str, list] = {
        "AI Fundamentals": [],
        "AI Applications": [],
        "Tech": [],
        "Politics": [],
        "Others": [],
    }
    for i, s in enumerate(stories):
        cat = s.get("analysis", {}).get("topic_category", "Others")
        if cat not in cats:
            cat = "Others"
        cats[cat].append((i + 1, s))

    sections = ""
    for cat, items in cats.items():
        if not items:
            continue
        sid, bid = SECTION_ID[cat], BADGE_CLASS[cat]
        sections += f'<div class="section-header" id="{sid}"><span class="section-badge {bid}">{escape(cat)}</span><div class="section-line"></div></div>\n'
        if cat == "Others":
            sections += others_table_html(items)
        else:
            for rank, story in items:
                sections += story_card_html(rank, story)

    date_str = target.strftime("%A, %B %d, %Y").upper()
    navbar_html = get_navbar_html()

    content = f'<div style="margin-top:48px; text-align:center;"><div class="latest-label">Latest Briefing</div></div>{sections}'

    return wrap_with_layout(
        title="HN Daily Digest",
        date_str=date_str,
        subtitle=f"TOP {len(stories)} - {ranking.upper()}",
        content=content,
        navbar_html=navbar_html,
    )


# ── Entry Point ───────────────────────────────────────────────────────────────


def run(target: date, ranking: str, n_stories: int):
    print(f"  Date={target}  Ranking={ranking}  Stories={n_stories}")

    print("  Fetching story list...")
    stories = get_stories_for_date(target, n=n_stories, ranking=ranking)

    if stories:
        print(f"  Found {len(stories)} stories. Starting analysis...")
        for i, story in enumerate(stories):
            title = story.get("title", "")[:65]
            print(f"  [{i+1:02}/{len(stories)}] {title}")
            hn_id = story.get("objectID", "")

            t0 = time.time()
            article = fetch_article(story.get("url", ""))
            t_article = time.time() - t0

            t0 = time.time()
            comments = get_top_comments(int(hn_id)) if hn_id else []
            t_comments = time.time() - t0

            t0 = time.time()
            try:
                story["analysis"] = analyze_story(story, article, comments)
                t_ai = time.time() - t0
                print(
                    f"         ⏱  Scrape: {t_article:.1f}s | HN: {t_comments:.1f}s | AI: {t_ai:.1f}s"
                )
            except Exception as e:
                print(f"         ⚠ Analysis error: {e}")
                story["analysis"] = {
                    "topic_category": "Others",
                    "summary_paragraphs": [
                        story.get("title", ""),
                        "Analysis unavailable.",
                    ],
                    "highlight": "",
                    "key_points": [],
                    "sentiments": [],
                }
            time.sleep(2.0)  # stay within 15 RPM Free Tier limit

    # Only generate index.html, no archives or manifest.
    (OUTPUT_DIR / "index.html").write_text(
        build_index(stories, target, ranking), encoding="utf-8"
    )
    print("  ✔ index.html (Data persistency removed)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=None)
    ap.add_argument("--ranking", default="top", choices=list(RANKING_TAGS.keys()))
    ap.add_argument("--stories", default=20, type=int)
    args = ap.parse_args()

    target = (
        date.fromisoformat(args.date) if args.date else date.today() - timedelta(days=1)
    )
    run(target, args.ranking, args.stories)


if __name__ == "__main__":
    main()

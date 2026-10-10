"""Reproducible request replay: the same FAQ-heavy prompt sequence before and after cache approval.

    python scripts/demo_replay.py --base-url http://localhost:8000 [--approve] [--disable-after]

Counts provider calls vs cache hits for an identical sequence. In mock mode no money is spent;
in live mode every non-cached request is a real (billed) Anthropic call, so keep the list short.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request

PROMPTS = [
    "What time do you open?",
    "When are you open?",
    "Do you open on Sunday?",
    "Do you deliver?",
    "How much is Chocolate Cake?",
    "What cakes do you have?",
    "Is my order ready?",
    "Do you deliver to my address?",
    "Can I order a cake for 50 people?",
    "What are your opening hours?",
]


def call(base, method, path, body=None, token=None):
    req = urllib.request.Request(f"{base}/api/v1{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None)  # fmt: skip
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:  # noqa: S310 - operator-supplied URL
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def replay(base, label):
    _, sess = call(base, "POST", "/chat/session")
    provider, hits, rows = 0, 0, []
    for p in PROMPTS:
        _, r = call(base, "POST", "/chat", {"application_id": sess["application_id"], "message": p}, sess["token"])
        hit = r["cache_status"] in ("exact_hit", "semantic_hit")
        hits += hit
        provider += not hit
        rows.append(f"    {r['cache_status']:12s} {r.get('cache_decision') or '':38s} {p}")
    print(f"{label}: {provider} provider calls, {hits} cache hits out of {len(PROMPTS)} requests")
    print("\n".join(rows))
    return provider, hits


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--base-url", default="http://localhost:8000")
    a.add_argument("--approve", action="store_true", help="generate + approve the recommendation (dev login)")
    a.add_argument("--disable-after", action="store_true")
    args = a.parse_args()
    base = args.base_url.rstrip("/")
    before = replay(base, "BEFORE")
    if args.approve:
        _, tok = call(base, "POST", "/auth/dev-login", {"role": "owner"})
        token = tok["access_token"]
        call(base, "POST", "/forecasts/run", {}, token)
        _, rec = call(base, "POST", "/recommendations/generate", None, token)
        print(f"\nRecommendation: {rec['action_type']}\n  {rec['rationale']}\n")
        if rec["action_type"] != "enable_semantic_cache":
            sys.exit("Nothing to approve.")
        status, res = call(base, "POST", f"/recommendations/{rec['id']}/approve",
                           {"expected_version": rec["version"]}, token)  # fmt: skip
        print(f"Approve -> HTTP {status}, status {res.get('status')}\n")
    after = replay(base, "AFTER")
    print(f"\nProvider calls: {before[0]} -> {after[0]} for the identical sequence.")
    if args.disable_after and args.approve:
        _, pols = call(base, "GET", "/policies", None, token)
        for p in pols["items"]:
            if p["enabled"]:
                call(base, "POST", f"/policies/{p['id']}/disable", None, token)
        print("Policies disabled (provider calls resume).")


if __name__ == "__main__":
    main()

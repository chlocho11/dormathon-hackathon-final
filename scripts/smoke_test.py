"""HTTP smoke test against a running TokenGuard API (local or deployed). Standard library only.

    python scripts/smoke_test.py --base-url http://localhost:8000 [--seed]

Exits non-zero on the first failed check. In live Anthropic mode this sends exactly ONE chat
request (a real, billed provider call); pass --no-chat to skip it.
"""

import argparse
import json
import sys
import urllib.error
import urllib.request


def call(base: str, method: str, path: str, body: dict | None = None, token: str | None = None):
    req = urllib.request.Request(f"{base}/api/v1{path}", method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=40) as res:  # noqa: S310 - operator-supplied URL
            return res.status, json.loads(res.read() or b"null")
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read() or b"null")


def check(label: str, ok: bool, detail: object = "") -> None:
    print(f"[{'PASS' if ok else 'FAIL'}] {label}" + (f" -> {detail}" if detail != "" else ""))
    if not ok:
        sys.exit(1)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", default="http://localhost:8000")
    p.add_argument("--seed", action="store_true", help="call /demo/seed first (dev only)")
    p.add_argument("--no-chat", action="store_true")
    args = p.parse_args()
    base = args.base_url.rstrip("/")

    status, health = call(base, "GET", "/health")
    check("health responds", status == 200, health)
    check("database ok", health["dependencies"]["database"] == "ok")
    mode = health["dependencies"]["anthropic"]["mode"]
    print(f"       provider mode: {mode}")

    if args.seed:
        status, body = call(base, "POST", "/demo/seed")
        check("demo seed", status == 200, body)

    status, sess = call(base, "POST", "/chat/session")
    check("chat session token issued", status == 200, {k: sess.get(k) for k in ("application_id", "expires_at")})

    if not args.no_chat:
        status, reply = call(
            base,
            "POST",
            "/chat",
            {"application_id": sess["application_id"], "message": "What time do you open?"},
            sess["token"],
        )
        check("chat answered", status == 200, {k: reply.get(k) for k in ("cache_status", "provider_mode", "usage")})
        check("cost estimated", reply["estimated_cost_myr"] >= 0, reply["estimated_cost_myr"])

    status, err = call(base, "GET", "/me", token=sess["token"])
    check("chat token rejected on owner endpoint", status == 401, err["error"]["code"])
    print("Smoke test passed.")


if __name__ == "__main__":
    main()

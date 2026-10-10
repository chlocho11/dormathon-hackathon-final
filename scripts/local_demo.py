"""Prepare and launch a local demo (mock by default; --live enables billed Anthropic).

Requires apps/api/.venv and apps/web/node_modules (see docs/deployment.md).
Run from anywhere: python scripts/local_demo.py [--prepare-only].
Mock mode needs no credentials. Live mode reads the backend-only .env.anthropic.local key.
"""

import argparse
import os
import secrets
import shutil
import socket
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "apps" / "api"
WEB = ROOT / "apps" / "web"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-only", action="store_true")
    parser.add_argument("--skip-prepare", action="store_true", help="Reuse a previously prepared demo database.")
    parser.add_argument("--live", action="store_true", help="Use the backend-only Anthropic key; requests are billed.")
    parser.add_argument("--web-port", type=int, default=3000)
    parser.add_argument("--api-port", type=int, default=8000)
    args = parser.parse_args()
    if not (1 <= args.web_port <= 65535 and 1 <= args.api_port <= 65535):
        parser.error("Ports must be between 1 and 65535.")
    if not args.prepare_only:
        for port in (args.web_port, args.api_port):
            with socket.socket() as connection:
                connection.settimeout(1)
                if connection.connect_ex(("127.0.0.1", port)) == 0:
                    parser.error(f"Port {port} is in use. Select --web-port / --api-port or stop its server.")
    python = API / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    node = shutil.which("node")
    if not python.exists() or (
        not args.prepare_only and (not (WEB / "node_modules" / "next" / "package.json").exists() or not node)
    ):
        raise SystemExit("Install first: apps/api: uv sync; apps/web: npm ci. See docs/deployment.md.")
    env = os.environ.copy()
    env.update(
        {
            "APP_ENV": "development",
            "DEMO_MODE": "true",
            "ANTHROPIC_MODE": "live" if args.live else "mock",
            "SUPABASE_URL": "",
            "SUPABASE_JWKS_URL": "",
            "OWNER_AUTH_USER_ID": "",
            "NEXT_PUBLIC_SUPABASE_URL": "",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY": "",
            "NEXT_PUBLIC_API_BASE_URL": f"http://localhost:{args.api_port}",
            "ALLOWED_ORIGINS": f'["http://localhost:{args.web_port}"]',
            "DEV_JWT_SECRET": secrets.token_urlsafe(32),
            "CHAT_TOKEN_SECRET": secrets.token_urlsafe(32),
            "FINGERPRINT_SECRET": secrets.token_urlsafe(32),
            "EMBEDDING_CACHE_DIR": str(API / ".models"),
        }
    )
    if args.live:
        env["PROVIDER_MAX_RETRIES"] = "0"
        env["PRICING_CATALOG_VERSION"] = "anthropic-2026-10-11"
        key_check = subprocess.run(  # noqa: S603 - fixed local interpreter and configuration-only check
            [
                str(python),
                "-c",
                "import sys; from app.config import get_settings; "
                "sys.exit(0 if get_settings().anthropic_api_key else 2)",
            ],
            cwd=API,
            env=env,
            check=False,
        )
        if key_check.returncode:
            raise SystemExit("Paste ANTHROPIC_API_KEY into the root .env.anthropic.local file before using --live.")
    else:
        env["ANTHROPIC_API_KEY"] = ""
    # The embedded server stays alive between local runs. Use a separate database
    # so this launcher cannot overwrite a supplied production DATABASE_URL.
    url = subprocess.check_output(  # noqa: S603 - fixed local interpreter/script/database arguments
        [str(python), "scripts/local_db.py", "--db", "tokenguard_local_demo"],
        cwd=API,
        env=env,
        text=True,
    ).strip()
    env["DATABASE_URL"] = url
    commands = [
        [str(python), "-m", "alembic", "upgrade", "head"],
        [str(python), "-m", "app.jobs.bootstrap"],
    ]
    if not args.skip_prepare:
        commands.append([str(python), str(ROOT / "scripts" / "seed_demo.py"), "--evaluate", "--predict"])
    for command in commands:
        subprocess.run(command, cwd=API, env=env, check=True)  # noqa: S603 - fixed local commands
    if args.prepare_only:
        print("Local mock demo prepared in tokenguard_local_demo. Launch with this script to reuse its database.")
        return
    processes = []
    try:
        processes.append(
            subprocess.Popen(  # noqa: S603 - fixed local interpreter and uvicorn arguments
                [str(python), "-m", "uvicorn", "app.main:app", "--port", str(args.api_port)], cwd=API, env=env
            )
        )
        command = [
            node,
            str(WEB / "node_modules" / "next" / "dist" / "bin" / "next"),
            "dev",
            "--port",
            str(args.web_port),
        ]
        backend_secrets = {
            "ANTHROPIC_API_KEY",
            "DATABASE_URL",
            "DEV_JWT_SECRET",
            "CHAT_TOKEN_SECRET",
            "FINGERPRINT_SECRET",
            "SCHEDULER_SECRET",
        }
        web_env = {name: value for name, value in env.items() if name not in backend_secrets}
        processes.append(subprocess.Popen(command, cwd=WEB, env=web_env))  # noqa: S603 - resolved node; fixed local script
        mode = "Live Anthropic (billed)" if args.live else "Mock provider (no API charge)"
        print(f"{mode}: http://localhost:{args.web_port}/login — Ctrl+C stops web/API.")
        while all(process.poll() is None for process in processes):
            time.sleep(1)
        failed = next((process.returncode for process in processes if process.returncode), 1)
        raise SystemExit(failed)
    except KeyboardInterrupt:
        print("Stopping local demo.")
    finally:
        for process in processes:
            if process.poll() is None:
                taskkill = shutil.which("taskkill") if os.name == "nt" else None
                if taskkill:
                    # Stop only the process tree this launcher created, including Next's worker.
                    subprocess.run(  # noqa: S603 - PID is our own child process
                        [taskkill, "/PID", str(process.pid), "/T", "/F"],
                        capture_output=True,
                        check=False,
                    )
                else:
                    process.terminate()
        for process in processes:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    main()

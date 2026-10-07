#!/usr/bin/env python3
"""Run the local API, frontend and worker together; stop them on Ctrl+C or startup failure."""
from pathlib import Path
import os
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
uvicorn = ROOT / "backend/.venv/bin/uvicorn"
npm = shutil.which("npm")
if not uvicorn.is_file() or not npm or not (ROOT / "frontend/node_modules").is_dir():
    sys.exit("Install dependencies with make install before starting development.")
children: list[subprocess.Popen] = []

try:
    children.append(subprocess.Popen(
        [str(uvicorn), "app.main:app", "--app-dir", str(ROOT / "backend"),
         "--reload", "--reload-dir", str(ROOT / "backend/app"),
         "--host", "127.0.0.1", "--port", "8000"],
        cwd=ROOT, start_new_session=True,
    ))
    children.append(subprocess.Popen(
        [npm, "run", "dev"], cwd=ROOT / "frontend", start_new_session=True,
    ))
    children.append(subprocess.Popen(
        [str(ROOT / 'backend/.venv/bin/python'), str(ROOT / 'scripts/worker.py')],
        cwd=ROOT, start_new_session=True,
    ))
    print("Frontend: http://127.0.0.1:5173 | API docs: http://127.0.0.1:8000/api/docs", flush=True)
    while all(child.poll() is None for child in children):
        time.sleep(0.25)
    exit_code = next((child.returncode for child in children if child.returncode is not None), 1)
except KeyboardInterrupt:
    exit_code = 0
finally:
    for child in children:
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
    for child in children:
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
sys.exit(exit_code)

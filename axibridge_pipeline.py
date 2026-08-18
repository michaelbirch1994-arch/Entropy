#!/usr/bin/env python3
"""
axibridge_pipeline.py
=====================
End-to-end automation: raw ArcDPS .zevtc logs -> parsed EI JSONs
-> combined report.json -> served to AxiBridge via local HTTP.

Usage:
    python axibridge_pipeline.py <folder_with_zevtc_files>

Requirements:
    - GuildWars2EliteInsights-CLI.exe (Windows) or the equivalent binary
    - GW2_EI_log_combiner (pip install or local clone)
    - Python 3.9+
"""

import argparse
import glob
import http.server
import os
import socketserver
import subprocess
import sys
import threading
import webbrowser

# ──────────────────────────────────────────────────────────────────
# CONFIGURATION  –  edit these paths to match your local setup
# ──────────────────────────────────────────────────────────────────

# Path to the Elite Insights CLI executable
EI_CLI_PATH = r"C:\Tools\GuildWars2EliteInsights-CLI.exe"

# Path to your EI .conf file (must have DetailedWvW=true)
EI_CONF_PATH = r"C:\Tools\ei_config.conf"

# Path to the GW2_EI_log_combiner script (Drevarr's combiner)
# If installed via pip, just use "gw2_ei_log_combiner" as the command.
# If cloned locally, point to the main .py file.
COMBINER_SCRIPT = r"C:\Tools\GW2_EI_log_combiner\main.py"

# Whether the combiner is a pip-installed command (True) or a local .py file (False)
COMBINER_IS_COMMAND = False

# AxiBridge dev server URL
AXIBRIDGE_URL = "http://localhost:5173"

# Port for the temporary local file server
SERVE_PORT = 8080

# Name of the combined output file
OUTPUT_FILENAME = "combined_report.json"

# ──────────────────────────────────────────────────────────────────
# PIPELINE
# ──────────────────────────────────────────────────────────────────


def banner(step: int, total: int, msg: str) -> None:
    """Print a formatted pipeline step banner."""
    print(f"\n{'='*60}")
    print(f"  [{step}/{total}]  {msg}")
    print(f"{'='*60}\n")


def find_logs(folder: str) -> list[str]:
    """Find all .zevtc files in the target folder."""
    patterns = ["*.zevtc", "*.evtc", "*.zevtc.zip"]
    files: list[str] = []
    for pat in patterns:
        files.extend(glob.glob(os.path.join(folder, pat)))
    return sorted(files)


def parse_logs(folder: str, log_files: list[str]) -> list[str]:
    """
    Run Elite Insights CLI on all log files.
    Returns a list of generated .json file paths.
    """
    banner(1, 3, "PARSING  –  Running Elite Insights CLI")

    if not os.path.isfile(EI_CLI_PATH):
        print(f"  ERROR: Elite Insights CLI not found at: {EI_CLI_PATH}")
        print(f"  Update the EI_CLI_PATH variable at the top of this script.")
        sys.exit(1)

    if not os.path.isfile(EI_CONF_PATH):
        print(f"  ERROR: EI config file not found at: {EI_CONF_PATH}")
        print(f"  Update the EI_CONF_PATH variable at the top of this script.")
        sys.exit(1)

    print(f"  Found {len(log_files)} log file(s) to parse.")
    for f in log_files:
        print(f"    - {os.path.basename(f)}")

    cmd = [EI_CLI_PATH, "-c", EI_CONF_PATH] + log_files
    print(f"\n  Running: {os.path.basename(EI_CLI_PATH)} -c {os.path.basename(EI_CONF_PATH)} [{len(log_files)} files]")
    print(f"  This may take a while...\n")

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"  WARNING: Elite Insights exited with code {result.returncode}")
        if result.stderr:
            print(f"  STDERR: {result.stderr[:500]}")

    if result.stdout:
        for line in result.stdout.strip().split("\n")[-5:]:
            print(f"  EI> {line}")

    # Find all .json files generated (EI places them alongside the .zevtc files)
    json_files = glob.glob(os.path.join(folder, "*.json"))
    print(f"\n  Generated {len(json_files)} JSON file(s).")
    return sorted(json_files)


def combine_logs(folder: str, json_files: list[str]) -> str:
    """
    Run the GW2_EI_log_combiner on the parsed JSON files.
    Returns the path to the combined output file.
    """
    banner(2, 3, "COMBINING  –  Merging parsed logs into a single report")

    output_path = os.path.join(folder, OUTPUT_FILENAME)

    print(f"  Input:  {len(json_files)} JSON file(s)")
    print(f"  Output: {output_path}\n")

    if COMBINER_IS_COMMAND:
        # Installed via pip as a CLI command
        cmd = [COMBINER_SCRIPT] + json_files + ["-o", output_path]
    else:
        # Local Python script
        if not os.path.isfile(COMBINER_SCRIPT):
            print(f"  ERROR: Combiner script not found at: {COMBINER_SCRIPT}")
            print(f"  Update the COMBINER_SCRIPT variable at the top of this script.")
            sys.exit(1)
        cmd = [sys.executable, COMBINER_SCRIPT] + json_files + ["-o", output_path]

    print(f"  Running combiner...")
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=folder)

    if result.returncode != 0:
        print(f"  ERROR: Combiner exited with code {result.returncode}")
        if result.stderr:
            print(f"  STDERR: {result.stderr[:500]}")
        sys.exit(1)

    if result.stdout:
        for line in result.stdout.strip().split("\n")[-5:]:
            print(f"  Combiner> {line}")

    if not os.path.isfile(output_path):
        # Some combiners write to a default location. Try common names.
        alt = os.path.join(folder, "report.json")
        if os.path.isfile(alt):
            os.rename(alt, output_path)
            print(f"  Renamed output to: {OUTPUT_FILENAME}")
        else:
            print(f"  ERROR: Combined output file not found at expected path.")
            print(f"  Check your combiner's output location and adjust OUTPUT_FILENAME.")
            sys.exit(1)

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n  Combined report created: {output_path} ({size_mb:.2f} MB)")
    return output_path


def serve_and_open(folder: str, output_path: str) -> None:
    """
    Start a local HTTP server and open AxiBridge with the report URL.
    """
    banner(3, 3, "SERVING  –  Launching local server and opening AxiBridge")

    filename = os.path.basename(output_path)
    serve_url = f"http://127.0.0.1:{SERVE_PORT}/{filename}"
    dashboard_url = f"{AXIBRIDGE_URL}/?report={serve_url}"

    # Set up a simple HTTP server rooted at the folder
    os.chdir(folder)

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        """Adds CORS headers and suppresses noisy logging."""

        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            super().end_headers()

        def do_OPTIONS(self):
            self.send_response(200)
            self.end_headers()

        def log_message(self, format, *args):
            # Only log actual file requests, not noise
            if args and "GET" in str(args[0]):
                print(f"  HTTP> {args[0]}")

    try:
        httpd = socketserver.TCPServer(("", SERVE_PORT), QuietHandler)
    except OSError as e:
        print(f"  ERROR: Could not start server on port {SERVE_PORT}: {e}")
        print(f"  Another process may be using that port. Update SERVE_PORT.")
        sys.exit(1)

    print(f"  Local server running at: http://127.0.0.1:{SERVE_PORT}/")
    print(f"  Serving file: {filename}")
    print(f"  Report URL:   {serve_url}")
    print(f"\n  Opening AxiBridge dashboard...")
    print(f"  Dashboard:    {dashboard_url}")
    print(f"\n  {'─'*56}")
    print(f"  Press Ctrl+C to stop the server when done.")
    print(f"  {'─'*56}\n")

    # Open the browser
    webbrowser.open(dashboard_url)

    # Serve until interrupted
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n  Server stopped. Goodbye!")
        httpd.shutdown()


def main():
    parser = argparse.ArgumentParser(
        description="AxiBridge Pipeline: .zevtc -> Elite Insights -> Combiner -> Dashboard",
        epilog="Edit the CONFIGURATION section at the top of this script to set tool paths."
    )
    parser.add_argument(
        "folder",
        help="Folder containing raw .zevtc log files to process"
    )
    parser.add_argument(
        "--skip-parse",
        action="store_true",
        help="Skip EI parsing (reuse existing .json files in the folder)"
    )
    parser.add_argument(
        "--skip-combine",
        action="store_true",
        help="Skip combining (serve an existing combined_report.json)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=SERVE_PORT,
        help=f"Port for the local file server (default: {SERVE_PORT})"
    )
    args = parser.parse_args()

    global SERVE_PORT
    SERVE_PORT = args.port

    folder = os.path.abspath(args.folder)
    if not os.path.isdir(folder):
        print(f"ERROR: Folder not found: {folder}")
        sys.exit(1)

    print(f"\n  AxiBridge Pipeline")
    print(f"  {'─'*40}")
    print(f"  Source folder: {folder}")

    output_path = os.path.join(folder, OUTPUT_FILENAME)

    if not args.skip_parse:
        log_files = find_logs(folder)
        if not log_files:
            print(f"\n  No .zevtc/.evtc files found in: {folder}")
            print(f"  Use --skip-parse if you already have .json files.")
            sys.exit(1)
        json_files = parse_logs(folder, log_files)
        if not json_files:
            print(f"\n  No .json files were generated by Elite Insights.")
            sys.exit(1)
    else:
        print(f"\n  Skipping parsing (--skip-parse)")
        json_files = sorted(glob.glob(os.path.join(folder, "*.json")))
        json_files = [f for f in json_files if os.path.basename(f) != OUTPUT_FILENAME]
        if not json_files:
            print(f"  No .json files found in folder to combine.")
            sys.exit(1)
        print(f"  Found {len(json_files)} existing JSON file(s).")

    if not args.skip_combine:
        output_path = combine_logs(folder, json_files)
    else:
        print(f"\n  Skipping combining (--skip-combine)")
        if not os.path.isfile(output_path):
            print(f"  ERROR: {OUTPUT_FILENAME} not found in {folder}")
            sys.exit(1)
        print(f"  Using existing: {output_path}")

    serve_and_open(folder, output_path)


if __name__ == "__main__":
    main()

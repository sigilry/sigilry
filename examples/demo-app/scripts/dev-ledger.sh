#!/usr/bin/env bash
# dev-ledger.sh — Launch Canton sandbox with deterministic party/user provisioning.
#
# Canton's `sandbox` subcommand does not support `--bootstrap`, so we start the
# sandbox in the background, wait for readiness (via --canton-port-file), then
# run the bootstrap script through `sandbox-console` (which connects to the
# running sandbox). The sandbox process stays in the foreground for concurrently.
# (In 3.4.9, `--bootstrap` appears in top-level help but is rejected for `sandbox`.)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Port defaults (match dpm sandbox conventions)
# ---------------------------------------------------------------------------
LEDGER_API_PORT="${SANDBOX_LEDGER_API_PORT:-36865}"
ADMIN_API_PORT="${SANDBOX_ADMIN_API_PORT:-33901}"
JSON_API_PORT="${SANDBOX_JSON_API_PORT:-37575}"
SEQUENCER_PUBLIC_PORT="${SANDBOX_SEQUENCER_PUBLIC_PORT:-35101}"
SEQUENCER_ADMIN_PORT="${SANDBOX_SEQUENCER_ADMIN_PORT:-35102}"
MEDIATOR_ADMIN_PORT="${SANDBOX_MEDIATOR_ADMIN_PORT:-35103}"

# ---------------------------------------------------------------------------
# Identity defaults (exported for the bootstrap script)
# ---------------------------------------------------------------------------
export VITE_LEDGER_PARTY_ID="${VITE_LEDGER_PARTY_ID:-Alice}"
export VITE_LEDGER_USER_ID="${VITE_LEDGER_USER_ID:-ledger-api-user}"

# ---------------------------------------------------------------------------
# DAR path
# ---------------------------------------------------------------------------
DAR_PATH="${DEMO_DIR}/dars/demo-todo-package-0.0.1.dar"
if [[ ! -f "$DAR_PATH" ]]; then
  echo "ERROR: DAR not found at ${DAR_PATH}" >&2
  echo "Run: dpm build -o dars/demo-todo-package-0.0.1.dar" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Bootstrap script path
# ---------------------------------------------------------------------------
BOOTSTRAP_SCRIPT="${SCRIPT_DIR}/bootstrap-demo-ledger.canton"
if [[ ! -f "$BOOTSTRAP_SCRIPT" ]]; then
  echo "ERROR: Bootstrap script not found at ${BOOTSTRAP_SCRIPT}" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Resolve Canton JAR
# ---------------------------------------------------------------------------
DEFAULT_CANTON_JAR="${HOME}/.dpm/cache/components/canton-enterprise/3.4.9/lib/canton-enterprise-3.4.9.jar"

CANTON_JAR="${CANTON_JAR:-$DEFAULT_CANTON_JAR}"

if [[ ! -f "$CANTON_JAR" ]]; then
  echo "ERROR: Canton JAR not found at ${CANTON_JAR}" >&2
  echo "Install via dpm or set CANTON_JAR env var." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Clean previous state and ensure log directory exists
# ---------------------------------------------------------------------------
rm -rf "${DEMO_DIR}/log"
mkdir -p "${DEMO_DIR}/log"

# Also clean any Canton data directory (sandbox state)
rm -rf "${DEMO_DIR}/.canton" 2>/dev/null || true

# ---------------------------------------------------------------------------
# Port-file for readiness detection
# ---------------------------------------------------------------------------
PORT_FILE="${DEMO_DIR}/log/canton-ports.json"

# ---------------------------------------------------------------------------
# Launch Canton sandbox (background)
# ---------------------------------------------------------------------------
echo "[dev-ledger] Starting Canton sandbox..."
echo "[dev-ledger] Ledger API : ${LEDGER_API_PORT}"
echo "[dev-ledger] JSON API   : ${JSON_API_PORT}"
echo "[dev-ledger] Admin API  : ${ADMIN_API_PORT}"
echo "[dev-ledger] Party      : ${VITE_LEDGER_PARTY_ID}"
echo "[dev-ledger] User       : ${VITE_LEDGER_USER_ID}"
echo "[dev-ledger] DAR        : ${DAR_PATH}"
echo "[dev-ledger] Bootstrap  : ${BOOTSTRAP_SCRIPT}"
echo "[dev-ledger] Canton JAR : ${CANTON_JAR}"
echo ""

java -jar "$CANTON_JAR" sandbox \
  --ledger-api-port "$LEDGER_API_PORT" \
  --admin-api-port "$ADMIN_API_PORT" \
  --json-api-port "$JSON_API_PORT" \
  --sequencer-public-port "$SEQUENCER_PUBLIC_PORT" \
  --sequencer-admin-port "$SEQUENCER_ADMIN_PORT" \
  --mediator-admin-port "$MEDIATOR_ADMIN_PORT" \
  --dar "$DAR_PATH" \
  --canton-port-file "$PORT_FILE" \
  --no-tty \
  --log-file-name "${DEMO_DIR}/log/canton.log" \
  --log-file-appender rolling &
CANTON_PID=$!

# Forward signals to the sandbox process
cleanup() { kill "$CANTON_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Wait for sandbox readiness
# ---------------------------------------------------------------------------
echo "[dev-ledger] Waiting for sandbox to be ready..."
READY=false
for _ in $(seq 1 120); do
  if ! kill -0 "$CANTON_PID" 2>/dev/null; then
    echo "ERROR: Canton sandbox exited unexpectedly" >&2
    wait "$CANTON_PID" 2>/dev/null || true
    exit 1
  fi
  if [[ -f "$PORT_FILE" ]]; then
    READY=true
    break
  fi
  sleep 0.5
done

if ! $READY; then
  echo "ERROR: Sandbox did not become ready within 60 seconds" >&2
  exit 1
fi

echo "[dev-ledger] Sandbox ready."

# ---------------------------------------------------------------------------
# Run bootstrap via sandbox-console
# ---------------------------------------------------------------------------
echo "[dev-ledger] Running bootstrap script..."
BOOTSTRAP_ERR="${DEMO_DIR}/log/bootstrap-stderr.log"
java -jar "$CANTON_JAR" sandbox-console \
  --port "$LEDGER_API_PORT" \
  --admin-api-port "$ADMIN_API_PORT" \
  --sequencer-public-port "$SEQUENCER_PUBLIC_PORT" \
  --sequencer-admin-port "$SEQUENCER_ADMIN_PORT" \
  --mediator-admin-port "$MEDIATOR_ADMIN_PORT" \
  --bootstrap "$BOOTSTRAP_SCRIPT" \
  --no-tty \
  --log-file-name "${DEMO_DIR}/log/canton-bootstrap.log" \
  --log-file-appender flat 2>"$BOOTSTRAP_ERR" || {
    echo "WARNING: Bootstrap script failed. Stderr:" >&2
    cat "$BOOTSTRAP_ERR" >&2
    echo "WARNING: (sandbox may already be provisioned)" >&2
  }

echo "[dev-ledger] Sandbox running (PID: ${CANTON_PID})"

# ---------------------------------------------------------------------------
# Keep sandbox in foreground for concurrently
# ---------------------------------------------------------------------------
trap - EXIT
trap 'kill "$CANTON_PID" 2>/dev/null; wait "$CANTON_PID" 2>/dev/null' INT TERM
wait "$CANTON_PID"

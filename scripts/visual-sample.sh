#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
state_dir="$repo_dir/.visual-sample"
db_dir="$state_dir/postgres"
env_file="$state_dir/config.env"
db_port=55432
server_port=3010
frontend_port=8080

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

wait_for_http() {
  local url="$1"
  local pid_file="$2"
  local log_file="$3"
  for ((attempt = 0; attempt < 120; attempt++)); do
    if curl --silent --fail --output /dev/null "$url"; then
      return 0
    fi
    if ! is_running "$pid_file"; then
      echo "Process exited while starting. Recent log output:" >&2
      tail -n 35 "$log_file" >&2
      return 1
    fi
    sleep 2
  done
  echo "Timed out waiting for $url. Recent log output:" >&2
  tail -n 35 "$log_file" >&2
  return 1
}

check_ports() {
  for port in "$db_port" "$server_port" "$frontend_port"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | grep -q .; then
      echo "Port $port is already in use; stop the other service first." >&2
      exit 1
    fi
  done
}

prepare_config() {
  mkdir -p "$state_dir"
  chmod 700 "$state_dir"
  if [[ -f "$env_file" ]]; then
    return
  fi
  local db_password app_password demo_password encryption_key auth_secret
  db_password="$(openssl rand -hex 24)"
  app_password="$(openssl rand -hex 24)"
  demo_password="$(openssl rand -hex 24)"
  encryption_key="$(openssl rand -hex 32)"
  auth_secret="$(openssl rand -base64 48 | tr -d '\n')"
  umask 077
  cat > "$env_file" <<EOF
SPARKY_FITNESS_DB_HOST=127.0.0.1
SPARKY_FITNESS_DB_PORT=$db_port
SPARKY_FITNESS_DB_NAME=sparkyfitness_visual
SPARKY_FITNESS_DB_USER=sparky
SPARKY_FITNESS_DB_PASSWORD=$db_password
SPARKY_FITNESS_APP_DB_USER=sparky_app
SPARKY_FITNESS_APP_DB_PASSWORD=$app_password
SPARKY_FITNESS_FRONTEND_URL=http://localhost:$frontend_port
SPARKY_FITNESS_SERVER_PORT=$server_port
SPARKY_FITNESS_SERVER_BIND_HOST=127.0.0.1
SPARKY_FITNESS_API_ENCRYPTION_KEY=$encryption_key
BETTER_AUTH_SECRET=$auth_secret
SPARKY_FITNESS_DEMO_MODE=true
SPARKY_FITNESS_DEMO_EMAIL=visual-demo@example.com
SPARKY_FITNESS_DEMO_PASSWORD=$demo_password
SPARKY_FITNESS_LOG_LEVEL=ERROR
NODE_ENV=development
EOF
}

start_sample() {
  require_command initdb
  require_command pg_ctl
  require_command createdb
  require_command psql
  require_command openssl
  require_command curl
  require_command lsof
  [[ -x "$repo_dir/XoTServer/node_modules/.bin/tsx" ]] || {
    echo "Install workspace dependencies before starting the sample." >&2
    exit 1
  }
  [[ -x "$repo_dir/XoTFrontend/node_modules/.bin/vite" ]] || {
    echo "Install workspace dependencies before starting the sample." >&2
    exit 1
  }
  if is_running "$state_dir/server.pid" || is_running "$state_dir/frontend.pid"; then
    echo "Visual sample is already running. Use '$0 status' or '$0 stop'." >&2
    exit 1
  fi
  check_ports
  prepare_config
  set -a
  # Generated locally with simple assignment values; never checked into git.
  source "$env_file"
  set +a

  if [[ ! -f "$db_dir/PG_VERSION" ]]; then
    printf '%s\n' "$SPARKY_FITNESS_DB_PASSWORD" > "$state_dir/postgres-password"
    initdb -D "$db_dir" -U "$SPARKY_FITNESS_DB_USER" \
      -A scram-sha-256 --pwfile="$state_dir/postgres-password" \
      --no-instructions > "$state_dir/initdb.log" 2>&1
    rm "$state_dir/postgres-password"
  fi
  pg_ctl -D "$db_dir" -l "$state_dir/postgres.log" \
    -o "-h 127.0.0.1 -p $db_port" start > /dev/null
  if ! PGPASSWORD="$SPARKY_FITNESS_DB_PASSWORD" psql -h 127.0.0.1 \
    -p "$db_port" -U "$SPARKY_FITNESS_DB_USER" -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname = '$SPARKY_FITNESS_DB_NAME'" | grep -q 1; then
    PGPASSWORD="$SPARKY_FITNESS_DB_PASSWORD" createdb -h 127.0.0.1 \
      -p "$db_port" -U "$SPARKY_FITNESS_DB_USER" "$SPARKY_FITNESS_DB_NAME"
  fi

  (
    cd "$repo_dir/XoTServer"
    nohup ./node_modules/.bin/tsx index.ts \
      > "$state_dir/server.log" 2>&1 < /dev/null &
    echo "$!" > "$state_dir/server.pid"
  )
  wait_for_http "http://127.0.0.1:$server_port/api/health" \
    "$state_dir/server.pid" "$state_dir/server.log"

  (
    cd "$repo_dir/XoTFrontend"
    nohup ./node_modules/.bin/vite --host 127.0.0.1 \
      --port "$frontend_port" --strictPort \
      > "$state_dir/frontend.log" 2>&1 < /dev/null &
    echo "$!" > "$state_dir/frontend.pid"
  )
  wait_for_http "http://127.0.0.1:$frontend_port/" \
    "$state_dir/frontend.pid" "$state_dir/frontend.log"
  echo "Visual sample ready at http://localhost:$frontend_port"
  echo "Choose 'Explore Live Demo' on the login page, then open Diary and Reports."
  echo "Stop it with: $0 stop"
}

stop_sample() {
  for service in frontend server; do
    local pid_file="$state_dir/$service.pid"
    if is_running "$pid_file"; then
      kill "$(cat "$pid_file")" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  done
  if [[ -f "$db_dir/PG_VERSION" ]]; then
    pg_ctl -D "$db_dir" stop -m fast > /dev/null 2>&1 || true
  fi
  echo "Visual sample stopped. Its isolated data remains in .visual-sample/."
}

case "${1:-}" in
  start) start_sample ;;
  serve)
    start_sample
    trap stop_sample EXIT
    echo "Serving visual sample. Press Ctrl+C to stop."
    while is_running "$state_dir/server.pid" && is_running "$state_dir/frontend.pid"; do
      sleep 2
    done
    echo "A visual sample process exited. Check .visual-sample/*.log." >&2
    exit 1
    ;;
  stop) stop_sample ;;
  status)
    for service in server frontend; do
      if is_running "$state_dir/$service.pid"; then
        echo "$service: running"
      else
        echo "$service: stopped"
      fi
    done
    if [[ -f "$db_dir/PG_VERSION" ]] && pg_ctl -D "$db_dir" status > /dev/null 2>&1; then
      echo "database: running"
    else
      echo "database: stopped"
    fi
    ;;
  *) echo "Usage: $0 {serve|start|stop|status}" >&2; exit 2 ;;
esac

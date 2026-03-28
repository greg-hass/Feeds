#!/bin/sh
set -eu

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-feeds-smoke}"
PORT="${FEEDS_PORT:-38080}"
SETUP_PASSWORD="${SMOKE_TEST_PASSWORD:-smoke-test-password}"
JWT_SECRET_VALUE="${JWT_SECRET:-smoke-test-secret-key-that-is-at-least-32-characters}"
LOG_LEVEL_VALUE="${LOG_LEVEL:-warn}"
GEMINI_API_KEY_VALUE="${GEMINI_API_KEY:-}"
YOUTUBE_API_KEY_VALUE="${YOUTUBE_API_KEY:-}"
BOOTSTRAP_PASSWORD="${SMOKE_TEST_BOOTSTRAP_PASSWORD:-smoke-test-env-password}"

compose_with_env() {
    scenario_project="$1"
    scenario_port="$2"
    scenario_app_password="$3"
    shift 3

    COMPOSE_PROJECT_NAME="$scenario_project" \
    FEEDS_PORT="$scenario_port" \
    JWT_SECRET="$JWT_SECRET_VALUE" \
    APP_PASSWORD="$scenario_app_password" \
    CORS_ORIGIN="http://127.0.0.1:${scenario_port}" \
    LOG_LEVEL="$LOG_LEVEL_VALUE" \
    GEMINI_API_KEY="$GEMINI_API_KEY_VALUE" \
    YOUTUBE_API_KEY="$YOUTUBE_API_KEY_VALUE" \
    docker compose "$@"
}

cleanup() {
    compose_with_env "${PROJECT_NAME}-setup" "$PORT" "" down -v --remove-orphans >/dev/null 2>&1 || true
    compose_with_env "${PROJECT_NAME}-bootstrap" "$((PORT + 1))" "$BOOTSTRAP_PASSWORD" down -v --remove-orphans >/dev/null 2>&1 || true
}

wait_for_status() {
    scenario_project="$1"
    scenario_port="$2"
    attempts=60
    status_json=''
    until status_json="$(curl -fsS "http://127.0.0.1:${scenario_port}/api/v1/auth/status" 2>/dev/null)"; do
        attempts=$((attempts - 1))
        if [ "$attempts" -le 0 ]; then
            echo "Smoke test failed: auth status endpoint did not become ready on port ${scenario_port}" >&2
            echo "---- docker compose ps (${scenario_project}) ----" >&2
            compose_with_env "$scenario_project" "$scenario_port" "" ps >&2 || true
            echo "---- docker compose logs (${scenario_project}) ----" >&2
            compose_with_env "$scenario_project" "$scenario_port" "" logs --no-color --tail=200 >&2 || true
            exit 1
        fi
        sleep 2
    done
    printf '%s' "$status_json"
}

extract_token() {
    printf '%s' "$1" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

assert_protected_endpoint() {
    scenario_port="$1"
    token="$2"

    unauth_code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${scenario_port}/api/v1/feeds")"
    [ "$unauth_code" = "401" ]

    invalid_token_code="$(curl -s -o /dev/null -w '%{http_code}' \
        -H 'Authorization: Bearer invalid-token' \
        "http://127.0.0.1:${scenario_port}/api/v1/feeds")"
    [ "$invalid_token_code" = "401" ]

    auth_code="$(curl -s -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer ${token}" \
        "http://127.0.0.1:${scenario_port}/api/v1/feeds")"
    [ "$auth_code" = "200" ]
}

trap cleanup EXIT INT TERM

setup_project="${PROJECT_NAME}-setup"
bootstrap_project="${PROJECT_NAME}-bootstrap"
bootstrap_port="$((PORT + 1))"

compose_with_env "$setup_project" "$PORT" "" up -d --build

status_json="$(wait_for_status "$setup_project" "$PORT")"
printf '%s' "$status_json" | grep -q '"authEnabled":true'
printf '%s' "$status_json" | grep -q '"needsSetup":true'
printf '%s' "$status_json" | grep -q '"hasEnvPassword":false'

setup_json="$(curl -fsS \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${SETUP_PASSWORD}\"}" \
    "http://127.0.0.1:${PORT}/api/v1/auth/setup")"

printf '%s' "$setup_json" | grep -q '"message":"Password configured successfully"'
printf '%s' "$setup_json" | grep -q '"token":"'
setup_token="$(extract_token "$setup_json")"
[ -n "$setup_token" ]

status_after_setup="$(curl -fsS "http://127.0.0.1:${PORT}/api/v1/auth/status")"
printf '%s' "$status_after_setup" | grep -q '"needsSetup":false'

invalid_setup_login_code="$(curl -s -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d '{"password":"wrong-password"}' \
    "http://127.0.0.1:${PORT}/api/v1/auth/login")"
[ "$invalid_setup_login_code" = "401" ]

login_json="$(curl -fsS \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${SETUP_PASSWORD}\"}" \
    "http://127.0.0.1:${PORT}/api/v1/auth/login")"

printf '%s' "$login_json" | grep -q '"token":"'
printf '%s' "$login_json" | grep -q '"username":"admin"'
login_token="$(extract_token "$login_json")"
[ -n "$login_token" ]
assert_protected_endpoint "$PORT" "$login_token"

compose_with_env "$bootstrap_project" "$bootstrap_port" "$BOOTSTRAP_PASSWORD" up -d --build

bootstrap_status="$(wait_for_status "$bootstrap_project" "$bootstrap_port")"
printf '%s' "$bootstrap_status" | grep -q '"authEnabled":true'
printf '%s' "$bootstrap_status" | grep -q '"needsSetup":true'
printf '%s' "$bootstrap_status" | grep -q '"hasEnvPassword":true'

invalid_bootstrap_login_code="$(curl -s -o /dev/null -w '%{http_code}' \
    -H 'Content-Type: application/json' \
    -d '{"password":"wrong-password"}' \
    "http://127.0.0.1:${bootstrap_port}/api/v1/auth/login")"
[ "$invalid_bootstrap_login_code" = "401" ]

bootstrap_login="$(curl -fsS \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"${BOOTSTRAP_PASSWORD}\"}" \
    "http://127.0.0.1:${bootstrap_port}/api/v1/auth/login")"

printf '%s' "$bootstrap_login" | grep -q '"token":"'
printf '%s' "$bootstrap_login" | grep -q '"username":"admin"'
bootstrap_token="$(extract_token "$bootstrap_login")"
[ -n "$bootstrap_token" ]
assert_protected_endpoint "$bootstrap_port" "$bootstrap_token"

bootstrap_status_after_login="$(curl -fsS "http://127.0.0.1:${bootstrap_port}/api/v1/auth/status")"
printf '%s' "$bootstrap_status_after_login" | grep -q '"needsSetup":false'

echo "Docker smoke test passed on http://127.0.0.1:${PORT} and http://127.0.0.1:${bootstrap_port}"

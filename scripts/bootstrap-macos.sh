#!/usr/bin/env bash

set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-22}"
START_COLIMA="${START_COLIMA:-1}"
DOCKER_PLUGIN_DIR="/opt/homebrew/lib/docker/cli-plugins"
ZSHRC_FILE="${HOME}/.zshrc"
DOCKER_CONFIG_DIR="${HOME}/.docker"
DOCKER_CONFIG_FILE="${DOCKER_CONFIG_DIR}/config.json"

BREW_PACKAGES=(
  fnm
  pnpm
  jq
  just
  docker
  docker-compose
  colima
)

require_command() {
  local command_name="$1"
  local install_hint="$2"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}"
    echo "${install_hint}"
    exit 1
  fi
}

load_homebrew_shellenv() {
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    return
  fi

  if [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

ensure_xcode_tools() {
  if xcode-select -p >/dev/null 2>&1; then
    return
  fi

  echo "Apple Command Line Tools are required."
  echo "Run: xcode-select --install"
  exit 1
}

ensure_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    return
  fi

  echo "Homebrew is required."
  echo "Install it with:"
  echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  exit 1
}

install_brew_packages() {
  brew install "${BREW_PACKAGES[@]}"
}

ensure_fnm_shell_init() {
  touch "${ZSHRC_FILE}"

  if grep -Fq 'fnm env --use-on-cd --shell zsh' "${ZSHRC_FILE}"; then
    return
  fi

  cat <<'EOF' >> "${ZSHRC_FILE}"

# fnm: fast Node version manager
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --use-on-cd --shell zsh)"
fi
EOF
}

ensure_docker_plugin_config() {
  mkdir -p "${DOCKER_CONFIG_DIR}"

  if [ ! -f "${DOCKER_CONFIG_FILE}" ]; then
    cat <<EOF > "${DOCKER_CONFIG_FILE}"
{
  "cliPluginsExtraDirs": [
    "${DOCKER_PLUGIN_DIR}"
  ]
}
EOF
    return
  fi

  local tmp_file
  tmp_file="$(mktemp)"

  jq --arg plugin_dir "${DOCKER_PLUGIN_DIR}" '
    .cliPluginsExtraDirs = ((.cliPluginsExtraDirs // []) + [$plugin_dir] | unique)
  ' "${DOCKER_CONFIG_FILE}" > "${tmp_file}"

  mv "${tmp_file}" "${DOCKER_CONFIG_FILE}"
}

install_node_and_set_default() {
  eval "$(fnm env --shell bash)"
  fnm install "${NODE_MAJOR}"
  fnm default "${NODE_MAJOR}"
  fnm use default >/dev/null
}

start_colima_if_needed() {
  if [ "${START_COLIMA}" != "1" ]; then
    return
  fi

  if colima status 2>/dev/null | grep -q '^status: Running'; then
    return
  fi

  colima start
}

verify_environment() {
  eval "$(fnm env --shell bash)"

  echo
  echo "Installed tool versions"
  echo "node: $(node -v)"
  echo "pnpm: $(pnpm --version)"
  echo "jq: $(jq --version)"
  echo "just: $(just --version)"
  echo "docker: $(docker --version)"
  echo "docker compose: $(docker compose version)"

  if colima status >/dev/null 2>&1; then
    echo "colima: $(colima version | head -n 1)"
    echo "docker server: $(docker info --format '{{.ServerVersion}}')"
  fi
}

main() {
  ensure_xcode_tools
  ensure_homebrew
  load_homebrew_shellenv
  install_brew_packages
  ensure_fnm_shell_init
  ensure_docker_plugin_config
  install_node_and_set_default
  start_colima_if_needed
  verify_environment
}

main "$@"

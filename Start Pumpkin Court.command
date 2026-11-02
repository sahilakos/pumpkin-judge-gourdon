#!/bin/zsh
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if curl --max-time 2 -fsS http://127.0.0.1:3000/api/config >/dev/null 2>&1; then
  open "http://127.0.0.1:3000/"
  exit 0
fi
if [[ ! -d node_modules ]]; then
  npm ci || exit 1
fi
if [[ ! -f dist/index.html ]]; then
  npm run build || exit 1
fi
(sleep 2; open "http://127.0.0.1:3000/") &
npm start


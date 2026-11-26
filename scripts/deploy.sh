#!/usr/bin/env bash
# Deploy the committed code to the Vultr server (urstoothfully.org).
#
#   bash scripts/deploy.sh          # deploy, then follow the build
#   bash scripts/deploy.sh status   # how the last deploy went
#   bash scripts/deploy.sh logs     # live app logs (Ctrl+C to stop)
#
# Run from Git Bash in the project folder. Only COMMITTED code is sent
# (git archive HEAD), so commit first. The build runs on the server and keeps
# going even if this window closes; the site stays up until the ~5 s restart.
# Database migrations are NOT run here — apply them first:
#   npx prisma migrate deploy   (with DATABASE_URL / DIRECT_URL set)
set -euo pipefail

KEY="${URSTOOTHFULLY_KEY:-$HOME/.ssh/urstoothfully_vultr}"
HOST="root@64.176.145.84"
SSH=(ssh -i "$KEY" -o ServerAliveInterval=20 "$HOST")

case "${1:-deploy}" in
  status) "${SSH[@]}" 'cat /root/deploy.log; echo; cd /opt/urstoothfully && docker compose ps --format "app: {{.Status}}"' ;;
  logs)   "${SSH[@]}" 'cd /opt/urstoothfully && docker compose logs -f --tail 50 app' ;;
  deploy)
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
      echo "Note: you have uncommitted changes — they will NOT be deployed."
    fi
    echo "Deploying $(git log --oneline -1)"
    git archive HEAD | "${SSH[@]}" 'cd /opt/urstoothfully && rm -rf src.new && mkdir src.new && tar -x -C src.new && rm -rf src && mv src.new src && (nohup /root/deploy.sh > /root/deploy.log 2>&1 &)'
    echo "Building on the server (about 8 minutes). Following the build — Ctrl+C stops watching, not the deploy."
    "${SSH[@]}" 'sleep 3; tail -n +1 -f /root/build.log & T=$!; until grep -qE "DONE|BUILD FAILED" /root/deploy.log; do sleep 5; done; kill $T; echo; cat /root/deploy.log'
    ;;
  *) echo "Usage: bash scripts/deploy.sh [deploy|status|logs]"; exit 1 ;;
esac

#!/usr/bin/env bash
# Control the background content pipeline (a user-level systemd unit, survives logout).
#   ./ctl.sh start        start or resume the audio loop (begins at START_RANK, default 278 = where study currently is)
#   ./ctl.sh cards        write all missing cards with DeepSeek (parallel, no thinking), then exit
#   ./ctl.sh stop         finish the current clip, then exit
#   ./ctl.sh status       progress summary
#   ./ctl.sh logs [N]     last N log lines
set -euo pipefail
cd "$(dirname "$0")"
CONTENT=../../content
case "${1:-status}" in
  start)
    rm -f "$CONTENT/STOP"
    systemd-run --user --unit=wordcore-content --collect --working-directory="$PWD" \
      --setenv=START_RANK="${START_RANK:-278}" --setenv=MIMO_DAILY_CAP="${MIMO_DAILY_CAP:-40000}" --setenv=AUDIO_WORKERS="${AUDIO_WORKERS:-4}" \
      --setenv=CARDS_PROVIDER="${CARDS_PROVIDER:-deepseek}" \
      --property=Restart=on-failure --property=RestartSec=120 \
      /usr/bin/python3 -u pipeline.py run
    ;;
  cards)
    rm -f "$CONTENT/STOP"
    systemd-run --user --unit=wordcore-cards --collect --working-directory="$PWD" \
      --setenv=START_RANK="${START_RANK:-278}" --setenv=CARD_WORKERS="${CARD_WORKERS:-12}" \
      /usr/bin/python3 -u pipeline.py cards
    ;;
  stop)
    touch "$CONTENT/STOP"
    echo "asked the pipeline to stop after the current clip"
    ;;
  status)
    python3 pipeline.py status
    echo "units:  audio $(systemctl --user is-active wordcore-content 2>/dev/null || true), cards $(systemctl --user is-active wordcore-cards 2>/dev/null || true)"
    ;;
  logs)
    tail -n "${2:-40}" "$CONTENT/logs/pipeline.log"
    ;;
  *) echo "usage: $0 start|cards|stop|status|logs [N]" >&2; exit 2 ;;
esac

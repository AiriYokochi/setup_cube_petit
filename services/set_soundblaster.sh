#!/usr/bin/env bash
# Detect this machine's Sound Blaster sink/source and set them as the
# default PulseAudio output/input.
#
# Previously set-soundblaster.service hardcoded a specific unit's sink name
# (including its USB serial number) in ExecStart, so it only ever worked on
# the one individual it was copied from. This script instead looks the
# device up at runtime, so the same service file works on every Cube Petit.
#
# USB audio devices are not always enumerated by PulseAudio yet at the
# moment this systemd --user unit fires (e.g. right after login), so this
# retries for a while before giving up.

set -u

TIMEOUT="${SET_SOUNDBLASTER_TIMEOUT:-30}"
INTERVAL=1
elapsed=0
sink_name=""
src_name=""

while [ "$elapsed" -le "$TIMEOUT" ]; do
  if [ -z "$sink_name" ]; then
    sink_name=$(pactl list short sinks 2>/dev/null | grep -i "sound_blaster" | awk '{print $2}' | head -n 1)
  fi
  if [ -z "$src_name" ]; then
    # exclude monitor sources (loopback of the sink itself, not a real mic input)
    src_name=$(pactl list short sources 2>/dev/null | grep -v monitor | grep -i "sound_blaster" | awk '{print $2}' | head -n 1)
  fi
  if [ -n "$sink_name" ] && [ -n "$src_name" ]; then
    break
  fi
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

status=0

if [ -n "$sink_name" ]; then
  pactl set-default-sink "$sink_name"
  echo "set_soundblaster.sh: default sink -> $sink_name"
else
  echo "set_soundblaster.sh: no Sound Blaster sink found after ${TIMEOUT}s" >&2
  status=1
fi

if [ -n "$src_name" ]; then
  pactl set-default-source "$src_name"
  echo "set_soundblaster.sh: default source -> $src_name"
else
  echo "set_soundblaster.sh: no Sound Blaster source found after ${TIMEOUT}s" >&2
  status=1
fi

exit "$status"

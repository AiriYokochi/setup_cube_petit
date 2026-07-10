#!/bin/sh
# Stop the slcand instance started by startCan.sh.
#
# Previously this used `ps aux | grep slcand | awk ... | head -1`, which
# can match grep's own "grep slcand" line in the process list and kill
# the wrong PID depending on process ordering. pkill -x matches only
# processes whose command name is exactly "slcand", avoiding that bug.
pkill -x slcand

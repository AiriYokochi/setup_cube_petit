#!/bin/sh
kill $(ps aux | grep slcand | awk -F ' ' '{print $2}' | head -1)

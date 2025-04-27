#!/bin/bash
nmcli connection show

sudo nmcli connection modify "cube-petit-router-5G-2" connection.autoconnect-priority 100
# sudo nmcli connection modify "cube-petit-router-2G-2" connection.autoconnect-priority 10
#!/bin/bash
echo "[$(date +%H:%M:%S)] Hook triggered" >> /tmp/hook-debug.log
cat >> /tmp/hook-debug.log
echo "" >> /tmp/hook-debug.log

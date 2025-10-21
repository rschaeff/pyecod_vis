#!/bin/bash
#
# Stop pyecod_vis server running in background
#

cd "$(dirname "$0")"

if [ ! -f pyecod_vis.pid ]; then
    echo "No PID file found. Server may not be running."
    exit 1
fi

PID=$(cat pyecod_vis.pid)

if ! ps -p $PID > /dev/null 2>&1; then
    echo "Server is not running (PID $PID not found)"
    rm pyecod_vis.pid
    exit 1
fi

echo "Stopping pyecod_vis server (PID: $PID)..."
kill $PID

# Wait for graceful shutdown
sleep 2

if ps -p $PID > /dev/null 2>&1; then
    echo "Forcing shutdown..."
    kill -9 $PID
fi

rm pyecod_vis.pid

echo "✓ Server stopped"

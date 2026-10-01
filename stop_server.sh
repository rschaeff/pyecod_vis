#!/bin/bash
#
# Stop pyecod_vis server running in background
#
# Kills the whole process group (npm + next-server child), not just npm,
# otherwise next-server is orphaned and keeps holding the port.
#

cd "$(dirname "$0")"

if [ ! -f pyecod_vis.pid ]; then
    echo "No PID file found. Server may not be running."
    echo "Check for orphaned servers with: ss -ltnp | grep -E ':(3001|4001) '"
    exit 1
fi

PID=$(cat pyecod_vis.pid)

if ! ps -p $PID > /dev/null 2>&1; then
    echo "Server is not running (PID $PID not found)"
    rm pyecod_vis.pid
    exit 1
fi

PGID=$(ps -o pgid= -p $PID | tr -d ' ')

# All descendants of a PID (npm -> sh -> next-server)
descendants() {
    local child
    for child in $(pgrep -P "$1"); do
        echo "$child"
        descendants "$child"
    done
}

# Only signal the group if start_background.sh made the server its leader;
# never kill the group of the shell running this script
if [ "$PGID" = "$PID" ]; then
    TARGET="-$PGID"
    echo "Stopping pyecod_vis server (process group: $PGID)..."
else
    # Server started by an older script: signal npm and its descendants directly
    TARGET="$PID $(descendants $PID | tr '\n' ' ')"
    echo "Stopping pyecod_vis server (PIDs: $TARGET)..."
fi

kill -TERM -- $TARGET 2>/dev/null

# Wait for graceful shutdown
for i in $(seq 1 10); do
    ps -p $PID > /dev/null 2>&1 || break
    sleep 1
done

if ps -p $PID > /dev/null 2>&1; then
    echo "Forcing shutdown..."
    kill -9 -- $TARGET 2>/dev/null
fi

rm pyecod_vis.pid

echo "✓ Server stopped"

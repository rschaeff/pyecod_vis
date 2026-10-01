#!/bin/bash
#
# Start pyecod_vis server in background on leda
# Server will continue running even after terminal is closed
#
# Usage: ./start_background.sh          # production build (npm start, port 3001)
#        ./start_background.sh --dev    # dev server (npm run dev:leda, port 4001)
#

cd "$(dirname "$0")"

if [ "$1" = "--dev" ]; then
    MODE="dev"
    NPM_CMD="npm run dev:leda"
    PORT=4001
else
    MODE="production"
    NPM_CMD="npm start"
    PORT=3001
    if [ ! -f .next/BUILD_ID ]; then
        echo "Error: No production build found. Run 'npm run build' first."
        exit 1
    fi
fi

# Check if already running
if [ -f pyecod_vis.pid ]; then
    PID=$(cat pyecod_vis.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Error: Server is already running (PID: $PID)"
        echo "Stop it first with: ./stop_server.sh"
        exit 1
    fi
fi

if ss -ltn | grep -q ":$PORT "; then
    echo "Error: Port $PORT is already in use:"
    ss -ltnp | grep ":$PORT "
    exit 1
fi

echo "=========================================="
echo "Starting pyecod_vis ($MODE) in background on leda"
echo "=========================================="

# Start in its own session/process group so stop_server.sh can kill
# npm and the next-server child together
setsid nohup $NPM_CMD > pyecod_vis.log 2>&1 < /dev/null &
PID=$!

# Save PID
echo $PID > pyecod_vis.pid

echo ""
echo "Server started"
echo "  PID: $PID"
echo "  Log: $(pwd)/pyecod_vis.log"
echo ""
echo "Accessible at:"
echo "  - http://leda.swmed.edu:$PORT"
echo "  - http://10.18.0.1:$PORT"
echo "  - http://129.112.32.18:$PORT"
echo ""
echo "To stop: ./stop_server.sh"
echo "To view logs: tail -f pyecod_vis.log"
echo ""

# Wait for the port to come up (startup is slow on NFS)
for i in $(seq 1 30); do
    if ! ps -p $PID > /dev/null 2>&1; then
        echo "✗ Server failed to start. Check pyecod_vis.log for errors"
        rm -f pyecod_vis.pid
        exit 1
    fi
    if ss -ltn | grep -q ":$PORT "; then
        echo "✓ Server is listening on port $PORT"
        exit 0
    fi
    sleep 2
done

echo "⚠ Server process is running but port $PORT is not listening yet. Check pyecod_vis.log"

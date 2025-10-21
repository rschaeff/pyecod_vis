#!/bin/bash
#
# Start pyecod_vis server in background on leda
# Server will continue running even after terminal is closed
#

cd "$(dirname "$0")"

# Check if already running
if [ -f pyecod_vis.pid ]; then
    PID=$(cat pyecod_vis.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Error: Server is already running (PID: $PID)"
        echo "Stop it first with: ./stop_server.sh"
        exit 1
    fi
fi

echo "=========================================="
echo "Starting pyecod_vis in background on leda"
echo "=========================================="

# Start server in background
nohup npm run dev:leda > pyecod_vis.log 2>&1 &
PID=$!

# Save PID
echo $PID > pyecod_vis.pid

echo ""
echo "Server started successfully!"
echo "  PID: $PID"
echo "  Log: $(pwd)/pyecod_vis.log"
echo ""
echo "Accessible at:"
echo "  - http://leda:3000"
echo "  - http://10.18.0.1:3000"
echo "  - http://129.112.32.18:3000"
echo ""
echo "To stop: ./stop_server.sh"
echo "To view logs: tail -f pyecod_vis.log"
echo ""

# Wait a moment and check if it started successfully
sleep 3
if ps -p $PID > /dev/null 2>&1; then
    echo "✓ Server is running"
else
    echo "✗ Server failed to start. Check pyecod_vis.log for errors"
    rm pyecod_vis.pid
    exit 1
fi

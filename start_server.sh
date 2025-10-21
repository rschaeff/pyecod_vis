#!/bin/bash
#
# Start pyecod_vis server on leda
# Accessible on network at http://leda:3000 or http://10.18.0.1:3000
#

cd "$(dirname "$0")"

echo "=========================================="
echo "Starting pyecod_vis on leda"
echo "=========================================="
echo ""
echo "Accessible at:"
echo "  - http://leda:3000"
echo "  - http://10.18.0.1:3000"
echo "  - http://129.112.32.18:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run in development mode with network binding
npm run dev:leda

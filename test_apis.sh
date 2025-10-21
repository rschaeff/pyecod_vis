#!/bin/bash

echo "===================================="
echo "Testing pyecod_vis API Endpoints"
echo "===================================="
echo ""

# Test 1: Login
echo "1. Testing /api/auth/login"
echo "   POST with username=rschaeff, password=ecod"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rschaeff","password":"ecod"}' \
  -c /tmp/session_cookie.txt \
  -w '\n%{http_code}')
echo "   Response: $LOGIN_RESPONSE"
echo ""

# Test 2: Check session
echo "2. Testing /api/auth/me"
echo "   GET with session cookie"
ME_RESPONSE=$(curl -s http://localhost:3000/api/auth/me \
  -b /tmp/session_cookie.txt)
echo "   Response: $ME_RESPONSE"
echo ""

# Test 3: Queue
echo "3. Testing /api/queue"
echo "   GET (default parameters)"
QUEUE_RESPONSE=$(curl -s http://localhost:3000/api/queue | python3 -m json.tool | head -20)
echo "$QUEUE_RESPONSE"
echo ""

# Test 4: Protein details
echo "4. Testing /api/protein/:id"
echo "   GET /api/protein/8s72_A"
PROTEIN_RESPONSE=$(curl -s http://localhost:3000/api/protein/8s72_A | python3 -m json.tool | head -40)
echo "$PROTEIN_RESPONSE"
echo ""

# Test 5: Structure (will likely 404 for now)
echo "5. Testing /api/structure/:id"
echo "   GET /api/structure/8s72_A"
STRUCTURE_RESPONSE=$(curl -s http://localhost:3000/api/structure/8s72_A | head -10)
echo "   Response: $STRUCTURE_RESPONSE"
echo ""

# Test 6: Curate (dry run - won't actually submit)
echo "6. Testing /api/curate (structure only, not executing)"
echo "   Would POST curation decision with domains[]"
echo "   Skipping actual submission to avoid modifying data"
echo ""

echo "===================================="
echo "API Tests Complete"
echo "===================================="

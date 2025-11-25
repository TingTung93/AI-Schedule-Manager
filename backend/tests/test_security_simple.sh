#!/usr/bash
#!/bin/bash
#
# Simple security headers test script
# Tests CSRF protection and security headers using curl
#

echo "=== Security Headers and CSRF Protection Test ==="
echo

# Start the backend if not running (assumes it's on localhost:8000)
BASE_URL="http://localhost:8000"

echo "Testing security headers on /health endpoint..."
echo "----------------------------------------------"

response=$(curl -s -I $BASE_URL/health)

# Check each security header
check_header() {
    header=$1
    expected=$2

    if echo "$response" | grep -qi "$header:"; then
        value=$(echo "$response" | grep -i "$header:" | cut -d: -f2- | tr -d '\r\n' | xargs)
        echo "✓ $header: $value"
        return 0
    else
        echo "✗ $header: MISSING"
        return 1
    fi
}

# Test all security headers
check_header "X-Content-Type-Options" "nosniff"
check_header "X-Frame-Options" "DENY"
check_header "X-XSS-Protection" "1; mode=block"
check_header "Content-Security-Policy" "default-src"
check_header "Referrer-Policy" "strict-origin"
check_header "Permissions-Policy" ""

echo
echo "Testing CSRF token endpoint..."
echo "-------------------------------"

csrf_response=$(curl -s -c /tmp/csrf_cookies.txt $BASE_URL/api/csrf-token)
if echo "$csrf_response" | grep -q "CSRF token"; then
    echo "✓ CSRF token endpoint accessible"

    if grep -q "fastapi-csrf-token\|csrf" /tmp/csrf_cookies.txt 2>/dev/null; then
        echo "✓ CSRF cookie set"
    else
        echo "✗ CSRF cookie not found"
    fi
else
    echo "✗ CSRF token endpoint failed"
fi

echo
echo "Testing POST without CSRF token (should fail)..."
echo "------------------------------------------------"

post_response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"test": "data"}' \
    $BASE_URL/api/rules/parse)

http_code=$(echo "$post_response" | tail -n 1)
if [ "$http_code" = "401" ] || [ "$http_code" = "403" ]; then
    echo "✓ POST without CSRF token rejected (HTTP $http_code)"
else
    echo "⚠ POST returned HTTP $http_code (expected 401/403)"
fi

echo
echo "=== Test Summary ==="
echo "All critical security headers should be present"
echo "CSRF protection should be active"
echo

# Cleanup
rm -f /tmp/csrf_cookies.txt

echo "✅ Security test complete!"

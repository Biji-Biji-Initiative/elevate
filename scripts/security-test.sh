#!/bin/bash

# Security Testing Suite for MS Elevate LEAPS Tracker
# This script performs various security tests to verify implemented protections

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_URL="${ADMIN_URL:-http://localhost:3001}"

echo -e "${BLUE}🔐 MS Elevate LEAPS Tracker Security Test Suite${NC}"
echo "========================================================"
echo "Testing against: $BASE_URL"
echo ""

# Function to print test results
print_test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Function to test HTTP status
test_http_status() {
    local url=$1
    local expected_status=$2
    local description=$3
    
    actual_status=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$actual_status" = "$expected_status" ]; then
        print_test_result 0 "$description (Status: $actual_status)"
        return 0
    else
        print_test_result 1 "$description (Expected: $expected_status, Got: $actual_status)"
        return 1
    fi
}

# Function to test header presence
test_security_header() {
    local url=$1
    local header=$2
    local description=$3
    
    header_value=$(curl -s -I "$url" | grep -i "$header:" || echo "")
    
    if [ -n "$header_value" ]; then
        print_test_result 0 "$description"
        echo "  └─ $header_value"
        return 0
    else
        print_test_result 1 "$description (Header not found)"
        return 1
    fi
}

echo -e "${YELLOW}1. Testing Security Headers${NC}"
echo "----------------------------------------"

test_security_header "$BASE_URL" "X-Frame-Options" "X-Frame-Options header present"
test_security_header "$BASE_URL" "X-Content-Type-Options" "X-Content-Type-Options header present"
test_security_header "$BASE_URL" "Referrer-Policy" "Referrer-Policy header present"
test_security_header "$BASE_URL" "Content-Security-Policy" "Content-Security-Policy header present"
test_security_header "$BASE_URL" "Permissions-Policy" "Permissions-Policy header present"

echo ""

echo -e "${YELLOW}2. Testing CSRF Protection${NC}"
echo "----------------------------------------"

# Test CSRF protection on submissions endpoint
csrf_response=$(curl -s -X POST "$BASE_URL/api/submissions" \
    -H "Content-Type: application/json" \
    -d '{"activityCode": "LEARN", "payload": {}}' \
    -w "%{http_code}")

if echo "$csrf_response" | grep -q "403"; then
    print_test_result 0 "CSRF protection active on submissions endpoint"
elif echo "$csrf_response" | grep -q "401"; then
    print_test_result 0 "Authentication required (CSRF protection may be active)"
else
    print_test_result 1 "CSRF protection may not be working on submissions endpoint"
fi

# Test CSRF protection on file upload endpoint
upload_response=$(curl -s -X POST "$BASE_URL/api/files/upload" \
    -F "file=@package.json" \
    -F "activityCode=EXPLORE" \
    -w "%{http_code}")

if echo "$upload_response" | grep -q "403"; then
    print_test_result 0 "CSRF protection active on file upload endpoint"
elif echo "$upload_response" | grep -q "401"; then
    print_test_result 0 "Authentication required (CSRF protection may be active)"
else
    print_test_result 1 "CSRF protection may not be working on file upload endpoint"
fi

echo ""

echo -e "${YELLOW}3. Testing Content Security Policy${NC}"
echo "----------------------------------------"

# Check if CSP report endpoint exists
test_http_status "$BASE_URL/api/csp-report" "405" "CSP report endpoint accessible (rejects GET)"

# Test CSP report endpoint with POST (should accept)
csp_report_response=$(curl -s -X POST "$BASE_URL/api/csp-report" \
    -H "Content-Type: application/csp-report" \
    -d '{"csp-report": {"document-uri": "test", "violated-directive": "script-src"}}' \
    -w "%{http_code}")

if echo "$csp_report_response" | grep -q "200\|400"; then
    print_test_result 0 "CSP report endpoint accepts POST requests"
else
    print_test_result 1 "CSP report endpoint not working properly"
fi

echo ""

echo -e "${YELLOW}4. Testing File Upload Security${NC}"
echo "----------------------------------------"

# Create test files
echo "Test content" > /tmp/test.txt
echo "Test PDF content" > /tmp/test.pdf
touch /tmp/test.exe

# Test file type validation (should fail)
if curl -s -f -X POST "$BASE_URL/api/files/upload" \
    -F "file=@/tmp/test.exe" \
    -F "activityCode=EXPLORE" >/dev/null 2>&1; then
    print_test_result 1 "File type validation failed - .exe file was accepted"
else
    print_test_result 0 "File type validation working - .exe file rejected"
fi

# Test valid file types (would need authentication)
echo "  Note: Valid file upload tests require authentication"

echo ""

echo -e "${YELLOW}5. Testing Rate Limiting${NC}"
echo "----------------------------------------"

# Test basic rate limiting on health endpoint (if available)
rate_limit_test() {
    local endpoint=$1
    local max_requests=$2
    local description=$3
    
    echo "  Testing $description..."
    
    success_count=0
    rate_limited=false
    
    for i in $(seq 1 $((max_requests + 5))); do
        status=$(curl -s -o /dev/null -w "%{http_code}" "$endpoint" || echo "000")
        
        if [ "$status" = "429" ]; then
            rate_limited=true
            break
        elif [ "$status" = "200" ] || [ "$status" = "405" ]; then
            success_count=$((success_count + 1))
        fi
        
        # Small delay between requests
        sleep 0.1
    done
    
    if [ "$rate_limited" = true ]; then
        print_test_result 0 "$description - Rate limiting active after $success_count requests"
    else
        print_test_result 1 "$description - No rate limiting detected"
    fi
}

# Test health endpoint for basic rate limiting
if curl -s "$BASE_URL/api/health" >/dev/null 2>&1; then
    rate_limit_test "$BASE_URL/api/health" 100 "Health endpoint rate limiting"
else
    echo "  Health endpoint not available for rate limit testing"
fi

echo ""

echo -e "${YELLOW}6. Testing Authentication Protection${NC}"
echo "----------------------------------------"

# Test protected endpoints without authentication
protected_endpoints=(
    "/api/submissions:GET"
    "/api/dashboard:GET"
    "/dashboard:GET"
    "/admin:GET"
)

for endpoint_method in "${protected_endpoints[@]}"; do
    IFS=':' read -r endpoint method <<< "$endpoint_method"
    
    if [ "$method" = "GET" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" || echo "000")
    else
        status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" || echo "000")
    fi
    
    if [ "$status" = "401" ] || [ "$status" = "403" ] || [ "$status" = "307" ] || [ "$status" = "302" ]; then
        print_test_result 0 "Protected endpoint $endpoint requires authentication"
    else
        print_test_result 1 "Protected endpoint $endpoint may not be properly secured (Status: $status)"
    fi
done

echo ""

echo -e "${YELLOW}7. Testing Input Sanitization${NC}"
echo "----------------------------------------"

# Test XSS prevention in public endpoints
xss_payload="<script>alert('xss')</script>"
encoded_payload=$(printf '%s' "$xss_payload" | jq -sRr @uri)

# Test profile endpoint (if public)
profile_response=$(curl -s "$BASE_URL/api/profile/test-user" || echo "")
if echo "$profile_response" | grep -q "script"; then
    print_test_result 1 "Potential XSS vulnerability in profile endpoint"
else
    print_test_result 0 "Profile endpoint appears to handle scripts safely"
fi

echo ""

echo -e "${YELLOW}8. Testing SSL/TLS Configuration${NC}"
echo "----------------------------------------"

if [[ $BASE_URL == https://* ]]; then
    # Test SSL certificate
    ssl_info=$(curl -s -I "$BASE_URL" | grep -i "strict-transport-security" || echo "")
    
    if [ -n "$ssl_info" ]; then
        print_test_result 0 "HSTS header present"
        echo "  └─ $ssl_info"
    else
        print_test_result 1 "HSTS header missing"
    fi
    
    # Test SSL certificate validity
    if curl -s "$BASE_URL" >/dev/null 2>&1; then
        print_test_result 0 "SSL certificate valid"
    else
        print_test_result 1 "SSL certificate issues detected"
    fi
else
    echo "  Note: Testing HTTP endpoint - SSL tests skipped"
fi

echo ""

echo -e "${YELLOW}9. Dependency Security Audit${NC}"
echo "----------------------------------------"

if command -v pnpm >/dev/null 2>&1; then
    echo "  Running pnpm audit..."
    if pnpm audit --audit-level moderate >/dev/null 2>&1; then
        print_test_result 0 "No known security vulnerabilities in dependencies"
    else
        print_test_result 1 "Security vulnerabilities found in dependencies"
        echo "  └─ Run 'pnpm audit' for details"
    fi
else
    echo "  pnpm not available - skipping dependency audit"
fi

echo ""

echo -e "${YELLOW}10. Testing Error Handling${NC}"
echo "----------------------------------------"

# Test that errors don't leak sensitive information
error_endpoints=(
    "/api/nonexistent"
    "/api/submissions/invalid"
    "/nonexistent-page"
)

for endpoint in "${error_endpoints[@]}"; do
    response=$(curl -s "$BASE_URL$endpoint" || echo "")
    
    if echo "$response" | grep -qi "error\|stack\|trace\|debug"; then
        if echo "$response" | grep -qi "database\|sql\|connection\|password\|secret\|key"; then
            print_test_result 1 "Error endpoint $endpoint may leak sensitive information"
        else
            print_test_result 0 "Error endpoint $endpoint returns safe error messages"
        fi
    else
        print_test_result 0 "Error endpoint $endpoint returns minimal error information"
    fi
done

echo ""

# Cleanup test files
rm -f /tmp/test.txt /tmp/test.pdf /tmp/test.exe

echo -e "${BLUE}Security Test Suite Complete${NC}"
echo "========================================"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "- Review any failed tests above"
echo "- Run with authentication tokens for complete testing"
echo "- Perform manual security testing for complex scenarios"
echo "- Consider professional penetration testing for production"
echo ""
echo -e "${GREEN}For detailed security documentation, see: SECURITY.md${NC}"
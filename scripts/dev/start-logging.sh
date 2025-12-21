#!/bin/bash

# Start ELK Stack for Log Aggregation

echo "🚀 Starting ELK Stack for Athena log aggregation..."

# Create required directories
echo "📁 Creating directories..."
mkdir -p monitoring/logstash/templates
mkdir -p logs

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start ELK stack
echo "🐳 Starting ELK containers..."
docker-compose -f docker-compose.logging.yml up -d

# Wait for Elasticsearch to be ready
echo "⏳ Waiting for Elasticsearch to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:9200/_cluster/health > /dev/null 2>&1; then
        echo "✅ Elasticsearch is ready!"
        break
    fi
    echo -n "."
    sleep 5
done

# Wait for Kibana to be ready
echo "⏳ Waiting for Kibana to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:5601/api/status > /dev/null 2>&1; then
        echo "✅ Kibana is ready!"
        break
    fi
    echo -n "."
    sleep 5
done

echo ""
echo "🎉 ELK Stack is running!"
echo ""
echo "📊 Access points:"
echo "   - Kibana: http://localhost:5601"
echo "   - Elasticsearch: http://localhost:9200"
echo "   - Logstash TCP: localhost:5000"
echo ""
echo "📝 To send logs from the application:"
echo "   1. Set LOGSTASH_HOST=localhost in your .env file"
echo "   2. Restart the application"
echo ""
echo "🔍 View logs:"
echo "   docker-compose -f docker-compose.logging.yml logs -f"
echo ""
echo "🛑 Stop logging stack:"
echo "   docker-compose -f docker-compose.logging.yml down"
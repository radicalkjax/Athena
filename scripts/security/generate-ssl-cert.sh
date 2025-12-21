#!/bin/bash

# Athena v2 - SSL Certificate Generation Script
# For development/testing purposes - Use proper CA certificates in production

set -e

echo "🔐 Generating SSL certificates for Athena..."

# Create directories
mkdir -p nginx/ssl
mkdir -p certificates

# Certificate details
DOMAIN="athena.yourdomain.com"
COUNTRY="US"
STATE="California"
CITY="San Francisco"
ORGANIZATION="Athena Security"
ORGANIZATIONAL_UNIT="IT Department"
EMAIL="admin@yourdomain.com"

# Generate private key
echo "📋 Generating private key..."
openssl genrsa -out nginx/ssl/athena.key 4096

# Generate certificate signing request
echo "📋 Generating certificate signing request..."
openssl req -new -key nginx/ssl/athena.key -out nginx/ssl/athena.csr -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORGANIZATION/OU=$ORGANIZATIONAL_UNIT/CN=$DOMAIN/emailAddress=$EMAIL"

# Generate self-signed certificate (for development)
echo "📋 Generating self-signed certificate..."
openssl x509 -req -days 365 -in nginx/ssl/athena.csr -signkey nginx/ssl/athena.key -out nginx/ssl/athena.crt

# Set proper permissions
chmod 600 nginx/ssl/athena.key
chmod 644 nginx/ssl/athena.crt

# Generate DH parameters for enhanced security
echo "📋 Generating DH parameters (this may take a while)..."
openssl dhparam -out nginx/ssl/dhparam.pem 2048

echo "✅ SSL certificates generated successfully!"
echo ""
echo "📁 Files created:"
echo "  - nginx/ssl/athena.key (private key)"
echo "  - nginx/ssl/athena.crt (certificate)"
echo "  - nginx/ssl/athena.csr (certificate request)"
echo "  - nginx/ssl/dhparam.pem (DH parameters)"
echo ""
echo "⚠️  IMPORTANT FOR PRODUCTION:"
echo "  - Replace self-signed certificate with CA-signed certificate"
echo "  - Use Let's Encrypt or commercial SSL provider"
echo "  - Store private keys securely"
echo "  - Set up certificate auto-renewal"
echo ""
echo "🔍 Certificate details:"
openssl x509 -in nginx/ssl/athena.crt -text -noout | grep -A 5 "Subject:"
echo ""
echo "📅 Certificate validity:"
openssl x509 -in nginx/ssl/athena.crt -dates -noout
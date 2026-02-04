#!/bin/bash
# Script to configure CORS for GCS bucket to allow direct uploads/downloads
# Usage: ./configure_cors.sh <bucket-name>

BUCKET_NAME=$1

if [ -z "$BUCKET_NAME" ]; then
    echo "Usage: ./configure_cors.sh <bucket-name>"
    exit 1
fi

echo "Configuring CORS for gs://$BUCKET_NAME..."

# Create cors configuration file
cat > cors.json <<EOF
[
    {
      "origin": ["https://flowstry.com", "https://api.flowstry.com", "https://app.flowstry.com", "http://localhost:3000", "http://localhost:3001"],
      "method": ["GET", "PUT", "OPTIONS"],
      "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "x-goog-resumable"],
      "maxAgeSeconds": 3600
    }
]
EOF

# Apply configuration using gcloud
gcloud storage buckets update gs://$BUCKET_NAME --cors-file=cors.json

# Cleanup
rm cors.json

echo "CORS configuration updated successfully!"

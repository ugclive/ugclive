#!/bin/bash

# Test data for the Lambda function
UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TIMESTAMP=$(date +%s)

echo "Testing Lambda video generation with test ID: $UUID"

# Test payload
PAYLOAD=$(cat <<EOF
{
  "id": "$UUID",
  "data": {
    "user_id": "test-user",
    "video_type": "aiugc",
    "text_alignment": "bottom",
    "video_alignment": "serial",
    "status": "pending",
    "remotion": {
      "caption": "Test caption for video generation",
      "template": "https://yoqsadxajmnqhhkajiyk.supabase.co/storage/v1/object/public/template/sample-video.mp4",
      "demo": null,
      "sound": null,
      "videotype": "aiugc"
    }
  }
}
EOF
)

# Lambda API endpoint (use the one from your .env file)
API_URL="https://f3959lb343.execute-api.us-east-1.amazonaws.com/generate-video"

echo "Using API endpoint: $API_URL"
echo "Sending payload: $PAYLOAD"

# Send request to Lambda
curl -v -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo -e "\n\nRequest sent. Check AWS CloudWatch logs and Supabase for results."
echo "Record ID: $UUID"
#!/bin/bash

# Exit on error
set -e

echo "=== UGC Live Lambda Deployment ==="
echo "This script will package and deploy the Lambda function"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Create distribution package
echo "Creating deployment package..."
rm -f lambda-function.zip
zip -r lambda-function.zip . -x "*.git*" "*node_modules*" "*.zip" "deploy.sh"

# Add node_modules (excluding dev dependencies)
echo "Adding production dependencies..."
npm install --production
zip -r lambda-function.zip node_modules/

# Deploy to Lambda
echo "Deploying to AWS Lambda..."
aws lambda update-function-code \
    --function-name ugclive-video-processor \
    --zip-file fileb://lambda-function.zip

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo "Deployment successful!"
    
    # Update Lambda configuration if needed
    echo "Updating Lambda configuration..."
    aws lambda update-function-configuration \
        --function-name ugclive-video-processor \
        --timeout 900 \
        --memory-size 3008 \
        --environment "Variables={SUPABASE_URL=$SUPABASE_URL,SUPABASE_KEY=$SUPABASE_KEY,S3_BUCKET=ugclive-videos-us,FFMPEG_PATH=/opt/ffmpeg/ffmpeg}"
    
    echo "Lambda function has been updated with the new code"
    echo "You can now test it through your application"
else
    echo "Deployment failed"
    exit 1
fi 
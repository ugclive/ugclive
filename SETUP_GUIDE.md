# UGC Video Generation Platform - Serverless Setup Guide

## Architecture Overview

This platform uses a serverless architecture with the following components:

- **Frontend**: React application deployed on Vercel
- **Database**: Supabase (PostgreSQL + Authentication + Storage)
- **Video Processing**: AWS Lambda + FFmpeg
- **Video Storage**: AWS S3 bucket

## System Components

### 1. Supabase Setup

Supabase serves as our database, authentication provider, and storage for static assets. The database includes the following key tables:

- `profiles`: User profiles linked to auth.users
- `demo`: User-uploaded demo videos
- `sound`: Audio tracks for videos
- `templates`: Video templates
- `generated_videos`: Videos created by users, with processing status

Storage buckets:
- `sound`: Audio files
- `template`: Template videos
- `generated-videos`: Generated video metadata
- `user-templates`: User-uploaded custom templates

### 2. AWS Lambda for Video Processing

The Lambda function automatically processes video generation requests:

```javascript
// Key function in Lambda
exports.handler = async (event) => {
  // 1. Parse request body to get video ID and data
  const body = JSON.parse(event.body || '{}');
  const id = body.id;
  const data = body.data;
  
  // 2. Update Supabase status to 'processing'
  await supabase
    .from('generated_videos')
    .update({ status: 'processing' })
    .eq('id', id);
  
  // 3. Process video with FFmpeg
  const processedVideoPath = await ensureCompatibleCodec(videoSource, id);
  
  // 4. Upload to S3
  const s3Response = await s3.upload({
    Bucket: process.env.S3_BUCKET || 'ugclive-videos-us',
    Key: `videos/${id}.mp4`,
    Body: fileStream,
    ContentType: 'video/mp4'
  }).promise();
  
  // 5. Update Supabase with S3 URL
  await supabase
    .from('generated_videos')
    .update({ 
      status: 'completed',
      remotion_video: s3Response.Location,
      completed_at: new Date().toISOString()
    })
    .eq('id', id);
  
  // 6. Return success response
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({
      success: true,
      id: id,
      url: s3Response.Location
    })
  };
};
```

Lambda configuration:
- Name: `ugclive-video-processor`
- Runtime: Node.js 18.x
- Memory: 3000 MB
- Timeout: 15 minutes
- Environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
  - `S3_BUCKET`

### 3. AWS S3 for Video Storage

S3 bucket structure:
- Bucket name: `ugclive-videos-us`
- Folders:
  - `videos/`: Final processed videos
  - `temp/`: Temporary processing files
  - `assets/`: Static assets (optional)

### 4. API Gateway

- Endpoint: `https://f3959lb343.execute-api.us-east-1.amazonaws.com/generate-video`
- Type: HTTP API (ANY method)
- Integrated with the Lambda function

### 5. Frontend React Application

The frontend contains several key components:

- `ContentGenerator.tsx`: Creates video generation requests
- `VideoGrid.tsx`: Displays user's videos
- `VideoCard.tsx`: Shows playable videos with status indicators
- `useVideos.ts`: Hook for fetching videos with real-time updates

Environment variables:
```
# Supabase Configuration
VITE_SUPABASE_URL=https://yoqsadxajmnqhhkajiyk.supabase.co
VITE_SUPABASE_ANON_KEY=your-key-here

# API Configuration
VITE_API_URL=https://f3959lb343.execute-api.us-east-1.amazonaws.com/generate-video

# App Configuration
VITE_APP_NAME=UGClive
VITE_APP_URL=https://www.ugclive.com

# S3 Configuration
S3_BUCKET=ugclive-videos-us
```

## End-to-End Workflow

### Video Creation Flow

1. **User creates a video**:
   ```javascript
   // In ContentGenerator.tsx
   const saveGeneratedVideo = async () => {
     // Create video data
     const remotionData = { /* video settings */ };
     
     // Save to Supabase
     const { data, error } = await supabase
       .from('generated_videos')
       .insert({
         user_id: user.id,
         video_type: 'aiugc',
         text_alignment: textPosition,
         video_alignment: selectedDemo ? videoLayout : null,
         remotion: remotionData
       })
       .select();
   };
   ```

2. **Lambda processes the video**:
   - When a new record is added to `generated_videos`, the Lambda function:
     - Downloads the source video
     - Processes it with FFmpeg
     - Uploads to S3
     - Updates the record with the S3 URL

3. **Frontend displays the video**:
   ```javascript
   // In VideoCard.tsx
   const VideoCard = ({ video }) => {
     // Display video based on status
     return (
       <div>
         {/* Video processing status overlay */}
         {(video.status === 'pending' || video.status === 'processing') && (
           <div className="processing-overlay">Processing...</div>
         )}
         
         {/* Video player (when complete) */}
         {video.remotion_video && (
           <video src={video.remotion_video} />
         )}
       </div>
     );
   };
   ```

4. **Real-time updates**:
   ```javascript
   // In useVideos.ts
   useEffect(() => {
     // Subscribe to changes on the generated_videos table
     const channel = supabase
       .channel('videos-updates')
       .on(
         'postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'generated_videos',
           filter: `user_id=eq.${user.id}`,
         },
         (payload) => {
           // Invalidate the query to trigger a refetch
           queryClient.invalidateQueries({
             queryKey: ["videos", videoType, user.id],
           });
         }
       )
       .subscribe();
   }, [user, videoType]);
   ```

## Rebuilding the System

To rebuild this system:

1. **Create Supabase project**:
   - Set up tables, storage buckets, and authentication
   - Configure RLS policies and triggers

2. **Set up AWS Lambda**:
   - Create Lambda function with FFmpeg layer
   - Configure S3 bucket and permissions
   - Create API Gateway endpoint

3. **Configure the frontend**:
   - Update environment variables with your endpoints
   - Deploy to Vercel or your preferred hosting platform

4. **Test the workflow**:
   - Create a video on the frontend
   - Monitor Lambda logs and S3 storage
   - Verify video appears on the dashboard

## Troubleshooting

- **Lambda issues**: Check CloudWatch logs
- **Frontend issues**: Verify environment variables
- **Supabase issues**: Check realtime subscription settings
- **File processing**: Ensure FFmpeg is correctly configured in Lambda

## Security Considerations

- Properly configure Supabase RLS policies
- Secure API Gateway endpoint
- Use environment variables for sensitive information
- Set up proper CORS policies 
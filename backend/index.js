require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
const supabase = require("./config/supabase.config");
const { initializeFileServer, shutdownFileServer } = require("./src/fileServer");

// Create output directory if it doesn't exist
const outputDir = path.resolve(__dirname, "./out");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Configuration
const LAMBDA_API_URL = process.env.LAMBDA_API_URL || "https://f3959lb343.execute-api.us-east-1.amazonaws.com/prod/generate-video";
const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000; // 15 seconds timeout for API calls
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/bin/ffprobe';

// Create Express app
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// Retry logic for Lambda API calls
async function callLambdaWithRetry(url, data, retryCount = 0) {
  try {
    console.log(`Attempt ${retryCount + 1}: Sending request to Lambda API for video ID: ${data.id}`);
    
    const response = await axios.post(url, data, { 
      timeout: TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Lambda API response for ${data.id}:`, response.status);
    return response;
  } catch (error) {
    if (retryCount < MAX_RETRIES - 1) {
      console.log(`Retrying Lambda API call for ${data.id} (${retryCount + 1}/${MAX_RETRIES})`);
      // Exponential backoff: wait longer between each retry
      const delay = 1000 * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callLambdaWithRetry(url, data, retryCount + 1);
    }
    
    // Detailed error logging on final failure
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error("Lambda API error:", error.response.status, error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error("Network error - no response received");
    } else {
      // Something happened in setting up the request
      console.error("Error setting up request:", error.message);
    }
    throw error;
  }
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", version: "1.0.0" });
});

// Status endpoint with more information
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    apiUrl: LAMBDA_API_URL
  });
});

// Trigger video generation
app.post("/trigger-video-generation", async (req, res) => {
  const startTime = Date.now();
  const { id } = req.body;
  
  console.log(`Video generation request received for ID: ${id}`);
  
  try {
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: id",
      });
    }

    // Fetch the record from Supabase
    console.log(`Fetching video data from Supabase for ID: ${id}`);
    const { data, error } = await supabase
      .from("generated_videos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error(`Supabase error for ID ${id}:`, error);
      return res.status(404).json({
        success: false,
        message: "Record not found",
        error: error.message,
      });
    }

    // Update status to processing before sending to Lambda
    console.log(`Updating status to 'processing' for ID: ${id}`);
    const { error: updateError } = await supabase
      .from("generated_videos")
      .update({ status: "processing" })
      .eq("id", id);
    
    if (updateError) {
      console.warn(`Warning: Could not update status for ID ${id}:`, updateError);
    }

    // Prepare the payload for Lambda
    const lambdaPayload = {
      id,
      data
    };

    // Call Lambda API with retry logic
    console.log(`Calling Lambda API for ID: ${id}`);
    const response = await callLambdaWithRetry(LAMBDA_API_URL, lambdaPayload);

    // Process response
    if (response.data.success) {
      const processingTime = Date.now() - startTime;
      console.log(`Successfully triggered video generation for ID: ${id} (${processingTime}ms)`);
      
      // Download audio if it exists
      let audioPath = null;
      if (data.sound) {
        const audioFileName = `${id}_audio.mp3`;
        audioPath = path.join(outputDir, audioFileName);
        console.log(`Downloading audio: ${data.sound}`);
        await downloadFile(data.sound, audioPath);
      }
      
      // Prepare for text overlay
      const caption = data.caption || data.caption;
      const textPosition = data.text_alignment || 'bottom';
      
      // First transcode the video to ensure compatible format
      let processedVideo = await transcodeVideo(data.template, data.output);
      
      // If we have audio, add it to the video
      if (audioPath) {
        const withAudioPath = path.join(outputDir, `${id}_with_audio.mp4`);
        console.log('Adding audio to video');
        await addAudioToVideo(processedVideo, audioPath, withAudioPath);
        processedVideo = withAudioPath;
      }
      
      // If we have caption text, add it
      if (caption) {
        const withTextPath = path.join(outputDir, `${id}_with_text.mp4`);
        console.log(`Adding caption to video: "${caption}"`);
        await addTextOverlay(processedVideo, caption, textPosition, withTextPath);
        processedVideo = withTextPath;
      }
      
      // Upload the final processed video to S3
      const s3Url = await uploadToS3(processedVideo, id);
      
      // Update Supabase with video URL
      log('Updating Supabase with video URL');
      const { error: updateError } = await supabase
        .from('generated_videos')
        .update({
          status: 'completed',
          s3_video_url: s3Url,
          completed_at: new Date().toISOString(),
          error: null
        })
        .eq('id', id);
      
      res.json({
        success: true,
        message: "Video generation process triggered",
        id,
        processingTime,
        s3Url
      });
    } else {
      console.error(`Lambda API returned error for ID ${id}:`, response.data);
      
      // If Lambda failed, update status back to pending to allow retry
      await supabase
        .from("generated_videos")
        .update({ 
          status: "pending",
          error: response.data.error || "Unknown Lambda error" 
        })
        .eq("id", id);
      
      res.status(500).json({
        success: false,
        message: "Lambda failed to process the video",
        error: response.data.error || "Unknown Lambda error"
      });
    }
  } catch (error) {
    console.error(`Error triggering video generation for ID ${id}:`, error);
    
    // Try to update status to error state
    try {
      await supabase
        .from("generated_videos")
        .update({ 
          status: "error", 
          error: error.message || "Request to processing service failed" 
        })
        .eq("id", id);
    } catch (dbError) {
      console.error(`Failed to update error status for ID ${id}:`, dbError);
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to trigger video generation",
      error: error.message || "Unknown error"
    });
  }
});

// Retry processing for failed videos
app.post("/retry-processing/:id", async (req, res) => {
  const { id } = req.params;
  
  try {
    // Forward to trigger-video-generation endpoint
    req.body.id = id;
    app.handle(req, res, () => {});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retry processing",
      error: error.message
    });
  }
});

// Start the server and setup
const server = app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);

  try {
    // Initialize file server at startup
    initializeFileServer(outputDir);
    console.log("File server initialized");
    
    // Setup graceful shutdown
    process.on("SIGINT", async () => {
      console.log("Server shutdown initiated...");
      
      // Shutdown file server
      await shutdownFileServer();
      
      // Close server
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });

    console.log("Service started successfully!");
  } catch (error) {
    console.error("Failed to initialize services:", error);
    console.log("Server is running but some initializations failed.");
  }
});

// Function to combine videos (template + demo)
async function combineVideos(template, demo, output, layout = 'side') {
  let ffmpegCmd = '';
  
  if (layout === 'side') {
    // Side-by-side layout
    ffmpegCmd = `${FFMPEG_PATH} -i "${template}" -i "${demo}" -filter_complex "[0:v]scale=640:360[left];[1:v]scale=640:360[right];[left][right]hstack=inputs=2[v]" -map "[v]" -c:v libx264 -crf 23 "${output}"`;
  } else if (layout === 'sequential') {
    // Sequential layout
    ffmpegCmd = `${FFMPEG_PATH} -i "${template}" -i "${demo}" -filter_complex concat=n=2:v=1:a=1 -c:v libx264 -crf 23 "${output}"`;
  }
  
  log(`Running combine command: ${ffmpegCmd}`);
  await execPromise(ffmpegCmd);
  return output;
}

// Function to add text overlay
async function addTextOverlay(video, text, position, output) {
  let y = '10'; // Default top
  
  if (position === 'center') {
    y = '(h-text_h)/2';
  } else if (position === 'bottom') {
    y = 'h-text_h-10';
  }
  
  const ffmpegCmd = `${FFMPEG_PATH} -i "${video}" -vf "drawtext=text='${text}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=${y}" -c:a copy "${output}"`;
  
  log(`Running text overlay command: ${ffmpegCmd}`);
  await execPromise(ffmpegCmd);
  return output;
}

// Add retry logic for network operations
async function withRetry(operation, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      log(`Operation failed (attempt ${attempt}/${maxRetries}): ${error.message}`);
      
      if (attempt < maxRetries) {
        log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Exponential backoff
        delay *= 2;
      }
    }
  }
  
  throw lastError;
}

// Add more detailed logging
log(`Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);

// Track processing time
const startTime = Date.now();
// ... do processing
const processingTime = Date.now() - startTime;
log(`Video processing completed in ${processingTime / 1000} seconds`);

// Add audio to video
async function addAudioToVideo(videoPath, audioPath, outputPath) {
  try {
    // Command to add audio to video
    const ffmpegCmd = `${FFMPEG_PATH} -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest "${outputPath}" -y`;
    log(`Running command: ${ffmpegCmd}`);
    
    const { stdout, stderr } = await execPromise(ffmpegCmd);
    
    // Check if output file exists and has content
    if (fs.existsSync(outputPath)) {
      const outputStats = fs.statSync(outputPath);
      log(`Audio addition complete. Output file size: ${outputStats.size} bytes`);
      
      if (outputStats.size === 0) {
        throw new Error('Output file is empty');
      }
      
      return outputPath;
    } else {
      log(`FFmpeg stderr: ${stderr}`);
      throw new Error('Output file does not exist');
    }
  } catch (error) {
    log(`Error adding audio: ${error.message}`);
    throw error;
  }
}

// Add text overlay
async function addTextOverlay(videoPath, text, position, outputPath) {
  try {
    // Determine text position
    let y = '10'; // Default top
    if (position === 'center') {
      y = '(h-text_h)/2';
    } else if (position === 'bottom') {
      y = 'h-text_h-10';
    }
    
    // Escape special characters in text
    const escapedText = text.replace(/'/g, "'\\''");
    
    // Command to add text overlay
    const ffmpegCmd = `${FFMPEG_PATH} -i "${videoPath}" -vf "drawtext=text='${escapedText}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=${y}" -c:a copy "${outputPath}" -y`;
    log(`Running command: ${ffmpegCmd}`);
    
    const { stdout, stderr } = await execPromise(ffmpegCmd);
    
    // Check if output file exists and has content
    if (fs.existsSync(outputPath)) {
      const outputStats = fs.statSync(outputPath);
      log(`Text overlay addition complete. Output file size: ${outputStats.size} bytes`);
      
      if (outputStats.size === 0) {
        throw new Error('Output file is empty');
      }
      
      return outputPath;
    } else {
      log(`FFmpeg stderr: ${stderr}`);
      throw new Error('Output file does not exist');
    }
  } catch (error) {
    log(`Error adding text overlay: ${error.message}`);
    throw error;
  }
}

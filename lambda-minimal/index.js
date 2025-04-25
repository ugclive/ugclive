const { createClient } = require('@supabase/supabase-js');
const AWS = require('aws-sdk');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');
const execPromise = promisify(exec);
const pipeline = promisify(require('stream').pipeline);

// Initialize Services
const s3 = new AWS.S3();

// Initialize Supabase with env variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const BUCKET_NAME = process.env.S3_BUCKET || 'ugclive-videos-us';
const TMP_DIR = '/tmp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/ffmpeg/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/ffmpeg/ffprobe';

// Helper for logging with timestamps
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// List files in a directory for debugging
function listFiles(dir) {
  try {
    log(`Listing files in ${dir}:`);
    const files = fs.readdirSync(dir);
    for (const file of files) {
      try {
        const stats = fs.statSync(path.join(dir, file));
        log(`- ${file}: ${stats.size} bytes`);
      } catch (e) {
        log(`- ${file}: Error getting stats: ${e.message}`);
      }
    }
    return files.length;
  } catch (error) {
    log(`Error listing files in ${dir}: ${error.message}`);
    return 0;
  }
}

// Check if FFmpeg binaries are available
async function checkFFmpeg() {
  try {
    if (fs.existsSync(FFMPEG_PATH)) {
      log(`FFmpeg found at: ${FFMPEG_PATH}`);
    } else {
      log(`FFmpeg not found at: ${FFMPEG_PATH}`);
      // Try finding FFmpeg in other locations
      const { stdout } = await execPromise('find / -name ffmpeg -type f 2>/dev/null');
      log(`Found FFmpeg at: ${stdout.trim() || 'No locations found'}`);
    }
    
    // Try running FFmpeg to check version
    try {
      const { stdout } = await execPromise(`${FFMPEG_PATH} -version`);
      log(`FFmpeg version: ${stdout.split('\n')[0]}`);
    } catch (e) {
      log(`Error checking FFmpeg version: ${e.message}`);
    }
  } catch (error) {
    log(`Error checking FFmpeg: ${error.message}`);
  }
}

// Download a file from URL to local path
async function downloadFile(url, destinationPath) {
  log(`Downloading ${url} to ${destinationPath}`);
  
  // Ensure /tmp directory exists
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
  
  // Determine if http or https
  const client = url.startsWith('https') ? https : http;
  
  return new Promise((resolve, reject) => {
    // Create write stream
    const fileStream = fs.createWriteStream(destinationPath);
    
    // Track download progress
    let downloadedBytes = 0;
    let totalBytes = 0;
    
    const request = client.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        log(`Following redirect to: ${response.headers.location}`);
        downloadFile(response.headers.location, destinationPath)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      // Check for successful response
      if (response.statusCode !== 200) {
        fileStream.close();
        reject(new Error(`Failed to download, status code: ${response.statusCode}`));
        return;
      }
      
      // Get total file size
      totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      log(`Total file size: ${totalBytes} bytes`);
      
      // Track progress
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0 && downloadedBytes % 1000000 === 0) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100);
          log(`Download progress: ${progress}%`);
        }
      });
      
      // Pipe response to file
      pipeline(response, fileStream)
        .then(() => {
          log(`Download complete: ${destinationPath}`);
          // Verify file exists and has content
          try {
            const stats = fs.statSync(destinationPath);
            log(`File size: ${stats.size} bytes`);
            if (stats.size === 0) {
              reject(new Error('Downloaded file is empty'));
            } else {
              resolve(destinationPath);
            }
          } catch (error) {
            reject(new Error(`Error verifying download: ${error.message}`));
          }
        })
        .catch((error) => {
          log(`Download error: ${error.message}`);
          reject(error);
        });
    });
    
    request.on('error', (error) => {
      fileStream.close();
      fs.unlink(destinationPath, () => {});
      log(`Request error: ${error.message}`);
      reject(error);
    });
    
    // Set timeout for the request
    request.setTimeout(60000, () => {
      request.destroy();
      fileStream.close();
      fs.unlink(destinationPath, () => {});
      reject(new Error('Download timed out after 60 seconds'));
    });
  });
}

// Transcode video to compatible format
async function transcodeVideo(sourcePath, outputPath) {
  log(`Transcoding video from ${sourcePath} to ${outputPath}`);
  
  // Check file access before proceeding
  try {
    await fs.promises.access(sourcePath, fs.constants.R_OK);
    log(`Source file ${sourcePath} is readable`);
  } catch (error) {
    throw new Error(`Source file ${sourcePath} is not accessible: ${error.message}`);
  }
  
  // Get source file info
  const sourceStats = fs.statSync(sourcePath);
  log(`Source file size: ${sourceStats.size} bytes`);
  
  if (sourceStats.size === 0) {
    throw new Error('Source file is empty');
  }
  
  try {
    // Command to transcode video
    const ffmpegCmd = `${FFMPEG_PATH} -i "${sourcePath}" -c:v libx264 -preset fast -crf 23 -c:a aac -strict experimental "${outputPath}" -y`;
    log(`Running command: ${ffmpegCmd}`);
    
    const { stdout, stderr } = await execPromise(ffmpegCmd);
    
    // Check if output file exists and has content
    if (fs.existsSync(outputPath)) {
      const outputStats = fs.statSync(outputPath);
      log(`Transcoding complete. Output file size: ${outputStats.size} bytes`);
      
      if (outputStats.size === 0) {
        throw new Error('Transcoded file is empty');
      }
      
      return outputPath;
    } else {
      log(`FFmpeg stderr: ${stderr}`);
      throw new Error('Transcoded file does not exist');
    }
  } catch (error) {
    log(`Transcoding error: ${error.message}`);
    throw error;
  }
}

// Upload file to S3
async function uploadToS3(filePath, id) {
  log(`Uploading ${filePath} to S3`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  
  const fileStats = fs.statSync(filePath);
  log(`Upload file size: ${fileStats.size} bytes`);
  
  if (fileStats.size === 0) {
    throw new Error('File is empty, cannot upload');
  }
  
  // Create read stream
  const fileStream = fs.createReadStream(filePath);
  
  // Upload to S3
  const s3Key = `videos/${id}.mp4`;
  log(`Uploading to S3 bucket: ${BUCKET_NAME}, key: ${s3Key}`);
  
  try {
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: 'video/mp4'
    };
    
    const result = await s3.upload(uploadParams).promise();
    log(`Upload successful: ${result.Location}`);
    return result.Location;
  } catch (error) {
    log(`S3 upload error: ${error.message}`);
    throw error;
  }
}

// Clean up temporary files
function cleanupTempFiles(files) {
  log(`Cleaning up ${files.length} temporary files`);
  
  for (const file of files) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        log(`Deleted: ${file}`);
      }
    } catch (error) {
      log(`Error deleting ${file}: ${error.message}`);
    }
  }
}

// Main Lambda handler
exports.handler = async (event, context) => {
  log('Lambda function started');
  log('Event:', event);
  
  // Log environment variables
  log('Environment variables:');
  log(`- SUPABASE_URL: ${supabaseUrl ? '✓ Set' : '✗ Missing'}`);
  log(`- SUPABASE_KEY: ${supabaseKey ? '✓ Set' : '✗ Missing'}`);
  log(`- S3_BUCKET: ${BUCKET_NAME}`);
  log(`- FFMPEG_PATH: ${FFMPEG_PATH}`);
  
  // Track temp files for cleanup
  const tempFiles = [];
  
  try {
    // Check if FFmpeg is available
    await checkFFmpeg();
    
    // Parse request body
    const requestBody = event.body ? 
      (typeof event.body === 'string' ? JSON.parse(event.body) : event.body) : 
      {};
    
    log('Request body:', requestBody);
    
    const id = requestBody.id;
    const data = requestBody.data;
    
    if (!id || !data) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Missing required parameters: id and data'
        })
      };
    }
    
    log(`Processing video generation for ID: ${id}`);
    
    // Extract data from the request
    const remotionData = data.remotion || {};
    const videoSource = remotionData.template;
    
    if (!videoSource) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'No video source provided'
        })
      };
    }
    
    // Ensure /tmp directory exists and is empty
    listFiles(TMP_DIR);
    
    // Update status to processing in Supabase
    try {
      const { error } = await supabase
        .from('generated_videos')
        .update({ 
          status: 'processing',
          error: null
        })
        .eq('id', id);
      
      if (error) {
        log(`Error updating status in Supabase: ${error.message}`);
      } else {
        log('Status updated to "processing" in Supabase');
      }
    } catch (error) {
      log(`Error updating Supabase: ${error.message}`);
    }
    
    // Download the source video
    const sourceFileName = `${id}_source.mp4`;
    const sourcePath = path.join(TMP_DIR, sourceFileName);
    tempFiles.push(sourcePath);
    
    log(`Downloading source video: ${videoSource}`);
    await downloadFile(videoSource, sourcePath);
    
    // Transcode the video
    const outputFileName = `${id}.mp4`;
    const outputPath = path.join(TMP_DIR, outputFileName);
    tempFiles.push(outputPath);
    
    log('Transcoding video');
    await transcodeVideo(sourcePath, outputPath);
    
    // Check if file exists before uploading
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Processed video file not found at: ${outputPath}`);
    }
    
    // Upload to S3
    log('Uploading to S3');
    const s3Url = await uploadToS3(outputPath, id);
    
    // Update Supabase with video URL
    log('Updating Supabase with video URL');
    const { error: updateError } = await supabase
      .from('generated_videos')
      .update({
        status: 'completed',
        remotion_video: s3Url,
        completed_at: new Date().toISOString(),
        error: null
      })
      .eq('id', id);
    
    if (updateError) {
      log(`Error updating Supabase: ${updateError.message}`);
    } else {
      log('Status updated to "completed" in Supabase');
    }
    
    // All done, clean up
    cleanupTempFiles(tempFiles);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Video processed successfully',
        videoUrl: s3Url
      })
    };
    
  } catch (error) {
    log(`Error processing video: ${error.message}`, error);
    
    // Try to update error status in Supabase
    const id = event.body ? 
      (typeof event.body === 'string' ? 
        JSON.parse(event.body).id : 
        event.body.id) : 
      null;
    
    if (id) {
      try {
        await supabase
          .from('generated_videos')
          .update({
            status: 'error',
            error: error.message
          })
          .eq('id', id);
        
        log('Updated status to "error" in Supabase');
      } catch (dbError) {
        log(`Failed to update error status: ${dbError.message}`);
      }
    }
    
    // Clean up any temp files
    try {
      cleanupTempFiles(tempFiles);
    } catch (cleanupError) {
      log(`Error during cleanup: ${cleanupError.message}`);
    }
    
    // List any remaining files
    listFiles(TMP_DIR);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}; 
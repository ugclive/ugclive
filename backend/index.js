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
      
      res.json({
        success: true,
        message: "Video generation process triggered",
        id,
        processingTime
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

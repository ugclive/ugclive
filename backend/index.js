const AWS = require('aws-sdk');
const { createClient } = require('@supabase/supabase-js');
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const { initializeFileServer, shutdownFileServer } = require("./src/fileServer");

// Initialize services
const s3 = new AWS.S3();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const lambda = new AWS.Lambda();
const BUCKET_NAME = process.env.S3_BUCKET || 'ugclive-videos-us';
const TMP_DIR = '/tmp';

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));

// Simple status endpoint
app.get("/status", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Trigger video generation
app.post("/trigger-video-generation", async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameter: id",
      });
    }

    // Fetch the record from Supabase
    const { data, error } = await supabase
      .from("generated_videos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
        error: error.message,
      });
    }

    // Prepare the payload to send to Lambda
    const lambdaPayload = {
      id,
      data
    };

    // Call Lambda function to process video
    const lambdaResponse = await lambda
      .invoke({
        FunctionName: 'ugclive-video-processor',
        Payload: JSON.stringify(lambdaPayload)
      })
      .promise();

    const responsePayload = JSON.parse(lambdaResponse.Payload);

    if (responsePayload.success) {
      res.json({
        success: true,
        message: "Video generation process triggered",
        id,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Lambda failed to process the video",
        error: responsePayload.error
      });
    }

  } catch (error) {
    console.error("Error triggering video generation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to trigger video generation",
      error: error.message,
    });
  }
});

// Start the server and setup
const server = app.listen(port, async () => {
  console.log(`Server running at http://localhost:${port}`);

  try {
    // Initialize file server at startup
    initializeFileServer(path.resolve(__dirname, "./out"));

    // Initialize Supabase real-time subscription
    console.log("Service started successfully!");
  } catch (error) {
    console.error("Failed to initialize services:", error);
    console.log("Server is running but some initializations failed.");
  }
});

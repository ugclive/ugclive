import React, { useState } from "react";
import { Play, Pause, Clock, RefreshCcw } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type Video = Database["public"]["Tables"]["generated_videos"]["Row"];

// AWS Lambda API endpoint
const API_URL = import.meta.env.VITE_API_URL;

// Function to trigger video generation in AWS Lambda
const triggerVideoGeneration = async (video: Video) => {
  try {
    console.log(`Manually triggering video generation for ID: ${video.id}`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: video.id,
        data: video
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error triggering video generation:', error);
    throw error;
  }
};

interface VideoCardProps {
  video: Video;
}

// Helper function to safely extract error message from various error formats
const getErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    if ('message' in error) {
      return error.message as string;
    }
  }
  return 'Unknown error occurred';
};

const VideoCard = ({ video }: VideoCardProps) => {
  // Immediately return a placeholder if video is undefined or null
  if (!video) {
    return (
      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow">
        <div className="aspect-video bg-muted flex items-center justify-center">
          <p className="text-muted-foreground">Video data unavailable</p>
        </div>
        <div className="p-4">
          <p className="text-sm text-muted-foreground">Unable to load video data</p>
        </div>
      </div>
    );
  }

  const [isPlaying, setIsPlaying] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current || !video.remotion_video) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  // Function to retry video generation
  const handleRetryGeneration = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling up
    
    if (isRetrying) return;
    
    try {
      setIsRetrying(true);
      await triggerVideoGeneration(video);
      toast.success("Video generation restarted successfully");
    } catch (error) {
      toast.error("Failed to restart video generation");
      console.error("Error restarting video generation:", error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Create a title from caption or default text
  const title = video?.caption || "Generated Video";
  
  // Generate a default description based on status
  const getDescription = () => {
    switch (video.status) {
      case 'pending':
        return 'Video is queued for processing...';
      case 'processing':
        return 'Your video is being generated...';
      case 'completed':
        return 'Your video is ready!';
      case 'error':
        return `Error: ${getErrorMessage(video.error) || 'Failed to generate video'}`;
      default:
        return 'Processing status unknown';
    }
  };

  const description = getDescription();
  const gradient = "bg-gradient-to-r from-indigo-500 to-purple-600";
  const showRetryButton = video.status === 'pending' || video.status === 'error';

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow relative group">
      <div className={`aspect-video ${gradient} flex items-center justify-center relative overflow-hidden`}>
        {/* Video processing status overlay for pending/processing */}
        {(video.status === 'pending' || video.status === 'processing') && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <div className="flex flex-col items-center">
              <Clock className="h-12 w-12 text-white animate-pulse mb-2" />
              <p className="text-white font-medium">{video.status === 'pending' ? 'Queued' : 'Processing'}</p>
              
              {/* Retry button for pending videos */}
              {showRetryButton && (
                <button 
                  className="mt-4 bg-white/20 hover:bg-white/30 text-white text-sm py-1 px-3 rounded-full flex items-center"
                  onClick={handleRetryGeneration}
                  disabled={isRetrying}
                >
                  <RefreshCcw className="h-3 w-3 mr-1" />
                  {isRetrying ? 'Retrying...' : 'Retry Generation'}
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Error state with retry button */}
        {video.status === 'error' && (
          <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center z-20">
            <div className="flex flex-col items-center text-center">
              <p className="text-white font-medium mb-2">Generation Failed</p>
              <p className="text-white/70 text-xs max-w-[80%] mb-4">
                {getErrorMessage(video.error)}
              </p>
              
              <button 
                className="bg-white/20 hover:bg-white/30 text-white text-sm py-1 px-3 rounded-full flex items-center"
                onClick={handleRetryGeneration}
                disabled={isRetrying}
              >
                <RefreshCcw className="h-3 w-3 mr-1" />
                {isRetrying ? 'Retrying...' : 'Retry Generation'}
              </button>
            </div>
          </div>
        )}
        
        {/* Video element (when complete) */}
        {video.remotion_video && (
          <video
            ref={videoRef}
            src={video.remotion_video}
            className={`absolute inset-0 w-full h-full object-cover ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
        )}
        
        {/* Play/Pause button overlay (only show when video is complete) */}
        {video.status === 'completed' && video.remotion_video && (
          <div 
            className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer z-10"
            onClick={togglePlay}
          >
            <div className="h-14 w-14 rounded-full bg-white/80 flex items-center justify-center">
              {isPlaying ? (
                <Pause className="h-8 w-8 text-primary" />
              ) : (
                <Play className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>
        )}
        
        {/* Title overlay */}
        {!isPlaying && (
          <div className="relative z-10 p-3">
            <span className="text-white/90 text-lg font-medium line-clamp-2">
              {title}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${
            video.status === 'completed' ? 'bg-green-500' : 
            video.status === 'error' ? 'bg-red-500' : 
            video.status === 'processing' ? 'bg-yellow-500' : 
            'bg-gray-500'
          }`}></div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Created: {new Date(video.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default VideoCard;


import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Play, Loader } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";

type Video = Database["public"]["Tables"]["generated_videos"]["Row"];

interface VideoCardProps {
  video: Video;
}

const VideoCard = ({ video }: VideoCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const isGenerating = video.remotion_video === null;
  const createdAt = new Date(video.created_at);
  
  // Reset states when video changes (especially from null to having a URL)
  useEffect(() => {
    setIsPlaying(false);
    setIsLoading(true);
    setProgress(0);
  }, [video.remotion_video]);
  
  useEffect(() => {
    if (!isGenerating && videoRef.current) {
      const videoElement = videoRef.current;
      
      // Start preloading the video
      videoElement.preload = "auto";
      
      const handleProgress = () => {
        if (videoElement.buffered.length > 0) {
          const bufferedEnd = videoElement.buffered.end(0);
          const duration = videoElement.duration;
          const loadProgress = (bufferedEnd / duration) * 100;
          setProgress(loadProgress);
          
          if (loadProgress >= 100) {
            setIsLoading(false);
          }
        }
      };
      
      const handleLoadedData = () => {
        setIsLoading(false);
        setProgress(100);
      };
      
      videoElement.addEventListener("progress", handleProgress);
      videoElement.addEventListener("loadeddata", handleLoadedData);
      
      // Set a fallback timer in case events don't fire correctly
      const loadingTimeout = setTimeout(() => {
        setIsLoading(false);
      }, 5000);
      
      return () => {
        videoElement.removeEventListener("progress", handleProgress);
        videoElement.removeEventListener("loadeddata", handleLoadedData);
        clearTimeout(loadingTimeout);
      };
    }
  }, [isGenerating, video.remotion_video]);
  
  const handleDownload = () => {
    if (video.remotion_video) {
      // Create an anchor element and trigger download
      const link = document.createElement("a");
      link.href = video.remotion_video;
      link.download = `video-${video.id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <div className="relative aspect-[9/16] w-full">
        {isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black">
            <Loader className="h-8 w-8 animate-spin text-primary mb-2" />
            <span className="text-xs font-medium">Generating video...</span>
            <Progress className="w-2/3 mt-3 h-2" value={75} />
          </div>
        ) : (
          <>
            {/* Hidden video element for preloading */}
            <video 
              ref={videoRef}
              src={video.remotion_video || ""} 
              className="hidden"
              preload="auto"
            />
            
            {isPlaying ? (
              <video 
                src={video.remotion_video || ""} 
                className="w-full h-full object-cover"
                autoPlay
                controls
                onEnded={() => setIsPlaying(false)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                {isLoading && (
                  <>
                    <Loader className="h-6 w-6 animate-spin text-primary mb-1" />
                    <Progress className="w-2/3 mt-1 h-1.5" value={progress} />
                  </>
                )}
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className={`h-10 w-10 rounded-full opacity-90 hover:opacity-100 ${isLoading ? 'opacity-50' : ''}`}
                  onClick={() => setIsPlaying(true)}
                  disabled={isLoading}
                >
                  <Play className="h-5 w-5" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      
      <CardContent className="p-3 flex justify-between items-center">
        <div>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </p>
          <p className="text-xs">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-secondary">
              {video.video_type === "aiugc" ? "AI UGC" : "Meme"}
            </span>
          </p>
        </div>
        
        {!isGenerating && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default VideoCard;

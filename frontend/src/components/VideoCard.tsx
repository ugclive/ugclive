import React, { useState } from "react";
import { Play, Pause } from "lucide-react";

interface VideoCardProps {
  title: string;
  description: string;
  thumbnail: string; // URL to thumbnail image
  videoUrl?: string; // URL to video file (optional)
  gradient?: string; // CSS gradient for placeholder
}

const VideoCard = ({
  title,
  description,
  thumbnail,
  videoUrl,
  gradient = "bg-gradient-to-r from-indigo-500 to-purple-600",
}: VideoCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current || !videoUrl) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow relative group">
      <div className={`aspect-video ${gradient} flex items-center justify-center relative overflow-hidden`}>
        {/* Thumbnail or gradient background */}
        {thumbnail && (
          <img 
            src={thumbnail} 
            alt={title} 
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        
        {/* Video element (hidden until played) */}
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className={`absolute inset-0 w-full h-full object-cover ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
            onEnded={() => setIsPlaying(false)}
            playsInline
            muted
          />
        )}
        
        {/* Play/Pause button overlay */}
        <div 
          className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
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
        
        {/* Title overlay */}
        {!isPlaying && (
          <div className="relative z-10">
            <span className="text-white/90 text-xl font-medium">
              {title}
            </span>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};

export default VideoCard;

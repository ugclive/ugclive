import { useState, useEffect, useRef } from "react";
import { Play, PauseIcon, Volume2, VolumeX, LayoutGrid, LayoutList, Columns, RowsIcon, ArrowUp, ArrowDown, AlignCenter, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import type { Template } from "@/services/templateService";

interface Sound {
  id: number;
  name: string;
  sound_link: string;
}

interface ContentPreviewProps {
  hook: string;
  avatarId: number | null;
  selectedTemplate?: Template;
  selectedSound?: Sound | null;
  demoVideoUrl?: string | null;
  onLayoutChange?: (layout: "serial" | "side" | "top") => void;
  onTextPositionChange?: (position: "top" | "center" | "bottom") => void;
}

type VideoLayout = "serial" | "side" | "top";
type TextPosition = "top" | "center" | "bottom";

const ContentPreview = ({ 
  hook, 
  avatarId, 
  selectedTemplate, 
  selectedSound, 
  demoVideoUrl,
  onLayoutChange,
  onTextPositionChange
}: ContentPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarVideoLoaded, setAvatarVideoLoaded] = useState(false);
  const [demoVideoLoaded, setDemoVideoLoaded] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<'avatar' | 'demo'>('avatar');
  const [videoLayout, setVideoLayout] = useState<VideoLayout>("serial");
  const [textPosition, setTextPosition] = useState<TextPosition>("bottom");
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [shouldStartPlayback, setShouldStartPlayback] = useState(false);
  const avatarVideoRef = useRef<HTMLVideoElement>(null);
  const demoVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading) {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      
      loadingTimeoutRef.current = setTimeout(() => {
        console.log("Loading timeout reached, forcing completion");
        setLoadingTimeout(true);
        setAvatarVideoLoaded(true);
        setDemoVideoLoaded(true);
        setIsLoading(false);
        setShouldStartPlayback(true);
      }, 5000);
    } else if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isLoading]);

  useEffect(() => {
    if (avatarVideoRef.current) {
      avatarVideoRef.current.pause();
      avatarVideoRef.current.currentTime = 0;
    }
    
    if (demoVideoRef.current) {
      demoVideoRef.current.pause();
      demoVideoRef.current.currentTime = 0;
    }

    setAvatarVideoLoaded(false);
    setDemoVideoLoaded(false);
    setIsLoading(true);
    setLoadingTimeout(false);
    setShouldStartPlayback(false);
    
    if (!selectedTemplate && avatarId !== null) {
      setIsLoading(false);
      setShouldStartPlayback(true);
    }
  }, [avatarId, demoVideoUrl, selectedTemplate]);

  useEffect(() => {
    if (!isLoading && shouldStartPlayback) {
      if (isPlaying) {
        console.log("Starting video playback after loading");
        
        if (avatarVideoRef.current && (videoLayout !== "serial" || currentVideo === 'avatar')) {
          avatarVideoRef.current.play().catch(err => {
            console.error("Error playing avatar video:", err);
          });
        }
        
        if (demoVideoRef.current && demoVideoUrl && (videoLayout !== "serial" || currentVideo === 'demo')) {
          demoVideoRef.current.play().catch(err => {
            console.error("Error playing demo video:", err);
          });
        }
        
        if (audioRef.current && selectedSound) {
          audioRef.current.play().catch(err => {
            console.error("Error playing audio:", err);
          });
        }
      }
      
      setShouldStartPlayback(false);
    }
  }, [isLoading, shouldStartPlayback, isPlaying, videoLayout, currentVideo, demoVideoUrl, selectedSound]);

  useEffect(() => {
    const videoElement = avatarVideoRef.current;
    
    if (videoElement && selectedTemplate) {
      const handleLoadedData = () => {
        console.log("Avatar video loaded");
        setAvatarVideoLoaded(true);
        checkIfAllMediaLoaded();
      };

      const handleLoadStart = () => {
        console.log("Avatar video loading started");
      };

      const handleError = (e: Event) => {
        console.error("Error loading avatar video:", e);
        setAvatarVideoLoaded(true);
        checkIfAllMediaLoaded();
      };

      videoElement.addEventListener('loadeddata', handleLoadedData);
      videoElement.addEventListener('loadstart', handleLoadStart);
      videoElement.addEventListener('error', handleError);

      if (videoElement.readyState >= 3) {
        handleLoadedData();
      }

      return () => {
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('loadstart', handleLoadStart);
        videoElement.removeEventListener('error', handleError);
      };
    }
  }, [selectedTemplate]);

  useEffect(() => {
    const videoElement = demoVideoRef.current;
    
    if (videoElement && demoVideoUrl) {
      const handleLoadedData = () => {
        console.log("Demo video loaded");
        setDemoVideoLoaded(true);
        checkIfAllMediaLoaded();
      };

      const handleError = (e: Event) => {
        console.error("Error loading demo video:", e);
        setDemoVideoLoaded(true);
        checkIfAllMediaLoaded();
      };

      videoElement.addEventListener('loadeddata', handleLoadedData);
      videoElement.addEventListener('error', handleError);

      if (videoElement.readyState >= 3) {
        handleLoadedData();
      }

      return () => {
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('error', handleError);
      };
    } else if (!demoVideoUrl) {
      setDemoVideoLoaded(true);
      checkIfAllMediaLoaded();
    }
  }, [demoVideoUrl]);

  const checkIfAllMediaLoaded = () => {
    if (avatarVideoLoaded && (demoVideoLoaded || !demoVideoUrl)) {
      setIsLoading(false);
      setShouldStartPlayback(true);
    }
  };

  useEffect(() => {
    if (loadingTimeout) {
      checkIfAllMediaLoaded();
    }
  }, [loadingTimeout, avatarVideoLoaded, demoVideoLoaded]);

  useEffect(() => {
    const avatarVideo = avatarVideoRef.current;
    const demoVideo = demoVideoRef.current;
    
    if (avatarVideo && demoVideo && demoVideoUrl) {
      if (videoLayout === "serial") {
        const handleAvatarVideoEnded = () => {
          if (isPlaying && demoVideoUrl) {
            setCurrentVideo('demo');
            demoVideo.currentTime = 0;
            demoVideo.play().catch(err => {
              console.error("Error playing demo video:", err);
            });
          }
        };
        
        const handleDemoVideoEnded = () => {
          if (isPlaying) {
            setCurrentVideo('avatar');
            avatarVideo.currentTime = 0;
            avatarVideo.play().catch(err => {
              console.error("Error playing avatar video:", err);
            });
          }
        };
        
        avatarVideo.addEventListener('ended', handleAvatarVideoEnded);
        demoVideo.addEventListener('ended', handleDemoVideoEnded);
        
        return () => {
          avatarVideo.removeEventListener('ended', handleAvatarVideoEnded);
          demoVideo.removeEventListener('ended', handleDemoVideoEnded);
        };
      }
    }
  }, [isPlaying, demoVideoUrl, videoLayout]);

  useEffect(() => {
    if (isPlaying) {
      if (avatarVideoRef.current && (!demoVideoUrl || videoLayout !== "serial" || currentVideo === 'avatar')) {
        avatarVideoRef.current.play().catch(err => {
          console.error("Error playing avatar video:", err);
        });
      }
      
      if (demoVideoRef.current && demoVideoUrl && (videoLayout !== "serial" || currentVideo === 'demo')) {
        demoVideoRef.current.play().catch(err => {
          console.error("Error playing demo video:", err);
        });
      }
      
      if (audioRef.current && selectedSound) {
        audioRef.current.play().catch(err => {
          console.error("Error playing audio:", err);
        });
      }
    } else {
      if (avatarVideoRef.current) avatarVideoRef.current.pause();
      if (demoVideoRef.current) demoVideoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
    }
  }, [isPlaying, demoVideoUrl, videoLayout, currentVideo, selectedSound]);

  useEffect(() => {
    if (avatarVideoRef.current) {
      avatarVideoRef.current.muted = isMuted;
    }
    
    if (demoVideoRef.current) {
      demoVideoRef.current.muted = isMuted;
    }
    
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (audioRef.current && selectedSound) {
      audioRef.current.src = selectedSound.sound_link;
      audioRef.current.load();
      
      if (isPlaying && !isLoading) {
        audioRef.current.play().catch(err => {
          console.error("Error playing audio:", err);
        });
      }
    }
  }, [selectedSound, isPlaying, isLoading]);

  useEffect(() => {
    if (!demoVideoUrl) {
      setVideoLayout("serial");
      setCurrentVideo('avatar');
    }
  }, [demoVideoUrl]);

  const avatarUrl = !selectedTemplate && avatarId !== null 
    ? `https://randomuser.me/api/portraits/${avatarId % 2 === 0 ? 'women' : 'men'}/${avatarId + 1}.jpg`
    : null;

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleLayoutChange = (value: string) => {
    if (value) {
      const layout = value as VideoLayout;
      setVideoLayout(layout);
      if (avatarVideoRef.current) avatarVideoRef.current.currentTime = 0;
      if (demoVideoRef.current) demoVideoRef.current.currentTime = 0;
      if (value === "serial") {
        setCurrentVideo('avatar');
      }
      
      if (onLayoutChange) {
        onLayoutChange(layout);
      }
    }
  };

  const handleTextPositionChange = (value: string) => {
    if (value) {
      const position = value as TextPosition;
      setTextPosition(position);
      
      if (onTextPositionChange) {
        onTextPositionChange(position);
      }
    }
  };

  return (
    <div className="relative h-full w-full bg-gray-100 rounded-lg overflow-hidden">
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      ) : avatarId === null ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
          <UserPlus className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-center font-medium">Please select an avatar</p>
          <p className="text-xs text-muted-foreground mt-1">Choose from the AI Avatars section</p>
        </div>
      ) : selectedTemplate ? (
        <>
          {demoVideoUrl && (
            <div className="absolute top-2 left-0 right-0 z-10 flex justify-center">
              <div className="px-3 py-1.5 bg-white/30 backdrop-blur-sm rounded-full">
                <ToggleGroup type="single" value={videoLayout} onValueChange={handleLayoutChange}>
                  <ToggleGroupItem value="serial" aria-label="Sequential playback">
                    <LayoutList className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="side" aria-label="Side by side">
                    <Columns className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="top" aria-label="Up and down">
                    <RowsIcon className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          )}

          <div className="absolute inset-0">
            {videoLayout === "serial" ? (
              <>
                <div className={`absolute inset-0 transition-opacity duration-300 ${currentVideo === 'avatar' ? 'opacity-100' : 'opacity-0'}`}>
                  <video 
                    ref={avatarVideoRef}
                    src={selectedTemplate.video_link}
                    poster={selectedTemplate.image_link}
                    className="w-full h-full object-cover"
                    loop={!demoVideoUrl}
                    playsInline
                    muted={isMuted}
                    preload="auto"
                  />
                </div>
                
                {demoVideoUrl && (
                  <div className={`absolute inset-0 transition-opacity duration-300 ${currentVideo === 'demo' ? 'opacity-100' : 'opacity-0'}`}>
                    <video 
                      ref={demoVideoRef}
                      src={demoVideoUrl}
                      className="w-full h-full object-cover"
                      loop={false}
                      playsInline
                      muted={isMuted}
                      preload="auto"
                    />
                  </div>
                )}
              </>
            ) : videoLayout === "side" ? (
              <div className="flex h-full">
                <div className="w-1/2 h-full overflow-hidden">
                  <video 
                    ref={demoVideoRef}
                    src={demoVideoUrl}
                    className="w-full h-full object-cover"
                    loop={true}
                    playsInline
                    muted={isMuted}
                    preload="auto"
                  />
                </div>
                <div className="w-1/2 h-full overflow-hidden">
                  <video 
                    ref={avatarVideoRef}
                    src={selectedTemplate.video_link}
                    poster={selectedTemplate.image_link}
                    className="w-full h-full object-cover"
                    loop={true}
                    playsInline
                    muted={isMuted}
                    preload="auto"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="h-1/2 w-full overflow-hidden">
                  <video 
                    ref={demoVideoRef}
                    src={demoVideoUrl}
                    className="w-full h-full object-cover"
                    loop={true}
                    playsInline
                    muted={isMuted}
                    preload="auto"
                  />
                </div>
                <div className="h-1/2 w-full overflow-hidden">
                  <video 
                    ref={avatarVideoRef}
                    src={selectedTemplate.video_link}
                    poster={selectedTemplate.image_link}
                    className="w-full h-full object-cover"
                    loop={true}
                    playsInline
                    muted={isMuted}
                    preload="auto"
                  />
                </div>
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30"></div>
          </div>
          
          {hook && (
            <div className={cn(
              "absolute inset-x-0",
              textPosition === "top" ? "top-0 pt-[68px] pb-4 px-4" : 
              textPosition === "center" ? "top-1/2 -translate-y-1/2 p-4" : 
              "bottom-0 pb-[68px] pt-4 px-4"
            )}>
              <div className="text-center text-white leading-tight" style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                maxWidth: "100%",
                margin: "0 auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
                {hook}
              </div>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex justify-between items-center">
              <button
                onClick={handleMuteToggle}
                className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/40 text-white smooth-transition"
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              
              <div className="px-3 py-1.5 bg-white/30 backdrop-blur-sm rounded-full">
                <ToggleGroup type="single" value={textPosition} onValueChange={handleTextPositionChange}>
                  <ToggleGroupItem value="top" aria-label="Text at top">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="center" aria-label="Text at center">
                    <AlignCenter className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="bottom" aria-label="Text at bottom">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              
              <button
                onClick={handlePlayPause}
                className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/40 text-white smooth-transition"
              >
                {isPlaying ? <PauseIcon size={18} /> : <Play size={18} className="ml-1" />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0">
            <img 
              src={avatarUrl || ""} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30"></div>
          </div>
          
          {hook && (
            <div className="absolute inset-x-0 bottom-0 pb-[68px] pt-4 px-4">
              <div className="text-center text-white leading-tight" style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
                maxWidth: "100%",
                margin: "0 auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
                {hook}
              </div>
            </div>
          )}
          
          <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-center">
            <button
              onClick={handleMuteToggle}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/40 text-white smooth-transition"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            
            <button
              onClick={handlePlayPause}
              className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/40 text-white smooth-transition"
            >
              {isPlaying ? <PauseIcon size={18} /> : <Play size={18} className="ml-1" />}
            </button>
          </div>
        </>
      )}
      
      {selectedSound && (
        <audio 
          ref={audioRef} 
          src={selectedSound.sound_link} 
          loop={true}
        />
      )}
    </div>
  );
};

export default ContentPreview;

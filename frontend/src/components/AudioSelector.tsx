
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Pause, Check, Music, Volume2, X, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import AudioUploadDialog from "./AudioUploadDialog";
import { useAuth } from "@/contexts/AuthContext";

interface Sound {
  id: number;
  name: string;
  sound_link: string;
}

interface AudioSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sound: Sound | null) => void;
}

const fetchSounds = async (): Promise<Sound[]> => {
  const { data, error } = await supabase
    .from("sound")
    .select("*");
  
  if (error) {
    console.error("Error fetching sounds:", error);
    throw error;
  }
  
  return data;
};

const AudioSelector = ({ isOpen, onClose, onSelect }: AudioSelectorProps) => {
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [selectedSoundId, setSelectedSoundId] = useState<number | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();
  
  const { data: sounds, isLoading, error, refetch } = useQuery({
    queryKey: ["sounds"],
    queryFn: fetchSounds,
  });

  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      setLoadingId(null);
    }
  }, [isOpen]);

  const handlePlay = (sound: Sound) => {
    if (audioRef.current) {
      audioRef.current.pause();
      
      if (playingId === sound.id) {
        setPlayingId(null);
        setLoadingId(null);
      } else {
        setLoadingId(sound.id);
        audioRef.current.src = sound.sound_link;
        audioRef.current.play()
          .then(() => {
            setPlayingId(sound.id);
            setLoadingId(null);
          })
          .catch(err => {
            console.error("Error playing audio:", err);
            setLoadingId(null);
          });
      }
    }
  };

  const handleSelect = (sound: Sound) => {
    setSelectedSoundId(sound.id);
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      setLoadingId(null);
    }
    onSelect(sound);
    onClose();
  };

  const handleResetSound = () => {
    setSelectedSoundId(null);
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      setLoadingId(null);
    }
    onSelect(null);
    onClose();
  };

  const handleUploadSuccess = () => {
    refetch();
  };

  // Create a reversed array of sounds for display
  const reversedSounds = sounds ? [...sounds].reverse() : [];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              <span>Select Audio</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-between mb-2">
            {selectedSoundId !== null && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSound}
                className="flex items-center gap-1 text-xs"
              >
                <X size={14} />
                Reset Sound
              </Button>
            )}
            
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsUploadDialogOpen(true)}
                className="flex items-center gap-1 text-xs ml-auto"
              >
                <Upload size={14} />
                Upload Sound
              </Button>
            )}
          </div>
          
          <div className="max-h-[50vh] overflow-y-auto py-2 pr-1">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : error ? (
              <div className="text-destructive text-center py-4">
                Error loading audio files. Please try again.
              </div>
            ) : reversedSounds && reversedSounds.length > 0 ? (
              <div className="grid gap-2">
                {reversedSounds.map((sound) => (
                  <Card 
                    key={sound.id}
                    className={cn(
                      "transition-all duration-200 hover:bg-accent/40",
                      playingId === sound.id && "border-primary bg-primary/10"
                    )}
                  >
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          selectedSoundId === sound.id 
                            ? "bg-[#0EA5E9] text-white" 
                            : playingId === sound.id 
                              ? "bg-primary text-white"
                              : "bg-primary/10"
                        )}>
                          {selectedSoundId === sound.id ? (
                            <Check size={18} />
                          ) : playingId === sound.id ? (
                            <Volume2 size={18} />
                          ) : (
                            <Music size={18} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{sound.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {selectedSoundId === sound.id 
                              ? "Selected" 
                              : playingId === sound.id 
                                ? "Now playing" 
                                : loadingId === sound.id
                                  ? "Loading..."
                                  : "Click to preview"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant={playingId === sound.id ? "default" : "outline"} 
                          size="icon" 
                          onClick={() => handlePlay(sound)}
                          className={cn(
                            "transition-all",
                            playingId === sound.id && "bg-primary hover:bg-primary/90"
                          )}
                          disabled={loadingId === sound.id}
                        >
                          {loadingId === sound.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : playingId === sound.id ? (
                            <Pause size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                        </Button>
                        <Button 
                          variant="default" 
                          size="icon" 
                          onClick={() => handleSelect(sound)}
                          className="bg-[#2562EA] hover:bg-[#2562EA]/90"
                        >
                          <Check size={16} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No audio files found
              </div>
            )}
          </div>
          
          {/* Hidden audio element for playing sounds */}
          <audio ref={audioRef} />
        </DialogContent>
      </Dialog>

      {/* Audio Upload Dialog */}
      <AudioUploadDialog 
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
};

export default AudioSelector;

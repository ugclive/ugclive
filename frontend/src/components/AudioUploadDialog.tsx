import { useState, ChangeEvent } from "react";
import { Loader2, Upload, X, Music } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AudioUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AudioUploadDialog = ({ isOpen, onClose, onSuccess }: AudioUploadDialogProps) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioName, setAudioName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user } = useAuth();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    // Validate file type
    if (!file.type.includes('audio/mpeg') && !file.type.includes('audio/mp3')) {
      toast.error('Only MP3 audio files are accepted');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Audio file is too large (max 5MB)');
      return;
    }
    
    setAudioFile(file);
    
    // Set default name from filename without extension
    const fileName = file.name.split('.').slice(0, -1).join('.');
    setAudioName(fileName);
  };

  const resetForm = () => {
    setAudioFile(null);
    setAudioName("");
    setUploadProgress(0);
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleUpload = async () => {
    if (!audioFile || !user) {
      toast.error('Please select an audio file');
      return;
    }

    if (!audioName.trim()) {
      toast.error('Please enter a name for your audio');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Generate a unique filename for storage but keep user's chosen name for display
      const fileExt = audioFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      // Upload audio to Supabase storage using XMLHttpRequest to track progress
      const { data: signedUrlData } = await supabase.storage
        .from('user-templates')
        .createSignedUploadUrl(filePath);
        
      if (!signedUrlData) {
        throw new Error('Failed to get upload URL');
      }
      
      // Use XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      });
      
      // Create a promise to handle the upload
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        
        xhr.onerror = function() {
          reject(new Error('Network error during upload'));
        };
      });
      
      // Start the upload
      xhr.open('PUT', signedUrlData.signedUrl);
      xhr.send(audioFile);
      
      // Wait for the upload to complete
      await uploadPromise;
      
      // Get the public URL for the audio
      const { data: audioUrl } = supabase.storage
        .from('user-templates')
        .getPublicUrl(filePath);
      
      // Save the sound information to the database with the user-entered name
      const { error } = await supabase
        .from('sound')
        .insert({
          name: audioName.trim(),
          sound_link: audioUrl.publicUrl,
          user_id: user.id
        });
      
      if (error) {
        throw error;
      }
      
      toast.success('Audio uploaded successfully');
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error uploading audio:', error);
      toast.error(error.message || 'Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <span>Upload Your Sound</span>
          </DialogTitle>
          <DialogDescription>
            Upload an MP3 audio file to use as background sound (max 5MB)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="audio-name">Sound Name</Label>
            <Input 
              id="audio-name" 
              value={audioName} 
              onChange={(e) => setAudioName(e.target.value)} 
              placeholder="Enter a name for your sound"
              disabled={isUploading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audio">Audio File (MP3)</Label>
            {audioFile ? (
              <div className="relative flex items-center p-2 border rounded-md">
                <div className="flex-1 truncate pr-2">
                  <p className="text-sm font-medium">{audioFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setAudioFile(null)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center border border-dashed rounded-md py-4">
                <label htmlFor="audio-upload" className="cursor-pointer text-center px-4">
                  <Music className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select an MP3 file</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max size: 5MB
                  </p>
                  <input
                    type="file"
                    id="audio-upload"
                    accept="audio/mpeg,audio/mp3"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
        
        {isUploading && (
          <div className="space-y-2">
            <div className="w-full bg-secondary rounded-full h-2.5">
              <div 
                className="bg-primary h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}
        
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!audioFile || !audioName.trim() || isUploading}
            className="ml-auto"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Sound
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AudioUploadDialog;

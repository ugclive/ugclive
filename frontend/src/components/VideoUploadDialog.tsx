import { useState, ChangeEvent } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
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
import { createTemplate } from "@/services/templateService";

// Type definitions for Supabase responses
interface SignedUrlResponse {
  signedUrl: string;
  token?: string;
  path?: string;
}

interface PublicUrlResponse {
  publicUrl: string;
}

interface VideoUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const VideoUploadDialog = ({ isOpen, onClose, onSuccess }: VideoUploadDialogProps) => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { user } = useAuth();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    // Validate file type
    if (!file.type.includes('video/mp4')) {
      toast.error('Only MP4 videos are accepted');
      return;
    }
    
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Video file is too large (max 10MB)');
      return;
    }
    
    setVideoFile(file);
  };

  const resetForm = () => {
    setVideoFile(null);
    setUploadProgress(0);
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleUpload = async () => {
    if (!videoFile || !user) {
      toast.error('Please select a video file');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Generate a unique filename
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      // Upload video to Supabase storage using XMLHttpRequest to track progress
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('user-templates')
        .createSignedUploadUrl(filePath);
        
      if (signedUrlError || !signedUrlData) {
        throw new Error(signedUrlError?.message || 'Failed to get upload URL');
      }
      
      // Type assert and verify the signed URL
      const signedUrl = signedUrlData.signedUrl;
      if (!signedUrl) {
        throw new Error('Missing signed URL in response');
      }
      
      // Create a FormData object
      const formData = new FormData();
      formData.append('file', videoFile);
      
      // Use XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 50);
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
      xhr.open('PUT', signedUrl);
      xhr.send(videoFile);
      
      // Wait for the upload to complete
      await uploadPromise;
      
      // Get the public URL for the video
      const { data: videoUrlData } = supabase.storage
        .from('user-templates')
        .getPublicUrl(filePath);
      
      if (!videoUrlData) {
        throw new Error('Failed to get video public URL');
      }
      
      // Type assert and verify the public URL
      const videoPublicUrl = videoUrlData.publicUrl;
      if (!videoPublicUrl) {
        throw new Error('Missing video public URL in response');
      }
      
      // Create a thumbnail from the video
      const thumbnailFilePath = `${user.id}/thumbnail_${fileName.replace('.mp4', '.jpg')}`;
      
      // Using the video element to generate a thumbnail
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      
      // Wait for video to load enough to extract frame
      await new Promise((resolve) => {
        video.onloadeddata = resolve;
        video.load();
      });
      
      // Seek to 0.5 seconds into the video
      video.currentTime = 0.5;
      
      // Wait for the seek to complete
      await new Promise((resolve) => {
        video.onseeked = resolve;
      });
      
      // Create a canvas and draw the video frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to blob
      const thumbnailBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else resolve(new Blob([]));
        }, 'image/jpeg', 0.8);
      });
      
      // Upload thumbnail to Supabase storage using the same XMLHttpRequest approach
      const { data: thumbnailSignedUrlData, error: thumbnailSignedUrlError } = await supabase.storage
        .from('user-templates')
        .createSignedUploadUrl(thumbnailFilePath);
        
      if (thumbnailSignedUrlError || !thumbnailSignedUrlData) {
        throw new Error(thumbnailSignedUrlError?.message || 'Failed to get thumbnail upload URL');
      }
      
      // Type assert and verify the thumbnail signed URL
      const thumbnailSignedUrl = thumbnailSignedUrlData.signedUrl;
      if (!thumbnailSignedUrl) {
        throw new Error('Missing thumbnail signed URL in response');
      }
      
      // Use XMLHttpRequest to track thumbnail upload progress
      const thumbnailXhr = new XMLHttpRequest();
      
      // Set up progress tracking for thumbnail
      thumbnailXhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = 50 + Math.round((event.loaded / event.total) * 50);
          setUploadProgress(percent);
        }
      });
      
      // Create a promise to handle the thumbnail upload
      const thumbnailUploadPromise = new Promise<void>((resolve, reject) => {
        thumbnailXhr.onload = function() {
          if (thumbnailXhr.status >= 200 && thumbnailXhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Thumbnail upload failed with status ${thumbnailXhr.status}`));
          }
        };
        
        thumbnailXhr.onerror = function() {
          reject(new Error('Network error during thumbnail upload'));
        };
      });
      
      // Start the thumbnail upload
      thumbnailXhr.open('PUT', thumbnailSignedUrl);
      thumbnailXhr.setRequestHeader('Content-Type', 'image/jpeg');
      thumbnailXhr.send(thumbnailBlob);
      
      // Wait for the thumbnail upload to complete
      await thumbnailUploadPromise;
      
      // Get the public URL for the thumbnail
      const { data: thumbnailUrlData } = supabase.storage
        .from('user-templates')
        .getPublicUrl(thumbnailFilePath);
      
      if (!thumbnailUrlData) {
        throw new Error('Failed to get thumbnail public URL');
      }
      
      // Type assert and verify the thumbnail public URL
      const thumbnailPublicUrl = thumbnailUrlData.publicUrl;
      if (!thumbnailPublicUrl) {
        throw new Error('Missing thumbnail public URL in response');
      }
      
      // Save template information to the database
      await createTemplate(
        user.id,
        thumbnailPublicUrl,
        videoPublicUrl
      );
      
      toast.success('Video uploaded successfully');
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error uploading video:', error);
      toast.error(error.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <span>Upload Your Video</span>
          </DialogTitle>
          <DialogDescription>
            Upload an MP4 video to use as a template (max 10MB)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="video">Video File (MP4)</Label>
            {videoFile ? (
              <div className="relative flex items-center p-2 border rounded-md">
                <div className="flex-1 truncate pr-2">
                  <p className="text-sm font-medium">{videoFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setVideoFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center border border-dashed rounded-md py-4">
                <label htmlFor="video-upload" className="cursor-pointer text-center px-4">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select an MP4 video</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max size: 10MB
                  </p>
                  <input
                    type="file"
                    id="video-upload"
                    accept="video/mp4"
                    onChange={handleFileChange}
                    className="hidden"
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
            disabled={!videoFile || isUploading}
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
                Upload Video
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VideoUploadDialog;

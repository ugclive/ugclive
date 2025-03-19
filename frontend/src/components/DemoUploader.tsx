
import { useState } from "react";
import { Upload, X, FileVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface DemoUploaderProps {
  onSuccess: (demoId: number) => void;
  onCancel: () => void;
}

const DemoUploader = ({ onSuccess, onCancel }: DemoUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      // Check if file is video
      if (!selectedFile.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }
      // Check file size (limit to 100MB)
      if (selectedFile.size > 100 * 1024 * 1024) {
        toast.error('File is too large. Maximum size is 100MB');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    
    try {
      setUploading(true);
      setProgress(0);
      
      // Generate a unique file name with demo_ prefix to distinguish from other content types
      const fileExt = file.name.split('.').pop();
      const fileName = `demo_${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
      
      // Upload to Supabase Storage using XMLHttpRequest to track progress
      const formData = new FormData();
      formData.append('file', file);
      
      // Get the URL and headers for the upload
      const { data } = await supabase.storage.from('user-templates').createSignedUploadUrl(filePath);
      if (!data) {
        throw new Error("Failed to get upload URL");
      }
      
      // Create and configure XMLHttpRequest for upload with progress tracking
      const xhr = new XMLHttpRequest();
      
      // Set up progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
        }
      });
      
      // Create a promise to handle the upload
      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = async function() {
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
      xhr.open('PUT', data.signedUrl);
      xhr.send(file);
      
      // Wait for the upload to complete
      await uploadPromise;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-templates')
        .getPublicUrl(filePath);

      // Save to demo table
      const { data: demoData, error: demoError } = await supabase
        .from('demo')
        .insert([
          { 
            demo_link: publicUrl,
            user_id: user.id,
          }
        ])
        .select();

      if (demoError) {
        throw demoError;
      }

      toast.success('Demo uploaded successfully');
      
      // Notify parent component
      if (demoData && demoData.length > 0) {
        onSuccess(demoData[0].id);
      }
    } catch (error) {
      console.error('Error uploading demo:', error);
      toast.error('Error uploading demo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border border-border rounded-lg bg-card">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Upload Demo Video</h3>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onCancel}
          disabled={uploading}
        >
          <X size={18} />
        </Button>
      </div>
      
      {!file ? (
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <input
            type="file"
            id="demo-upload"
            accept="video/*"
            onChange={handleFileChange}
            className="sr-only"
          />
          <label 
            htmlFor="demo-upload"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium mb-1">Click to upload demo video</p>
            <p className="text-xs text-muted-foreground">MP4, WebM or MOV (max. 100MB)</p>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-secondary flex items-center justify-center rounded">
              <FileVideo size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
            {!uploading && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setFile(null)}
              >
                <X size={16} />
              </Button>
            )}
          </div>
          
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Demo'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoUploader;

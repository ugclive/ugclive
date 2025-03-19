
import { Skeleton } from "@/components/ui/skeleton";
import VideoCard from "@/components/VideoCard";
import { useVideos } from "@/hooks/useVideos";
import type { Database } from "@/integrations/supabase/types";
import { useEffect } from "react";
import { toast } from "sonner";

type VideoType = Database["public"]["Enums"]["video_type"];

interface VideoGridProps {
  videoType: VideoType;
}

const VideoGrid = ({ videoType }: VideoGridProps) => {
  const { data: videos, isLoading, isError } = useVideos(videoType);

  // Show toast notification when there's an error fetching videos
  useEffect(() => {
    if (isError) {
      toast.error("Failed to load videos. Please try again later.");
    }
  }, [isError]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-lg overflow-hidden">
            <div className="aspect-[9/16]">
              <Skeleton className="w-full h-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!videos?.length) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium text-muted-foreground">No videos found</h3>
        <p className="mt-2">You haven't created any {videoType === "aiugc" ? "AI UGC" : "meme"} videos yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
};

export default VideoGrid;

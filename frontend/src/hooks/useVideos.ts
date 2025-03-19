
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import type { Database } from "@/integrations/supabase/types";

type VideoType = Database["public"]["Enums"]["video_type"];
type Video = Database["public"]["Tables"]["generated_videos"]["Row"];

export const useVideos = (videoType: VideoType) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Set up real-time subscription to video updates
  useEffect(() => {
    if (!user) return;

    // Subscribe to changes on the generated_videos table for this user
    const channel = supabase
      .channel('videos-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generated_videos',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          // Invalidate the query to trigger a refetch
          queryClient.invalidateQueries({
            queryKey: ["videos", videoType, user.id],
          });
        }
      )
      .subscribe();

    // Cleanup subscription when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, videoType, queryClient]);

  return useQuery({
    queryKey: ["videos", videoType, user?.id],
    queryFn: async (): Promise<Video[]> => {
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from("generated_videos")
        .select("*")
        .eq("user_id", user.id)
        .eq("video_type", videoType)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching videos:", error);
        throw error;
      }

      return data || [];
    },
    // Only run the query if we have a user
    enabled: !!user,
    // Keep the data fresh, but don't refetch on window focus for better UX
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

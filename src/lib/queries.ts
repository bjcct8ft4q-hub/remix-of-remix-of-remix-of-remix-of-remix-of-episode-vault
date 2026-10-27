import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const seriesListQuery = () =>
  queryOptions({
    queryKey: ["series"],
    queryFn: async () => {
      const { data, error } = await supabase.from("series").select("*, episodes(count)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const seriesQuery = (id: string) =>
  queryOptions({
    queryKey: ["series", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("series").select("*, episodes(*), episode_catalog(*)").eq("id", id).maybeSingle();
      if (error) throw error;
      if (data) {
        data.episodes.sort((a, b) => a.number - b.number);
        data.episode_catalog.sort((a, b) => a.number - b.number);
      }
      return data;
    },
  });

export const commentsQuery = (episodeId: string) =>
  queryOptions({
    queryKey: ["comments", episodeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles(username)")
        .eq("episode_id", episodeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export type SeriesRow = Awaited<ReturnType<NonNullable<ReturnType<typeof seriesListQuery>["queryFn"]>>>[number];

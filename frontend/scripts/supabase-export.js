
// Supabase Export Script
// This script generates SQL commands to replicate your Supabase configuration
// Run this with Node.js: node supabase-export.js > supabase-setup.sql

console.log(`
-- Supabase Project Clone Script
-- Generated on ${new Date().toISOString()}
-- This script recreates tables, enums, RLS policies, and storage configuration

-----------------------
-- Create Enums
-----------------------

-- Create plan enum type
CREATE TYPE public.plan AS ENUM ('free', 'pro', 'ultra');

-- Create template_type enum
CREATE TYPE public.template_type AS ENUM ('aiavatar', 'game', 'usergenerated');

-- Create text_alignment enum
CREATE TYPE public.text_alignment AS ENUM ('top', 'center', 'bottom');

-- Create video_alignment enum
CREATE TYPE public.video_alignment AS ENUM ('side', 'top', 'serial');

-- Create video_type enum
CREATE TYPE public.video_type AS ENUM ('aiugc', 'meme');

-----------------------
-- Create Tables
-----------------------

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  plan public.plan NOT NULL DEFAULT 'free'::public.plan,
  credits INTEGER NOT NULL DEFAULT 3,
  username TEXT,
  avatar_url TEXT
);

-- Create demo table
CREATE TABLE public.demo (
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  id BIGINT PRIMARY KEY,
  demo_link TEXT NOT NULL
);

-- Create generated_images table
CREATE TABLE public.generated_images (
  video_url TEXT,
  id BIGINT PRIMARY KEY,
  prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID DEFAULT gen_random_uuid()
);

-- Create sound table
CREATE TABLE public.sound (
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sound_link TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'audio name'::text,
  user_id UUID,
  id BIGINT PRIMARY KEY
);

-- Create templates table
CREATE TABLE public.templates (
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  template_type public.template_type DEFAULT 'aiavatar'::public.template_type,
  id BIGINT PRIMARY KEY,
  video_link TEXT NOT NULL,
  image_link TEXT,
  user_id UUID
);

-- Create generated_videos table
CREATE TABLE public.generated_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  text_alignment public.text_alignment NOT NULL,
  video_alignment public.video_alignment,
  video_type public.video_type NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL,
  caption TEXT,
  error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'::text,
  remotion_video TEXT,
  demo_id BIGINT,
  sound_id BIGINT,
  template_id BIGINT,
  remotion JSONB
);

-----------------------
-- Add Foreign Keys
-----------------------

-- Demo table foreign keys
ALTER TABLE public.demo
  ADD CONSTRAINT demo_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Generated_videos table foreign keys
ALTER TABLE public.generated_videos
  ADD CONSTRAINT generated_videos_demo_id_fkey FOREIGN KEY (demo_id) REFERENCES public.demo(id),
  ADD CONSTRAINT generated_videos_sound_id_fkey FOREIGN KEY (sound_id) REFERENCES public.sound(id),
  ADD CONSTRAINT generated_videos_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id),
  ADD CONSTRAINT generated_videos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-----------------------
-- Enable Row Level Security
-----------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

-----------------------
-- Create RLS Policies
-----------------------

-- Profiles table policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Demo table policies
CREATE POLICY "Users can view their own demos" ON public.demo
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own demos" ON public.demo
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own demos" ON public.demo
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own demos" ON public.demo
  FOR DELETE USING (auth.uid() = user_id);

-- Generated_images table policies
CREATE POLICY "Users can view their own generated images" ON public.generated_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generated images" ON public.generated_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated images" ON public.generated_images
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated images" ON public.generated_images
  FOR DELETE USING (auth.uid() = user_id);

-- Sound table policies
CREATE POLICY "Users can view sounds with null user_id or their own" ON public.sound
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own sounds" ON public.sound
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sounds" ON public.sound
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sounds" ON public.sound
  FOR DELETE USING (auth.uid() = user_id);

-- Templates table policies
CREATE POLICY "Users can view all templates" ON public.templates
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own templates" ON public.templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON public.templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON public.templates
  FOR DELETE USING (auth.uid() = user_id);

-- Generated_videos table policies
CREATE POLICY "Users can view their own generated videos" ON public.generated_videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generated videos" ON public.generated_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated videos" ON public.generated_videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generated videos" ON public.generated_videos
  FOR DELETE USING (auth.uid() = user_id);

-----------------------
-- Setup Realtime
-----------------------

-- Enable REPLICA IDENTITY FULL for the generated_videos table
ALTER TABLE public.generated_videos REPLICA IDENTITY FULL;

-- Add the table to supabase_realtime publication
BEGIN;
  -- Check if the publication exists, if not create it
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
      CREATE PUBLICATION supabase_realtime;
    END IF;
  END
  $$;

  -- Add the table to the publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.generated_videos;
COMMIT;

-----------------------
-- Setup Auth Hooks
-----------------------

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Create a trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-----------------------
-- Storage Setup
-----------------------

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('sound', 'sound', true),
  ('template', 'template', true),
  ('generated-videos', 'generated-videos', true),
  ('user-templates', 'user-templates', true);

-- User-templates bucket policies
CREATE POLICY "Allow public to view files" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'user-templates');

CREATE POLICY "Allow users to delete their own files" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'user-templates' AND auth.uid() = owner);

CREATE POLICY "Allow users to update their own files" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'user-templates' AND auth.uid() = owner);

CREATE POLICY "Allow users to upload their own files" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'user-templates' AND auth.uid() = owner);

-- Global storage policies (for all buckets)
CREATE POLICY "Allow authenticated users to upload demo videos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users to view demo videos" 
  ON storage.objects FOR SELECT 
  USING (true);

CREATE POLICY "Allow users to update their own demo videos" 
  ON storage.objects FOR UPDATE 
  USING (auth.uid() = owner);

CREATE POLICY "Allow users to delete their own demo videos" 
  ON storage.objects FOR DELETE 
  USING (auth.uid() = owner);

CREATE POLICY "Anyone can read user sounds" 
  ON storage.objects FOR SELECT 
  USING (true);

CREATE POLICY "Users can upload their own sounds" 
  ON storage.objects FOR INSERT 
  WITH CHECK (auth.uid() = owner);

COMMENT ON TABLE public.profiles IS 'User profiles for the application';
COMMENT ON TABLE public.generated_videos IS 'Videos generated by users';
COMMENT ON TABLE public.sound IS 'Audio files for use in video generation';
COMMENT ON TABLE public.templates IS 'Video templates for generating content';
`);


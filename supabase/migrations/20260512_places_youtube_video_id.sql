-- Short cinematic clip reference per scout row (YouTube watch?v= ID only)
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS youtube_video_id text;

COMMENT ON COLUMN public.places.youtube_video_id IS 'YouTube video ID from scout-agent cinematic search ([Place] [City] cinematic vibe)';

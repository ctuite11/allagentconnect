-- Add notification settings to hot_sheets table
ALTER TABLE public.hot_sheets
ADD COLUMN IF NOT EXISTS notify_client_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_agent_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_schedule TEXT DEFAULT 'immediately' CHECK (notification_schedule IN ('immediately', 'daily', 'weekly'));

-- Update existing rows to have default values
UPDATE public.hot_sheets
SET 
  notify_client_email = COALESCE(notify_client_email, false),
  notify_agent_email = COALESCE(notify_agent_email, true),
  notification_schedule = COALESCE(notification_schedule, 'immediately')
WHERE notify_client_email IS NULL OR notify_agent_email IS NULL OR notification_schedule IS NULL;
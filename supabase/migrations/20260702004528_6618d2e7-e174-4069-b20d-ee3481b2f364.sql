-- Add 'invited' to agent_status enum for admin-created lifecycle
ALTER TYPE agent_status ADD VALUE IF NOT EXISTS 'invited';
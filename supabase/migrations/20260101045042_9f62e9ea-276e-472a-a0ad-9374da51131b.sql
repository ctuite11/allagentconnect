-- Add early_access column to agent_settings
ALTER TABLE agent_settings ADD COLUMN early_access boolean NOT NULL DEFAULT false;

-- Add index for onboarding email matching
CREATE INDEX IF NOT EXISTS idx_agent_early_access_email ON agent_early_access (email);
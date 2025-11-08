-- Enable real-time updates for client_needs table
ALTER TABLE client_needs REPLICA IDENTITY FULL;

-- Add client_needs to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE client_needs;
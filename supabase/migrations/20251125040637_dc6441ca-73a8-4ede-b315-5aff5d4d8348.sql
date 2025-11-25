-- Backfill buyer roles for all existing clients who are missing them
INSERT INTO user_roles (user_id, role)
SELECT DISTINCT car.client_id, 'buyer'::app_role
FROM client_agent_relationships car
LEFT JOIN user_roles ur ON ur.user_id = car.client_id
WHERE ur.id IS NULL;
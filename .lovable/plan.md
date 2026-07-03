## Execute Grace's password reset

Invoke `admin-set-user-password` with your admin session:
- `email`: `grace.pettengill@raveis.com`
- `password`: `Password11$`

Then verify `account_activated_at IS NOT NULL` and `agent_status = 'verified'`, and confirm.
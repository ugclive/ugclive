-- Create a monitoring function that checks for inconsistencies
CREATE OR REPLACE FUNCTION check_auth_profile_consistency()
RETURNS TABLE (
  orphaned_profiles bigint,
  users_without_profiles bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles p LEFT JOIN auth.users u ON p.id = u.id WHERE u.id IS NULL) as orphaned_profiles,
    (SELECT COUNT(*) FROM auth.users u LEFT JOIN profiles p ON u.id = p.id WHERE p.id IS NULL) as users_without_profiles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example query to run the check
SELECT * FROM check_auth_profile_consistency();

-- Create a view to easily identify inconsistent records
CREATE OR REPLACE VIEW inconsistent_users AS
SELECT 
  'orphaned_profile' as issue_type,
  p.id, 
  p.email, 
  p.username, 
  p.created_at
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL

UNION ALL

SELECT 
  'missing_profile' as issue_type,
  u.id,
  u.email,
  NULL as username,
  u.created_at 
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Example query to view inconsistent records
SELECT * FROM inconsistent_users; 
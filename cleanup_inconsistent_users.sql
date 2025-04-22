-- Step 1: Identify inconsistent records
-- Run this first to see which profiles need to be cleaned up
SELECT p.id, p.email, p.username, p.created_at 
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;

-- Step 2: Clean up by deleting orphaned profiles
-- Only run this after reviewing the results from Step 1
DELETE FROM profiles
WHERE id IN (
  SELECT p.id
  FROM profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  WHERE u.id IS NULL
);

-- Check if any records still exist after cleanup
SELECT COUNT(*) as remaining_orphans
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL; 
# Authentication Fix Implementation Guide

This guide will walk you through implementing all the fixes to resolve the issue with users appearing in the `profiles` table but not in `auth.users`.

## Step 1: Clean Up Existing Inconsistent Data

1. Log in to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to the SQL Editor
3. Copy and paste the first query from `cleanup_inconsistent_users.sql` to identify inconsistent records:
   ```sql
   SELECT p.id, p.email, p.username, p.created_at 
   FROM profiles p
   LEFT JOIN auth.users u ON p.id = u.id
   WHERE u.id IS NULL;
   ```
4. Review the results to understand which profiles will be removed
5. If you're comfortable deleting these orphaned profiles, run the cleanup query:
   ```sql
   DELETE FROM profiles
   WHERE id IN (
     SELECT p.id
     FROM profiles p
     LEFT JOIN auth.users u ON p.id = u.id
     WHERE u.id IS NULL
   );
   ```
6. Verify the cleanup was successful:
   ```sql
   SELECT COUNT(*) as remaining_orphans
   FROM profiles p
   LEFT JOIN auth.users u ON p.id = u.id
   WHERE u.id IS NULL;
   ```

## Step 2: Improve OAuth Flow and Auth Handling

1. Update your `frontend/src/components/AuthDialog.tsx` file with the new code that:
   - Adds tracking for authentication attempts
   - Clears stale state
   - Improves error handling

2. Update your `frontend/src/contexts/AuthContext.tsx` file with the new code that:
   - Adds profile validation
   - Fixes the authentication state change handling
   - Adds better error messaging

3. Make sure to save both files and test the sign-in flow

## Step 3: Improve Database Trigger

1. Go to the SQL Editor in your Supabase Dashboard
2. Run the SQL commands from `improve_db_trigger.sql` to:
   - Drop the existing trigger
   - Create an improved `handle_new_user()` function with better error handling
   - Recreate the trigger

## Step 4: Set Up Monitoring

1. Go to the SQL Editor in your Supabase Dashboard
2. Run the SQL commands from `monitoring.sql` to:
   - Create a function that checks for inconsistencies
   - Create a view to easily identify inconsistent records

3. You can now run this query anytime to check for inconsistencies:
   ```sql
   SELECT * FROM check_auth_profile_consistency();
   ```

4. To see detailed inconsistent records:
   ```sql
   SELECT * FROM inconsistent_users;
   ```

## Step 5: Testing

After implementing all changes, test thoroughly by:

1. Sign up as a new user to ensure both auth and profile records are created
2. Sign out and sign back in to verify authentication persistence
3. Try to interrupt the sign-up process (close browser during OAuth) to test robustness
4. Monitor for orphaned profiles by running the check function periodically

## Troubleshooting

If you continue to see issues:

1. Check the browser console for any JavaScript errors
2. Review Supabase logs for potential auth errors 
3. Run the monitoring queries to check if new inconsistencies are being created
4. Verify that the trigger is working by creating a test user and checking both tables

For any persistent issues, you may need to:
1. Clear your browser's local storage and cookies
2. Verify all Supabase environment variables are correctly set
3. Confirm your OAuth provider settings in Supabase are correct

## Maintenance

Run the monitoring check regularly to ensure your database remains consistent. Consider setting up automated alerts if inconsistencies are detected. 
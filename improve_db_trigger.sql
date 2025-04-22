-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Improved handle_new_user function with error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
    -- Update existing profile instead of creating a new one
    UPDATE public.profiles
    SET email = new.email,
        updated_at = now()
    WHERE id = new.id;
  ELSE
    -- Create new profile
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email);
  END IF;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE NOTICE 'Error creating profile: %', SQLERRM;
  RETURN new;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 
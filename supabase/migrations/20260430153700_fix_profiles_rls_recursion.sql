-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 2. Create the fixed non-recursive policy
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

-- 3. Drop the existing trigger so we can modify it
DROP TRIGGER IF EXISTS tr_protect_profile_sensitive_columns ON profiles;

-- 4. Create the function to handle both INSERT and UPDATE safely
CREATE OR REPLACE FUNCTION protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If the user is authenticated (not a service role or admin)
  IF auth.role() = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      -- On insert, force defaults
      NEW.tier := 'free';
      NEW.suspended_at := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      -- On update, revert to previous values
      NEW.tier := OLD.tier;
      NEW.suspended_at := OLD.suspended_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Attach the trigger for BOTH INSERT and UPDATE
CREATE TRIGGER tr_protect_profile_sensitive_columns
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION protect_profile_sensitive_columns();

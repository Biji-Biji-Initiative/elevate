-- User authentication and profile policies
-- Controls access to user data based on role and ownership

-- Users table policies
-- Users can read their own data and public profiles of others
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.get_user_id());

-- Users can view public profiles (for leaderboard, etc.)
CREATE POLICY "Public profiles are viewable" ON users
  FOR SELECT
  TO authenticated
  USING (true); -- We'll control visibility at application level

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  TO authenticated
  USING (id = auth.get_user_id());

-- Only admins can insert new users (typically done via webhook/sync)
CREATE POLICY "Admins can insert users" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

-- Only admins can delete users
CREATE POLICY "Admins can delete users" ON users
  FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Activities table policies (read-only for most users)
-- All authenticated users can read activities
CREATE POLICY "Activities are readable by all" ON activities
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify activities
CREATE POLICY "Only admins can modify activities" ON activities
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Only admins can update activities" ON activities
  FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Only admins can delete activities" ON activities
  FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Badges table policies
-- All authenticated users can read badges
CREATE POLICY "Badges are readable by all" ON badges
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify badges
CREATE POLICY "Only admins can modify badges" ON badges
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "Only admins can update badges" ON badges
  FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

CREATE POLICY "Only admins can delete badges" ON badges
  FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Earned badges policies
-- Users can view their own earned badges
CREATE POLICY "Users can view own earned badges" ON earned_badges
  FOR SELECT
  TO authenticated
  USING (user_id = auth.get_user_id());

-- Users can view earned badges of others (for public profiles)
CREATE POLICY "Earned badges are viewable for public profiles" ON earned_badges
  FOR SELECT
  TO authenticated
  USING (true); -- Application will control visibility

-- Only admins and reviewers can award badges
CREATE POLICY "Reviewers can insert earned badges" ON earned_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_reviewer());

-- Only admins can remove earned badges
CREATE POLICY "Admins can delete earned badges" ON earned_badges
  FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Kajabi events policies (admin/system only)
-- Only admins can view kajabi events
CREATE POLICY "Admins can view kajabi events" ON kajabi_events
  FOR SELECT
  TO authenticated
  USING (auth.is_admin());

-- Kajabi events are inserted by webhook (service role)
CREATE POLICY "Service role can insert kajabi events" ON kajabi_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only admins can update kajabi events
CREATE POLICY "Admins can update kajabi events" ON kajabi_events
  FOR UPDATE
  TO authenticated
  USING (auth.is_admin());

-- Add helpful comments
COMMENT ON POLICY "Users can view own profile" ON users IS 'Users can access their own profile data';
COMMENT ON POLICY "Public profiles are viewable" ON users IS 'All users can view public profile information';
COMMENT ON POLICY "Activities are readable by all" ON activities IS 'Activity definitions are public';
COMMENT ON POLICY "Reviewers can insert earned badges" ON earned_badges IS 'Reviewers and admins can award badges';
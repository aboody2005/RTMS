-- =====================================================
-- Rabbit Experiment Team Management System
-- Database Migration: 002 - Row Level Security Policies
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS for RLS
-- =====================================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid() AND is_active = true;
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get team ID managed by current user (if team leader)
CREATE OR REPLACE FUNCTION get_leader_team_id()
RETURNS UUID AS $$
DECLARE
  v_team_id UUID;
BEGIN
  SELECT tl.team_id INTO v_team_id
  FROM team_leaders tl
  JOIN students s ON s.id = tl.student_id
  WHERE s.email = auth.email() -- or link by profile
    AND tl.is_active = true
    AND tl.link_revoked_at IS NULL
  LIMIT 1;
  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- PROFILES RLS
-- =====================================================

-- Admins can see all profiles
CREATE POLICY "admin_all_profiles" ON profiles
  FOR ALL USING (is_admin());

-- Users can view their own profile
CREATE POLICY "user_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile (non-role fields)
CREATE POLICY "user_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- SYSTEM_SETTINGS RLS
-- =====================================================

-- Only admins can manage settings
CREATE POLICY "admin_settings" ON system_settings
  FOR ALL USING (is_admin());

-- Anyone authenticated can read settings (needed for team capacity checks)
CREATE POLICY "read_settings" ON system_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- ACADEMIC_GROUPS RLS
-- =====================================================

-- Admins have full access
CREATE POLICY "admin_groups" ON academic_groups
  FOR ALL USING (is_admin());

-- All authenticated users can read groups
CREATE POLICY "read_groups" ON academic_groups
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- STUDENTS RLS
-- =====================================================

-- Admins have full access
CREATE POLICY "admin_students" ON students
  FOR ALL USING (is_admin());

-- Team leaders can read students in their academic group
CREATE POLICY "leader_read_group_students" ON students
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM team_leaders tl
      JOIN teams t ON t.id = tl.team_id
      JOIN profiles p ON p.id = auth.uid()
      WHERE tl.is_active = true
        AND tl.link_revoked_at IS NULL
        AND t.academic_group_id = students.academic_group_id
    )
  );

-- =====================================================
-- TEAMS RLS
-- =====================================================

-- Admins have full access
CREATE POLICY "admin_teams" ON teams
  FOR ALL USING (is_admin());

-- All authenticated users can read teams
CREATE POLICY "read_teams" ON teams
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- TEAM_LEADERS RLS
-- =====================================================

-- Admins have full access
CREATE POLICY "admin_leaders" ON team_leaders
  FOR ALL USING (is_admin());

-- Team leaders can read their own leader record
CREATE POLICY "leader_own_record" ON team_leaders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN profiles p ON p.email = s.email
      WHERE s.id = team_leaders.student_id AND p.id = auth.uid()
    )
  );

-- =====================================================
-- TEAM_MEMBERSHIPS RLS
-- =====================================================

-- Admins have full access
CREATE POLICY "admin_memberships" ON team_memberships
  FOR ALL USING (is_admin());

-- Team leaders can read memberships for their team
CREATE POLICY "leader_team_memberships" ON team_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_leaders tl
      WHERE tl.team_id = team_memberships.team_id
        AND tl.is_active = true
        AND tl.link_revoked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM students s
          JOIN profiles p ON p.email = s.email
          WHERE s.id = tl.student_id AND p.id = auth.uid()
        )
    )
  );

-- Team leaders can insert memberships for their team
CREATE POLICY "leader_insert_memberships" ON team_memberships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_leaders tl
      WHERE tl.team_id = team_memberships.team_id
        AND tl.is_active = true
        AND tl.link_revoked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM students s
          JOIN profiles p ON p.email = s.email
          WHERE s.id = tl.student_id AND p.id = auth.uid()
        )
    )
  );

-- Team leaders can update memberships for their team
CREATE POLICY "leader_update_memberships" ON team_memberships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team_leaders tl
      WHERE tl.team_id = team_memberships.team_id
        AND tl.is_active = true
        AND tl.link_revoked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM students s
          JOIN profiles p ON p.email = s.email
          WHERE s.id = tl.student_id AND p.id = auth.uid()
        )
    )
  );

-- =====================================================
-- TEAM_INVITATIONS RLS
-- =====================================================

-- Admins have full access
CREATE POLICY "admin_invitations" ON team_invitations
  FOR ALL USING (is_admin());

-- Team leaders can manage invitations for their team
CREATE POLICY "leader_team_invitations" ON team_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_leaders tl
      WHERE tl.team_id = team_invitations.team_id
        AND tl.is_active = true
        AND tl.link_revoked_at IS NULL
        AND EXISTS (
          SELECT 1 FROM students s
          JOIN profiles p ON p.email = s.email
          WHERE s.id = tl.student_id AND p.id = auth.uid()
        )
    )
  );

-- Public can look up invitation by token (for student confirmation page)
-- This is handled via service role in API routes - NOT exposed via RLS

-- =====================================================
-- AUDIT_LOGS RLS
-- =====================================================

-- Only admins can read audit logs
CREATE POLICY "admin_audit_logs" ON audit_logs
  FOR ALL USING (is_admin());

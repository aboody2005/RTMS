-- =====================================================
-- Rabbit Experiment Team Management System
-- Database Migration: 001 - Initial Schema
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE membership_status AS ENUM (
  'available',
  'invitation_pending',
  'confirmed',
  'revoked',
  'removed'
);

CREATE TYPE invitation_status AS ENUM (
  'pending',
  'confirmed',
  'revoked',
  'expired'
);

CREATE TYPE user_role AS ENUM (
  'admin',
  'team_leader',
  'student'
);

CREATE TYPE audit_action AS ENUM (
  'student_import',
  'student_create',
  'student_update',
  'student_delete',
  'group_create',
  'group_update',
  'group_delete',
  'team_create',
  'team_update',
  'team_delete',
  'leader_assign',
  'leader_change',
  'leader_link_generate',
  'leader_link_revoke',
  'invitation_create',
  'invitation_revoke',
  'membership_confirm',
  'membership_remove',
  'random_distribution',
  'admin_reassign',
  'capacity_change',
  'settings_change'
);

-- =====================================================
-- TABLE: profiles
-- Linked to Supabase Auth users
-- =====================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TABLE: system_settings
-- Global configurable settings
-- =====================================================

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('default_group_capacity', '41', 'Default maximum students per academic group'),
  ('default_teams_per_group', '8', 'Default number of teams per academic group'),
  ('default_team_capacity', '6', 'Default maximum students per team'),
  ('leader_included_in_capacity', 'true', 'Whether team leader counts toward team capacity'),
  ('random_distribution_auto_confirm', 'false', 'Whether random distribution auto-confirms students');

-- =====================================================
-- TABLE: academic_groups
-- =====================================================

CREATE TABLE academic_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  max_students INTEGER NOT NULL DEFAULT 41,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- =====================================================
-- TABLE: students
-- Master student list, independent of team assignments
-- =====================================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  student_id TEXT,
  email TEXT,
  phone TEXT,
  academic_group_id UUID NOT NULL REFERENCES academic_groups(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  import_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Prevent duplicate student IDs within same group
  CONSTRAINT unique_student_id UNIQUE (student_id),
  -- Prevent duplicate name+group when no student_id
  CONSTRAINT unique_name_group UNIQUE (full_name, academic_group_id)
);

CREATE INDEX idx_students_group ON students(academic_group_id);
CREATE INDEX idx_students_student_id ON students(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX idx_students_active ON students(is_active);

-- =====================================================
-- TABLE: teams
-- =====================================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  academic_group_id UUID NOT NULL REFERENCES academic_groups(id) ON DELETE RESTRICT,
  max_capacity INTEGER NOT NULL DEFAULT 6,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  CONSTRAINT unique_team_name_per_group UNIQUE (name, academic_group_id)
);

CREATE INDEX idx_teams_group ON teams(academic_group_id);
CREATE INDEX idx_teams_active ON teams(is_active);

-- =====================================================
-- TABLE: team_leaders
-- Associates a student as the leader of a team
-- =====================================================

CREATE TABLE team_leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  -- Secure access token (stored as hash)
  access_token_hash TEXT,
  access_token_prefix TEXT, -- First 8 chars for identification
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  link_revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  CONSTRAINT unique_leader_per_team UNIQUE (team_id),
  CONSTRAINT unique_student_as_leader UNIQUE (student_id)
);

CREATE INDEX idx_leaders_team ON team_leaders(team_id);
CREATE INDEX idx_leaders_student ON team_leaders(student_id);
CREATE INDEX idx_leaders_token ON team_leaders(access_token_hash) WHERE access_token_hash IS NOT NULL;

-- =====================================================
-- TABLE: team_memberships
-- Tracks student team assignments and their status
-- =====================================================

CREATE TABLE team_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  status membership_status NOT NULL DEFAULT 'invitation_pending',
  is_leader BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removed_by UUID REFERENCES profiles(id),
  removal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_memberships_student ON team_memberships(student_id);
CREATE INDEX idx_memberships_team ON team_memberships(team_id);
CREATE INDEX idx_memberships_status ON team_memberships(status);

-- =====================================================
-- TABLE: team_invitations
-- Unique invitation links for students
-- =====================================================

CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id UUID NOT NULL REFERENCES team_memberships(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  -- Token stored as SHA256 hash
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL, -- First 8 chars for display/identification
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES profiles(id),
  is_random_distribution BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_invitations_student ON team_invitations(student_id);
CREATE INDEX idx_invitations_team ON team_invitations(team_id);
CREATE INDEX idx_invitations_membership ON team_invitations(membership_id);
CREATE INDEX idx_invitations_token ON team_invitations(token_hash);
CREATE INDEX idx_invitations_status ON team_invitations(status);

-- =====================================================
-- TABLE: audit_logs
-- Comprehensive audit trail
-- =====================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action audit_action NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  performed_by_name TEXT, -- Denormalized for display
  target_student_id UUID REFERENCES students(id),
  target_team_id UUID REFERENCES teams(id),
  target_group_id UUID REFERENCES academic_groups(id),
  details JSONB,
  previous_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_student ON audit_logs(target_student_id);
CREATE INDEX idx_audit_team ON audit_logs(target_team_id);
CREATE INDEX idx_audit_group ON audit_logs(target_group_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_performed_by ON audit_logs(performed_by);

-- =====================================================
-- FUNCTIONS: Updated timestamps
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON academic_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_leaders_updated BEFORE UPDATE ON team_leaders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON team_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_invitations_updated BEFORE UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- FUNCTION: Get current student membership status
-- Returns the effective status of a student
-- =====================================================

CREATE OR REPLACE FUNCTION get_student_effective_status(p_student_id UUID)
RETURNS membership_status AS $$
DECLARE
  v_status membership_status;
BEGIN
  SELECT status INTO v_status
  FROM team_memberships
  WHERE student_id = p_student_id
    AND status IN ('confirmed', 'invitation_pending')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN 'available'::membership_status;
  END IF;
  
  RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get team confirmed count
-- =====================================================

CREATE OR REPLACE FUNCTION get_team_confirmed_count(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM team_memberships
  WHERE team_id = p_team_id
    AND status = 'confirmed';
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get team available slots
-- =====================================================

CREATE OR REPLACE FUNCTION get_team_available_slots(p_team_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_max INTEGER;
  v_confirmed INTEGER;
BEGIN
  SELECT max_capacity INTO v_max FROM teams WHERE id = p_team_id;
  v_confirmed := get_team_confirmed_count(p_team_id);
  RETURN GREATEST(0, v_max - v_confirmed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Confirm student invitation (atomic)
-- Prevents double-confirmation and capacity overflow
-- =====================================================

CREATE OR REPLACE FUNCTION confirm_student_invitation(p_token_hash TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invitation team_invitations%ROWTYPE;
  v_membership team_memberships%ROWTYPE;
  v_team teams%ROWTYPE;
  v_student students%ROWTYPE;
  v_confirmed_count INTEGER;
  v_existing_confirmed UUID;
BEGIN
  -- Lock the invitation row
  SELECT * INTO v_invitation
  FROM team_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invitation_not_found');
  END IF;
  
  IF v_invitation.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invitation_' || v_invitation.status);
  END IF;
  
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < NOW() THEN
    UPDATE team_invitations SET status = 'expired' WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'invitation_expired');
  END IF;
  
  -- Check if student is already confirmed in any team
  SELECT tm.id INTO v_existing_confirmed
  FROM team_memberships tm
  WHERE tm.student_id = v_invitation.student_id
    AND tm.status = 'confirmed'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'student_already_confirmed');
  END IF;
  
  -- Lock the team and check capacity
  SELECT * INTO v_team FROM teams WHERE id = v_invitation.team_id FOR UPDATE;
  
  SELECT COUNT(*) INTO v_confirmed_count
  FROM team_memberships
  WHERE team_id = v_invitation.team_id AND status = 'confirmed';
  
  IF v_confirmed_count >= v_team.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'team_at_capacity');
  END IF;
  
  -- Get membership
  SELECT * INTO v_membership
  FROM team_memberships
  WHERE id = v_invitation.membership_id
  FOR UPDATE;
  
  -- Update membership to confirmed
  UPDATE team_memberships
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = v_membership.id;
  
  -- Update invitation to confirmed
  UPDATE team_invitations
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = v_invitation.id;
  
  -- Revoke any other pending invitations for this student
  UPDATE team_invitations ti
  SET status = 'revoked', revoked_at = NOW()
  FROM team_memberships tm
  WHERE ti.membership_id = tm.id
    AND tm.student_id = v_invitation.student_id
    AND ti.id != v_invitation.id
    AND ti.status = 'pending';
  
  -- Get student info for response
  SELECT * INTO v_student FROM students WHERE id = v_invitation.student_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'student_name', v_student.full_name,
    'team_id', v_team.id,
    'team_name', v_team.name,
    'membership_id', v_membership.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Add student to team (by team leader or admin)
-- =====================================================

CREATE OR REPLACE FUNCTION add_student_to_team(
  p_student_id UUID,
  p_team_id UUID,
  p_created_by UUID,
  p_token TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_team teams%ROWTYPE;
  v_student students%ROWTYPE;
  v_confirmed_count INTEGER;
  v_existing_membership UUID;
  v_membership_id UUID;
  v_token_hash TEXT;
  v_leader_group_id UUID;
  v_team_group_id UUID;
BEGIN
  -- Get team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'team_not_found');
  END IF;
  
  -- Get student
  SELECT * INTO v_student FROM students WHERE id = p_student_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'student_not_found');
  END IF;
  
  -- Verify student belongs to same academic group as team
  IF v_student.academic_group_id != v_team.academic_group_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'group_mismatch');
  END IF;
  
  -- Check if student is already confirmed in any active team
  SELECT tm.id INTO v_existing_membership
  FROM team_memberships tm
  WHERE tm.student_id = p_student_id AND tm.status = 'confirmed'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'student_already_confirmed');
  END IF;
  
  -- Check if student already has a pending invitation for this team
  SELECT tm.id INTO v_existing_membership
  FROM team_memberships tm
  WHERE tm.student_id = p_student_id AND tm.team_id = p_team_id AND tm.status = 'invitation_pending'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invitation_already_pending');
  END IF;
  
  -- Check team capacity
  SELECT COUNT(*) INTO v_confirmed_count
  FROM team_memberships
  WHERE team_id = p_team_id AND status = 'confirmed';
  
  IF v_confirmed_count >= v_team.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'team_at_capacity');
  END IF;
  
  -- Hash the token
  v_token_hash := encode(sha256(p_token::bytea), 'hex');
  
  -- Create membership record
  INSERT INTO team_memberships (student_id, team_id, status, created_by)
  VALUES (p_student_id, p_team_id, 'invitation_pending', p_created_by)
  RETURNING id INTO v_membership_id;
  
  -- Create invitation
  INSERT INTO team_invitations (
    membership_id, student_id, team_id, token_hash, token_prefix, created_by
  ) VALUES (
    v_membership_id, p_student_id, p_team_id, v_token_hash, LEFT(p_token, 8), p_created_by
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'membership_id', v_membership_id,
    'token_hash', v_token_hash
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Random distribution (admin only, atomic)
-- =====================================================

CREATE OR REPLACE FUNCTION random_distribute_students(
  p_group_id UUID,
  p_student_ids UUID[],
  p_auto_confirm BOOLEAN,
  p_performed_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_team RECORD;
  v_student_id UUID;
  v_token TEXT;
  v_token_hash TEXT;
  v_membership_id UUID;
  v_teams_with_slots RECORD[];
  v_slot_list UUID[];
  v_idx INTEGER;
  v_shuffled_students UUID[];
  v_distributed INTEGER := 0;
  v_remaining INTEGER;
  v_team_slots JSONB := '[]'::JSONB;
  v_distribution_results JSONB := '[]'::JSONB;
BEGIN
  -- Build list of available slots across teams in this group
  v_slot_list := ARRAY[]::UUID[];
  
  FOR v_team IN
    SELECT t.id, t.max_capacity,
      (t.max_capacity - COUNT(tm.id) FILTER (WHERE tm.status = 'confirmed')) AS available_slots
    FROM teams t
    LEFT JOIN team_memberships tm ON tm.team_id = t.id
    WHERE t.academic_group_id = p_group_id AND t.is_active = true
    GROUP BY t.id, t.max_capacity
    HAVING (t.max_capacity - COUNT(tm.id) FILTER (WHERE tm.status = 'confirmed')) > 0
    ORDER BY available_slots DESC
  LOOP
    -- Add this team's id repeated 'available_slots' times
    FOR v_idx IN 1..v_team.available_slots LOOP
      v_slot_list := array_append(v_slot_list, v_team.id);
    END LOOP;
  END LOOP;
  
  -- Shuffle the slot list using random ordering
  SELECT array_agg(slot ORDER BY random()) INTO v_slot_list FROM unnest(v_slot_list) AS slot;
  
  -- Filter students: only unconfirmed/unassigned students from this group
  SELECT array_agg(s.id ORDER BY random()) INTO v_shuffled_students
  FROM students s
  WHERE s.id = ANY(p_student_ids)
    AND s.academic_group_id = p_group_id
    AND s.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.student_id = s.id AND tm.status = 'confirmed'
    );
  
  IF v_shuffled_students IS NULL THEN
    RETURN jsonb_build_object('success', true, 'distributed', 0, 'remaining_unassigned', 0);
  END IF;
  
  -- Distribute students to slots
  FOR v_idx IN 1..LEAST(array_length(v_shuffled_students, 1), array_length(v_slot_list, 1)) LOOP
    v_student_id := v_shuffled_students[v_idx];
    
    -- Generate a secure token
    v_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(sha256(v_token::bytea), 'hex');
    
    -- Create membership
    IF p_auto_confirm THEN
      INSERT INTO team_memberships (student_id, team_id, status, confirmed_at, created_by, is_leader)
      VALUES (v_student_id, v_slot_list[v_idx], 'confirmed', NOW(), p_performed_by, false)
      RETURNING id INTO v_membership_id;
      
      -- Still create invitation record for audit purposes (already confirmed)
      INSERT INTO team_invitations (
        membership_id, student_id, team_id, token_hash, token_prefix,
        status, confirmed_at, is_random_distribution, created_by
      ) VALUES (
        v_membership_id, v_student_id, v_slot_list[v_idx], v_token_hash, LEFT(v_token, 8),
        'confirmed', NOW(), true, p_performed_by
      );
    ELSE
      INSERT INTO team_memberships (student_id, team_id, status, created_by, is_leader)
      VALUES (v_student_id, v_slot_list[v_idx], 'invitation_pending', p_performed_by, false)
      RETURNING id INTO v_membership_id;
      
      INSERT INTO team_invitations (
        membership_id, student_id, team_id, token_hash, token_prefix,
        status, is_random_distribution, created_by
      ) VALUES (
        v_membership_id, v_student_id, v_slot_list[v_idx], v_token_hash, LEFT(v_token, 8),
        'pending', true, p_performed_by
      );
    END IF;
    
    v_distributed := v_distributed + 1;
    
    v_distribution_results := v_distribution_results || jsonb_build_object(
      'student_id', v_student_id,
      'team_id', v_slot_list[v_idx],
      'token', CASE WHEN NOT p_auto_confirm THEN v_token ELSE NULL END,
      'membership_id', v_membership_id
    );
  END LOOP;
  
  v_remaining := array_length(v_shuffled_students, 1) - v_distributed;
  
  -- Log audit
  INSERT INTO audit_logs (action, performed_by, target_group_id, details)
  VALUES (
    'random_distribution', p_performed_by, p_group_id,
    jsonb_build_object(
      'distributed', v_distributed,
      'remaining_unassigned', v_remaining,
      'auto_confirm', p_auto_confirm,
      'group_id', p_group_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'distributed', v_distributed,
    'remaining_unassigned', COALESCE(v_remaining, 0),
    'results', v_distribution_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

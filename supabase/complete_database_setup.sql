-- ==========================================================================
-- RABBIT TEAM MANAGEMENT SYSTEM - COMPLETE ALL-IN-ONE DATABASE SETUP
-- Execute this script in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- ==========================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Safe Creation of ENUMs
DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM (
    'available',
    'invitation_pending',
    'confirmed',
    'revoked',
    'removed'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM (
    'pending',
    'confirmed',
    'revoked',
    'expired'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'admin',
    'team_leader',
    'student'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
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
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3. Core Tables

-- Profiles (Linked to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Insert Default Settings
INSERT INTO system_settings (key, value, description) VALUES
  ('default_group_capacity', '41', 'Default maximum students per academic group'),
  ('default_teams_per_group', '8', 'Default number of teams per academic group'),
  ('default_team_capacity', '6', 'Default maximum students per team'),
  ('leader_included_in_capacity', 'true', 'Whether team leader counts toward team capacity'),
  ('random_distribution_auto_confirm', 'true', 'Whether random distribution auto-confirms students'),
  ('experiment_title', '"تجارب علم الأدوية (Pharmacology) - تجارب الأرانب"', 'Title of practical experiment'),
  ('faculty_name', '"كلية الصيدلة"', 'Faculty name')
ON CONFLICT (key) DO NOTHING;

-- Academic Groups (A1, A2, B1, B2, C1, C2)
CREATE TABLE IF NOT EXISTS academic_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  max_students INTEGER NOT NULL DEFAULT 41,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Students Master List
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  academic_group_id UUID NOT NULL REFERENCES academic_groups(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  import_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  CONSTRAINT unique_name_group UNIQUE (full_name, academic_group_id)
);

CREATE INDEX IF NOT EXISTS idx_students_group ON students(academic_group_id);
CREATE INDEX IF NOT EXISTS idx_students_active ON students(is_active);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  academic_group_id UUID NOT NULL REFERENCES academic_groups(id) ON DELETE RESTRICT,
  max_capacity INTEGER NOT NULL DEFAULT 6,
  rabbit_number INTEGER,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  CONSTRAINT unique_team_name_per_group UNIQUE (name, academic_group_id)
);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS rabbit_number INTEGER;

CREATE INDEX IF NOT EXISTS idx_teams_group ON teams(academic_group_id);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(is_active);

-- Team Leaders
CREATE TABLE IF NOT EXISTS team_leaders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  access_token_hash TEXT,
  access_token_prefix TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  link_revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  CONSTRAINT unique_leader_per_team UNIQUE (team_id),
  CONSTRAINT unique_student_as_leader UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_leaders_team ON team_leaders(team_id);
CREATE INDEX IF NOT EXISTS idx_leaders_student ON team_leaders(student_id);
CREATE INDEX IF NOT EXISTS idx_leaders_token ON team_leaders(access_token_hash) WHERE access_token_hash IS NOT NULL;

-- Team Memberships
CREATE TABLE IF NOT EXISTS team_memberships (
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

CREATE INDEX IF NOT EXISTS idx_memberships_student ON team_memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_memberships_team ON team_memberships(team_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON team_memberships(status);

-- Team Invitations
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id UUID NOT NULL REFERENCES team_memberships(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_invitations_student ON team_invitations(student_id);
CREATE INDEX IF NOT EXISTS idx_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_invitations_membership ON team_invitations(membership_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON team_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON team_invitations(status);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action audit_action NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  performed_by_name TEXT,
  target_student_id UUID REFERENCES students(id),
  target_team_id UUID REFERENCES teams(id),
  target_group_id UUID REFERENCES academic_groups(id),
  details JSONB,
  previous_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_student ON audit_logs(target_student_id);
CREATE INDEX IF NOT EXISTS idx_audit_team ON audit_logs(target_team_id);
CREATE INDEX IF NOT EXISTS idx_audit_group ON audit_logs(target_group_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_performed_by ON audit_logs(performed_by);

-- 4. Automatic Triggers & Timestamp Handlers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_groups_updated ON academic_groups;
CREATE TRIGGER trg_groups_updated BEFORE UPDATE ON academic_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_students_updated ON students;
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_teams_updated ON teams;
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_leaders_updated ON team_leaders;
CREATE TRIGGER trg_leaders_updated BEFORE UPDATE ON team_leaders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_memberships_updated ON team_memberships;
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON team_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_invitations_updated ON team_invitations;
CREATE TRIGGER trg_invitations_updated BEFORE UPDATE ON team_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Automatic Admin Profile Creation Trigger (from auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'admin'::public.user_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = 'admin'::public.user_role,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing auth users into profiles if any exist
INSERT INTO public.profiles (id, email, full_name, role, is_active)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  'admin'::public.user_role,
  true
FROM auth.users
ON CONFLICT (id) DO UPDATE SET role = 'admin'::public.user_role;

-- 6. Helper & Atomic Business Logic Functions

-- Effective Status
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

-- Confirmed Count
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

-- Available Slots
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

-- Atomic Invitation Confirmation
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
  
  SELECT tm.id INTO v_existing_confirmed
  FROM team_memberships tm
  WHERE tm.student_id = v_invitation.student_id
    AND tm.status = 'confirmed'
  LIMIT 1;
  
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'student_already_confirmed');
  END IF;
  
  SELECT * INTO v_team FROM teams WHERE id = v_invitation.team_id FOR UPDATE;
  
  SELECT COUNT(*) INTO v_confirmed_count
  FROM team_memberships
  WHERE team_id = v_invitation.team_id AND status = 'confirmed';
  
  IF v_confirmed_count >= v_team.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'team_at_capacity');
  END IF;
  
  SELECT * INTO v_membership
  FROM team_memberships
  WHERE id = v_invitation.membership_id
  FOR UPDATE;
  
  UPDATE team_memberships
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = v_membership.id;
  
  UPDATE team_invitations
  SET status = 'confirmed', confirmed_at = NOW()
  WHERE id = v_invitation.id;
  
  UPDATE team_invitations ti
  SET status = 'revoked', revoked_at = NOW()
  FROM team_memberships tm
  WHERE ti.membership_id = tm.id
    AND tm.student_id = v_invitation.student_id
    AND ti.id != v_invitation.id
    AND ti.status = 'pending';
  
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

-- Atomic Random Distribution Function
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
  v_slot_list UUID[];
  v_idx INTEGER;
  v_shuffled_students UUID[];
  v_distributed INTEGER := 0;
  v_remaining INTEGER;
  v_distribution_results JSONB := '[]'::JSONB;
BEGIN
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
    FOR v_idx IN 1..v_team.available_slots LOOP
      v_slot_list := array_append(v_slot_list, v_team.id);
    END LOOP;
  END LOOP;
  
  SELECT array_agg(slot ORDER BY random()) INTO v_slot_list FROM unnest(v_slot_list) AS slot;
  
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
  
  FOR v_idx IN 1..LEAST(array_length(v_shuffled_students, 1), array_length(v_slot_list, 1)) LOOP
    v_student_id := v_shuffled_students[v_idx];
    v_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(sha256(v_token::bytea), 'hex');
    
    IF p_auto_confirm THEN
      INSERT INTO team_memberships (student_id, team_id, status, confirmed_at, created_by, is_leader)
      VALUES (v_student_id, v_slot_list[v_idx], 'confirmed', NOW(), p_performed_by, false)
      RETURNING id INTO v_membership_id;
      
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

-- 7. Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Profiles Policies
DROP POLICY IF EXISTS "admin_all_profiles" ON profiles;
CREATE POLICY "admin_all_profiles" ON profiles FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "user_own_profile" ON profiles;
CREATE POLICY "user_own_profile" ON profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "user_update_own_profile" ON profiles;
CREATE POLICY "user_update_own_profile" ON profiles FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Settings Policies
DROP POLICY IF EXISTS "admin_settings" ON system_settings;
CREATE POLICY "admin_settings" ON system_settings FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "read_settings" ON system_settings;
CREATE POLICY "read_settings" ON system_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- Groups Policies
DROP POLICY IF EXISTS "admin_groups" ON academic_groups;
CREATE POLICY "admin_groups" ON academic_groups FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "read_groups" ON academic_groups;
CREATE POLICY "read_groups" ON academic_groups FOR SELECT USING (auth.uid() IS NOT NULL);

-- Students Policies
DROP POLICY IF EXISTS "admin_students" ON students;
CREATE POLICY "admin_students" ON students FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "leader_read_group_students" ON students;
CREATE POLICY "leader_read_group_students" ON students FOR SELECT USING (
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

-- Teams Policies
DROP POLICY IF EXISTS "admin_teams" ON teams;
CREATE POLICY "admin_teams" ON teams FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "read_teams" ON teams;
CREATE POLICY "read_teams" ON teams FOR SELECT USING (auth.uid() IS NOT NULL);

-- Leaders Policies
DROP POLICY IF EXISTS "admin_leaders" ON team_leaders;
CREATE POLICY "admin_leaders" ON team_leaders FOR ALL USING (is_admin());

-- Memberships Policies
DROP POLICY IF EXISTS "admin_memberships" ON team_memberships;
CREATE POLICY "admin_memberships" ON team_memberships FOR ALL USING (is_admin());

-- Invitations Policies
DROP POLICY IF EXISTS "admin_invitations" ON team_invitations;
CREATE POLICY "admin_invitations" ON team_invitations FOR ALL USING (is_admin());

-- Audit Logs Policies
DROP POLICY IF EXISTS "admin_audit_logs" ON audit_logs;
CREATE POLICY "admin_audit_logs" ON audit_logs FOR ALL USING (is_admin());

-- 8. Seed Initial Academic Groups & Teams
DO $$
DECLARE
  v_group_names TEXT[] := ARRAY['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  v_group_name TEXT;
  v_group_id UUID;
  v_team_idx INTEGER;
BEGIN
  FOREACH v_group_name IN ARRAY v_group_names LOOP
    INSERT INTO academic_groups (name, max_students, description, is_active)
    VALUES (v_group_name, 41, 'المجموعة الدراسية ' || v_group_name, true)
    ON CONFLICT (name) DO UPDATE SET max_students = EXCLUDED.max_students
    RETURNING id INTO v_group_id;

    IF v_group_id IS NULL THEN
      SELECT id INTO v_group_id FROM academic_groups WHERE name = v_group_name;
    END IF;

    FOR v_team_idx IN 1..8 LOOP
      INSERT INTO teams (name, academic_group_id, max_capacity, rabbit_number, description, is_active)
      VALUES (
        'الفريق ' || v_team_idx || ' — المجموعة ' || v_group_name,
        v_group_id,
        6,
        v_team_idx,
        'فريق ' || v_team_idx || ' التابع للمجموعة ' || v_group_name,
        true
      )
      ON CONFLICT (name, academic_group_id) DO UPDATE SET rabbit_number = EXCLUDED.rabbit_number;
    END LOOP;
  END LOOP;
END $$;

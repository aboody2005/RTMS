-- ==========================================================================
-- MIGRATION: 004_remove_student_id_and_fix_invitations.sql
-- Description:
-- 1. Safely remove university ID constraints and requirements from the students table.
--    Students are identified by their unique UUID `id` and (full_name, academic_group_id).
--    Existing records remain completely preserved.
-- 2. Ensure `student_id` column is nullable and unconstrained.
-- 3. Ensure `confirm_student_invitation` RPC works robustly without university ID.
-- ==========================================================================

-- 1. Safely drop constraints on student_id if present
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS unique_student_id;
DROP INDEX IF EXISTS idx_students_student_id;

-- 2. Make student_id column nullable if it isn't already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'students' AND column_name = 'student_id'
  ) THEN
    ALTER TABLE public.students ALTER COLUMN student_id DROP NOT NULL;
  END IF;
END $$;

-- 3. Ensure unique constraint on full_name + academic_group_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_name_group'
  ) THEN
    ALTER TABLE public.students ADD CONSTRAINT unique_name_group UNIQUE (full_name, academic_group_id);
  END IF;
END $$;

-- 4. Re-verify confirm_student_invitation function exists and is up to date
CREATE OR REPLACE FUNCTION public.confirm_student_invitation(p_token_hash TEXT)
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
  
  -- Revoke any other pending invitations for this student
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

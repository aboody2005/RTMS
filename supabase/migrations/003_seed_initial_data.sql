-- =====================================================
-- Rabbit Experiment Team Management System
-- Database Migration: 003 - Seed Initial Academic Groups & Teams
-- =====================================================

-- Seed 6 initial academic groups (A1, A2, B1, B2, C1, C2) with default capacity of 41 students
-- and 8 experiment teams per group (corresponding to 8 rabbits) with default capacity of 6 students
DO $$
DECLARE
  v_group_names TEXT[] := ARRAY['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  v_group_name TEXT;
  v_group_id UUID;
  v_team_idx INTEGER;
BEGIN
  FOREACH v_group_name IN ARRAY v_group_names LOOP
    -- Insert academic group with default 41 capacity if not exists
    INSERT INTO academic_groups (name, max_students, description, is_active)
    VALUES (v_group_name, 41, 'المجموعة الدراسية ' || v_group_name, true)
    ON CONFLICT (name) DO UPDATE SET max_students = EXCLUDED.max_students
    RETURNING id INTO v_group_id;

    -- If group already existed, get its id
    IF v_group_id IS NULL THEN
      SELECT id INTO v_group_id FROM academic_groups WHERE name = v_group_name;
    END IF;

    -- Insert 8 experiment teams for each group (Teams 1 through 8, default capacity 6)
    FOR v_team_idx IN 1..8 LOOP
      INSERT INTO teams (name, academic_group_id, max_capacity, description, is_active)
      VALUES (
        'فريق ' || v_team_idx || ' (أرنب ' || v_team_idx || ')',
        v_group_id,
        6,
        'فريق الأرنب التجريبي رقم ' || v_team_idx || ' للمجموعة ' || v_group_name,
        true
      )
      ON CONFLICT (name, academic_group_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

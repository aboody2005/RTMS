// Database types generated from the Supabase schema

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MembershipStatus = 'available' | 'invitation_pending' | 'confirmed' | 'revoked' | 'removed';
export type InvitationStatus = 'pending' | 'confirmed' | 'revoked' | 'expired';
export type UserRole = 'admin' | 'team_leader' | 'student';
export type AuditAction =
  | 'student_import' | 'student_create' | 'student_update' | 'student_delete'
  | 'group_create' | 'group_update' | 'group_delete'
  | 'team_create' | 'team_update' | 'team_delete'
  | 'leader_assign' | 'leader_change' | 'leader_link_generate' | 'leader_link_revoke'
  | 'invitation_create' | 'invitation_revoke'
  | 'membership_confirm' | 'membership_remove'
  | 'random_distribution' | 'admin_reassign'
  | 'capacity_change' | 'settings_change';

// =====================================================
// DATABASE ROW TYPES
// =====================================================

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  key: string;
  value: Json;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AcademicGroup {
  id: string;
  name: string;
  description: string | null;
  max_students: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Student {
  id: string;
  full_name: string;
  student_id?: string | null; // Deprecated - University ID removed
  email: string | null;
  phone: string | null;
  academic_group_id: string;
  is_active: boolean;
  notes: string | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Team {
  id: string;
  name: string;
  academic_group_id: string;
  max_capacity: number;
  rabbit_number?: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TeamLeader {
  id: string;
  team_id: string;
  student_id: string;
  access_token_hash: string | null;
  access_token_prefix: string | null;
  is_active: boolean;
  link_revoked_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TeamMembership {
  id: string;
  student_id: string;
  team_id: string;
  status: MembershipStatus;
  is_leader: boolean;
  confirmed_at: string | null;
  removed_at: string | null;
  removed_by: string | null;
  removal_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface TeamInvitation {
  id: string;
  membership_id: string;
  student_id: string;
  team_id: string;
  token_hash: string;
  token_prefix: string;
  status: InvitationStatus;
  expires_at: string | null;
  confirmed_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  is_random_distribution: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  performed_by: string | null;
  performed_by_name: string | null;
  target_student_id: string | null;
  target_team_id: string | null;
  target_group_id: string | null;
  details: Json | null;
  previous_values: Json | null;
  new_values: Json | null;
  ip_address: string | null;
  created_at: string;
}

// =====================================================
// ENRICHED/JOINED TYPES (for frontend display)
// =====================================================

export interface StudentWithGroup extends Student {
  academic_group: AcademicGroup;
  effective_status?: MembershipStatus;
}

export interface TeamWithDetails extends Team {
  academic_group: AcademicGroup;
  team_leader?: TeamLeaderWithStudent;
  confirmed_count: number;
  pending_count: number;
  available_slots: number;
}

export interface TeamLeaderWithStudent extends TeamLeader {
  student: Student;
  team: Team;
  academic_group: AcademicGroup;
}

export interface MembershipWithDetails extends TeamMembership {
  student: Student;
  team: Team;
  invitation?: TeamInvitation;
}

export interface InvitationWithDetails extends TeamInvitation {
  student: Student;
  team: TeamWithDetails;
  membership: TeamMembership;
}

// =====================================================
// DASHBOARD STATISTICS
// =====================================================

export interface DashboardStats {
  total_students: number;
  total_groups: number;
  total_teams: number;
  total_leaders: number;
  confirmed_students: number;
  pending_students: number;
  unassigned_students: number;
  available_slots: number;
}

export interface GroupStats {
  group: AcademicGroup;
  total_students: number;
  confirmed_students: number;
  pending_students: number;
  unassigned_students: number;
  teams: TeamStats[];
}

export interface TeamStats {
  team: Team;
  leader: TeamLeaderWithStudent | null;
  confirmed_count: number;
  pending_count: number;
  available_slots: number;
}

// =====================================================
// FORM TYPES
// =====================================================

export interface StudentImportRow {
  full_name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name?: string;
  academic_group_id?: string;
  import_status?: 'valid' | 'duplicate' | 'invalid_group' | 'error';
  error_message?: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  max_students?: number;
}

export interface CreateTeamInput {
  name: string;
  academic_group_id: string;
  max_capacity?: number;
  description?: string;
}

export interface AssignLeaderInput {
  team_id: string;
  student_id: string;
}

export interface CreateStudentInput {
  full_name: string;
  email?: string;
  phone?: string;
  academic_group_id: string;
  notes?: string;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// =====================================================
// TOKEN TYPES
// =====================================================

export interface LeaderLinkData {
  token: string;
  team_id: string;
  leader_id: string;
}

export interface InvitationTokenData {
  token: string;
  student_id: string;
  team_id: string;
  invitation_id: string;
}

// =====================================================
// EXCEL EXPORT TYPES
// =====================================================

export interface ExcelExportOptions {
  groups?: string[]; // group IDs, empty = all
  include_pending?: boolean;
  include_unassigned?: boolean;
}

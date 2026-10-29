import { z } from 'zod';

// =====================================================
// ACADEMIC GROUP SCHEMAS
// =====================================================

export const createGroupSchema = z.object({
  name: z.string().min(1, 'اسم المجموعة مطلوب').max(50, 'اسم المجموعة طويل جداً'),
  description: z.string().max(200, 'الوصف طويل جداً').optional(),
  max_students: z.number().int().min(1, 'الحد الأدنى طالب واحد').max(500, 'الحد الأقصى 500 طالب').default(41),
});

export const updateGroupSchema = createGroupSchema.partial().extend({
  id: z.string().uuid(),
});

// =====================================================
// STUDENT SCHEMAS
// =====================================================

export const createStudentSchema = z.object({
  full_name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(200, 'الاسم طويل جداً'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  phone: z.string().max(20, 'رقم الهاتف طويل جداً').optional().or(z.literal('')),
  academic_group_id: z.string().uuid('المجموعة الدراسية مطلوبة'),
  notes: z.string().max(500).optional(),
});

export const updateStudentSchema = createStudentSchema.partial().extend({
  id: z.string().uuid(),
});

export const importStudentsSchema = z.object({
  students: z.array(z.object({
    full_name: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    group_name: z.string().optional(),
    academic_group_id: z.string().uuid().optional(),
  })),
  academic_group_id: z.string().uuid().optional(),
  resolve_duplicates: z.enum(['skip', 'update', 'error']).default('skip'),
});

// =====================================================
// TEAM SCHEMAS
// =====================================================

export const createTeamSchema = z.object({
  name: z.string().min(1, 'اسم الفريق مطلوب').max(100, 'اسم الفريق طويل جداً'),
  academic_group_id: z.string().uuid('المجموعة الدراسية مطلوبة'),
  max_capacity: z.number().int().min(1, 'الحد الأدنى طالب واحد').max(100).default(6),
  description: z.string().max(500).optional(),
});

export const updateTeamSchema = createTeamSchema.partial().extend({
  id: z.string().uuid(),
});

export const bulkCreateTeamsSchema = z.object({
  academic_group_id: z.string().uuid('المجموعة الدراسية مطلوبة'),
  count: z.number().int().min(1).max(50),
  name_prefix: z.string().min(1).default('فريق'),
  max_capacity: z.number().int().min(1).max(100).default(6),
});

// =====================================================
// TEAM LEADER SCHEMAS
// =====================================================

export const assignLeaderSchema = z.object({
  team_id: z.string().uuid('الفريق مطلوب'),
  student_id: z.string().uuid('الطالب مطلوب'),
});

// =====================================================
// INVITATION SCHEMAS
// =====================================================

export const createInvitationSchema = z.object({
  student_id: z.string().uuid('الطالب مطلوب'),
  team_id: z.string().uuid('الفريق مطلوب'),
});

export const confirmInvitationSchema = z.object({
  token: z.string().min(1, 'رمز الدعوة مطلوب'),
});

// =====================================================
// RANDOM DISTRIBUTION SCHEMAS
// =====================================================

export const randomDistributionSchema = z.object({
  academic_group_id: z.string().uuid('المجموعة الدراسية مطلوبة'),
  student_ids: z.array(z.string().uuid()).optional(),
  distribute_all: z.boolean().default(true),
  auto_confirm: z.boolean().default(false),
});

// =====================================================
// SETTINGS SCHEMAS
// =====================================================

export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

// =====================================================
// LOGIN SCHEMA
// =====================================================

export const loginSchema = z.object({
  email: z.string().min(1, 'البريد الإلكتروني أو اسم المستخدم مطلوب'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

// =====================================================
// EXCEL EXPORT SCHEMA
// =====================================================

export const exportSchema = z.object({
  group_ids: z.array(z.string().uuid()).optional(),
  include_pending: z.boolean().default(true),
  include_unassigned: z.boolean().default(true),
});

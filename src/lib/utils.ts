import { type ClassValue, clsx } from 'clsx';
import crypto from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Generate a cryptographically secure random token
export function generateSecureToken(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

// Hash a token with SHA256
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Arabic membership status labels
export function getMembershipStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    available: 'متاح',
    invitation_pending: 'في انتظار التأكيد',
    confirmed: 'مؤكد',
    revoked: 'ملغي',
    removed: 'تمت إزالته',
  };
  return labels[status] || status;
}

// Arabic invitation status labels
export function getInvitationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'في الانتظار',
    confirmed: 'مؤكدة',
    revoked: 'ملغاة',
    expired: 'منتهية الصلاحية',
  };
  return labels[status] || status;
}

// Arabic role labels
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'مدير النظام',
    team_leader: 'قائد فريق',
    student: 'طالب',
  };
  return labels[role] || role;
}

// Status badge classes
export function getMembershipStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: 'status-badge-neutral',
    invitation_pending: 'status-badge-warning',
    confirmed: 'status-badge-success',
    revoked: 'status-badge-danger',
    removed: 'status-badge-muted',
  };
  return colors[status] || 'status-badge-neutral';
}

export function getInvitationStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'status-badge-warning',
    confirmed: 'status-badge-success',
    revoked: 'status-badge-danger',
    expired: 'status-badge-muted',
  };
  return colors[status] || 'status-badge-neutral';
}

// Format date in Arabic locale
export function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Short date format
export function formatDateShort(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Build invitation URL
export function buildInvitationUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/confirm/${token}`;
}

// Build team leader URL
export function buildLeaderUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${base}/leader/${token}`;
}

// Normalize Arabic name for duplicate detection
export function normalizeArabicName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

// Pagination helper
export function getPaginationRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to };
}

// Generate team names (e.g., فريق 1, فريق 2, ...)
export function generateTeamNames(count: number, prefix: string = 'فريق'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`);
}

// Arabic error messages for common API errors
export function getApiErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    invitation_not_found: 'لم يتم العثور على الدعوة',
    invitation_confirmed: 'تم تأكيد هذه الدعوة مسبقاً',
    invitation_revoked: 'تم إلغاء هذه الدعوة',
    invitation_expired: 'انتهت صلاحية هذه الدعوة',
    student_already_confirmed: 'الطالب منضم إلى فريق آخر بالفعل',
    team_at_capacity: 'الفريق ممتلئ',
    team_not_found: 'الفريق غير موجود',
    student_not_found: 'الطالب غير موجود',
    group_mismatch: 'الطالب لا ينتمي إلى المجموعة الدراسية للفريق',
    invitation_already_pending: 'يوجد دعوة معلقة لهذا الطالب في هذا الفريق',
    unauthorized: 'غير مصرح لك بهذه العملية',
    unknown: 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى',
  };
  return messages[error] || messages.unknown;
}

/**
 * Strips redundant group suffixes or rabbit suffixes from a team's name for clean display,
 * e.g., "الفريق 1 — المجموعة B1" -> "الفريق 1"
 * Ensures the group name is only displayed once per card or section.
 */
export function getCleanTeamName(teamName?: string, groupName?: string): string {
  if (!teamName) return '';
  let clean = teamName;
  if (groupName) {
    const groupRegex = new RegExp(`\\s*[-—–]?\\s*المجموعة\\s*${groupName}\\s*`, 'gi');
    clean = clean.replace(groupRegex, '').trim();
  }
  // Strip any generic " — المجموعة X" pattern
  clean = clean.replace(/\s*[-—–]?\\s*المجموعة\s*[A-Za-z0-9\u0621-\u064A]+\s*/gi, '').trim();
  // Strip any trailing "(أرنب X)" if present
  clean = clean.replace(/\s*\((أرنب\s*\d+)\)\s*/gi, '').trim();
  return clean || teamName;
}

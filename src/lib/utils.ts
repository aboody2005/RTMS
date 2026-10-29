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

/**
 * Normalizes a base URL by trimming whitespace, removing trailing slashes,
 * and ensuring an http/https protocol is present.
 */
export function normalizeBaseUrl(url?: string | null): string {
  if (!url) return '';
  let clean = url.trim();
  // Strip all trailing slashes
  clean = clean.replace(/\/+$/, '');
  // Add https:// protocol if missing
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  return clean;
}

/**
 * Returns the effective application base URL.
 * Prioritizes:
 * 1. Browser context: window.location.origin (always matches the exact live domain)
 * 2. Incoming request: x-forwarded-host + x-forwarded-proto, or request.nextUrl.origin
 * 3. Environment variables: NEXT_PUBLIC_APP_URL
 * 4. Hosting providers: Netlify URL / Vercel VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL
 * 5. Production fallback: https://rtmshu.netlify.app
 * 6. Local development fallback: http://localhost:3000
 */
export function getAppBaseUrl(requestOrBase?: any): string {
  if (typeof requestOrBase === 'string' && requestOrBase.trim()) {
    return normalizeBaseUrl(requestOrBase);
  }

  // 1. Browser context (client-side): window.location.origin is always 100% accurate
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin) {
      return normalizeBaseUrl(origin);
    }
  }

  // 2. Request context (server-side API routes & middleware)
  if (requestOrBase) {
    try {
      const getHeader = (name: string): string | null => {
        if (!requestOrBase.headers) return null;
        if (typeof requestOrBase.headers.get === 'function') {
          return requestOrBase.headers.get(name);
        }
        return requestOrBase.headers[name] || null;
      };

      const forwardedHost = getHeader('x-forwarded-host') || getHeader('host');
      const forwardedProto = getHeader('x-forwarded-proto') || 'https';

      if (forwardedHost) {
        const hostWithoutPort = forwardedHost.split(',')[0].trim();
        return normalizeBaseUrl(`${forwardedProto}://${hostWithoutPort}`);
      }

      if (requestOrBase.nextUrl?.origin) {
        return normalizeBaseUrl(requestOrBase.nextUrl.origin);
      }
      if (typeof requestOrBase.url === 'string') {
        const parsed = new URL(requestOrBase.url);
        return normalizeBaseUrl(parsed.origin);
      }
    } catch {
      // Ignore parsing errors and proceed to env fallbacks
    }
  }

  // 3. Explicit environment variable NEXT_PUBLIC_APP_URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  }

  // 4. Netlify built-in environment variables
  if (process.env.URL) {
    return normalizeBaseUrl(process.env.URL);
  }
  if (process.env.DEPLOY_PRIME_URL) {
    return normalizeBaseUrl(process.env.DEPLOY_PRIME_URL);
  }

  // 5. Vercel built-in environment variables
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeBaseUrl(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  if (process.env.VERCEL_URL) {
    return normalizeBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  // 6. Production fallback (ensures deployed builds never produce localhost)
  if (process.env.NODE_ENV === 'production') {
    return 'https://rtmshu.netlify.app';
  }

  // 7. Local development fallback
  return 'http://localhost:3000';
}

/**
 * Builds a full student invitation URL with proper base domain and normalized slashes.
 * Supports passing a request object or custom base URL, or dynamically resolves it.
 */
export function buildInvitationUrl(token: string, requestOrBase?: any): string {
  const base = getAppBaseUrl(requestOrBase);
  return `${base}/confirm/${token}`;
}

/**
 * Builds a full team leader access URL with proper base domain and normalized slashes.
 */
export function buildLeaderUrl(token: string, requestOrBase?: any): string {
  const base = getAppBaseUrl(requestOrBase);
  return `${base}/leader/${token}`;
}

/**
 * Re-bases any link (e.g., from an API or database) to the current environment base URL.
 * If the link has localhost but the current environment is production, or if it is a relative path,
 * it replaces the domain with the true base URL.
 */
export function rebaseAppUrl(url?: string | null, requestOrBase?: any): string {
  if (!url) return '';
  const base = getAppBaseUrl(requestOrBase);

  // If already a relative path
  if (url.startsWith('/')) {
    return `${base}${url}`;
  }

  try {
    const parsed = new URL(url);
    // If the URL has localhost/127.0.0.1 and current base is NOT localhost
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isCurrentBaseLocal = base.includes('localhost') || base.includes('127.0.0.1');

    if (isLocalHost && !isCurrentBaseLocal) {
      return `${base}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    // If the URL domain matches base, normalize it
    return url;
  } catch {
    return url;
  }
}

/**
 * Robust copy-to-clipboard utility that works on both desktop and mobile devices,
 * with fallback for browsers without navigator.clipboard permissions or non-secure contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Modern Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // 2. Fallback using temporary textarea
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      return false;
    }
  }

  return false;
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

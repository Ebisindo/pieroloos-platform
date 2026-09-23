export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  REVIEWER: 'reviewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export function canManageWorkspace(role: Role): boolean {
  return role === ROLES.OWNER || role === ROLES.ADMIN;
}

export function canReviewProfessionalOutput(role: Role): boolean {
  return role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.REVIEWER;
}

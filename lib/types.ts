export type Role = 'MASTER_ADMIN' | 'BUSINESS_ADMIN' | 'STAFF';

export interface User {
  id: string;
  email: string;
  role: Role;
  companyId: string;
}

export interface UserInvitation {
  email: string;
  role: Role;
}

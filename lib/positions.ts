export interface StaffPositionConfig {
  id: string;
  title: string;
  description: string;
  defaultDepartments: string[];
  canApproveQuotations: boolean;
  canApproveInvoices: boolean;
  approvalRights: boolean;
  canFinalizeDocuments: boolean;
}

export const STAFF_POSITIONS: StaffPositionConfig[] = [
  {
    id: "sales_manager",
    title: "Sales Manager",
    description: "Oversees CRM accounts, sales funnels, client quotations & billing.",
    defaultDepartments: ["sales", "pos"],
    canApproveQuotations: true,
    canApproveInvoices: true,
    approvalRights: true,
    canFinalizeDocuments: true
  },
  {
    id: "sales_executive",
    title: "Sales Executive / Clerk",
    description: "Creates client quotations, invoices, POS transactions & manages contacts.",
    defaultDepartments: ["sales", "pos"],
    canApproveQuotations: false,
    canApproveInvoices: false,
    approvalRights: false,
    canFinalizeDocuments: false
  },
  {
    id: "accountant",
    title: "Accountant / Finance Specialist",
    description: "Manages ledger transactions, invoice settlements, expense claims & audit logs.",
    defaultDepartments: ["finance", "sales"],
    canApproveQuotations: true,
    canApproveInvoices: true,
    approvalRights: true,
    canFinalizeDocuments: true
  },
  {
    id: "finance_director",
    title: "Finance Director / CFO",
    description: "Full oversight of financial ledgers, invoice approvals, budget finalizations.",
    defaultDepartments: ["finance", "sales", "procurement", "reports", "executive"],
    canApproveQuotations: true,
    canApproveInvoices: true,
    approvalRights: true,
    canFinalizeDocuments: true
  },
  {
    id: "inventory_manager",
    title: "Inventory / Warehouse Manager",
    description: "Manages warehouse stock levels, inventory catalog & procurement orders.",
    defaultDepartments: ["inventory", "procurement", "pos"],
    canApproveQuotations: false,
    canApproveInvoices: false,
    approvalRights: true,
    canFinalizeDocuments: false
  },
  {
    id: "inventory_clerk",
    title: "Inventory Clerk",
    description: "Performs physical stock audits, barcode scans & logs stock entries.",
    defaultDepartments: ["inventory", "pos"],
    canApproveQuotations: false,
    canApproveInvoices: false,
    approvalRights: false,
    canFinalizeDocuments: false
  },
  {
    id: "hr_manager",
    title: "HR Manager",
    description: "Administers employee payroll cycles, staff profiles & leave approvals.",
    defaultDepartments: ["hr"],
    canApproveQuotations: false,
    canApproveInvoices: false,
    approvalRights: true,
    canFinalizeDocuments: true
  },
  {
    id: "procurement_officer",
    title: "Procurement Officer",
    description: "Manages supplier terms, issues POs & inventory acquisitions.",
    defaultDepartments: ["procurement", "inventory"],
    canApproveQuotations: false,
    canApproveInvoices: true,
    approvalRights: true,
    canFinalizeDocuments: false
  },
  {
    id: "operations_lead",
    title: "Operations Lead / General Manager",
    description: "Cross-departmental management and operational approvals.",
    defaultDepartments: ["sales", "finance", "hr", "inventory", "projects", "reports", "support", "procurement", "pos", "marketing", "audit", "executive"],
    canApproveQuotations: true,
    canApproveInvoices: true,
    approvalRights: true,
    canFinalizeDocuments: true
  },
  {
    id: "custom",
    title: "Custom Position",
    description: "Manually select specific departments and permissions for this staff member.",
    defaultDepartments: [],
    canApproveQuotations: false,
    canApproveInvoices: false,
    approvalRights: false,
    canFinalizeDocuments: false
  }
];

export function getPositionConfig(positionTitle?: string): StaffPositionConfig {
  if (!positionTitle) return STAFF_POSITIONS[STAFF_POSITIONS.length - 1];
  const found = STAFF_POSITIONS.find(
    p => p.title.toLowerCase() === positionTitle.toLowerCase() || p.id.toLowerCase() === positionTitle.toLowerCase()
  );
  return found || {
    id: "custom",
    title: positionTitle,
    description: "Custom Position",
    defaultDepartments: [],
    canApproveQuotations: false,
    canApproveInvoices: false,
    approvalRights: false,
    canFinalizeDocuments: false
  };
}

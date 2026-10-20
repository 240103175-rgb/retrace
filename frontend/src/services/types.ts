// Types shared by the service interface, the mock and the HTTP client. Mirror /openapi.yml.

export type Role = 'investigator' | 'admin';
export type CaseStatus = 'open' | 'in_review' | 'closed' | 'archived';
export type EvidenceType = 'message' | 'link' | 'account' | 'payment' | 'observation';
export type Verification = 'unverified' | 'confirmed' | 'disputed';
export type EntityType = 'person' | 'account' | 'phone' | 'link' | 'card' | 'wallet' | 'organization';
export type RelationshipType = 'contacted' | 'paid' | 'owns' | 'links_to' | 'same_as';
export type RiskLevel = 'low' | 'medium' | 'high';
export type CaseSort = 'updated' | 'created' | 'title' | 'risk';
export type RuleId = 'credential_request' | 'urgent_payment' | 'suspicious_link' | 'personal_payment' | 'hub_entity' | 'disputed_evidence';

export type ErrorCode =
  | 'validation_error'
  | 'unauthorized'
  | 'invalid_credentials'
  | 'email_taken'
  | 'forbidden'
  | 'not_found'
  | 'case_locked'
  | 'invalid_relationship'
  | 'last_admin'
  | 'network'
  | 'server_error';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface CaseSummary {
  id: number;
  title: string;
  description: string;
  status: CaseStatus;
  ownerId: number;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
  evidenceCount: number;
  entityCount: number;
  relationshipCount: number;
  riskScore: number;
  riskLevel: RiskLevel;
}

export interface Evidence {
  id: number;
  caseId: number;
  type: EvidenceType;
  content: string;
  source: string | null;
  observedOn: string | null;
  amount: number | null;
  verification: Verification;
  createdAt: string;
}

export interface EvidenceInput {
  type: EvidenceType;
  content: string;
  source?: string | null;
  observedOn?: string | null;
  amount?: number | null;
  verification?: Verification;
}

export interface Entity {
  id: number;
  caseId: number;
  type: EntityType;
  label: string;
  note: string | null;
}

export interface EntityInput {
  type: EntityType;
  label: string;
  note?: string | null;
}

export interface Relationship {
  id: number;
  caseId: number;
  sourceId: number;
  targetId: number;
  type: RelationshipType;
  evidenceIds: number[];
}

export interface RelationshipInput {
  sourceId: number;
  targetId: number;
  type: RelationshipType;
  evidenceIds?: number[];
}

export interface Graph {
  nodes: { id: number; type: EntityType; label: string; degree: number }[];
  edges: { id: number; sourceId: number; targetId: number; type: RelationshipType; evidenceCount: number }[];
}

export interface RiskRef {
  kind: 'evidence' | 'entity';
  id: number;
  label: string;
  detail?: string;
}

export interface Risk {
  score: number;
  level: RiskLevel;
  basedOnlyOnUnverified: boolean;
  rules: { id: RuleId; weight: number; refs: RiskRef[] }[];
}

export interface ReportSummary {
  id: number;
  caseId: number;
  createdAt: string;
  createdBy: number;
  createdByName: string | null;
}

export interface Report extends ReportSummary {
  snapshot: {
    case: CaseSummary;
    evidence: Evidence[];
    entities: Entity[];
    relationships: Relationship[];
    risk: Risk;
  };
}

export interface AdminStats {
  users: number;
  cases: number;
  casesByStatus: Record<CaseStatus, number>;
  evidence: number;
  highRiskCases: number;
}

export interface AuditEvent {
  id: number;
  at: string;
  actorId: number | null;
  actorName: string | null;
  action: string;
  resourceType: string;
  resourceId: number | null;
  caseId: number | null;
}

export interface CaseFilter {
  q?: string;
  status?: CaseStatus | null;
  sort?: CaseSort;
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    message: string = code,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

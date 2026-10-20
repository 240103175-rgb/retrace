// The single service interface the UI uses. Implemented by mockService and httpService.
import type {
  AdminStats,
  AuditEvent,
  CaseFilter,
  CaseStatus,
  CaseSummary,
  Entity,
  EntityInput,
  Evidence,
  EvidenceInput,
  Graph,
  Relationship,
  RelationshipInput,
  Report,
  ReportSummary,
  Risk,
  Role,
  Session,
  User,
} from './types';

export interface RetraceApi {
  setToken(token: string | null): void;

  register(input: { email: string; password: string; name: string }): Promise<Session>;
  login(input: { email: string; password: string }): Promise<Session>;
  logout(): Promise<void>;
  me(): Promise<User>;

  listCases(filter?: CaseFilter): Promise<CaseSummary[]>;
  createCase(input: { title: string; description?: string }): Promise<CaseSummary>;
  getCase(id: number): Promise<CaseSummary>;
  updateCase(id: number, patch: { title?: string; description?: string; status?: CaseStatus }): Promise<CaseSummary>;

  listEvidence(caseId: number): Promise<Evidence[]>;
  createEvidence(caseId: number, input: EvidenceInput): Promise<Evidence>;
  updateEvidence(caseId: number, id: number, patch: Partial<EvidenceInput>): Promise<Evidence>;
  deleteEvidence(caseId: number, id: number): Promise<void>;

  listEntities(caseId: number): Promise<Entity[]>;
  createEntity(caseId: number, input: EntityInput): Promise<Entity>;
  updateEntity(caseId: number, id: number, patch: Partial<EntityInput>): Promise<Entity>;
  deleteEntity(caseId: number, id: number): Promise<void>;

  listRelationships(caseId: number): Promise<Relationship[]>;
  createRelationship(caseId: number, input: RelationshipInput): Promise<Relationship>;
  deleteRelationship(caseId: number, id: number): Promise<void>;

  graph(caseId: number): Promise<Graph>;
  risk(caseId: number): Promise<Risk>;

  listReports(caseId: number): Promise<ReportSummary[]>;
  createReport(caseId: number): Promise<Report>;
  getReport(caseId: number, id: number): Promise<Report>;

  adminStats(): Promise<AdminStats>;
  adminCases(filter?: CaseFilter): Promise<CaseSummary[]>;
  adminUsers(): Promise<User[]>;
  adminSetRole(userId: number, role: Role): Promise<User>;
  adminAudit(params?: { caseId?: number; limit?: number }): Promise<AuditEvent[]>;
}

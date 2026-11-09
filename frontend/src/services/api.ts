// The single service interface the UI uses. Implemented by mockService and httpService.
import type {
  AdminStats,
  Attachment,
  AttachmentInput,
  AuditEvent,
  CaseFilter,
  CaseStatus,
  CaseSummary,
  AuditFilter,
  Download,
  EvidenceFilter,
  Entity,
  EntitySuggestion,
  Summary,
  EntityInput,
  Evidence,
  EvidenceInput,
  Graph,
  Member,
  Comment,
  EntityMatch,
  IntakeReport,
  PublicCheck,
  PublicReportInput,
  RiskRuleSetting,
  SimilarCase,
  Task,
  MemberRole,
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
  /** Register a handler for 401 responses while signed in (#78). */
  onUnauthorized(fn: (() => void) | null): void;

  register(input: { email: string; password: string; name: string }): Promise<Session>;
  login(input: { email: string; password: string }): Promise<Session>;
  logout(): Promise<void>;
  me(): Promise<User>;
  logoutAll(): Promise<void>;
  updateMe(input: { name: string }): Promise<User>;
  changePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;

  listCases(filter?: CaseFilter): Promise<CaseSummary[]>;
  createCase(input: { title: string; description?: string }): Promise<CaseSummary>;
  getCase(id: number): Promise<CaseSummary>;
  updateCase(
    id: number,
    patch: { title?: string; description?: string; status?: CaseStatus; tags?: string[]; notes?: string | null; version?: number },
  ): Promise<CaseSummary>;
  exportCase(id: number): Promise<Download>;

  listMembers(caseId: number): Promise<Member[]>;
  addMember(caseId: number, input: { email: string; role: MemberRole }): Promise<Member>;
  updateMember(caseId: number, userId: number, input: { role: MemberRole }): Promise<Member>;
  removeMember(caseId: number, userId: number): Promise<void>;
  exportEvidenceCsv(id: number): Promise<Download>;

  listEvidence(caseId: number, filter?: EvidenceFilter): Promise<Evidence[]>;
  createEvidence(caseId: number, input: EvidenceInput): Promise<Evidence>;
  updateEvidence(caseId: number, id: number, patch: Partial<EvidenceInput> & { version?: number }): Promise<Evidence>;
  deleteEvidence(caseId: number, id: number): Promise<void>;

  listAttachments(caseId: number, evidenceId: number): Promise<Attachment[]>;
  uploadAttachment(caseId: number, evidenceId: number, input: AttachmentInput): Promise<Attachment>;
  downloadAttachment(caseId: number, evidenceId: number, attachment: Attachment): Promise<Download>;
  deleteAttachment(caseId: number, evidenceId: number, id: number): Promise<void>;

  listEntities(caseId: number): Promise<Entity[]>;
  entitySuggestions(caseId: number): Promise<EntitySuggestion[]>;
  createEntity(caseId: number, input: EntityInput): Promise<Entity>;
  updateEntity(caseId: number, id: number, patch: Partial<EntityInput> & { version?: number }): Promise<Entity>;
  deleteEntity(caseId: number, id: number): Promise<void>;

  listRelationships(caseId: number): Promise<Relationship[]>;
  createRelationship(caseId: number, input: RelationshipInput): Promise<Relationship>;
  deleteRelationship(caseId: number, id: number): Promise<void>;

  graph(caseId: number): Promise<Graph>;
  risk(caseId: number): Promise<Risk>;
  summary(caseId: number): Promise<Summary>;

  listReports(caseId: number): Promise<ReportSummary[]>;
  createReport(caseId: number): Promise<Report>;
  getReport(caseId: number, id: number): Promise<Report>;

  adminStats(): Promise<AdminStats>;
  adminCases(filter?: CaseFilter): Promise<CaseSummary[]>;
  adminUsers(): Promise<User[]>;
  adminUpdateUser(userId: number, patch: { role?: Role; disabled?: boolean }): Promise<User>;
  adminAudit(params?: AuditFilter): Promise<AuditEvent[]>;
  adminRiskRules(): Promise<RiskRuleSetting[]>;
  adminSetRiskRule(id: string, patch: { enabled?: boolean; weight?: number }): Promise<RiskRuleSetting>;

  // v1.4
  matches(caseId: number): Promise<EntityMatch[]>;
  similar(caseId: number): Promise<SimilarCase[]>;
  listComments(caseId: number): Promise<Comment[]>;
  addComment(caseId: number, text: string): Promise<Comment>;
  deleteComment(caseId: number, id: number): Promise<void>;
  listTasks(caseId: number): Promise<Task[]>;
  addTask(caseId: number, input: { title: string; assigneeId?: number | null }): Promise<Task>;
  updateTask(caseId: number, id: number, patch: { title?: string; done?: boolean; assigneeId?: number | null }): Promise<Task>;
  deleteTask(caseId: number, id: number): Promise<void>;
  listIntake(status?: 'new' | 'taken'): Promise<IntakeReport[]>;
  takeIntake(id: number): Promise<CaseSummary>;
  /** No sign-in needed. */
  submitPublicReport(input: PublicReportInput): Promise<{ reference: string }>;
  publicCheck(value: string): Promise<PublicCheck>;
}

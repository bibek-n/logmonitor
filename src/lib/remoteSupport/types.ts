export type RemoteSupportSessionStatus = "Pending" | "Approved" | "Rejected" | "Active" | "Ended" | "Expired";

export type SignalDirection = "ToAgent" | "ToAdmin";
export type SignalMessageType = "offer" | "answer" | "ice-candidate";

export interface RemoteSupportSessionRow {
  Id: number;
  SessionGuid: string;
  DeviceId: string;
  RequestedByUserId: number;
  Reason: string;
  Status: RemoteSupportSessionStatus;
  ApprovalNonce: string;
  RequestedAt: string;
  ExpiresAt: string;
  RespondedAt: string | null;
  Approved: boolean | null;
  StartedAt: string | null;
  EndedAt: string | null;
  TerminationReason: string | null;
  PermissionsGranted: string;
  SourceIp: string;
  CreatedAt: string;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Thrown by sessionAuthorization.ts for every "this request is invalid for the session's
// current state" case - callers (API routes) map `code` to the right HTTP status rather than
// string-matching `message`.
export class SessionStateError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "SessionStateError";
    this.code = code;
  }
}

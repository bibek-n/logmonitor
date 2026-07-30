import { ProviderType } from "../types";

export interface ProviderConnectionConfig {
  providerType: ProviderType;
  displayName: string;
  config: Record<string, string | undefined>;
  secret: string | null;
}

export interface InboundMessageRef {
  messageId: string;
  direction: "Incoming" | "Outgoing";
  sender: string;
  recipients: string[];
  subject: string | null;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

// The generic mail-provider integration surface described in the spec's section 2. Every
// concrete provider (M365, Google Workspace, Exchange Server, generic SMTP/IMAP) implements
// this same interface so the policy engine never needs to know which provider it's talking
// to. Stage 1 ships only stubAdapter.ts against this interface - real implementations are
// Stage 2+, once real tenant admin consent/credentials exist for a given provider.
export interface MailProviderAdapter {
  authenticate(): Promise<void>;
  testConnection(): Promise<ConnectionTestResult>;
  subscribeToMailEvents(): Promise<void>;
  inspectIncomingMessage(messageId: string): Promise<InboundMessageRef>;
  inspectOutgoingMessage(messageId: string): Promise<InboundMessageRef>;
  quarantineMessage(messageId: string, reason: string): Promise<void>;
  rejectMessage(messageId: string, reason: string): Promise<void>;
  removeAttachment(messageId: string, attachmentName: string): Promise<void>;
  notifySender(messageId: string, subject: string, body: string): Promise<void>;
  notifyRecipient(messageId: string, subject: string, body: string): Promise<void>;
}

export class NotImplementedError extends Error {
  constructor(providerType: ProviderType, method: string) {
    super(`${providerType} adapter does not implement ${method}() yet — Stage 2+`);
  }
}

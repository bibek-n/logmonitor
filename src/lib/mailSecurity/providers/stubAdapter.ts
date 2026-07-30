import { ConnectionTestResult, InboundMessageRef, MailProviderAdapter, NotImplementedError, ProviderConnectionConfig } from "./MailProviderAdapter";

// Every MailProviderConnections row in Stage 1 resolves to this adapter, regardless of its
// ProviderType. testConnection() genuinely runs and genuinely reports "not connected yet" -
// this is real, honest behavior, not a placeholder that lies about success. Every other
// method throws, since there is no live mail flow to act on in Stage 1.
export class StubMailProviderAdapter implements MailProviderAdapter {
  constructor(private readonly connection: ProviderConnectionConfig) {}

  async testConnection(): Promise<ConnectionTestResult> {
    return {
      ok: false,
      message: `${this.connection.providerType} adapter is not implemented yet. Real connectivity requires Stage 2 (tenant admin consent / mailbox credentials to be supplied and wired to a real adapter).`,
    };
  }

  async authenticate(): Promise<void> {
    throw new NotImplementedError(this.connection.providerType, "authenticate");
  }

  async subscribeToMailEvents(): Promise<void> {
    throw new NotImplementedError(this.connection.providerType, "subscribeToMailEvents");
  }

  async inspectIncomingMessage(): Promise<InboundMessageRef> {
    throw new NotImplementedError(this.connection.providerType, "inspectIncomingMessage");
  }

  async inspectOutgoingMessage(): Promise<InboundMessageRef> {
    throw new NotImplementedError(this.connection.providerType, "inspectOutgoingMessage");
  }

  async quarantineMessage(): Promise<void> {
    throw new NotImplementedError(this.connection.providerType, "quarantineMessage");
  }

  async rejectMessage(): Promise<void> {
    throw new NotImplementedError(this.connection.providerType, "rejectMessage");
  }

  async removeAttachment(): Promise<void> {
    throw new NotImplementedError(this.connection.providerType, "removeAttachment");
  }

  async notifySender(): Promise<void> {
    throw new NotImplementedError(this.connection.providerType, "notifySender");
  }

  async notifyRecipient(): Promise<void> {
    throw new NotImplementedError(this.connection.providerType, "notifyRecipient");
  }
}

export function createProviderAdapter(connection: ProviderConnectionConfig): MailProviderAdapter {
  return new StubMailProviderAdapter(connection);
}

import { getDb, sql } from "../db";
import { encryptSecret } from "./crypto";
import {
  AvailabilityStatus,
  RemoteConnection,
  RemoteConnectionGroup,
  RemoteCredential,
  RemoteInventoryDevice,
  RemoteSshKey,
} from "./types";
import type { z } from "zod";
import type {
  createConnectionSchema,
  createCredentialSchema,
  createGroupSchema,
  createInventoryDeviceSchema,
  createPortForwardSchema,
  createScriptSchema,
  updateConnectionSchema,
  updateCredentialSchema,
  updateGroupSchema,
  updateInventoryDeviceSchema,
  updateScriptSchema,
} from "./schema";

// --- Connection Groups -----------------------------------------------------------------------

export async function listGroups(): Promise<RemoteConnectionGroup[]> {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; ParentGroupId: number | null }>(
    "SELECT Id, Name, ParentGroupId FROM RemoteConnectionGroups WHERE IsDeleted = 0 ORDER BY Name ASC"
  );
  return result.recordset.map((r) => ({ id: r.Id, name: r.Name, parentGroupId: r.ParentGroupId }));
}

export async function createGroup(input: z.infer<typeof createGroupSchema>, userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, input.name)
    .input("parentGroupId", sql.Int, input.parentGroupId ?? null)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteConnectionGroups (Name, ParentGroupId, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id VALUES (@name, @parentGroupId, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function updateGroup(id: number, input: z.infer<typeof updateGroupSchema>, userId: number): Promise<void> {
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Name: string; ParentGroupId: number | null }>(
    "SELECT Name, ParentGroupId FROM RemoteConnectionGroups WHERE Id = @id AND IsDeleted = 0"
  );
  const current = existing.recordset[0];
  if (!current) throw new Error("Group not found");

  await db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, input.name ?? current.Name)
    .input("parentGroupId", sql.Int, input.parentGroupId !== undefined ? input.parentGroupId : current.ParentGroupId)
    .input("userId", sql.Int, userId)
    .query("UPDATE RemoteConnectionGroups SET Name = @name, ParentGroupId = @parentGroupId, UpdatedByUserId = @userId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
}

export async function deleteGroup(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE RemoteConnectionGroups SET IsDeleted = 1 WHERE Id = @id");
}

// --- Connections -------------------------------------------------------------------------------

function mapConnection(r: {
  Id: number;
  Name: string;
  Hostname: string | null;
  IpAddress: string | null;
  Port: number;
  Protocol: string;
  Username: string | null;
  Domain: string | null;
  CredentialId: number | null;
  SshKeyId: number | null;
  RemoteDirectory: string | null;
  OperatingSystem: string | null;
  DeviceType: string | null;
  Environment: string;
  Customer: string | null;
  Location: string | null;
  GroupId: number | null;
  Tags: string | null;
  Notes: string | null;
  IsFavorite: boolean;
  ConnectionTimeoutSeconds: number;
  KeepaliveIntervalSeconds: number;
  AutoReconnect: boolean;
  JumpHostConnectionId: number | null;
  PreConnectCommand: string | null;
  PostConnectCommand: string | null;
  LastSuccessAt: Date | null;
  LastFailureAt: Date | null;
  AvailabilityStatus: string;
  CreatedAt: Date;
  UpdatedAt: Date;
  IsShared: boolean;
  CreatedByUserId: number | null;
}): RemoteConnection {
  return {
    id: r.Id,
    name: r.Name,
    hostname: r.Hostname,
    ipAddress: r.IpAddress,
    port: r.Port,
    protocol: r.Protocol as RemoteConnection["protocol"],
    username: r.Username,
    domain: r.Domain,
    credentialId: r.CredentialId,
    sshKeyId: r.SshKeyId,
    remoteDirectory: r.RemoteDirectory,
    operatingSystem: r.OperatingSystem,
    deviceType: r.DeviceType,
    environment: r.Environment as RemoteConnection["environment"],
    customer: r.Customer,
    location: r.Location,
    groupId: r.GroupId,
    tags: r.Tags ? r.Tags.split(",").filter(Boolean) : [],
    notes: r.Notes,
    isFavorite: r.IsFavorite,
    connectionTimeoutSeconds: r.ConnectionTimeoutSeconds,
    keepaliveIntervalSeconds: r.KeepaliveIntervalSeconds,
    autoReconnect: r.AutoReconnect,
    jumpHostConnectionId: r.JumpHostConnectionId,
    preConnectCommand: r.PreConnectCommand,
    postConnectCommand: r.PostConnectCommand,
    lastSuccessAt: r.LastSuccessAt,
    lastFailureAt: r.LastFailureAt,
    availabilityStatus: r.AvailabilityStatus as AvailabilityStatus,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
    isShared: r.IsShared,
    createdByUserId: r.CreatedByUserId,
  };
}

const CONNECTION_COLUMNS = `Id, Name, Hostname, IpAddress, Port, Protocol, Username, Domain, CredentialId, SshKeyId,
  RemoteDirectory, OperatingSystem, DeviceType, Environment, Customer, Location, GroupId, Tags, Notes, IsFavorite,
  ConnectionTimeoutSeconds, KeepaliveIntervalSeconds, AutoReconnect, JumpHostConnectionId, PreConnectCommand,
  PostConnectCommand, LastSuccessAt, LastFailureAt, AvailabilityStatus, CreatedAt, UpdatedAt, IsShared, CreatedByUserId`;

// Shared connections (Phase 3): a connection with IsShared=1 (the default, preserving every
// existing connection's visibility from Phase 1/2) is visible to anyone with ra_connections_view.
// IsShared=0 makes it private to its creator - Admins can still see everything, matching this
// app's universal Admin-bypass convention. viewerUserId/isAdmin are optional so internal callers
// (the connection checker, credential resolution during a dial, etc.) that don't have a "current
// viewer" concept keep working unfiltered, exactly as before this feature existed.
export async function listConnections(
  opts: { search?: string; environment?: string; protocol?: string; groupId?: number; viewerUserId?: number; isAdmin?: boolean } = {}
): Promise<RemoteConnection[]> {
  const db = await getDb();
  const request = db.request();
  const conditions = ["IsDeleted = 0"];
  if (opts.search) {
    request.input("search", sql.NVarChar, `%${opts.search}%`);
    conditions.push("(Name LIKE @search OR Hostname LIKE @search OR IpAddress LIKE @search OR Tags LIKE @search)");
  }
  if (opts.environment) {
    request.input("environment", sql.VarChar, opts.environment);
    conditions.push("Environment = @environment");
  }
  if (opts.protocol) {
    request.input("protocol", sql.VarChar, opts.protocol);
    conditions.push("Protocol = @protocol");
  }
  if (opts.groupId) {
    request.input("groupId", sql.Int, opts.groupId);
    conditions.push("GroupId = @groupId");
  }
  if (opts.viewerUserId !== undefined && !opts.isAdmin) {
    request.input("viewerUserId", sql.Int, opts.viewerUserId);
    conditions.push("(IsShared = 1 OR CreatedByUserId = @viewerUserId)");
  }
  const result = await request.query<Parameters<typeof mapConnection>[0]>(
    `SELECT ${CONNECTION_COLUMNS} FROM RemoteConnections WHERE ${conditions.join(" AND ")} ORDER BY IsFavorite DESC, Name ASC`
  );
  return result.recordset.map(mapConnection);
}

export async function getConnection(id: number): Promise<RemoteConnection | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<Parameters<typeof mapConnection>[0]>(`SELECT ${CONNECTION_COLUMNS} FROM RemoteConnections WHERE Id = @id AND IsDeleted = 0`);
  const row = result.recordset[0];
  return row ? mapConnection(row) : null;
}

export async function createConnection(input: z.infer<typeof createConnectionSchema>, userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, input.name)
    .input("hostname", sql.NVarChar, input.hostname ?? null)
    .input("ipAddress", sql.VarChar, input.ipAddress ?? null)
    .input("port", sql.Int, input.port)
    .input("protocol", sql.VarChar, input.protocol)
    .input("username", sql.NVarChar, input.username ?? null)
    .input("domain", sql.NVarChar, input.domain ?? null)
    .input("credentialId", sql.Int, input.credentialId ?? null)
    .input("sshKeyId", sql.Int, input.sshKeyId ?? null)
    .input("remoteDirectory", sql.NVarChar, input.remoteDirectory ?? null)
    .input("operatingSystem", sql.VarChar, input.operatingSystem ?? null)
    .input("deviceType", sql.VarChar, input.deviceType ?? null)
    .input("environment", sql.VarChar, input.environment)
    .input("customer", sql.NVarChar, input.customer ?? null)
    .input("location", sql.NVarChar, input.location ?? null)
    .input("groupId", sql.Int, input.groupId ?? null)
    .input("tags", sql.NVarChar, input.tags.join(","))
    .input("notes", sql.NVarChar, input.notes ?? null)
    .input("isFavorite", sql.Bit, input.isFavorite)
    .input("connectionTimeoutSeconds", sql.Int, input.connectionTimeoutSeconds)
    .input("keepaliveIntervalSeconds", sql.Int, input.keepaliveIntervalSeconds)
    .input("autoReconnect", sql.Bit, input.autoReconnect)
    .input("jumpHostConnectionId", sql.Int, input.jumpHostConnectionId ?? null)
    .input("preConnectCommand", sql.NVarChar, input.preConnectCommand ?? null)
    .input("postConnectCommand", sql.NVarChar, input.postConnectCommand ?? null)
    .input("isShared", sql.Bit, input.isShared)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteConnections
        (Name, Hostname, IpAddress, Port, Protocol, Username, Domain, CredentialId, SshKeyId, RemoteDirectory,
         OperatingSystem, DeviceType, Environment, Customer, Location, GroupId, Tags, Notes, IsFavorite,
         ConnectionTimeoutSeconds, KeepaliveIntervalSeconds, AutoReconnect, JumpHostConnectionId,
         PreConnectCommand, PostConnectCommand, IsShared, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES
        (@name, @hostname, @ipAddress, @port, @protocol, @username, @domain, @credentialId, @sshKeyId, @remoteDirectory,
         @operatingSystem, @deviceType, @environment, @customer, @location, @groupId, @tags, @notes, @isFavorite,
         @connectionTimeoutSeconds, @keepaliveIntervalSeconds, @autoReconnect, @jumpHostConnectionId,
         @preConnectCommand, @postConnectCommand, @isShared, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function updateConnection(id: number, input: z.infer<typeof updateConnectionSchema>, userId: number): Promise<void> {
  const existing = await getConnection(id);
  if (!existing) throw new Error("Connection not found");

  const merged = {
    name: input.name ?? existing.name,
    hostname: input.hostname !== undefined ? input.hostname : existing.hostname,
    ipAddress: input.ipAddress !== undefined ? input.ipAddress : existing.ipAddress,
    port: input.port ?? existing.port,
    protocol: input.protocol ?? existing.protocol,
    username: input.username !== undefined ? input.username : existing.username,
    domain: input.domain !== undefined ? input.domain : existing.domain,
    credentialId: input.credentialId !== undefined ? input.credentialId : existing.credentialId,
    sshKeyId: input.sshKeyId !== undefined ? input.sshKeyId : existing.sshKeyId,
    remoteDirectory: input.remoteDirectory !== undefined ? input.remoteDirectory : existing.remoteDirectory,
    operatingSystem: input.operatingSystem !== undefined ? input.operatingSystem : existing.operatingSystem,
    deviceType: input.deviceType !== undefined ? input.deviceType : existing.deviceType,
    environment: input.environment ?? existing.environment,
    customer: input.customer !== undefined ? input.customer : existing.customer,
    location: input.location !== undefined ? input.location : existing.location,
    groupId: input.groupId !== undefined ? input.groupId : existing.groupId,
    tags: input.tags ?? existing.tags,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    isFavorite: input.isFavorite ?? existing.isFavorite,
    connectionTimeoutSeconds: input.connectionTimeoutSeconds ?? existing.connectionTimeoutSeconds,
    keepaliveIntervalSeconds: input.keepaliveIntervalSeconds ?? existing.keepaliveIntervalSeconds,
    autoReconnect: input.autoReconnect ?? existing.autoReconnect,
    jumpHostConnectionId: input.jumpHostConnectionId !== undefined ? input.jumpHostConnectionId : existing.jumpHostConnectionId,
    preConnectCommand: input.preConnectCommand !== undefined ? input.preConnectCommand : existing.preConnectCommand,
    postConnectCommand: input.postConnectCommand !== undefined ? input.postConnectCommand : existing.postConnectCommand,
    isShared: input.isShared ?? existing.isShared,
  };

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, merged.name)
    .input("hostname", sql.NVarChar, merged.hostname)
    .input("ipAddress", sql.VarChar, merged.ipAddress)
    .input("port", sql.Int, merged.port)
    .input("protocol", sql.VarChar, merged.protocol)
    .input("username", sql.NVarChar, merged.username)
    .input("domain", sql.NVarChar, merged.domain)
    .input("credentialId", sql.Int, merged.credentialId)
    .input("sshKeyId", sql.Int, merged.sshKeyId)
    .input("remoteDirectory", sql.NVarChar, merged.remoteDirectory)
    .input("operatingSystem", sql.VarChar, merged.operatingSystem)
    .input("deviceType", sql.VarChar, merged.deviceType)
    .input("environment", sql.VarChar, merged.environment)
    .input("customer", sql.NVarChar, merged.customer)
    .input("location", sql.NVarChar, merged.location)
    .input("groupId", sql.Int, merged.groupId)
    .input("tags", sql.NVarChar, merged.tags.join(","))
    .input("notes", sql.NVarChar, merged.notes)
    .input("isFavorite", sql.Bit, merged.isFavorite)
    .input("connectionTimeoutSeconds", sql.Int, merged.connectionTimeoutSeconds)
    .input("keepaliveIntervalSeconds", sql.Int, merged.keepaliveIntervalSeconds)
    .input("autoReconnect", sql.Bit, merged.autoReconnect)
    .input("jumpHostConnectionId", sql.Int, merged.jumpHostConnectionId)
    .input("preConnectCommand", sql.NVarChar, merged.preConnectCommand)
    .input("postConnectCommand", sql.NVarChar, merged.postConnectCommand)
    .input("isShared", sql.Bit, merged.isShared)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE RemoteConnections SET
        Name=@name, Hostname=@hostname, IpAddress=@ipAddress, Port=@port, Protocol=@protocol, Username=@username,
        Domain=@domain, CredentialId=@credentialId, SshKeyId=@sshKeyId, RemoteDirectory=@remoteDirectory,
        OperatingSystem=@operatingSystem, DeviceType=@deviceType, Environment=@environment, Customer=@customer,
        Location=@location, GroupId=@groupId, Tags=@tags, Notes=@notes, IsFavorite=@isFavorite,
        ConnectionTimeoutSeconds=@connectionTimeoutSeconds, KeepaliveIntervalSeconds=@keepaliveIntervalSeconds,
        AutoReconnect=@autoReconnect, JumpHostConnectionId=@jumpHostConnectionId, PreConnectCommand=@preConnectCommand,
        PostConnectCommand=@postConnectCommand, IsShared=@isShared, UpdatedByUserId=@userId, UpdatedAt=SYSUTCDATETIME()
      WHERE Id=@id
    `);
}

export async function deleteConnection(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE RemoteConnections SET IsDeleted = 1, IsActive = 0 WHERE Id = @id");
}

export async function cloneConnection(id: number, userId: number): Promise<number> {
  const existing = await getConnection(id);
  if (!existing) throw new Error("Connection not found");
  const db = await getDb();
  const result = await db
    .request()
    .input("sourceId", sql.Int, id)
    .input("newName", sql.NVarChar, `${existing.name} (copy)`)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteConnections
        (Name, Hostname, IpAddress, Port, Protocol, Username, Domain, CredentialId, SshKeyId, RemoteDirectory,
         OperatingSystem, DeviceType, Environment, Customer, Location, GroupId, Tags, Notes,
         ConnectionTimeoutSeconds, KeepaliveIntervalSeconds, AutoReconnect, JumpHostConnectionId,
         PreConnectCommand, PostConnectCommand, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      SELECT @newName, Hostname, IpAddress, Port, Protocol, Username, Domain, CredentialId, SshKeyId, RemoteDirectory,
        OperatingSystem, DeviceType, Environment, Customer, Location, GroupId, Tags, Notes,
        ConnectionTimeoutSeconds, KeepaliveIntervalSeconds, AutoReconnect, JumpHostConnectionId,
        PreConnectCommand, PostConnectCommand, @userId, @userId
      FROM RemoteConnections WHERE Id = @sourceId
    `);
  return result.recordset[0].Id;
}

export async function recordConnectionCheckResult(connectionId: number, status: AvailabilityStatus, latencyMs: number | null, errorMessage: string | null): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("connectionId", sql.Int, connectionId)
    .input("status", sql.VarChar, status)
    .input("latencyMs", sql.Int, latencyMs)
    .input("errorMessage", sql.NVarChar, errorMessage)
    .query("INSERT INTO RemoteConnectionChecks (ConnectionId, Status, LatencyMs, ErrorMessage) VALUES (@connectionId, @status, @latencyMs, @errorMessage)");

  await db
    .request()
    .input("connectionId", sql.Int, connectionId)
    .input("status", sql.VarChar, status)
    .query(`
      UPDATE RemoteConnections
      SET AvailabilityStatus = @status,
        LastSuccessAt = CASE WHEN @status = 'Online' THEN SYSUTCDATETIME() ELSE LastSuccessAt END,
        LastFailureAt = CASE WHEN @status IN ('Offline','Degraded') THEN SYSUTCDATETIME() ELSE LastFailureAt END
      WHERE Id = @connectionId
    `);
}

export async function listConnectionsForCheck(): Promise<
  { id: number; name: string; hostname: string | null; ipAddress: string | null; port: number; protocol: string; timeoutSeconds: number; previousStatus: AvailabilityStatus }[]
> {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; Hostname: string | null; IpAddress: string | null; Port: number; Protocol: string; ConnectionTimeoutSeconds: number; AvailabilityStatus: string }>(
    "SELECT Id, Name, Hostname, IpAddress, Port, Protocol, ConnectionTimeoutSeconds, AvailabilityStatus FROM RemoteConnections WHERE IsDeleted = 0 AND IsActive = 1"
  );
  return result.recordset.map((r) => ({
    id: r.Id,
    name: r.Name,
    hostname: r.Hostname,
    ipAddress: r.IpAddress,
    port: r.Port,
    protocol: r.Protocol,
    timeoutSeconds: r.ConnectionTimeoutSeconds,
    previousStatus: r.AvailabilityStatus as AvailabilityStatus,
  }));
}

// --- Credentials (vault) ----------------------------------------------------------------------
// EncryptedSecret is NEVER selected by list/get below - the object this app can leak is
// shaped so it structurally cannot contain the secret, not just "trust every call site to
// remember to omit it."

function mapCredential(r: {
  Id: number;
  Name: string;
  CredentialType: string;
  Username: string | null;
  Domain: string | null;
  ExpiresAt: Date | null;
  LastRotatedAt: Date | null;
  RotationReminderDays: number | null;
  LastAccessedAt: Date | null;
  CreatedAt: Date;
}): RemoteCredential {
  return {
    id: r.Id,
    name: r.Name,
    credentialType: r.CredentialType as RemoteCredential["credentialType"],
    username: r.Username,
    domain: r.Domain,
    expiresAt: r.ExpiresAt,
    lastRotatedAt: r.LastRotatedAt,
    rotationReminderDays: r.RotationReminderDays,
    lastAccessedAt: r.LastAccessedAt,
    createdAt: r.CreatedAt,
  };
}

const CREDENTIAL_COLUMNS_NO_SECRET = "Id, Name, CredentialType, Username, Domain, ExpiresAt, LastRotatedAt, RotationReminderDays, LastAccessedAt, CreatedAt";

export async function listCredentials(): Promise<RemoteCredential[]> {
  const db = await getDb();
  const result = await db.query<Parameters<typeof mapCredential>[0]>(
    `SELECT ${CREDENTIAL_COLUMNS_NO_SECRET} FROM RemoteCredentials WHERE IsDeleted = 0 ORDER BY Name ASC`
  );
  return result.recordset.map(mapCredential);
}

export async function createCredential(input: z.infer<typeof createCredentialSchema>, userId: number): Promise<number> {
  const encryptedSecret = await encryptSecret(input.secret);
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, input.name)
    .input("credentialType", sql.VarChar, input.credentialType)
    .input("encryptedSecret", sql.NVarChar(sql.MAX), encryptedSecret)
    .input("username", sql.NVarChar, input.username ?? null)
    .input("domain", sql.NVarChar, input.domain ?? null)
    .input("expiresAt", sql.DateTime2, input.expiresAt ?? null)
    .input("rotationReminderDays", sql.Int, input.rotationReminderDays ?? null)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteCredentials (Name, CredentialType, EncryptedSecret, Username, Domain, ExpiresAt, RotationReminderDays, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @credentialType, @encryptedSecret, @username, @domain, @expiresAt, @rotationReminderDays, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function updateCredential(id: number, input: z.infer<typeof updateCredentialSchema>, userId: number): Promise<void> {
  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, id)
    .query<{ Name: string; Username: string | null; Domain: string | null; ExpiresAt: Date | null; RotationReminderDays: number | null; IsActive: boolean }>(
      "SELECT Name, Username, Domain, ExpiresAt, RotationReminderDays, IsActive FROM RemoteCredentials WHERE Id = @id AND IsDeleted = 0"
    );
  const current = existing.recordset[0];
  if (!current) throw new Error("Credential not found");

  const request = db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, input.name ?? current.Name)
    .input("username", sql.NVarChar, input.username !== undefined ? input.username : current.Username)
    .input("domain", sql.NVarChar, input.domain !== undefined ? input.domain : current.Domain)
    .input("expiresAt", sql.DateTime2, input.expiresAt !== undefined ? input.expiresAt : current.ExpiresAt)
    .input("rotationReminderDays", sql.Int, input.rotationReminderDays !== undefined ? input.rotationReminderDays : current.RotationReminderDays)
    .input("isActive", sql.Bit, input.isActive ?? current.IsActive)
    .input("userId", sql.Int, userId);

  if (input.secret) {
    const encryptedSecret = await encryptSecret(input.secret);
    await request
      .input("encryptedSecret", sql.NVarChar(sql.MAX), encryptedSecret)
      .query(`
        UPDATE RemoteCredentials SET Name=@name, Username=@username, Domain=@domain, ExpiresAt=@expiresAt,
          RotationReminderDays=@rotationReminderDays, IsActive=@isActive, EncryptedSecret=@encryptedSecret,
          LastRotatedAt=SYSUTCDATETIME(), UpdatedByUserId=@userId, UpdatedAt=SYSUTCDATETIME()
        WHERE Id=@id
      `);
  } else {
    await request.query(`
      UPDATE RemoteCredentials SET Name=@name, Username=@username, Domain=@domain, ExpiresAt=@expiresAt,
        RotationReminderDays=@rotationReminderDays, IsActive=@isActive, UpdatedByUserId=@userId, UpdatedAt=SYSUTCDATETIME()
      WHERE Id=@id
    `);
  }
}

// "Mark Rotated" without changing the stored secret - for when rotation happened out-of-band
// (e.g. the password was changed directly on the target and the vault entry updated separately
// via the normal edit-with-a-new-secret flow already covered by updateCredential above). This
// just resets the rotation-due clock.
export async function markCredentialRotated(id: number, userId: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("userId", sql.Int, userId)
    .query("UPDATE RemoteCredentials SET LastRotatedAt = SYSUTCDATETIME(), UpdatedByUserId = @userId, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
}

export async function deleteCredential(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE RemoteCredentials SET IsDeleted = 1, IsActive = 0 WHERE Id = @id");
}

// Only ever called from: (a) the reveal API route, immediately after a fresh password
// re-check, or (b) connectionService.ts to dial a real connection. Never from a plain list/get
// route.
export async function getCredentialSecret(id: number): Promise<{ secret: string; name: string } | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<{ EncryptedSecret: string; Name: string }>(
    "SELECT EncryptedSecret, Name FROM RemoteCredentials WHERE Id = @id AND IsDeleted = 0"
  );
  const row = result.recordset[0];
  if (!row) return null;
  const { decryptSecret } = await import("./crypto");
  return { secret: await decryptSecret(row.EncryptedSecret), name: row.Name };
}

export async function markCredentialAccessed(id: number, userId: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).input("userId", sql.Int, userId).query(
    "UPDATE RemoteCredentials SET LastAccessedAt = SYSUTCDATETIME(), LastAccessedByUserId = @userId WHERE Id = @id"
  );
}

// --- SSH Keys ------------------------------------------------------------------------------

function mapSshKey(r: {
  Id: number;
  Name: string;
  KeyType: string;
  PublicKey: string;
  Fingerprint: string;
  PassphraseCredentialId: number | null;
  ExpiresAt: Date | null;
  LastAccessedAt: Date | null;
  CreatedAt: Date;
}): RemoteSshKey {
  return {
    id: r.Id,
    name: r.Name,
    keyType: r.KeyType as RemoteSshKey["keyType"],
    publicKey: r.PublicKey,
    fingerprint: r.Fingerprint,
    passphraseCredentialId: r.PassphraseCredentialId,
    expiresAt: r.ExpiresAt,
    lastAccessedAt: r.LastAccessedAt,
    createdAt: r.CreatedAt,
  };
}

const SSH_KEY_COLUMNS_NO_PRIVATE = "Id, Name, KeyType, PublicKey, Fingerprint, PassphraseCredentialId, ExpiresAt, LastAccessedAt, CreatedAt";

export async function listSshKeys(): Promise<RemoteSshKey[]> {
  const db = await getDb();
  const result = await db.query<Parameters<typeof mapSshKey>[0]>(`SELECT ${SSH_KEY_COLUMNS_NO_PRIVATE} FROM RemoteSSHKeys WHERE IsDeleted = 0 ORDER BY Name ASC`);
  return result.recordset.map(mapSshKey);
}

export async function createSshKeyRecord(opts: {
  name: string;
  keyType: "Ed25519" | "Rsa";
  publicKey: string;
  privateKeyPem: string;
  fingerprint: string;
  passphraseCredentialId: number | null;
  userId: number;
}): Promise<number> {
  const encryptedPrivateKey = await encryptSecret(opts.privateKeyPem);
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, opts.name)
    .input("keyType", sql.VarChar, opts.keyType)
    .input("publicKey", sql.NVarChar(sql.MAX), opts.publicKey)
    .input("encryptedPrivateKey", sql.NVarChar(sql.MAX), encryptedPrivateKey)
    .input("fingerprint", sql.VarChar, opts.fingerprint)
    .input("passphraseCredentialId", sql.Int, opts.passphraseCredentialId)
    .input("userId", sql.Int, opts.userId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteSSHKeys (Name, KeyType, PublicKey, EncryptedPrivateKey, Fingerprint, PassphraseCredentialId, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @keyType, @publicKey, @encryptedPrivateKey, @fingerprint, @passphraseCredentialId, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function deleteSshKey(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE RemoteSSHKeys SET IsDeleted = 1, IsActive = 0 WHERE Id = @id");
}

export async function getSshPrivateKey(id: number): Promise<{ privateKeyPem: string; name: string } | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<{ EncryptedPrivateKey: string; Name: string }>(
    "SELECT EncryptedPrivateKey, Name FROM RemoteSSHKeys WHERE Id = @id AND IsDeleted = 0"
  );
  const row = result.recordset[0];
  if (!row) return null;
  const { decryptSecret } = await import("./crypto");
  return { privateKeyPem: await decryptSecret(row.EncryptedPrivateKey), name: row.Name };
}

export async function markSshKeyAccessed(id: number, userId: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).input("userId", sql.Int, userId).query(
    "UPDATE RemoteSSHKeys SET LastAccessedAt = SYSUTCDATETIME(), LastAccessedByUserId = @userId WHERE Id = @id"
  );
}

// --- Inventory -------------------------------------------------------------------------------

function mapInventoryDevice(r: {
  Id: number;
  LinkedDeviceId: string | null;
  LinkedConnectionId: number | null;
  DeviceName: string;
  Hostname: string | null;
  IpAddress: string | null;
  MacAddress: string | null;
  OperatingSystem: string | null;
  OsVersion: string | null;
  DeviceTypeCategory: string | null;
  Cpu: string | null;
  Memory: string | null;
  Disk: string | null;
  Environment: string | null;
  Customer: string | null;
  Owner: string | null;
  Location: string | null;
  AssetNumber: string | null;
  SerialNumber: string | null;
  AvailableProtocolsJson: string | null;
  OpenManagementPortsJson: string | null;
  MonitoringStatus: string | null;
  AvailabilityStatus: string;
  LastConnectionAt: Date | null;
  Tags: string | null;
  Notes: string | null;
}): RemoteInventoryDevice {
  return {
    id: r.Id,
    linkedDeviceId: r.LinkedDeviceId,
    linkedConnectionId: r.LinkedConnectionId,
    deviceName: r.DeviceName,
    hostname: r.Hostname,
    ipAddress: r.IpAddress,
    macAddress: r.MacAddress,
    operatingSystem: r.OperatingSystem,
    osVersion: r.OsVersion,
    deviceTypeCategory: r.DeviceTypeCategory as RemoteInventoryDevice["deviceTypeCategory"],
    cpu: r.Cpu,
    memory: r.Memory,
    disk: r.Disk,
    environment: r.Environment,
    customer: r.Customer,
    owner: r.Owner,
    location: r.Location,
    assetNumber: r.AssetNumber,
    serialNumber: r.SerialNumber,
    availableProtocols: r.AvailableProtocolsJson ? JSON.parse(r.AvailableProtocolsJson) : [],
    openManagementPorts: r.OpenManagementPortsJson ? JSON.parse(r.OpenManagementPortsJson) : [],
    monitoringStatus: r.MonitoringStatus,
    availabilityStatus: r.AvailabilityStatus as AvailabilityStatus,
    lastConnectionAt: r.LastConnectionAt,
    tags: r.Tags ? r.Tags.split(",").filter(Boolean) : [],
    notes: r.Notes,
  };
}

const INVENTORY_COLUMNS = `Id, LinkedDeviceId, LinkedConnectionId, DeviceName, Hostname, IpAddress, MacAddress, OperatingSystem,
  OsVersion, DeviceTypeCategory, Cpu, Memory, Disk, Environment, Customer, Owner, Location, AssetNumber, SerialNumber,
  AvailableProtocolsJson, OpenManagementPortsJson, MonitoringStatus, AvailabilityStatus, LastConnectionAt, Tags, Notes`;

export async function listInventoryDevices(): Promise<RemoteInventoryDevice[]> {
  const db = await getDb();
  const result = await db.query<Parameters<typeof mapInventoryDevice>[0]>(
    `SELECT ${INVENTORY_COLUMNS} FROM RemoteInventoryDevices WHERE IsDeleted = 0 ORDER BY DeviceName ASC`
  );
  return result.recordset.map(mapInventoryDevice);
}

export async function getInventoryDevice(id: number): Promise<RemoteInventoryDevice | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<Parameters<typeof mapInventoryDevice>[0]>(`SELECT ${INVENTORY_COLUMNS} FROM RemoteInventoryDevices WHERE Id = @id AND IsDeleted = 0`);
  const row = result.recordset[0];
  return row ? mapInventoryDevice(row) : null;
}

export async function createInventoryDevice(input: z.infer<typeof createInventoryDeviceSchema>, userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("linkedDeviceId", sql.VarChar, input.linkedDeviceId ?? null)
    .input("linkedConnectionId", sql.Int, input.linkedConnectionId ?? null)
    .input("deviceName", sql.NVarChar, input.deviceName)
    .input("hostname", sql.NVarChar, input.hostname ?? null)
    .input("ipAddress", sql.VarChar, input.ipAddress ?? null)
    .input("macAddress", sql.VarChar, input.macAddress ?? null)
    .input("operatingSystem", sql.VarChar, input.operatingSystem ?? null)
    .input("osVersion", sql.NVarChar, input.osVersion ?? null)
    .input("deviceTypeCategory", sql.VarChar, input.deviceTypeCategory ?? null)
    .input("cpu", sql.NVarChar, input.cpu ?? null)
    .input("memory", sql.NVarChar, input.memory ?? null)
    .input("disk", sql.NVarChar, input.disk ?? null)
    .input("environment", sql.VarChar, input.environment ?? null)
    .input("customer", sql.NVarChar, input.customer ?? null)
    .input("owner", sql.NVarChar, input.owner ?? null)
    .input("location", sql.NVarChar, input.location ?? null)
    .input("assetNumber", sql.NVarChar, input.assetNumber ?? null)
    .input("serialNumber", sql.NVarChar, input.serialNumber ?? null)
    .input("tags", sql.NVarChar, input.tags.join(","))
    .input("notes", sql.NVarChar, input.notes ?? null)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteInventoryDevices
        (LinkedDeviceId, LinkedConnectionId, DeviceName, Hostname, IpAddress, MacAddress, OperatingSystem, OsVersion,
         DeviceTypeCategory, Cpu, Memory, Disk, Environment, Customer, Owner, Location, AssetNumber, SerialNumber,
         Tags, Notes, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES
        (@linkedDeviceId, @linkedConnectionId, @deviceName, @hostname, @ipAddress, @macAddress, @operatingSystem, @osVersion,
         @deviceTypeCategory, @cpu, @memory, @disk, @environment, @customer, @owner, @location, @assetNumber, @serialNumber,
         @tags, @notes, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function updateInventoryDevice(id: number, input: z.infer<typeof updateInventoryDeviceSchema>, userId: number): Promise<void> {
  const existing = await getInventoryDevice(id);
  if (!existing) throw new Error("Inventory device not found");

  const merged = { ...existing, ...input, tags: input.tags ?? existing.tags };
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("deviceName", sql.NVarChar, merged.deviceName)
    .input("hostname", sql.NVarChar, merged.hostname)
    .input("ipAddress", sql.VarChar, merged.ipAddress)
    .input("macAddress", sql.VarChar, merged.macAddress)
    .input("operatingSystem", sql.VarChar, merged.operatingSystem)
    .input("osVersion", sql.NVarChar, merged.osVersion)
    .input("deviceTypeCategory", sql.VarChar, merged.deviceTypeCategory)
    .input("cpu", sql.NVarChar, merged.cpu)
    .input("memory", sql.NVarChar, merged.memory)
    .input("disk", sql.NVarChar, merged.disk)
    .input("environment", sql.VarChar, merged.environment)
    .input("customer", sql.NVarChar, merged.customer)
    .input("owner", sql.NVarChar, merged.owner)
    .input("location", sql.NVarChar, merged.location)
    .input("assetNumber", sql.NVarChar, merged.assetNumber)
    .input("serialNumber", sql.NVarChar, merged.serialNumber)
    .input("tags", sql.NVarChar, merged.tags.join(","))
    .input("notes", sql.NVarChar, merged.notes)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE RemoteInventoryDevices SET
        DeviceName=@deviceName, Hostname=@hostname, IpAddress=@ipAddress, MacAddress=@macAddress,
        OperatingSystem=@operatingSystem, OsVersion=@osVersion, DeviceTypeCategory=@deviceTypeCategory,
        Cpu=@cpu, Memory=@memory, Disk=@disk, Environment=@environment, Customer=@customer, Owner=@owner,
        Location=@location, AssetNumber=@assetNumber, SerialNumber=@serialNumber, Tags=@tags, Notes=@notes,
        UpdatedByUserId=@userId, UpdatedAt=SYSUTCDATETIME()
      WHERE Id=@id
    `);
}

export async function deleteInventoryDevice(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE RemoteInventoryDevices SET IsDeleted = 1 WHERE Id = @id");
}

// --- Port Forwards (Phase 2) -------------------------------------------------------------------

export interface RemotePortForward {
  id: number;
  connectionId: number;
  forwardType: "Local" | "Remote" | "Dynamic";
  localPort: number;
  remoteHost: string | null;
  remotePort: number | null;
  status: "Active" | "Stopped" | "Failed";
  errorMessage: string | null;
  startedAt: Date | null;
  stoppedAt: Date | null;
}

function mapPortForward(r: {
  Id: number;
  ConnectionId: number;
  ForwardType: string;
  LocalPort: number;
  RemoteHost: string | null;
  RemotePort: number | null;
  Status: string;
  ErrorMessage: string | null;
  StartedAt: Date | null;
  StoppedAt: Date | null;
}): RemotePortForward {
  return {
    id: r.Id,
    connectionId: r.ConnectionId,
    forwardType: r.ForwardType as RemotePortForward["forwardType"],
    localPort: r.LocalPort,
    remoteHost: r.RemoteHost,
    remotePort: r.RemotePort,
    status: r.Status as RemotePortForward["status"],
    errorMessage: r.ErrorMessage,
    startedAt: r.StartedAt,
    stoppedAt: r.StoppedAt,
  };
}

const PORT_FORWARD_COLUMNS = "Id, ConnectionId, ForwardType, LocalPort, RemoteHost, RemotePort, Status, ErrorMessage, StartedAt, StoppedAt";

export async function listPortForwards(connectionId?: number): Promise<RemotePortForward[]> {
  const db = await getDb();
  const request = db.request();
  const conditions = ["IsDeleted = 0"];
  if (connectionId) {
    request.input("connectionId", sql.Int, connectionId);
    conditions.push("ConnectionId = @connectionId");
  }
  const result = await request.query<Parameters<typeof mapPortForward>[0]>(
    `SELECT ${PORT_FORWARD_COLUMNS} FROM RemotePortForwards WHERE ${conditions.join(" AND ")} ORDER BY Id DESC`
  );
  return result.recordset.map(mapPortForward);
}

export async function createPortForward(input: z.infer<typeof createPortForwardSchema>, userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("connectionId", sql.Int, input.connectionId)
    .input("forwardType", sql.VarChar, input.forwardType)
    .input("localPort", sql.Int, input.localPort)
    .input("remoteHost", sql.NVarChar, input.remoteHost ?? null)
    .input("remotePort", sql.Int, input.remotePort ?? null)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO RemotePortForwards (ConnectionId, ForwardType, LocalPort, RemoteHost, RemotePort, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@connectionId, @forwardType, @localPort, @remoteHost, @remotePort, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function deletePortForward(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE RemotePortForwards SET IsDeleted = 1, IsActive = 0 WHERE Id = @id");
}

// --- Session recording (Phase 3) ----------------------------------------------------------------
// RemoteSessionLogs rows are written directly by connectionService.ts as a session's I/O
// happens (see persistSessionLog there) - these are read-only playback accessors.

export interface RemoteSessionSummary {
  id: number;
  connectionId: number | null;
  connectionName: string | null;
  sessionType: string;
  protocol: string;
  targetHost: string;
  startedByUserId: number;
  startedByUsername: string | null;
  startedAt: Date;
  endedAt: Date | null;
  status: string;
  recordingStatus: string;
}

export async function getSessionSummary(sessionId: number): Promise<RemoteSessionSummary | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, sessionId).query<{
    Id: number;
    ConnectionId: number | null;
    ConnectionName: string | null;
    SessionType: string;
    Protocol: string;
    TargetHost: string;
    StartedByUserId: number;
    StartedByUsername: string | null;
    StartedAt: Date;
    EndedAt: Date | null;
    Status: string;
    RecordingStatus: string;
  }>(`
    SELECT s.Id, s.ConnectionId, c.Name AS ConnectionName, s.SessionType, s.Protocol, s.TargetHost,
      s.StartedByUserId, s.StartedByUsername, s.StartedAt, s.EndedAt, s.Status, s.RecordingStatus
    FROM RemoteSessions s LEFT JOIN RemoteConnections c ON c.Id = s.ConnectionId
    WHERE s.Id = @id
  `);
  const row = result.recordset[0];
  if (!row) return null;
  return {
    id: row.Id,
    connectionId: row.ConnectionId,
    connectionName: row.ConnectionName,
    sessionType: row.SessionType,
    protocol: row.Protocol,
    targetHost: row.TargetHost,
    startedByUserId: row.StartedByUserId,
    startedByUsername: row.StartedByUsername,
    startedAt: row.StartedAt,
    endedAt: row.EndedAt,
    status: row.Status,
    recordingStatus: row.RecordingStatus,
  };
}

export async function getSessionTranscript(sessionId: number): Promise<{ direction: "Input" | "Output"; content: string; loggedAt: Date }[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("sessionId", sql.Int, sessionId)
    .query<{ Direction: string; Content: string; LoggedAt: Date }>(
      "SELECT Direction, Content, LoggedAt FROM RemoteSessionLogs WHERE SessionId = @sessionId ORDER BY Sequence ASC"
    );
  return result.recordset.map((r) => ({ direction: r.Direction as "Input" | "Output", content: r.Content, loggedAt: r.LoggedAt }));
}

// --- Scripts & Commands (Phase 2) ---------------------------------------------------------------

export interface RemoteScript {
  id: number;
  name: string;
  description: string | null;
  scriptType: string;
  body: string;
  targetOsFamily: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapScript(r: { Id: number; Name: string; Description: string | null; ScriptType: string; Body: string; TargetOsFamily: string | null; CreatedAt: Date; UpdatedAt: Date }): RemoteScript {
  return {
    id: r.Id,
    name: r.Name,
    description: r.Description,
    scriptType: r.ScriptType,
    body: r.Body,
    targetOsFamily: r.TargetOsFamily,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
  };
}

const SCRIPT_COLUMNS = "Id, Name, Description, ScriptType, Body, TargetOsFamily, CreatedAt, UpdatedAt";

export async function listScripts(): Promise<RemoteScript[]> {
  const db = await getDb();
  const result = await db.query<Parameters<typeof mapScript>[0]>(`SELECT ${SCRIPT_COLUMNS} FROM RemoteScripts WHERE IsDeleted = 0 ORDER BY Name ASC`);
  return result.recordset.map(mapScript);
}

export async function getScript(id: number): Promise<RemoteScript | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<Parameters<typeof mapScript>[0]>(`SELECT ${SCRIPT_COLUMNS} FROM RemoteScripts WHERE Id = @id AND IsDeleted = 0`);
  const row = result.recordset[0];
  return row ? mapScript(row) : null;
}

export async function createScript(input: z.infer<typeof createScriptSchema>, userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, input.name)
    .input("description", sql.NVarChar, input.description ?? null)
    .input("scriptType", sql.VarChar, input.scriptType)
    .input("body", sql.NVarChar(sql.MAX), input.body)
    .input("targetOsFamily", sql.VarChar, input.targetOsFamily ?? null)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteScripts (Name, Description, ScriptType, Body, TargetOsFamily, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @description, @scriptType, @body, @targetOsFamily, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function updateScript(id: number, input: z.infer<typeof updateScriptSchema>, userId: number): Promise<void> {
  const existing = await getScript(id);
  if (!existing) throw new Error("Script not found");
  const merged = { ...existing, ...input };
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, merged.name)
    .input("description", sql.NVarChar, merged.description)
    .input("scriptType", sql.VarChar, merged.scriptType)
    .input("body", sql.NVarChar(sql.MAX), merged.body)
    .input("targetOsFamily", sql.VarChar, merged.targetOsFamily)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE RemoteScripts SET Name=@name, Description=@description, ScriptType=@scriptType, Body=@body,
        TargetOsFamily=@targetOsFamily, UpdatedByUserId=@userId, UpdatedAt=SYSUTCDATETIME()
      WHERE Id=@id
    `);
}

export async function deleteScript(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE RemoteScripts SET IsDeleted = 1, IsActive = 0 WHERE Id = @id");
}

export interface RemoteScriptExecution {
  id: number;
  scriptId: number;
  connectionId: number;
  batchId: string | null;
  executedByUserId: number;
  startedAt: Date;
  endedAt: Date | null;
  status: "Running" | "Completed" | "Failed";
  exitCode: number | null;
  output: string | null;
  errorMessage: string | null;
}

function mapScriptExecution(r: {
  Id: number;
  ScriptId: number;
  ConnectionId: number;
  BatchId: string | null;
  ExecutedByUserId: number;
  StartedAt: Date;
  EndedAt: Date | null;
  Status: string;
  ExitCode: number | null;
  Output: string | null;
  ErrorMessage: string | null;
}): RemoteScriptExecution {
  return {
    id: r.Id,
    scriptId: r.ScriptId,
    connectionId: r.ConnectionId,
    batchId: r.BatchId,
    executedByUserId: r.ExecutedByUserId,
    startedAt: r.StartedAt,
    endedAt: r.EndedAt,
    status: r.Status as RemoteScriptExecution["status"],
    exitCode: r.ExitCode,
    output: r.Output,
    errorMessage: r.ErrorMessage,
  };
}

const SCRIPT_EXECUTION_COLUMNS = "Id, ScriptId, ConnectionId, BatchId, ExecutedByUserId, StartedAt, EndedAt, Status, ExitCode, Output, ErrorMessage";

export async function createScriptExecution(scriptId: number, connectionId: number, batchId: string | null, userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("scriptId", sql.Int, scriptId)
    .input("connectionId", sql.Int, connectionId)
    .input("batchId", sql.UniqueIdentifier, batchId)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteScriptExecutions (ScriptId, ConnectionId, BatchId, ExecutedByUserId, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@scriptId, @connectionId, @batchId, @userId, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function completeScriptExecution(id: number, result: { status: "Completed" | "Failed"; exitCode: number | null; output: string; errorMessage: string | null }): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("status", sql.VarChar, result.status)
    .input("exitCode", sql.Int, result.exitCode)
    .input("output", sql.NVarChar(sql.MAX), result.output)
    .input("errorMessage", sql.NVarChar, result.errorMessage)
    .query(`
      UPDATE RemoteScriptExecutions SET Status=@status, ExitCode=@exitCode, Output=@output, ErrorMessage=@errorMessage, EndedAt=SYSUTCDATETIME()
      WHERE Id=@id
    `);
}

export async function listScriptExecutions(opts: { scriptId?: number; batchId?: string } = {}): Promise<RemoteScriptExecution[]> {
  const db = await getDb();
  const request = db.request();
  const conditions = ["IsDeleted = 0"];
  if (opts.scriptId) {
    request.input("scriptId", sql.Int, opts.scriptId);
    conditions.push("ScriptId = @scriptId");
  }
  if (opts.batchId) {
    request.input("batchId", sql.UniqueIdentifier, opts.batchId);
    conditions.push("BatchId = @batchId");
  }
  const result = await request.query<Parameters<typeof mapScriptExecution>[0]>(
    `SELECT TOP (200) ${SCRIPT_EXECUTION_COLUMNS} FROM RemoteScriptExecutions WHERE ${conditions.join(" AND ")} ORDER BY Id DESC`
  );
  return result.recordset.map(mapScriptExecution);
}

// --- Protocol Diagnostics (Phase 2 - SCTP connectivity testing only) ---------------------------

export interface RemoteProtocolDiagnostic {
  id: number;
  protocol: string;
  host: string;
  port: number | null;
  status: "Reachable" | "Unreachable" | "NotSupported";
  method: string | null;
  message: string | null;
  ranAt: Date;
}

function mapProtocolDiagnostic(r: { Id: number; Protocol: string; Host: string; Port: number | null; Status: string; Method: string | null; Message: string | null; RanAt: Date }): RemoteProtocolDiagnostic {
  return { id: r.Id, protocol: r.Protocol, host: r.Host, port: r.Port, status: r.Status as RemoteProtocolDiagnostic["status"], method: r.Method, message: r.Message, ranAt: r.RanAt };
}

export async function createProtocolDiagnostic(input: {
  protocol: string;
  host: string;
  port: number | null;
  status: "Reachable" | "Unreachable" | "NotSupported";
  method: string | null;
  message: string | null;
  ranByUserId: number;
}): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("protocol", sql.VarChar, input.protocol)
    .input("host", sql.NVarChar, input.host)
    .input("port", sql.Int, input.port)
    .input("status", sql.VarChar, input.status)
    .input("method", sql.VarChar, input.method)
    .input("message", sql.NVarChar, input.message)
    .input("userId", sql.Int, input.ranByUserId)
    .query<{ Id: number }>(`
      INSERT INTO RemoteProtocolDiagnostics (Protocol, Host, Port, Status, Method, Message, RanByUserId)
      OUTPUT INSERTED.Id
      VALUES (@protocol, @host, @port, @status, @method, @message, @userId)
    `);
  return result.recordset[0].Id;
}

export async function listProtocolDiagnostics(limit = 50): Promise<RemoteProtocolDiagnostic[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("limit", sql.Int, limit)
    .query<Parameters<typeof mapProtocolDiagnostic>[0]>("SELECT TOP (@limit) Id, Protocol, Host, Port, Status, Method, Message, RanAt FROM RemoteProtocolDiagnostics ORDER BY RanAt DESC");
  return result.recordset.map(mapProtocolDiagnostic);
}

// --- Approval requests (Phase 3) ----------------------------------------------------------------
// A generic queue - Phase 3 wires exactly one gate into it (bulk script execution above the
// configured threshold, see scriptExecutionService.ts and the scripts/[id]/execute route), left
// documented as the pattern a second sensitive action could reuse later without a bespoke table.

export interface RemoteApprovalRequest {
  id: number;
  actionType: string;
  payload: string;
  summary: string;
  requestedByUserId: number;
  requestedByUsername: string;
  status: "Pending" | "Approved" | "Rejected";
  reviewedByUserId: number | null;
  reviewedByUsername: string | null;
  reviewNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
}

function mapApprovalRequest(r: {
  Id: number;
  ActionType: string;
  Payload: string;
  Summary: string;
  RequestedByUserId: number;
  RequestedByUsername: string;
  Status: string;
  ReviewedByUserId: number | null;
  ReviewedByUsername: string | null;
  ReviewNote: string | null;
  CreatedAt: Date;
  ReviewedAt: Date | null;
}): RemoteApprovalRequest {
  return {
    id: r.Id,
    actionType: r.ActionType,
    payload: r.Payload,
    summary: r.Summary,
    requestedByUserId: r.RequestedByUserId,
    requestedByUsername: r.RequestedByUsername,
    status: r.Status as RemoteApprovalRequest["status"],
    reviewedByUserId: r.ReviewedByUserId,
    reviewedByUsername: r.ReviewedByUsername,
    reviewNote: r.ReviewNote,
    createdAt: r.CreatedAt,
    reviewedAt: r.ReviewedAt,
  };
}

const APPROVAL_COLUMNS =
  "Id, ActionType, Payload, Summary, RequestedByUserId, RequestedByUsername, Status, ReviewedByUserId, ReviewedByUsername, ReviewNote, CreatedAt, ReviewedAt";

export async function createApprovalRequest(actionType: string, payload: unknown, summary: string, userId: number, username: string): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("actionType", sql.VarChar, actionType)
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(payload))
    .input("summary", sql.NVarChar, summary)
    .input("userId", sql.Int, userId)
    .input("username", sql.NVarChar, username)
    .query<{ Id: number }>(`
      INSERT INTO RemoteApprovalRequests (ActionType, Payload, Summary, RequestedByUserId, RequestedByUsername)
      OUTPUT INSERTED.Id
      VALUES (@actionType, @payload, @summary, @userId, @username)
    `);
  return result.recordset[0].Id;
}

export async function getApprovalRequest(id: number): Promise<RemoteApprovalRequest | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<Parameters<typeof mapApprovalRequest>[0]>(`SELECT ${APPROVAL_COLUMNS} FROM RemoteApprovalRequests WHERE Id = @id`);
  const row = result.recordset[0];
  return row ? mapApprovalRequest(row) : null;
}

export async function listApprovalRequests(status?: string): Promise<RemoteApprovalRequest[]> {
  const db = await getDb();
  const request = db.request();
  let where = "";
  if (status) {
    request.input("status", sql.VarChar, status);
    where = "WHERE Status = @status";
  }
  const result = await request.query<Parameters<typeof mapApprovalRequest>[0]>(`SELECT ${APPROVAL_COLUMNS} FROM RemoteApprovalRequests ${where} ORDER BY Id DESC`);
  return result.recordset.map(mapApprovalRequest);
}

export async function reviewApprovalRequest(id: number, status: "Approved" | "Rejected", reviewerId: number, reviewerUsername: string, note: string | null): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("status", sql.VarChar, status)
    .input("reviewerId", sql.Int, reviewerId)
    .input("reviewerUsername", sql.NVarChar, reviewerUsername)
    .input("note", sql.NVarChar, note)
    .query(`
      UPDATE RemoteApprovalRequests SET Status=@status, ReviewedByUserId=@reviewerId, ReviewedByUsername=@reviewerUsername,
        ReviewNote=@note, ReviewedAt=SYSUTCDATETIME()
      WHERE Id=@id AND Status='Pending'
    `);
}

// --- Settings ----------------------------------------------------------------------------------

export async function getSettings(): Promise<{
  vaultLockAfterMinutes: number;
  defaultConnectionTimeoutSeconds: number;
  defaultKeepaliveIntervalSeconds: number;
  connectionCheckIntervalMinutes: number;
  notifyOnConnectionOfflineContactIds: string | null;
  requireApprovalForBulkExecution: boolean;
  bulkExecutionApprovalThreshold: number;
}> {
  const db = await getDb();
  const result = await db.query<{
    VaultLockAfterMinutes: number;
    DefaultConnectionTimeoutSeconds: number;
    DefaultKeepaliveIntervalSeconds: number;
    ConnectionCheckIntervalMinutes: number;
    NotifyOnConnectionOfflineContactIds: string | null;
    RequireApprovalForBulkExecution: boolean;
    BulkExecutionApprovalThreshold: number;
  }>(
    "SELECT VaultLockAfterMinutes, DefaultConnectionTimeoutSeconds, DefaultKeepaliveIntervalSeconds, ConnectionCheckIntervalMinutes, NotifyOnConnectionOfflineContactIds, RequireApprovalForBulkExecution, BulkExecutionApprovalThreshold FROM RemoteAccessSettings WHERE Id = 1"
  );
  const row = result.recordset[0];
  return {
    vaultLockAfterMinutes: row?.VaultLockAfterMinutes ?? 15,
    defaultConnectionTimeoutSeconds: row?.DefaultConnectionTimeoutSeconds ?? 15,
    defaultKeepaliveIntervalSeconds: row?.DefaultKeepaliveIntervalSeconds ?? 30,
    connectionCheckIntervalMinutes: row?.ConnectionCheckIntervalMinutes ?? 5,
    notifyOnConnectionOfflineContactIds: row?.NotifyOnConnectionOfflineContactIds ?? null,
    requireApprovalForBulkExecution: row?.RequireApprovalForBulkExecution ?? false,
    bulkExecutionApprovalThreshold: row?.BulkExecutionApprovalThreshold ?? 5,
  };
}

export async function updateSettings(
  input: {
    vaultLockAfterMinutes?: number;
    defaultConnectionTimeoutSeconds?: number;
    defaultKeepaliveIntervalSeconds?: number;
    connectionCheckIntervalMinutes?: number;
    notifyOnConnectionOfflineContactIds?: string | null;
    requireApprovalForBulkExecution?: boolean;
    bulkExecutionApprovalThreshold?: number;
  },
  userId: number
): Promise<void> {
  const current = await getSettings();
  const db = await getDb();
  await db
    .request()
    .input("vaultLockAfterMinutes", sql.Int, input.vaultLockAfterMinutes ?? current.vaultLockAfterMinutes)
    .input("defaultConnectionTimeoutSeconds", sql.Int, input.defaultConnectionTimeoutSeconds ?? current.defaultConnectionTimeoutSeconds)
    .input("defaultKeepaliveIntervalSeconds", sql.Int, input.defaultKeepaliveIntervalSeconds ?? current.defaultKeepaliveIntervalSeconds)
    .input("connectionCheckIntervalMinutes", sql.Int, input.connectionCheckIntervalMinutes ?? current.connectionCheckIntervalMinutes)
    .input("notifyOnConnectionOfflineContactIds", sql.NVarChar, input.notifyOnConnectionOfflineContactIds !== undefined ? input.notifyOnConnectionOfflineContactIds : current.notifyOnConnectionOfflineContactIds)
    .input("requireApprovalForBulkExecution", sql.Bit, input.requireApprovalForBulkExecution ?? current.requireApprovalForBulkExecution)
    .input("bulkExecutionApprovalThreshold", sql.Int, input.bulkExecutionApprovalThreshold ?? current.bulkExecutionApprovalThreshold)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE RemoteAccessSettings SET VaultLockAfterMinutes=@vaultLockAfterMinutes,
        DefaultConnectionTimeoutSeconds=@defaultConnectionTimeoutSeconds,
        DefaultKeepaliveIntervalSeconds=@defaultKeepaliveIntervalSeconds,
        ConnectionCheckIntervalMinutes=@connectionCheckIntervalMinutes,
        NotifyOnConnectionOfflineContactIds=@notifyOnConnectionOfflineContactIds,
        RequireApprovalForBulkExecution=@requireApprovalForBulkExecution,
        BulkExecutionApprovalThreshold=@bulkExecutionApprovalThreshold,
        UpdatedByUserId=@userId, UpdatedAt=SYSUTCDATETIME()
      WHERE Id = 1
    `);
}

import "dotenv/config";
import { getDb } from "../src/lib/db";

// Phase 2: API Monitors. Mirrors WebsiteMonitorConfigs's MonitorId-PK-as-FK shape (one row per
// Monitors row with MonitorType='Api', already a valid value per the original Phase 1 CHECK
// constraint - no change needed there). AuthConfigEncrypted stores the whole auth secret blob
// (API key value / bearer token / basic auth password / OAuth2 client secret) as one AES-256-GCM
// ciphertext - see src/lib/websiteApiMonitoring/apiCredentials.ts - never the raw secret.
// CachedOAuthTokenEncrypted/CachedOAuthTokenExpiresAt persist the OAuth2 client-credentials
// token across scheduled-scan runs (each a separate `tsx` process, so an in-memory cache alone
// would never survive between checks).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ApiMonitorConfigs' AND xtype='U')
    CREATE TABLE ApiMonitorConfigs (
      MonitorId INT PRIMARY KEY REFERENCES Monitors(Id) ON DELETE CASCADE,
      Url NVARCHAR(2000) NOT NULL,
      HttpMethod VARCHAR(10) NOT NULL DEFAULT 'GET',
      HeadersJson NVARCHAR(MAX) NULL,
      QueryParamsJson NVARCHAR(MAX) NULL,
      RequestBody NVARCHAR(MAX) NULL,
      RequestBodyContentType VARCHAR(100) NULL,
      AuthType VARCHAR(30) NOT NULL DEFAULT 'None',
      AuthConfigEncrypted NVARCHAR(MAX) NULL,
      CachedOAuthTokenEncrypted NVARCHAR(MAX) NULL,
      CachedOAuthTokenExpiresAt DATETIME2 NULL,
      ExpectedStatusCode INT NOT NULL DEFAULT 200,
      FollowRedirects BIT NOT NULL DEFAULT 1,
      MaxRedirects INT NOT NULL DEFAULT 5,
      SslVerify BIT NOT NULL DEFAULT 1,
      AssertionsJson NVARCHAR(MAX) NULL,
      ResponseTimeWarningMs INT NOT NULL DEFAULT 1000,
      ResponseTimeCriticalMs INT NOT NULL DEFAULT 3000,
      AlertEmail NVARCHAR(1000) NULL,
      CONSTRAINT CK_ApiMonitorConfigs_AuthType CHECK (AuthType IN ('None','ApiKey','BearerToken','BasicAuth','OAuth2ClientCredentials'))
    )
  `;

  // Assertion results (JSONPath-style checks against the response body) are this module's
  // equivalent of Website Monitoring's ContentCheckResultJson - never the body itself, only
  // which assertions passed/failed and why.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('MonitorResults') AND name = 'AssertionResultsJson')
    ALTER TABLE MonitorResults ADD AssertionResultsJson NVARCHAR(MAX) NULL
  `;

  console.log("ApiMonitorConfigs table + MonitorResults.AssertionResultsJson column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

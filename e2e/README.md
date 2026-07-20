# QA module E2E suite

Runs against the live deployed app — this project has no separate staging environment.
Every row the suite creates is prefixed `__qa_e2e__`. Auth and cleanup are both deliberately
**ephemeral, not standing infrastructure** — nothing from this process should be left behind
between runs:

- The bot user is `QA Manager` role (not `Admin`), so even for the short window it exists it
  can only reach `/api/admin/qa/**`, nothing else in the app.
- `scripts/_mint-e2e-jwt.ts` is a one-off, never committed to source control — deleted from
  the server immediately after it prints a token.
- The bot user itself is deleted at the end of each run, not left standing for reuse. Re-run
  `migrate:qa-e2e-test-user` fresh each time you need to run the suite.

## Running (one full cycle)

1. Seed the bot user:
   ```
   npm run migrate:qa-e2e-test-user
   ```
2. Mint a session token for it (run on the server, where `NEXTAUTH_SECRET` and DB credentials
   live), then delete the minting script immediately:
   ```
   npx tsx scripts/_mint-e2e-jwt.ts
   rm scripts/_mint-e2e-jwt.ts
   ```
3. Run the suite with that token, against the live app:
   ```
   QA_E2E_SESSION_TOKEN=<token> npm run test:e2e
   ```
4. Sweep any `__qa_e2e__`-tagged rows left behind (the suite can archive/edit through the UI,
   but can't hard-delete a Project through it):
   ```
   npx tsx scripts/_sweep-e2e-data.ts
   rm scripts/_sweep-e2e-data.ts
   ```
5. Delete the bot user:
   ```sql
   DELETE FROM Users WHERE Username = 'qa-e2e-test-bot';
   ```

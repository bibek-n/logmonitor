import { describe, it, expect } from "vitest";
import { analyzeCsrf } from "./csrf";
import { makeSourceFile } from "./testHelpers";

describe("analyzeCsrf", () => {
  it("flags a POST form missing @csrf", () => {
    const file = makeSourceFile("resources/views/form.blade.php", `<form method="POST" action="/save">\n  <input name="x">\n</form>\n`);
    const { issues } = analyzeCsrf([file]);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("csrf.missing-token-in-form");
  });

  it("does not flag a POST form that includes @csrf", () => {
    const file = makeSourceFile("resources/views/form.blade.php", `<form method="POST" action="/save">\n  @csrf\n  <input name="x">\n</form>\n`);
    const { issues } = analyzeCsrf([file]);
    expect(issues).toHaveLength(0);
  });

  it("does not flag a GET form", () => {
    const file = makeSourceFile("resources/views/form.blade.php", `<form method="GET" action="/search">\n  <input name="q">\n</form>\n`);
    const { issues } = analyzeCsrf([file]);
    expect(issues).toHaveLength(0);
  });

  it("flags a non-empty VerifyCsrfToken::$except array", () => {
    const file = makeSourceFile("app/Http/Middleware/VerifyCsrfToken.php", `<?php\nclass VerifyCsrfToken extends Middleware {\n  protected $except = [\n    'webhook/*',\n  ];\n}\n`);
    const { issues } = analyzeCsrf([file]);
    expect(issues.some((i) => i.ruleCode === "csrf.route-excluded")).toBe(true);
  });

  it("does not flag an empty $except array", () => {
    const file = makeSourceFile("app/Http/Middleware/VerifyCsrfToken.php", `<?php\nclass VerifyCsrfToken extends Middleware {\n  protected $except = [];\n}\n`);
    const { issues } = analyzeCsrf([file]);
    expect(issues).toHaveLength(0);
  });
});

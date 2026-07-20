import { describe, it, expect } from "vitest";
import { analyzeValidation } from "./validation";
import { makeSourceFile } from "./testHelpers";

describe("analyzeValidation", () => {
  it("flags a controller method reading input with no validation", () => {
    const file = makeSourceFile(
      "app/Http/Controllers/PostController.php",
      `<?php\nclass PostController {\n  public function store(Request $request) {\n    $title = $request->input('title');\n    Post::create(['title' => $title]);\n  }\n}\n`
    );
    const { issues } = analyzeValidation([file]);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("validation.controller-missing");
  });

  it("does not flag a method that calls ->validate()", () => {
    const file = makeSourceFile(
      "app/Http/Controllers/PostController.php",
      `<?php\nclass PostController {\n  public function store(Request $request) {\n    $data = $request->validate(['title' => 'required']);\n    Post::create($data);\n  }\n}\n`
    );
    const { issues } = analyzeValidation([file]);
    expect(issues).toHaveLength(0);
  });

  it("does not flag a method type-hinted with a Form Request", () => {
    const file = makeSourceFile(
      "app/Http/Controllers/PostController.php",
      `<?php\nclass PostController {\n  public function store(StorePostRequest $request) {\n    Post::create($request->input('title'));\n  }\n}\n`
    );
    const { issues } = analyzeValidation([file]);
    expect(issues).toHaveLength(0);
  });

  it("does not flag a controller method that reads no input", () => {
    const file = makeSourceFile("app/Http/Controllers/PostController.php", `<?php\nclass PostController {\n  public function index() {\n    return Post::all();\n  }\n}\n`);
    const { issues } = analyzeValidation([file]);
    expect(issues).toHaveLength(0);
  });

  it("flags a route parameter with no ->where() constraint", () => {
    const file = makeSourceFile("routes/web.php", `<?php\nRoute::get('/posts/{id}', [PostController::class, 'show']);\n`);
    const { issues } = analyzeValidation([file]);
    expect(issues.some((i) => i.ruleCode === "validation.route-param-unvalidated")).toBe(true);
  });

  it("does not flag a route parameter with a ->where() constraint", () => {
    const file = makeSourceFile("routes/web.php", `<?php\nRoute::get('/posts/{id}', [PostController::class, 'show'])->where('id', '[0-9]+');\n`);
    const { issues } = analyzeValidation([file]);
    expect(issues.some((i) => i.ruleCode === "validation.route-param-unvalidated")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { analyzeMassAssignment } from "./massAssignment";
import { makeSourceFile } from "./testHelpers";

describe("analyzeMassAssignment", () => {
  it("flags $guarded = []", () => {
    const file = makeSourceFile("app/Models/User.php", `<?php\nclass User extends Model {\n  protected $guarded = [];\n}\n`);
    const { issues } = analyzeMassAssignment([file]);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("massassignment.guarded-empty");
  });

  it("flags a model with neither $fillable nor $guarded", () => {
    const file = makeSourceFile("app/Models/Post.php", `<?php\nclass Post extends Model {\n  public $timestamps = false;\n}\n`);
    const { issues } = analyzeMassAssignment([file]);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("massassignment.fillable-missing");
  });

  it("does not flag a model with a proper $fillable", () => {
    const file = makeSourceFile("app/Models/Post.php", `<?php\nclass Post extends Model {\n  protected $fillable = ['title', 'body'];\n}\n`);
    const { issues } = analyzeMassAssignment([file]);
    expect(issues).toHaveLength(0);
  });

  it("flags Model::create(request()->all())", () => {
    const file = makeSourceFile("app/Http/Controllers/PostController.php", `<?php\nclass PostController {\n  public function store() {\n    return Post::create(request()->all());\n  }\n}\n`);
    const { issues } = analyzeMassAssignment([file]);
    expect(issues.some((i) => i.ruleCode === "massassignment.request-all")).toBe(true);
  });

  it("does not flag a validated create() call", () => {
    const file = makeSourceFile("app/Http/Controllers/PostController.php", `<?php\nclass PostController {\n  public function store(Request $request) {\n    $data = $request->validate(['title' => 'required']);\n    return Post::create($data);\n  }\n}\n`);
    const { issues } = analyzeMassAssignment([file]);
    expect(issues.some((i) => i.ruleCode === "massassignment.request-all")).toBe(false);
  });
});

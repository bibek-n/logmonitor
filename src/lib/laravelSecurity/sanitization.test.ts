import { describe, it, expect } from "vitest";
import { analyzeSanitization } from "./sanitization";
import { makeSourceFile } from "./testHelpers";

describe("analyzeSanitization", () => {
  it("flags {!! $variable !!} raw echo of a variable", () => {
    const file = makeSourceFile("resources/views/post.blade.php", `<div>{!! $post->body !!}</div>\n`);
    const { issues } = analyzeSanitization([file]);
    expect(issues).toHaveLength(1);
    expect(issues[0].ruleCode).toBe("sanitization.raw-blade-echo");
  });

  it("does not flag {{ }} escaped output", () => {
    const file = makeSourceFile("resources/views/post.blade.php", `<div>{{ $post->body }}</div>\n`);
    const { issues } = analyzeSanitization([file]);
    expect(issues).toHaveLength(0);
  });

  it("does not flag a raw echo of a known-safe helper", () => {
    const file = makeSourceFile("resources/views/post.blade.php", `<a href="{!! route('posts.show', $post) !!}">Link</a>\n`);
    const { issues } = analyzeSanitization([file]);
    expect(issues).toHaveLength(0);
  });

  it("does not flag a raw echo of an already-purified value", () => {
    const file = makeSourceFile("resources/views/post.blade.php", `<div>{!! clean($post->body) !!}</div>\n`);
    const { issues } = analyzeSanitization([file]);
    expect(issues).toHaveLength(0);
  });

  it("flags new HtmlString() wrapping a variable", () => {
    const file = makeSourceFile("app/View/Components/Post.php", `<?php\nreturn new HtmlString($post->body);\n`);
    const { issues } = analyzeSanitization([file]);
    expect(issues.some((i) => i.ruleCode === "sanitization.raw-html-helper")).toBe(true);
  });
});

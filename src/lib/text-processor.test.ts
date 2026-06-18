import { describe, it, expect } from "vitest";
import { applyAddOperation } from "./text-processor";

describe("applyAddOperation", () => {
  it("alternative mode uses baseValues[0] and cycles contents", () => {
    const html = "<p>one two three four five six</p>";
    const settings = {
      numFields: 3,
      contents: ["<<<A>>>", "<<<B>>>", "<<<C>>>"],
      baseValues: [2, 999],
      mode: "alternative",
    } as any;
    const out = applyAddOperation(html, settings);

    const decoded = out
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    const matches = Array.from(decoded.matchAll(/<<<[A-Z]>>>/g)).map(
      (m) => m[0],
    );
    expect(matches).toEqual(["<<<A>>>", "<<<B>>>", "<<<C>>>"]);
    expect(matches.length).toBe(3);
  });

  it("sequential mode applies each content in its own pass (both tokens present)", () => {
    const html = "<p>one two three four five six seven eight nine</p>";
    const settings = {
      numFields: 2,
      contents: ["<<<X>>>", "<<<Y>>>"],
      baseValues: [2, 3],
      mode: "sequential",
    } as any;

    const out = applyAddOperation(html, settings);
    const decoded = out
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    expect(decoded).toContain("<<<X>>>");
    expect(decoded).toContain("<<<Y>>>");
  });
});

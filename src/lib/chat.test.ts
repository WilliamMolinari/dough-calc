import { describe, expect, it } from "vitest";
import { chatContents } from "./gemini";

describe("chat photo attachments", () => {
  it("attaches the image to the turn that carries it", () => {
    const contents = chatContents([
      {
        role: "user",
        text: "Why is this one pale?",
        photo: { data: "aGVsbG8=", mimeType: "image/jpeg" },
      },
      { role: "model", text: "Pale base, steady rim." },
    ]);

    expect(contents[0].role).toBe("user");
    expect(contents[0].parts).toHaveLength(2);
    expect(contents[0].parts[0]).toEqual({
      inlineData: { mimeType: "image/jpeg", data: "aGVsbG8=" },
    });
    expect(contents[0].parts[1]).toEqual({ text: "Why is this one pale?" });

    expect(contents[1].role).toBe("model");
    expect(contents[1].parts).toHaveLength(1);
    expect(contents[1].parts[0]).toEqual({ text: "Pale base, steady rim." });
  });

  it("keeps photos on earlier turns so follow-ups can still see the shot", () => {
    const contents = chatContents([
      { role: "user", text: "Look at this.", photo: { data: "AAA", mimeType: "image/jpeg" } },
      { role: "model", text: "Nice rim." },
      { role: "user", text: "And the underside?" },
    ]);

    expect(contents[0].parts[0]).toHaveProperty("inlineData");
    expect(contents[2].parts).toEqual([{ text: "And the underside?" }]);
  });
});

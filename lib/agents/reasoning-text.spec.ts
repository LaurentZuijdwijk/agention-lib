import { collapseReasoningWhitespace } from "./reasoning-text";

describe("collapseReasoningWhitespace", () => {
  it("collapses runs of 3+ newlines to a single blank line by default", () => {
    const input = "First point.\n\n\n\nSecond point.\n\nThird point.";
    expect(collapseReasoningWhitespace(input)).toBe(
      "First point.\n\nSecond point.\n\nThird point."
    );
  });

  it("leaves a single blank line untouched", () => {
    const input = "First point.\n\nSecond point.";
    expect(collapseReasoningWhitespace(input)).toBe(input);
  });

  it("leaves single newlines untouched when collapseLineWraps is off", () => {
    const input = "The\nsky\nis\nblue";
    expect(collapseReasoningWhitespace(input)).toBe(input);
  });

  it("can disable blank-line collapsing", () => {
    const input = "First.\n\n\n\nSecond.";
    expect(
      collapseReasoningWhitespace(input, { collapseBlankLines: false })
    ).toBe(input);
  });

  it("merges one-word-per-line reasoning into sentences when collapseLineWraps is on", () => {
    const input = "The\nsky\nis\nblue\nbecause\nof\nscattering.";
    expect(
      collapseReasoningWhitespace(input, { collapseLineWraps: true })
    ).toBe("The sky is blue because of scattering.");
  });

  it("keeps a blank-line-separated paragraph break when merging line wraps", () => {
    const input = "First\nparagraph\nhere.\n\nSecond\nparagraph\nhere.";
    expect(
      collapseReasoningWhitespace(input, { collapseLineWraps: true })
    ).toBe("First paragraph here.\n\nSecond paragraph here.");
  });

  it("does not merge a markdown list item into the line before it", () => {
    const input = "Intro line.\n- First bullet\n- Second bullet";
    expect(
      collapseReasoningWhitespace(input, { collapseLineWraps: true })
    ).toBe(input);
  });

  it("does not merge a markdown heading into the line before it", () => {
    const input = "Some text.\n## A Heading\nMore text.";
    expect(
      collapseReasoningWhitespace(input, { collapseLineWraps: true })
    ).toBe(input);
  });

  it("does not merge a blockquote into the line before it", () => {
    const input = "Some text.\n> a quote\nmore text.";
    expect(
      collapseReasoningWhitespace(input, { collapseLineWraps: true })
    ).toBe(input);
  });

  it("applies both options together", () => {
    const input = "The\nsky\nis\nblue.\n\n\n\nRayleigh\nscattering\nexplains\nit.";
    expect(
      collapseReasoningWhitespace(input, {
        collapseLineWraps: true,
        collapseBlankLines: true,
      })
    ).toBe("The sky is blue.\n\nRayleigh scattering explains it.");
  });
});

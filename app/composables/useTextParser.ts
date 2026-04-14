export function useTextParser() {
  function extractDescription(text: string): string {
    const descMatch = text.match(
      /Description:\s*([\s\S]*?)(?=Examples:|General Capabilities:|Capabilities:|$)/i
    );
    if (descMatch?.[1]) return descMatch[1].trim();
    return (
      text
        .replace(/^Content code:.*$/im, "")
        .replace(/^Year level:.*$/im, "")
        .replace(/^Strand:.*$/im, "")
        .replace(/^Sub-strand:.*$/im, "")
        .replace(/^Description:\s*/im, "")
        .split(/Examples:|General Capabilities:|Capabilities:/i)[0]
        ?.trim() ?? ""
    );
  }

  function extractExamples(text: string): string[] {
    const examplesMatch = text.match(
      /Examples:\s*([\s\S]*?)(?=General Capabilities:|Capabilities:|$)/i
    );
    if (!examplesMatch?.[1]) return [];
    return examplesMatch[1]
      .split("|")
      .map((s) => s.trim())
      .filter(
        (s) => s.length > 0 && !s.match(/General Capabilities|Capabilities/i)
      );
  }

  function extractCapabilities(text: string): string[] {
    const capMatch = text.match(
      /(?:General Capabilities|Capabilities):\s*(.+)$/i
    );
    if (!capMatch?.[1]) return [];
    return capMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return {
    extractDescription,
    extractExamples,
    extractCapabilities,
  };
}
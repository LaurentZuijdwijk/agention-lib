import type {
  MCPAudioContent,
  MCPCallToolResult,
  MCPContentBlock,
  MCPEmbeddedResourceContent,
  MCPImageContent,
  MCPResourceLinkContent,
  MCPTextContent,
} from "./types";

/**
 * Format the decoded size of a base64 payload for display.
 */
function formatBase64Size(data: string): string {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  const bytes = Math.max(0, Math.floor((data.length * 3) / 4) - padding);

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Render a single MCP content block as text.
 *
 * Text blocks are returned verbatim. Binary blocks (image, audio, blob
 * resources) cannot be represented as text, so they are rendered as a
 * descriptive placeholder carrying their mime type and size — enough for a model
 * to know the content exists and to ask for it another way. Text-bearing
 * resources are inlined under a header naming their URI.
 *
 * Unrecognised block types — content types added to the protocol after this
 * release — are serialised as JSON rather than dropped.
 */
export function renderContentBlock(block: MCPContentBlock): string {
  switch (block.type) {
    case "text": {
      return (block as MCPTextContent).text ?? "";
    }
    case "image": {
      const image = block as MCPImageContent;
      return `[image content: ${image.mimeType ?? "unknown"}, ${formatBase64Size(
        image.data ?? ""
      )}]`;
    }
    case "audio": {
      const audio = block as MCPAudioContent;
      return `[audio content: ${audio.mimeType ?? "unknown"}, ${formatBase64Size(
        audio.data ?? ""
      )}]`;
    }
    case "resource": {
      const { resource } = block as MCPEmbeddedResourceContent;
      if (!resource) return "[resource]";

      const mime = resource.mimeType ? `, ${resource.mimeType}` : "";
      if (typeof resource.text === "string") {
        return `[resource: ${resource.uri}${mime}]\n${resource.text}`;
      }
      return `[resource: ${resource.uri}${mime}, ${formatBase64Size(
        resource.blob ?? ""
      )}]`;
    }
    case "resource_link": {
      const link = block as MCPResourceLinkContent;
      const name = link.name ? ` (${link.name})` : "";
      const description = link.description ? ` — ${link.description}` : "";
      return `[resource link: ${link.uri}${name}${description}]`;
    }
    default: {
      return `[${block.type} content: ${JSON.stringify(block)}]`;
    }
  }
}

/**
 * Convert a raw MCP `CallToolResult` into the value handed to the agent.
 *
 * Resolution order:
 * 1. When the result has content blocks, every block is rendered and the
 *    segments are joined with newlines. `structuredContent` is appended as JSON
 *    when the result carries no text block, so structured output is never lost
 *    behind a binary-only result.
 * 2. Otherwise `structuredContent` is returned as-is, so tools with an
 *    `outputSchema` keep giving the agent a real object.
 * 3. Otherwise the whole result is JSON-serialised.
 */
export function renderToolResult(result: MCPCallToolResult | null | undefined): unknown {
  const blocks = Array.isArray(result?.content) ? result!.content : [];

  if (blocks.length > 0) {
    const segments = blocks.map(renderContentBlock);
    const hasText = blocks.some((block) => block.type === "text");

    if (!hasText && result?.structuredContent !== undefined) {
      segments.push(JSON.stringify(result.structuredContent));
    }

    return segments.join("\n");
  }

  if (result?.structuredContent !== undefined) {
    return result.structuredContent;
  }

  return JSON.stringify(result ?? null);
}

export type DocumentImportErrorCode = "password" | "no-text" | "corrupt";

export class DocumentImportError extends Error {
  readonly code: DocumentImportErrorCode;

  constructor(code: DocumentImportErrorCode, message: string) {
    super(message);
    this.name = "DocumentImportError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Minimal HTML → Markdown converter for mammoth DOCX output
// ---------------------------------------------------------------------------

interface HtmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
}

type HtmlNode = string | HtmlElement;

const VOID_TAGS = new Set(["br", "hr", "img", "meta", "link", "input", "wbr"]);
const SKIP_BODY_TAGS = new Set(["script", "style", "head"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  bull: "•",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-fA-F]+|#\d+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return NAMED_ENTITIES[entity] ?? full;
  });
}

function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of raw.matchAll(attrRe)) {
    const key = (match[1] ?? "").toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? "";
    if (key) attrs[key] = decodeEntities(val);
  }
  return attrs;
}

function parseHtml(html: string): HtmlNode[] {
  const root: HtmlElement = { tag: "root", attrs: {}, children: [] };
  const stack: HtmlElement[] = [root];
  const tokenRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)\s*>|<!--[\s\S]*?-->/g;
  let lastIndex = 0;

  const pushText = (raw: string) => {
    if (!raw) return;
    const current = stack[stack.length - 1]!;
    if (SKIP_BODY_TAGS.has(current.tag)) return;
    current.children.push(decodeEntities(raw));
  };

  for (const match of html.matchAll(tokenRe)) {
    const index = match.index ?? 0;
    if (index > lastIndex) pushText(html.slice(lastIndex, index));
    lastIndex = index + match[0].length;

    if (match[0].startsWith("<!--")) continue;

    const isClose = match[1] === "/";
    const tag = (match[2] ?? "").toLowerCase();
    const rawAttrs = match[3] ?? "";
    const isSelfClosing = match[4] === "/" || VOID_TAGS.has(tag);

    if (isClose) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i]!.tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const element: HtmlElement = { tag, attrs: parseAttributes(rawAttrs), children: [] };
    stack[stack.length - 1]!.children.push(element);
    if (!isSelfClosing) stack.push(element);
  }

  if (lastIndex < html.length) pushText(html.slice(lastIndex));
  return root.children;
}

interface RenderContext {
  listStack: Array<{ ordered: boolean; count: number }>;
  inHeading: boolean;
}

function wrapInline(marker: string, content: string): string {
  const leading = /^\s+/.exec(content)?.[0] ?? "";
  const trailing = /\s+$/.exec(content)?.[0] ?? "";
  const core = content.trim();
  if (!core) return content;
  return `${leading}${marker}${core}${marker}${trailing}`;
}

function renderInlineChildren(nodes: readonly HtmlNode[], ctx: RenderContext): string {
  return nodes.map((node) => renderNode(node, ctx)).join("");
}

function renderTable(element: HtmlElement, ctx: RenderContext): string {
  const rows: HtmlElement[] = [];
  const collectRows = (nodes: readonly HtmlNode[]) => {
    for (const node of nodes) {
      if (typeof node === "string") continue;
      if (node.tag === "tr") rows.push(node);
      else collectRows(node.children);
    }
  };
  collectRows(element.children);

  const output: string[] = [];
  for (const row of rows) {
    const cells = row.children
      .filter((child): child is HtmlElement => typeof child !== "string" && (child.tag === "td" || child.tag === "th"))
      .map((cell) => renderInlineChildren(cell.children, ctx).trim())
      .filter(Boolean);
    if (!cells.length) continue;

    // A multi-line cell usually means a 2-column layout table: keep columns sequential instead of gluing them with "|".
    if (cells.some((cell) => cell.includes("\n"))) {
      output.push(cells.join("\n\n"));
    } else {
      output.push(cells.join(" | "));
    }
  }
  return output.length ? `\n\n${output.join("\n")}\n\n` : "";
}

function renderListItem(element: HtmlElement, ctx: RenderContext): string {
  const current = ctx.listStack[ctx.listStack.length - 1];
  const depth = Math.max(0, ctx.listStack.length - 1);
  if (current) current.count += 1;
  const bullet = current?.ordered ? `${current.count}. ` : "- ";
  const indent = "  ".repeat(depth);

  // Separate inline text from nested lists so nested <ul>/<ol> stay on indented lines below.
  const inlineParts: string[] = [];
  const nestedParts: string[] = [];
  for (const child of element.children) {
    if (typeof child !== "string" && (child.tag === "ul" || child.tag === "ol")) {
      const nested = renderNode(child, ctx).trimEnd();
      if (nested) nestedParts.push(nested);
    } else {
      const rendered = renderNode(child, ctx);
      if (rendered) inlineParts.push(rendered);
    }
  }

  const text = inlineParts
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
  const lines: string[] = [];
  if (text) lines.push(`${indent}${bullet}${text}`);
  if (nestedParts.length) lines.push(...nestedParts);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function renderNode(node: HtmlNode, ctx: RenderContext): string {
  if (typeof node === "string") return node.replace(/[ \t\r\n]+/g, " ");

  const { tag, attrs, children } = node;
  if (SKIP_BODY_TAGS.has(tag) || tag === "img") return "";
  if (tag === "br") return "\n";
  if (tag === "hr") return "\n\n---\n\n";

  if (/^h[1-6]$/.test(tag)) {
    const level = Number.parseInt(tag.slice(1), 10);
    const content = renderInlineChildren(children, { ...ctx, inHeading: true }).trim();
    return content ? `\n\n${"#".repeat(level)} ${content}\n\n` : "";
  }

  if (tag === "p" || tag === "div" || tag === "blockquote") {
    const content = renderInlineChildren(children, ctx).trim();
    return content ? `\n\n${content}\n\n` : "";
  }

  if (tag === "strong" || tag === "b") {
    const content = renderInlineChildren(children, ctx);
    return ctx.inHeading ? content : wrapInline("**", content);
  }

  if (tag === "em" || tag === "i") {
    const content = renderInlineChildren(children, ctx);
    return ctx.inHeading ? content : wrapInline("*", content);
  }

  if (tag === "a") {
    const content = renderInlineChildren(children, ctx).trim();
    const href = (attrs.href ?? "").trim().replace(/\s+/g, "%20");
    if (!href || href.startsWith("#")) return content;
    if (!content) return "";
    return `[${content}](${href})`;
  }

  if (tag === "ul" || tag === "ol") {
    ctx.listStack.push({ ordered: tag === "ol", count: 0 });
    const items = children.map((child) => renderNode(child, ctx)).join("");
    const isTopLevel = ctx.listStack.length === 1;
    ctx.listStack.pop();
    if (!items.trim()) return "";
    return isTopLevel ? `\n\n${items}\n` : `\n${items}`;
  }

  if (tag === "li") return renderListItem(node, ctx);
  if (tag === "table") return renderTable(node, ctx);

  return renderInlineChildren(children, ctx);
}

/** Converts simple semantic HTML (e.g. from Mammoth) into clean Markdown suited for Folio's parser. */
export function htmlToMarkdown(html: string): string {
  const nodes = parseHtml(html);
  const raw = renderInlineChildren(nodes, { listStack: [], inHeading: false });
  return raw
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// DOCX extraction (Mammoth)
// ---------------------------------------------------------------------------

/** Extracts structured Markdown text from a `.docx` ArrayBuffer entirely in the browser (or Node tests). */
export async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  if (buffer.byteLength === 0) return "";
  try {
    const mammothModule = await import("mammoth");
    const mammoth = ("default" in mammothModule ? mammothModule.default : mammothModule) as typeof import("mammoth");
    // Browser builds expect `{ arrayBuffer }`, while Node builds expect `{ buffer }`; passing both covers every runtime.
    const input = (
      typeof Buffer !== "undefined" ? { arrayBuffer: buffer, buffer: Buffer.from(buffer) } : { arrayBuffer: buffer }
    ) as Parameters<typeof mammoth.convertToHtml>[0];

    const { value: html } = await mammoth.convertToHtml(input, {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p.Title => h1:fresh",
        "p[style-name='Section Header'] => h2:fresh",
        "p[style-name='List Paragraph'] => p:fresh",
      ],
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
    });
    return htmlToMarkdown(html);
  } catch (error) {
    if (error instanceof DocumentImportError) throw error;
    throw new DocumentImportError("corrupt", "Couldn't read DOCX document.");
  }
}

// ---------------------------------------------------------------------------
// PDF extraction (PDF.js)
// ---------------------------------------------------------------------------

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LinkBox {
  rect: [number, number, number, number];
  url: string;
}

let workerConfigured = false;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!workerConfigured) {
    if (typeof window === "undefined") {
      await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    } else {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    }
    workerConfigured = true;
  }
  return pdfjs;
}

function median(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function linkAtItem(item: PositionedItem, links: readonly LinkBox[]): LinkBox | undefined {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height * 0.35;
  return links.find(({ rect: [x1, y1, x2, y2] }) => cx >= x1 - 2 && cx <= x2 + 2 && cy >= y1 - 2 && cy <= y2 + 2);
}

interface PdfLine {
  y: number;
  height: number;
  text: string;
}

function groupItemsIntoLines(items: readonly PositionedItem[], links: readonly LinkBox[]): PdfLine[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rawLines: Array<{ y: number; items: PositionedItem[] }> = [];

  for (const item of sorted) {
    const lastLine = rawLines[rawLines.length - 1];
    const tolerance = Math.max(2.5, item.height * 0.4);
    if (lastLine && Math.abs(lastLine.y - item.y) <= tolerance) {
      lastLine.items.push(item);
    } else {
      rawLines.push({ y: item.y, items: [item] });
    }
  }

  return rawLines
    .map((line) => {
      line.items.sort((a, b) => a.x - b.x);
      let buffer = "";
      let activeLink: LinkBox | null = null;
      let linkText = "";

      const flushLink = () => {
        if (!activeLink) return;
        const label = linkText.trim();
        if (label) {
          const leading = /^\s+/.exec(linkText)?.[0] ?? "";
          const trailing = /\s+$/.exec(linkText)?.[0] ?? "";
          const alreadyMarkdown = /^\[.*\]\(.*\)$/.test(label);
          const alreadyHasUrl = /https?:\/\/|mailto:/i.test(label);
          buffer += alreadyMarkdown || alreadyHasUrl ? linkText : `${leading}[${label}](${activeLink.url})${trailing}`;
        }
        activeLink = null;
        linkText = "";
      };

      for (let i = 0; i < line.items.length; i++) {
        const curr = line.items[i]!;
        const prev = i > 0 ? line.items[i - 1]! : null;
        const link = linkAtItem(curr, links) ?? null;

        let sep = "";
        if (prev) {
          const fontSize = Math.max(6, Math.min(prev.height, curr.height) || 10);
          const gap = curr.x - (prev.x + prev.width);
          const alreadySpaced = prev.str.endsWith(" ") || curr.str.startsWith(" ");
          if (gap > fontSize * 1.5) sep = "  ";
          else if (gap > fontSize * 0.18 && !alreadySpaced) sep = " ";
        }

        if (link && activeLink && link === activeLink) {
          linkText += sep + curr.str;
        } else {
          flushLink();
          if (link) {
            buffer += sep;
            activeLink = link;
            linkText = curr.str;
          } else {
            buffer += sep + curr.str;
          }
        }
      }
      flushLink();

      const height = median(
        line.items.map((item) => item.height).filter((h) => h > 0),
        10,
      );
      return { y: line.y, height, text: buffer.replace(/[ \t]+$/g, "") };
    })
    .filter((line) => line.text.trim().length > 0);
}

function linesToParagraphText(lines: readonly PdfLine[]): string {
  if (!lines.length) return "";
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const diff = lines[i - 1]!.y - lines[i]!.y;
    if (diff > 2) gaps.push(diff);
  }
  const normalStep = median(gaps, lines[0]!.height * 1.25);

  const output: string[] = [lines[0]!.text.trimStart()];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1]!;
    const curr = lines[i]!;
    const diff = prev.y - curr.y;
    const fontHeight = Math.max(prev.height, curr.height, 8);
    if (diff > Math.max(normalStep * 1.35, fontHeight * 1.7)) output.push("");
    output.push(curr.text.trimStart());
  }
  return output.join("\n");
}

/**
 * Detects a clear two-column page layout (optionally below a full-width header) while leaving
 * single-column resumes with right-aligned dates intact.
 */
function splitTwoColumnItems(
  items: readonly PositionedItem[],
): { header: PositionedItem[]; left: PositionedItem[]; right: PositionedItem[] } | null {
  if (items.length < 10) return null;
  const minX = Math.min(...items.map((item) => item.x));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const span = maxX - minX;
  if (span < 200) return null;

  // Try candidate vertical gutters across the middle region of the page.
  const searchStart = minX + span * 0.25;
  const searchEnd = minX + span * 0.65;
  const gutterHalfWidth = 8;

  let bestGutter: { x: number; splitY: number; left: PositionedItem[]; right: PositionedItem[]; header: PositionedItem[] } | null = null;

  for (let candidateX = searchStart; candidateX <= searchEnd; candidateX += 4) {
    const gLeft = candidateX - gutterHalfWidth;
    const gRight = candidateX + gutterHalfWidth;

    const crossing = items.filter((item) => item.x < gLeft && item.x + item.width > gRight);
    // Allow full-width header items only near the top of the page (above all column items).
    const lowestCrossingY = crossing.length ? Math.min(...crossing.map((item) => item.y)) : Number.POSITIVE_INFINITY;
    const bodyItems = crossing.length ? items.filter((item) => item.y < lowestCrossingY - 2) : items;
    const headerItems = crossing.length ? items.filter((item) => item.y >= lowestCrossingY - 2) : [];

    const left = bodyItems.filter((item) => item.x + item.width <= gLeft + 2);
    const right = bodyItems.filter((item) => item.x >= gRight - 2);
    if (left.length + right.length !== bodyItems.length) continue;
    if (left.length < 4 || right.length < 4) continue;

    const leftChars = left.reduce((sum, item) => sum + item.str.trim().length, 0);
    const rightChars = right.reduce((sum, item) => sum + item.str.trim().length, 0);
    if (leftChars < 30 || rightChars < 50) continue;

    const leftYs = new Set(left.map((item) => Math.round(item.y / 3)));
    const rightYs = new Set(right.map((item) => Math.round(item.y / 3)));
    if (leftYs.size < 4 || rightYs.size < 4) continue;

    const leftMinY = Math.min(...left.map((item) => item.y));
    const leftMaxY = Math.max(...left.map((item) => item.y));
    const rightMinY = Math.min(...right.map((item) => item.y));
    const rightMaxY = Math.max(...right.map((item) => item.y));
    const overlap = Math.min(leftMaxY, rightMaxY) - Math.max(leftMinY, rightMinY);
    const shorterHeight = Math.max(1, Math.min(leftMaxY - leftMinY, rightMaxY - rightMinY));
    if (overlap / shorterHeight < 0.4) continue;

    if (!bestGutter || headerItems.length < bestGutter.header.length) {
      bestGutter = { x: candidateX, splitY: lowestCrossingY, left, right, header: headerItems };
    }
  }

  return bestGutter ? { header: bestGutter.header, left: bestGutter.left, right: bestGutter.right } : null;
}

/** Extracts layout-aware text (preserving lines, section breaks, links and columns) from a `.pdf` ArrayBuffer. */
export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  if (buffer.byteLength === 0) throw new DocumentImportError("no-text", "PDF file is empty.");

  const pdfjs = await loadPdfJs();
  let task: ReturnType<typeof pdfjs.getDocument> | null = null;

  try {
    task = pdfjs.getDocument({
      data: new Uint8Array(buffer.slice(0)),
      verbosity: pdfjs.VerbosityLevel.ERRORS,
    });
    const pdf = await task.promise;

    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const [textContent, annotations] = await Promise.all([
        page.getTextContent(),
        page.getAnnotations().catch(() => [] as Array<Record<string, unknown>>),
      ]);

      const links: LinkBox[] = [];
      for (const annot of annotations) {
        if (annot.subtype !== "Link" || typeof annot.url !== "string" || !/^(?:https?:|mailto:)/i.test(annot.url)) continue;
        if (!Array.isArray(annot.rect) || annot.rect.length !== 4) continue;
        const rect = annot.rect.map(Number) as [number, number, number, number];
        if (rect.some((n) => !Number.isFinite(n))) continue;
        links.push({ rect, url: annot.url });
      }

      const items: PositionedItem[] = [];
      for (const rawItem of textContent.items) {
        if (!("str" in rawItem) || !rawItem.str.trim()) continue;
        const transform = rawItem.transform;
        const x = Number(transform[4] ?? 0);
        const y = Number(transform[5] ?? 0);
        const height = Math.abs(Number(rawItem.height || transform[3] || Math.hypot(transform[0] ?? 0, transform[1] ?? 0))) || 10;
        const width = Math.max(0, Number(rawItem.width ?? 0));
        items.push({ str: rawItem.str, x, y, width, height });
      }

      if (!items.length) continue;

      const columns = splitTwoColumnItems(items);
      if (columns) {
        const sections = [
          linesToParagraphText(groupItemsIntoLines(columns.header, links)),
          linesToParagraphText(groupItemsIntoLines(columns.left, links)),
          linesToParagraphText(groupItemsIntoLines(columns.right, links)),
        ].filter(Boolean);
        if (sections.length) pageTexts.push(sections.join("\n\n"));
      } else {
        const pageText = linesToParagraphText(groupItemsIntoLines(items, links));
        if (pageText) pageTexts.push(pageText);
      }
    }

    const joined = pageTexts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!joined) {
      throw new DocumentImportError("no-text", "No selectable text found in PDF.");
    }
    return joined;
  } catch (error) {
    if (error instanceof DocumentImportError) throw error;
    if (error instanceof Error && error.name === "PasswordException") {
      throw new DocumentImportError("password", "PDF is password-protected.");
    }
    throw new DocumentImportError("corrupt", "Couldn't read PDF document.");
  } finally {
    await task?.destroy().catch(() => undefined);
  }
}

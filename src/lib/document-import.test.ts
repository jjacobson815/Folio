import { describe, expect, it } from "vitest";
import { parseResume } from "@/parser";
import { DocumentImportError, extractTextFromDocx, extractTextFromPdf, htmlToMarkdown } from "./document-import";

// ---------------------------------------------------------------------------
// Minimal valid .docx (ZIP) builder for self-contained tests
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries: Array<{ name: string; content: string }>): ArrayBuffer {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    const crc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // store (no compression)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, dataBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const archive = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  return archive.buffer;
}

function buildDocx(bodyXml: string, relsExtra = ""): ArrayBuffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/contenttypes">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relsExtra}
</Relationships>`;

  const numbering = `<?xml version="1.0" encoding="UTF-8"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
    <w:lvl w:ilvl="1"><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>${bodyXml}</w:body>
</w:document>`;

  return buildZip([
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: rootRels },
    { name: "word/_rels/document.xml.rels", content: docRels },
    { name: "word/numbering.xml", content: numbering },
    { name: "word/document.xml", content: documentXml },
  ]);
}

// ---------------------------------------------------------------------------
// Minimal valid PDF builder for self-contained tests
// ---------------------------------------------------------------------------

interface PdfTextSpec {
  x: number;
  y: number;
  text: string;
  size?: number;
}

interface PdfLinkSpec {
  rect: [number, number, number, number];
  url: string;
}

function escapePdfString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildPdf(pages: Array<{ items: PdfTextSpec[]; links?: PdfLinkSpec[] }>): ArrayBuffer {
  const objects: string[] = [];
  const addObj = (body: string) => {
    objects.push(body);
    return objects.length; // 1-based PDF object id
  };

  const catalogId = addObj(""); // placeholder
  const pagesId = addObj(""); // placeholder
  const fontId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];

  for (const page of pages) {
    const streamLines = page.items.map(
      (item) => `BT /F1 ${item.size ?? 11} Tf 1 0 0 1 ${item.x} ${item.y} Tm (${escapePdfString(item.text)}) Tj ET`,
    );
    const stream = streamLines.join("\n");
    const contentId = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

    const annotIds: number[] = [];
    for (const link of page.links ?? []) {
      const [x1, y1, x2, y2] = link.rect;
      const annotId = addObj(
        `<< /Type /Annot /Subtype /Link /Rect [${x1} ${y1} ${x2} ${y2}] /Border [0 0 0] /A << /S /URI /URI (${escapePdfString(link.url)}) >> >>`,
      );
      annotIds.push(annotId);
    }

    const annotsEntry = annotIds.length ? ` /Annots [${annotIds.map((id) => `${id} 0 R`).join(" ")}]` : "";
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R${annotsEntry} >>`,
    );
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [0];
  let byteLength = chunks[0]!.length;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(byteLength);
    const objStr = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(objStr);
    byteLength += objStr.length;
  }

  const xrefOffset = byteLength;
  const xrefLines = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`];
  for (let i = 1; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  xrefLines.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  chunks.push(xrefLines.join(""));

  return new TextEncoder().encode(chunks.join("")).buffer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("htmlToMarkdown", () => {
  it("converts headings, paragraphs, emphasis, links and nested lists", () => {
    const html = [
      "<h1>Maya Okafor</h1>",
      "<p>Senior Product Engineer</p>",
      '<p><a href="mailto:maya@example.com">maya@example.com</a> · <a href="https://github.com/maya">GitHub</a></p>',
      "<h2>Experience</h2>",
      "<p><strong>Senior Engineer</strong> · Lumen Labs</p>",
      "<ul><li>Led <em>frontend</em> rebuild<ul><li>Cut load time in half</li></ul></li></ul>",
    ].join("");

    const md = htmlToMarkdown(html);
    expect(md).toContain("# Maya Okafor");
    expect(md).toContain("Senior Product Engineer");
    expect(md).toContain("[maya@example.com](mailto:maya@example.com) · [GitHub](https://github.com/maya)");
    expect(md).toContain("## Experience");
    expect(md).toContain("**Senior Engineer** · Lumen Labs");
    expect(md).toContain("- Led *frontend* rebuild");
    expect(md).toContain("  - Cut load time in half");
  });

  it("joins single-line table cells with pipes and keeps multi-line layout columns separate", () => {
    const rowTable = "<table><tr><td><strong>Senior Engineer</strong>, Acme</td><td>2021 – Present</td></tr></table>";
    expect(htmlToMarkdown(rowTable)).toBe("**Senior Engineer**, Acme | 2021 – Present");

    const layoutTable =
      "<table><tr><td><h3>Skills</h3><p>TypeScript, Go</p></td><td><h2>Experience</h2><p>Built APIs</p></td></tr></table>";
    const out = htmlToMarkdown(layoutTable);
    expect(out).toContain("### Skills\n\nTypeScript, Go");
    expect(out).toContain("## Experience\n\nBuilt APIs");
    expect(out).not.toContain(" | ");
  });

  it("drops images and bookmark anchors and decodes entities", () => {
    const html = '<p><a id="top"></a>R&amp;D &mdash; 100% &quot;clean&quot;<img src="data:image/png;base64,AAA" /></p>';
    expect(htmlToMarkdown(html)).toBe('R&D — 100% "clean"');
  });

  it("handles ordered lists and combined bold-italic emphasis", () => {
    const html = "<p><strong><em>Lead</em></strong></p><ol><li>First</li><li>Second</li></ol>";
    expect(htmlToMarkdown(html)).toBe("***Lead***\n\n1. First\n2. Second");
  });
});

describe("extractTextFromDocx", () => {
  it("extracts headings, lists, hyperlinks and tables into parser-ready Markdown", async () => {
    const docx = buildDocx(
      `
      <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Maya Okafor</w:t></w:r></w:p>
      <w:p><w:r><w:t>Senior Product Engineer</w:t></w:r></w:p>
      <w:p>
        <w:hyperlink r:id="rIdLink1"><w:r><w:t>maya@okafor.example</w:t></w:r></w:hyperlink>
        <w:r><w:t> | </w:t></w:r>
        <w:hyperlink r:id="rIdLink2"><w:r><w:t>GitHub</w:t></w:r></w:hyperlink>
      </w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Experience</w:t></w:r></w:p>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Senior Product Engineer</w:t></w:r><w:r><w:t> — Lumen Labs (Mar 2022 - Present)</w:t></w:r></w:p>
      <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Led dashboard rebuild on Next.js</w:t></w:r></w:p>
      <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Skills</w:t></w:r></w:p>
      <w:tbl><w:tr>
        <w:tc><w:p><w:r><w:t>Languages</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>TypeScript, Python, SQL</w:t></w:r></w:p></w:tc>
      </w:tr></w:tbl>
      `,
      `
      <Relationship Id="rIdLink1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="mailto:maya@okafor.example" TargetMode="External"/>
      <Relationship Id="rIdLink2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://github.com/mayaokafor" TargetMode="External"/>
      `,
    );

    const markdown = await extractTextFromDocx(docx);
    expect(markdown).toContain("# Maya Okafor");
    expect(markdown).toContain("[maya@okafor.example](mailto:maya@okafor.example)");
    expect(markdown).toContain("[GitHub](https://github.com/mayaokafor)");
    expect(markdown).toContain("- Led dashboard rebuild on Next.js");

    const parsed = parseResume(markdown);
    expect(parsed.resume.basics.name).toBe("Maya Okafor");
    expect(parsed.resume.basics.contact.email).toBe("maya@okafor.example");
    expect(parsed.resume.basics.contact.profiles.map((p) => p.network)).toContain("github");
    expect(parsed.resume.experience).toHaveLength(1);
    expect(parsed.resume.experience[0]).toMatchObject({ role: "Senior Product Engineer", company: "Lumen Labs" });
    expect(parsed.resume.skills.flatMap((s) => s.items)).toEqual(expect.arrayContaining(["TypeScript", "Python", "SQL"]));
  });

  it("returns empty string for an empty docx", async () => {
    const emptyDocx = buildDocx("<w:p/>");
    expect(await extractTextFromDocx(emptyDocx)).toBe("");
  });

  it("throws DocumentImportError on corrupt docx bytes", async () => {
    const corrupt = new TextEncoder().encode("not a zip archive").buffer;
    await expect(extractTextFromDocx(corrupt)).rejects.toBeInstanceOf(DocumentImportError);
  });
});

describe("extractTextFromPdf", () => {
  it("reconstructs lines, blank-line section breaks, right-aligned dates and link annotations", async () => {
    const pdf = buildPdf([
      {
        items: [
          { x: 54, y: 740, text: "PRIYA RAMANATHAN", size: 16 },
          { x: 54, y: 722, text: "Machine Learning Engineer", size: 11 },
          { x: 54, y: 706, text: "priya@example.com | San Francisco, CA | ", size: 10 },
          { x: 250, y: 706, text: "GitHub", size: 10 },
          { x: 54, y: 676, text: "EXPERIENCE", size: 12 },
          { x: 54, y: 658, text: "Stratus Analytics - Senior ML Engineer", size: 11 },
          { x: 430, y: 658, text: "Jan 2021 - Present", size: 11 },
          { x: 64, y: 642, text: "- Built two-tower retrieval model in PyTorch", size: 10 },
          { x: 64, y: 628, text: "- Designed Snowflake feature store", size: 10 },
          { x: 54, y: 598, text: "SKILLS", size: 12 },
          { x: 54, y: 580, text: "Languages: Python, SQL, Scala", size: 10 },
        ],
        links: [{ rect: [248, 703, 290, 718], url: "https://github.com/priyaram-ml" }],
      },
    ]);

    const text = await extractTextFromPdf(pdf);
    expect(text).toContain("PRIYA RAMANATHAN");
    expect(text).toContain("[GitHub](https://github.com/priyaram-ml)");
    expect(text).toMatch(/Stratus Analytics - Senior ML Engineer\s{2,}Jan 2021 - Present/);

    const parsed = parseResume(text);
    expect(parsed.resume.basics.name).toBe("Priya Ramanathan");
    expect(parsed.resume.basics.contact.email).toBe("priya@example.com");
    expect(parsed.resume.basics.contact.profiles.map((p) => p.network)).toContain("github");
    expect(parsed.resume.experience).toHaveLength(1);
    expect(parsed.resume.experience[0]).toMatchObject({ company: "Stratus Analytics", role: "Senior ML Engineer" });
    expect(parsed.resume.skills.flatMap((s) => s.items)).toEqual(expect.arrayContaining(["Python", "SQL", "Scala"]));
  });

  it("separates a two-column resume instead of interleaving sidebar and main text", async () => {
    const pdf = buildPdf([
      {
        items: [
          // Full-width top header
          { x: 54, y: 740, text: "JORDAN LEE", size: 16 },
          { x: 54, y: 722, text: "Staff Backend Engineer", size: 11 },
          // Left sidebar (x: 54..190)
          { x: 54, y: 680, text: "CONTACT", size: 11 },
          { x: 54, y: 664, text: "jordan@example.com", size: 10 },
          { x: 54, y: 648, text: "Seattle, WA", size: 10 },
          { x: 54, y: 620, text: "SKILLS", size: 11 },
          { x: 54, y: 604, text: "Go, Rust, PostgreSQL", size: 10 },
          { x: 54, y: 588, text: "Kubernetes, Terraform", size: 10 },
          // Right main column (x: 240..540)
          { x: 240, y: 680, text: "EXPERIENCE", size: 11 },
          { x: 240, y: 664, text: "Staff Engineer - CloudCore (2022 - Present)", size: 10 },
          { x: 240, y: 648, text: "- Scaled ingestion pipeline to 1M events/sec", size: 10 },
          { x: 240, y: 632, text: "- Cut p99 latency by 45% across core APIs", size: 10 },
          { x: 240, y: 604, text: "EDUCATION", size: 11 },
          { x: 240, y: 588, text: "B.S. Computer Science - UW, 2016", size: 10 },
        ],
      },
    ]);

    const text = await extractTextFromPdf(pdf);
    const lines = text.split("\n");
    expect(lines.some((line) => line.includes("jordan@example.com") && line.includes("CloudCore"))).toBe(false);
    expect(text.indexOf("JORDAN LEE")).toBeLessThan(text.indexOf("CONTACT"));
    expect(text.indexOf("SKILLS")).toBeLessThan(text.indexOf("EXPERIENCE"));

    const parsed = parseResume(text);
    expect(parsed.resume.basics.name).toBe("Jordan Lee");
    expect(parsed.resume.basics.contact.email).toBe("jordan@example.com");
    expect(parsed.resume.experience).toHaveLength(1);
    expect(parsed.resume.education).toHaveLength(1);
  });

  it("joins multi-page PDFs cleanly", async () => {
    const pdf = buildPdf([
      { items: [{ x: 54, y: 740, text: "Page One Name", size: 14 }] },
      { items: [{ x: 54, y: 740, text: "Page Two Experience", size: 14 }] },
    ]);
    const text = await extractTextFromPdf(pdf);
    expect(text).toContain("Page One Name");
    expect(text).toContain("Page Two Experience");
  });

  it("throws DocumentImportError with code 'no-text' when PDF pages contain no selectable text", async () => {
    const emptyPdf = buildPdf([{ items: [] }]);
    await expect(extractTextFromPdf(emptyPdf)).rejects.toMatchObject({
      name: "DocumentImportError",
      code: "no-text",
    } satisfies Partial<DocumentImportError>);
  });

  it("throws DocumentImportError with code 'password' for password-protected PDFs", async () => {
    const objs = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
      "<< /Filter /Standard /V 1 /R 2 /O (01234567890123456789012345678901) /U (01234567890123456789012345678901) /P -4 >>",
    ];
    let s = "%PDF-1.4\n";
    const off = [0];
    objs.forEach((o, i) => {
      off.push(s.length);
      s += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const x = s.length;
    s += `xref\n0 5\n0000000000 65535 f \n${off.slice(1).map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 5 /Root 1 0 R /Encrypt 4 0 R /ID [<0123> <0123>] >>\nstartxref\n${x}\n%%EOF\n`;
    await expect(extractTextFromPdf(new TextEncoder().encode(s).buffer)).rejects.toMatchObject({
      name: "DocumentImportError",
      code: "password",
    } satisfies Partial<DocumentImportError>);
  });

  it("throws DocumentImportError on corrupt PDF bytes", async () => {
    const corrupt = new TextEncoder().encode("not a pdf").buffer;
    await expect(extractTextFromPdf(corrupt)).rejects.toBeInstanceOf(DocumentImportError);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { ACCEPTED_FILE_TYPES, importResumeFile, INITIAL_IMPORT_STATE } from "./import-action";
import { INITIAL_STATE, usePortfolioStore } from "./portfolio-store";

// Minimal valid PDF with one text line ("Alex Rivera")
function minimalPdfBytes(line: string): Uint8Array<ArrayBuffer> {
  const esc = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = `BT /F1 12 Tf 1 0 0 1 72 720 Tm (${esc}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  let len = parts[0]!.length;
  for (let i = 0; i < objs.length; i++) {
    offsets.push(len);
    const s = `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
    parts.push(s);
    len += s.length;
  }
  const xref = len;
  parts.push(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) parts.push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  parts.push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const encoded = new TextEncoder().encode(parts.join(""));
  return new Uint8Array(encoded.buffer.slice(0));
}

// Minimal valid empty/single-paragraph .docx
function minimalDocxBytes(paragraph: string): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const entries = [
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/contenttypes"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    },
    {
      name: "word/document.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${paragraph}</w:t></w:r></w:p></w:body></w:document>`,
    },
  ];
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  const crc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff;
    for (const b of bytes) crc = (table[(crc ^ b) & 0xff] ?? 0) ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const nb = enc.encode(e.name);
    const db = enc.encode(e.content);
    const crc = crc32(db);
    const lh = new Uint8Array(30 + nb.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, db.length, true);
    lv.setUint32(22, db.length, true);
    lv.setUint16(26, nb.length, true);
    lh.set(nb, 30);
    const ch = new Uint8Array(46 + nb.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, db.length, true);
    cv.setUint32(24, db.length, true);
    cv.setUint16(28, nb.length, true);
    cv.setUint32(42, offset, true);
    ch.set(nb, 46);
    locals.push(lh, db);
    centrals.push(ch);
    offset += lh.length + db.length;
  }
  const cs = centrals.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cs, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cs + eocd.length);
  let pos = 0;
  for (const p of [...locals, ...centrals, eocd]) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

afterEach(() => {
  usePortfolioStore.setState(INITIAL_STATE);
});

describe("ACCEPTED_FILE_TYPES", () => {
  it("advertises .pdf and .docx extensions and MIME types", () => {
    expect(ACCEPTED_FILE_TYPES).toContain(".pdf");
    expect(ACCEPTED_FILE_TYPES).toContain(".docx");
    expect(ACCEPTED_FILE_TYPES).toContain("application/pdf");
    expect(ACCEPTED_FILE_TYPES).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });
});

describe("importResumeFile", () => {
  it("imports markdown and text files into the store", async () => {
    const file = new File(["# Jane Doe\nSoftware Engineer"], "resume.md", { type: "text/markdown" });
    const result = await importResumeFile(INITIAL_IMPORT_STATE, file);

    expect(result).toMatchObject({ status: "success", message: "Imported resume.md" });
    expect(usePortfolioStore.getState().source).toBe("# Jane Doe\nSoftware Engineer");
  });

  it("imports a .docx file even when browser omits MIME type", async () => {
    const file = new File([minimalDocxBytes("Jeremiah Jacobson")], "Jeremiah Jacobson - Resume.docx", { type: "" });
    const result = await importResumeFile(INITIAL_IMPORT_STATE, file);

    expect(result).toMatchObject({ status: "success", message: "Imported Jeremiah Jacobson - Resume.docx" });
    expect(usePortfolioStore.getState().source).toContain("Jeremiah Jacobson");
  });

  it("imports a .docx identified by MIME type", async () => {
    const file = new File([minimalDocxBytes("Maya Okafor")], "resume-upload", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await importResumeFile(INITIAL_IMPORT_STATE, file);

    expect(result.status).toBe("success");
    expect(usePortfolioStore.getState().source).toContain("Maya Okafor");
  });

  it("imports a .pdf file into the store (case-insensitive extension)", async () => {
    const file = new File([minimalPdfBytes("Alex Rivera")], "RESUME.PDF", { type: "" });
    const result = await importResumeFile(INITIAL_IMPORT_STATE, file);

    expect(result).toMatchObject({ status: "success", message: "Imported RESUME.PDF" });
    expect(usePortfolioStore.getState().source).toContain("Alex Rivera");
  });

  it("returns a helpful error for a scanned/empty .pdf", async () => {
    const emptyPagePdf = new TextEncoder().encode(
      [
        "%PDF-1.4\n",
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n",
        "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n",
        "trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n",
      ].join(""),
    );
    const file = new File([emptyPagePdf], "scanned.pdf", { type: "application/pdf" });
    const result = await importResumeFile(INITIAL_IMPORT_STATE, file);

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/selectable text|empty/i);
  });

  it("returns a helpful error for password-protected .pdf files", async () => {
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
    const file = new File([new TextEncoder().encode(s)], "protected.pdf", { type: "application/pdf" });
    const result = await importResumeFile(INITIAL_IMPORT_STATE, file);

    expect(result.status).toBe("error");
    expect(result.message).toContain("password-protected");
  });

  it("returns an empty-file error for a blank .docx", async () => {
    const file = new File([minimalDocxBytes("")], "blank.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await importResumeFile(INITIAL_IMPORT_STATE, file);
    expect(result).toMatchObject({ status: "error", message: "“blank.docx” is empty." });
  });

  it("rejects unsupported file formats with a message listing supported types", async () => {
    const file = new File(["binary"], "resume.png", { type: "image/png" });
    const result = await importResumeFile(INITIAL_IMPORT_STATE, file);

    expect(result.status).toBe("error");
    expect(result.message).toContain(".pdf");
    expect(result.message).toContain(".docx");
  });

  it("enforces size limits for text and document files", async () => {
    const bigText = new File([new Uint8Array(600 * 1024)], "huge.txt", { type: "text/plain" });
    const textResult = await importResumeFile(INITIAL_IMPORT_STATE, bigText);
    expect(textResult.status).toBe("error");
    expect(textResult.message).toContain("512 KB");

    const bigPdf = new File([new Uint8Array(11 * 1024 * 1024)], "huge.pdf", { type: "application/pdf" });
    const pdfResult = await importResumeFile(INITIAL_IMPORT_STATE, bigPdf);
    expect(pdfResult.status).toBe("error");
    expect(pdfResult.message).toContain("10 MB");
  });

  it("returns an error instead of throwing on corrupt .docx or .pdf files", async () => {
    const badDocx = new File(["corrupt"], "bad.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const docxResult = await importResumeFile(INITIAL_IMPORT_STATE, badDocx);
    expect(docxResult).toMatchObject({ status: "error", message: "Couldn't read “bad.docx”." });

    const badPdf = new File(["corrupt"], "bad.pdf", { type: "application/pdf" });
    const pdfResult = await importResumeFile(INITIAL_IMPORT_STATE, badPdf);
    expect(pdfResult).toMatchObject({ status: "error", message: "Couldn't read “bad.pdf”." });
  });
});

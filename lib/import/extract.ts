import JSZip from "jszip";

/** 提取结果:书名 + 按章节/页的纯文本 */
export interface ExtractedBook {
  title: string;
  sections: { title: string; text: string }[];
}

/** 把 xhtml/html 转为按行组织的纯文本(块级标签断行,行内标签去壳) */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote|dt|dd|table)>/gi, "\n")
    .replace(/<(h[1-6])[^>]*>/gi, "\n## ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  return s
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i + 1) : "";
}

function resolvePath(base: string, rel: string): string {
  if (rel.startsWith("/")) return rel.slice(1);
  const parts = (base + rel).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "." || p === "") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

/** 解析 EPUB(zip):读 OPF spine 顺序,逐章提取文本 */
export async function extractEpub(data: ArrayBuffer): Promise<ExtractedBook> {
  const zip = await JSZip.loadAsync(data);

  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("无效的 EPUB:缺少 container.xml");
  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("无效的 EPUB:找不到 OPF 路径");
  const opf = await zip.file(opfPath)?.async("string");
  if (!opf) throw new Error("无效的 EPUB:缺少 OPF 文件");
  const opfDir = dirOf(opfPath);

  const title =
    opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() ?? "";

  // manifest: id -> href
  const manifest = new Map<string, string>();
  for (const m of opf.matchAll(/<item\b[^>]*>/gi)) {
    const tag = m[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    const type = tag.match(/media-type="([^"]+)"/)?.[1] ?? "";
    if (id && href && /html|xml/i.test(type)) manifest.set(id, href);
  }

  // spine 顺序
  const idrefs = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/gi)].map((m) => m[1]);
  const hrefs = idrefs
    .map((id) => manifest.get(id))
    .filter((h): h is string => !!h);

  const sections: ExtractedBook["sections"] = [];
  for (const href of hrefs) {
    const path = resolvePath(opfDir, decodeURIComponent(href));
    const html = await zip.file(path)?.async("string");
    if (!html) continue;
    const text = htmlToText(html);
    if (text.length < 40) continue;
    const heading =
      html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ??
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ??
      path.split("/").pop() ??
      "";
    sections.push({ title: heading, text });
  }
  if (sections.length === 0) throw new Error("EPUB 中未找到可读文本章节");
  return { title, sections };
}

/**
 * 解析 PDF:pdfjs 按页取 text items,依据 y 坐标还原行结构。
 * 仅 Web 平台可用(pdfjs 依赖浏览器环境)。
 */
export async function extractPdf(data: ArrayBuffer): Promise<ExtractedBook> {
  // pdfjs-dist 仅 web 平台可用(依赖浏览器 canvas/worker)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = await (Function('return import("pdfjs-dist/legacy/build/pdf")')() as Promise<any>);
  try { await (Function('return import("pdfjs-dist/legacy/build/pdf.worker.entry")')() as Promise<any>); } catch { /* ok */ }

  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const meta = await doc.getMetadata().catch(() => null);
  const title = (meta?.info as { Title?: string } | undefined)?.Title ?? "";

  const sections: ExtractedBook["sections"] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4] as number;
      const y = item.transform[5] as number;
      const line = lines.find((l) => Math.abs(l.y - y) < 3);
      if (line) line.parts.push({ x, str: item.str });
      else lines.push({ y, parts: [{ x, str: item.str }] });
    }
    lines.sort((a, b) => b.y - a.y);
    const text = lines
      .map((l) =>
        l.parts
          .sort((a, b) => a.x - b.x)
          .map((s) => s.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join("\n");
    if (text.length >= 20) sections.push({ title: `第 ${p} 页`, text });
    page.cleanup();
  }
  await doc.destroy();
  if (sections.length === 0) throw new Error("PDF 中未提取到文本(可能是扫描版图片 PDF)");
  return { title, sections };
}

/** OCR 用的图片(base64 不含 data: 前缀) */
export interface OcrImage {
  base64: string;
  mime: string;
}

/**
 * 把 PDF 页面渲染为 JPEG 图片(供扫描版 PDF 做 AI OCR)。
 * 仅 Web 平台可用(依赖 canvas)。
 */
export async function renderPdfPagesToImages(
  data: ArrayBuffer,
  opts: { maxPages?: number; scale?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<OcrImage[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjs = await (Function('return import("pdfjs-dist/legacy/build/pdf")')() as Promise<any>);
  try { await (Function('return import("pdfjs-dist/legacy/build/pdf.worker.entry")')() as Promise<any>); } catch { /* ok */ }

  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const total = Math.min(doc.numPages, opts.maxPages ?? 40);
  const images: OcrImage[] = [];
  for (let p = 1; p <= total; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: opts.scale ?? 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 不可用");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    images.push({ base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mime: "image/jpeg" });
    page.cleanup();
    opts.onProgress?.(p, total);
  }
  await doc.destroy();
  return images;
}

/** 从图片版 EPUB 中按顺序提取书页图片(跳过小图标,供 AI OCR) */
export async function extractEpubImages(data: ArrayBuffer, max = 24): Promise<OcrImage[]> {
  const zip = await JSZip.loadAsync(data);
  const entries: { path: string; file: JSZip.JSZipObject }[] = [];
  zip.forEach((path, file) => {
    if (!file.dir && /\.(jpe?g|png|webp)$/i.test(path)) entries.push({ path, file });
  });
  const out: OcrImage[] = [];
  for (const e of entries) {
    if (out.length >= max) break;
    const base64 = await e.file.async("base64");
    // 跳过小图标(<~15KB)与超过单张上限(~2.6MB)的图片
    if (base64.length < 20_000 || base64.length > 3_500_000) continue;
    const mime = /\.png$/i.test(e.path)
      ? "image/png"
      : /\.webp$/i.test(e.path)
        ? "image/webp"
        : "image/jpeg";
    out.push({ base64, mime });
  }
  return out;
}

/** 把图片按张数与请求体积预算分批(单批 ≤ maxCount 张且 base64 总长 ≤ budget) */
export function batchImagesForOcr(
  images: OcrImage[],
  maxCount = 6,
  budget = 11_000_000,
): OcrImage[][] {
  const batches: OcrImage[][] = [];
  let cur: OcrImage[] = [];
  let size = 0;
  for (const img of images) {
    if (cur.length > 0 && (cur.length >= maxCount || size + img.base64.length > budget)) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(img);
    size += img.base64.length;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

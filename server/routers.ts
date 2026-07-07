import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

/** 批量导入:从文件 base64 提取纯文本(xlsx/docx/csv/txt;pdf 走 LLM file_url) */
async function extractFileText(
  fileBase64: string,
  fileName: string,
): Promise<{ text?: string; pdfBase64?: string }> {
  const lower = fileName.toLowerCase();
  const buf = Buffer.from(fileBase64, "base64");
  if (lower.endsWith(".pdf")) {
    return { pdfBase64: fileBase64 };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const parts: string[] = [];
    for (const name of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
      if (csv.trim()) parts.push(`## Sheet: ${name}\n${csv}`);
    }
    return { text: parts.join("\n\n") };
  }
  if (lower.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: result.value };
  }
  // csv / txt / md 等按 UTF-8 文本处理
  return { text: buf.toString("utf-8") };
}

const EXTRACT_SYSTEM_PROMPT = `你是一个鸡尾酒应用的数据导入助手。用户会提供一段文本(可能来自 PDF/Excel/Word/粘贴),内容可能包含:
1. bottle(酒库条目):市售的瓶装酒/原料,如金酒、威士忌、利口酒、苦精、糖浆、果汁、软饮等
2. prep(自制库条目):自制的糖浆、利口酒、风味液体、浸渍酒等,通常有做法/保质期/储存方式
3. recipe(酒单配方):鸡尾酒配方,有配料表和调制步骤

请从文本中提取所有可识别的条目,输出 JSON:
{"items":[{
  "type":"bottle"|"prep"|"recipe",
  "nameZh":"中文名(没有则译)","nameEn":"英文名(没有则译或拼音)",
  "category":"bottle分类,如 金酒/威士忌/利口酒/苦精/糖浆/果汁/软饮","style":"风格子分类,如 London Dry/Bourbon","brand":"品牌","origin":"产地","volume":"规格如 700ml","abv":40,"priceCny":0,
  "prepIngredients":["prep配料一行一条"],"prepRecipe":"做法","prepYield":"产量如 ~750ml","shelfLife":"保质期","storage":"储存方式",
  "baseSpirit":"recipe基酒,如 金酒","glass":"杯型","method":"调制法,如 摇和/搅拌","ingredients":[{"name":"配料名","amount":"用量如 45ml"}],"steps":"步骤(可多行)","garnish":"装饰","source":"出处",
  "notes":"备注"
}]}
规则:
- 数值字段 abv/priceCny 输出数字,未知填 0
- 未知的字符串字段填 ""
- 不要编造文本中不存在的条目;表格中每一行通常是一个条目
- 类型判断:有配料+步骤的是 recipe;有做法/保质期且是自制物的是 prep;其余瓶装商品是 bottle
- 最多提取 60 条`;

const bulkItemSchema = z.object({
  type: z.enum(["bottle", "prep", "recipe"]),
  nameZh: z.string().catch(""),
  nameEn: z.string().catch(""),
  category: z.string().catch(""),
  style: z.string().catch(""),
  brand: z.string().catch(""),
  origin: z.string().catch(""),
  volume: z.string().catch(""),
  abv: z.number().catch(0),
  priceCny: z.number().catch(0),
  prepIngredients: z.array(z.string()).catch([]),
  prepRecipe: z.string().catch(""),
  prepYield: z.string().catch(""),
  shelfLife: z.string().catch(""),
  storage: z.string().catch(""),
  baseSpirit: z.string().catch(""),
  glass: z.string().catch(""),
  method: z.string().catch(""),
  ingredients: z
    .array(z.object({ name: z.string().catch(""), amount: z.string().catch("") }))
    .catch([]),
  steps: z.string().catch(""),
  garnish: z.string().catch(""),
  source: z.string().catch(""),
  notes: z.string().catch(""),
});

export type BulkImportItem = z.infer<typeof bulkItemSchema>;

type LLMContent = Parameters<typeof invokeLLM>[0]["messages"][number]["content"];

async function llmExtract(userContent: LLMContent): Promise<BulkImportItem[]> {
  const response = await invokeLLM({
    messages: [
      { role: "system", content: EXTRACT_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
  });
  const raw = response.choices[0]?.message?.content;
  const text = typeof raw === "string" ? raw : "";
  let parsed: unknown = { items: [] };
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = { items: [] };
      }
    }
  }
  const arr = Array.isArray((parsed as { items?: unknown[] })?.items)
    ? (parsed as { items: unknown[] }).items
    : [];
  const items: BulkImportItem[] = [];
  for (const it of arr.slice(0, 60)) {
    const r = bulkItemSchema.safeParse(it);
    if (r.success && (r.data.nameZh.trim() || r.data.nameEn.trim())) items.push(r.data);
  }
  return items;
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  bulkImport: router({
    /** 智能提取:文本或文件(base64) → 结构化条目列表 */
    extract: publicProcedure
      .input(
        z.object({
          text: z.string().max(200_000).optional(),
          fileBase64: z.string().max(14_000_000).optional(),
          fileName: z.string().max(255).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        if (input.fileBase64 && input.fileName) {
          const { text, pdfBase64 } = await extractFileText(input.fileBase64, input.fileName);
          if (pdfBase64) {
            const items = await llmExtract([
              {
                type: "file_url",
                file_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                  mime_type: "application/pdf",
                },
              },
              { type: "text", text: "请从这份 PDF 中提取条目。" },
            ] as LLMContent);
            return { items };
          }
          const content = (text ?? "").trim();
          if (!content) return { items: [] as BulkImportItem[] };
          return { items: await llmExtract(content.slice(0, 100_000)) };
        }
        const content = (input.text ?? "").trim();
        if (!content) return { items: [] as BulkImportItem[] };
        return { items: await llmExtract(content.slice(0, 100_000)) };
      }),
  }),
});

export type AppRouter = typeof appRouter;

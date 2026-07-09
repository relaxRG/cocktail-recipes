import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { z } from "zod";
import { invokeLLM, type MessageContent } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAppConfigValue,
  getSyncData,
  setAppConfigValue,
  upsertSyncData,
} from "./db";

const OWNER_KEY = "ownerOpenId";

/**
 * 访问控制:应用为私人使用。
 * 第一个登录的用户自动成为 owner;之后仅 owner 可访问同步数据。
 */
async function ensureOwner(user: { id: number; openId: string }) {
  const owner = await getAppConfigValue(OWNER_KEY);
  if (!owner) {
    await setAppConfigValue(OWNER_KEY, user.openId);
    return true;
  }
  return owner === user.openId;
}

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
4. material(原材料库条目):新鲜水果、香草香料、糖类、蛋奶、茶咖等调酒原材料,常见于供应商报价表/采购单

特别注意——供应商报价表/采购价目表(如"水果报价表"):
- 表格通常有 品名/规格/单位/单价 等列,每行一条原料
- 只提取对调酒有用的原料(如柠檬、青柠、橙、西柚、菠萝、百香果、草莓、黄瓜、薄荷、姜等常用于鸡尾酒的水果/香草);明显与调酒无关的条目(如榴莲整箱、大宗蔬菜)跳过
- 这类条目 type 输出 "material",category 固定填 "原材料",style 按性质填以下之一:Fruit & Citrus(水果柑橘)/Herb(新鲜香草)/Spice & Botanical(香料草本)/Sugar & Sweetener(糖与甜味剂)/Dairy & Egg(乳制品蛋类)/Nut / Tea / Coffee(坚果茶咖)/Acid & Additive(酸剂添加剂)
- 价格换算:报价常为 元/斤 或 元/箱(含规格),尽量折算为该条目 volume 规格对应的价格;无法折算时保留原单价并在 notes 注明计价单位(如"报价 8元/斤")

请从文本中提取所有可识别的条目,输出 JSON:
{"items":[{
  "type":"bottle"|"prep"|"recipe"|"material",
  "nameZh":"中文名(没有则译)","nameEn":"英文名(没有则译或拼音)",
  "category":"bottle分类,如 金酒/威士忌/利口酒/苦精/糖浆/果汁/软饮;material固定为 原材料","style":"风格子分类,如 London Dry/Bourbon;material如 Fruit & Citrus","brand":"品牌","origin":"产地","volume":"规格如 700ml/500g/1斤","abv":40,"priceCny":0,
  "prepIngredients":["prep配料一行一条"],"prepRecipe":"做法","prepYield":"产量如 ~750ml","shelfLife":"保质期","storage":"储存方式",
  "baseSpirit":"recipe基酒,如 金酒","glass":"杯型","method":"调制法,如 摇和/搅拌","ingredients":[{"name":"配料名","amount":"用量如 45ml"}],"steps":"步骤(可多行)","garnish":"装饰","source":"出处",
  "variantOf":"文本明确写明的经典变体来源(如 '尼格罗尼的变体'/'Variant of Sidecar'),没写则空","codexFamily":"文本明确写明的 Codex 六大家族/母配方归属(如 'Family: Sidecar'/'六大家族:大吉利'),仅在文本明确声明时填写原文,没写则空",
  "notes":"备注"
}]}
规则:
- 数值字段 abv/priceCny 输出数字,未知填 0
- 未知的字符串字段填 ""
- variantOf/codexFamily 只在原文明确声明时提取(不要自行推断)
- source(引用来源)对 recipe 与 prep 都要尽力提取:书名/作者/酒吧/网站/年份等来源信息(如 "The Waldorf Astoria Bar Book · Frank Caiafa"),并且不要把来源信息重复写进 notes
- nameZh 与 nameEn 必须都给出:缺英文名时给出通用英文译名(如 柠檬→Lemon,百香果→Passion Fruit),缺中文名时给出通用中文译名
- 不要编造文本中不存在的条目;表格中每一行通常是一个条目
- 类型判断:有配料+步骤的是 recipe;有做法/保质期且是自制物的是 prep;新鲜水果/香草/糖/蛋奶等非瓶装酒水原料是 material;其余瓶装商品是 bottle
- 最多提取 60 条`;

const bulkItemSchema = z.object({
  type: z.enum(["bottle", "prep", "recipe", "material"]),
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
  variantOf: z.string().catch(""),
  codexFamily: z.string().catch(""),
  notes: z.string().catch(""),
});

export type BulkImportItem = z.infer<typeof bulkItemSchema>;

type LLMContent = Parameters<typeof invokeLLM>[0]["messages"][number]["content"];

// ─── OCR ──────────────────────────────────────────────────────────────────────
const OCR_SYSTEM_PROMPT = `你是一个精准的书页文字转写(OCR)助手。用户提供书页图片或扫描版 PDF,请把全部可读文字按原始阅读顺序完整转写为纯文本:
- 章节标题或配方名称行加 "## " 前缀
- 配料行保持"名称 用量"格式,一行一条
- 保留换行与条目边界,不要合并不同配方
- 只输出转写文本:不要解释、不要翻译、不要 markdown 代码块
- 页面没有文字时输出空字符串`;

async function llmOcr(content: MessageContent[]): Promise<string> {
  const response = await invokeLLM({
    messages: [{ role: "system", content: OCR_SYSTEM_PROMPT }, { role: "user", content }],
  });
  const raw = response.choices[0]?.message?.content;
  return typeof raw === "string" ? raw.trim() : "";
}

// ─── 翻译 ──────────────────────────────────────────────────────────────────────
const TRANSLATE_SYSTEM_PROMPT = (target: "zh" | "en") =>
  `你是专业的调酒书籍译者。把用户 JSON 中的每个配方条目翻译成${
    target === "zh" ? "中文" : "英文(English)"
  }。规则:
- 使用调酒行业标准术语(如 gin↔金酒、shake↔摇和、coupe↔库佩杯)
- amount 用量中的数字与单位保持原样(如 45ml、2 dash、1 bar spoon)
- 品牌等专有名词保留原文
- id 原样返回;不得增删条目
- 已是目标语言的内容原样保留
输出 JSON:{"items":[{"id":"","name":"","ingredients":[{"name":"","amount":""}],"steps":"","garnish":"","glass":"","method":""}]}`;

const translatedItemSchema = z.object({
  id: z.string().catch(""),
  name: z.string().catch(""),
  ingredients: z.array(z.object({ name: z.string().catch(""), amount: z.string().catch("") })).catch([]),
  steps: z.string().catch(""),
  garnish: z.string().catch(""),
  glass: z.string().catch(""),
  method: z.string().catch(""),
});
export type TranslatedRecipeItem = z.infer<typeof translatedItemSchema>;

// ─── 联网补全 ──────────────────────────────────────────────────────────────────
const ENRICH_SYSTEM_PROMPT = `你是一个鸡尾酒/酒类知识专家。用户会给出一个或多个酒、原料或产品的名称(可能含品牌、也可能附照片)。请根据你已有的行业知识,尽力还原每件产品的真实资料,补全为结构化条目。
请输出 JSON:{"items":[{"query":"原样返回用户给出的名称","found":true,"nameZh":"中文名","nameEn":"英文名","category":"金酒/朗姆/伏特加/威士忌/龙舌兰/白兰地/利口酒/苦精/味美思/开胃酒/起泡酒/葡萄酒/清酒烧酒/中式白酒/糖浆/软饮/糖与甜味剂/果蔬/香料与草本/花卉/茶咖与可可/坚果与谷物/乳蛋/酸类与添加剂/其他","style":"","brand":"","origin":"","volume":"700ml","abv":40,"priceCny":170,"notes":"一句话简介(中文,50字内)","confidence":"high"}]}
规则:完全无法识别的名称输出{"query":"原名","found":false};abv/priceCny未知填0;category必须严格落在枚举中;不要编造品牌;confidence:知名大牌high,通用品类medium,勉强猜测low`;

const enrichSchema = z.object({
  query: z.string().catch(""),
  found: z.boolean().catch(true),
  nameZh: z.string().catch(""),
  nameEn: z.string().catch(""),
  category: z.string().catch(""),
  style: z.string().catch(""),
  brand: z.string().catch(""),
  origin: z.string().catch(""),
  volume: z.string().catch(""),
  abv: z.number().catch(0),
  priceCny: z.number().catch(0),
  notes: z.string().catch(""),
  confidence: z.enum(["high", "medium", "low"]).catch("medium"),
});
export type EnrichedProduct = z.infer<typeof enrichSchema>;

function parseJsonObjectLoose(text: string): unknown {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return {}; } }
    return {};
  }
}


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
          imageBase64: z.string().max(14_000_000).optional(),
          imageMime: z.string().max(64).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        if (input.imageBase64) {
          const mime = input.imageMime || "image/jpeg";
          const items = await llmExtract([
            {
              type: "image_url",
              image_url: { url: `data:${mime};base64,${input.imageBase64}` },
            },
            {
              type: "text",
              text: "请识别这张照片中的中英文内容(可能是配方书页、酒瓶标签、价目表、手写笔记等),提取全部条目。",
            },
          ] as LLMContent);
          return { items };
        }
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

  bookImport: router({
    /** 扫描版/图片书:LLM 视觉 OCR → 纯文本(供客户端本地配方检测) */
    ocr: publicProcedure
      .input(
        z.object({
          pdfBase64: z.string().max(14_000_000).optional(),
          images: z
            .array(z.object({ base64: z.string().max(3_500_000), mime: z.string().max(64) }))
            .max(8)
            .optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const parts: LLMContent[] = [];
        if (input.pdfBase64) {
          parts.push({
            type: "file_url",
            file_url: {
              url: `data:application/pdf;base64,${input.pdfBase64}`,
              mime_type: "application/pdf",
            },
          } as LLMContent);
        }
        for (const img of input.images ?? []) {
          parts.push({
            type: "image_url",
            image_url: { url: `data:${img.mime};base64,${img.base64}` },
          } as LLMContent);
        }
        if (parts.length === 0) return { text: "" };
        parts.push({ type: "text", text: "请完整转写以上书页中的全部文字。" } as LLMContent);
        return { text: await llmOcr(parts as MessageContent[]) };
      }),

    /** 配方候选批量翻译(用量单位保留原样) */
    translate: publicProcedure
      .input(
        z.object({
          target: z.enum(["zh", "en"]),
          items: z
            .array(
              z.object({
                id: z.string().max(64),
                name: z.string().max(200),
                ingredients: z
                  .array(z.object({ name: z.string().max(200), amount: z.string().max(64) }))
                  .max(40),
                steps: z.string().max(6000),
                garnish: z.string().max(500),
                glass: z.string().max(100),
                method: z.string().max(100),
              }),
            )
            .min(1)
            .max(20),
        }),
      )
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: TRANSLATE_SYSTEM_PROMPT(input.target) },
            { role: "user", content: JSON.stringify({ items: input.items }) },
          ],
          response_format: { type: "json_object" },
        });
        const raw = response.choices[0]?.message?.content;
        const parsed = parseJsonObjectLoose(typeof raw === "string" ? raw : "");
        const arr = Array.isArray((parsed as { items?: unknown[] })?.items)
          ? (parsed as { items: unknown[] }).items
          : [];
        const items: TranslatedRecipeItem[] = [];
        for (const it of arr.slice(0, 20)) {
          const r = translatedItemSchema.safeParse(it);
          if (r.success && r.data.id) items.push(r.data);
        }
        return { items };
      }),
  }),

  lookup: router({
    /** 联网识别:未知产品名称/照片 → LLM 知识补全为结构化资料 */
    enrich: publicProcedure
      .input(
        z.object({
          names: z.array(z.string().min(1).max(200)).max(8).default([]),
          imageBase64: z.string().max(14_000_000).optional(),
          imageMime: z.string().max(64).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const names = input.names.map((n) => n.trim()).filter(Boolean);
        if (names.length === 0 && !input.imageBase64) return { items: [] as EnrichedProduct[] };
        const parts: LLMContent[] = [];
        if (input.imageBase64) {
          const mime = input.imageMime || "image/jpeg";
          parts.push({
            type: "image_url",
            image_url: { url: `data:${mime};base64,${input.imageBase64}` },
          } as LLMContent);
        }
        parts.push({
          type: "text",
          text:
            names.length > 0
              ? `请补全以下产品的资料:\n${names.map((n) => `- ${n}`).join("\n")}`
              : "请识别照片中的产品并补全资料。",
        } as LLMContent);
        const response = await invokeLLM({
          messages: [
            { role: "system", content: ENRICH_SYSTEM_PROMPT },
            { role: "user", content: parts as MessageContent[] },
          ],
          response_format: { type: "json_object" },
        });
        const raw = response.choices[0]?.message?.content;
        const parsed = parseJsonObjectLoose(typeof raw === "string" ? raw : "");
        const arr = Array.isArray((parsed as { items?: unknown[] })?.items)
          ? (parsed as { items: unknown[] }).items
          : [];
        const items: EnrichedProduct[] = [];
        for (const it of arr.slice(0, 8)) {
          const r = enrichSchema.safeParse(it);
          if (r.success) items.push(r.data);
        }
        return { items };
      }),
  }),

  sync: router({
    /** 检查当前登录用户是否有访问权 */
    access: protectedProcedure.query(async ({ ctx }) => {
      const allowed = await ensureOwner(ctx.user);
      return { allowed } as const;
    }),
    /** 拉取云端全部同步数据 */
    pull: protectedProcedure.query(async ({ ctx }) => {
      const allowed = await ensureOwner(ctx.user);
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Private app" });
      const entries = await getSyncData(ctx.user.id);
      return { entries } as const;
    }),
    /** 推送本地改动(last-write-wins per key) */
    push: protectedProcedure
      .input(
        z.object({
          entries: z
            .array(
              z.object({
                storageKey: z.string().max(128),
                value: z.string().max(15_000_000),
                clientUpdatedAt: z.number(),
              }),
            )
            .max(40),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const allowed = await ensureOwner(ctx.user);
        if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Private app" });
        await upsertSyncData(ctx.user.id, input.entries);
        return { success: true, count: input.entries.length } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;

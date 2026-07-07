// 调试:直接复现 server 的 xlsx 文本提取逻辑,确认文本是否正常
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSXmod from "xlsx";
const XLSX = XLSXmod.default ?? XLSXmod;

const src = "/home/ubuntu/upload/副本26年7月份水果报价表.xlsx";
const wb = XLSX.read(readFileSync(src), { type: "buffer" });
let out = "";
for (const name of wb.SheetNames) {
  const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
  out += `===== Sheet: ${name} =====\n${csv}\n`;
}
console.log("extracted text length:", out.length);
writeFileSync("/tmp/quotation-text.txt", out);
console.log("first 200 chars:", JSON.stringify(out.slice(0, 200)));

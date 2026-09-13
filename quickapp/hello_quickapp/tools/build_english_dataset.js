// 英语词汇资料集生成脚本（Node 端运行）
// 用法: node tools/build_english_dataset.js
// 输入: 资料/en.txt
//   行格式（以 | 分隔，1-indexed 列）:
//     1:ID(恒0) | 2:空 | 3:词性全称·词性英文 | 4:词性 | 5:学段 | 6:词条,中文释义短语 | 7:释义(字面\n转义,可含|) | 8:例句
//   注: 释义列内可能混入 | 分隔的搭配短语（9 列行），归并回释义；例句恒为最后一列
// 输出: src/common/datasets/english/  （规范 v1 资料集：meta.json + meta.txt(v4 物化) + map_N/detail_N/block_0.txt + icon.png）
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// 资料集图标生成：圆底 + 集名首字（与 build_poems_dataset.js 同款）
function buildDatasetIcon(charText, bgColor, fgColor) {
  const ch = (charText || '资').charAt(0);
  const fontSize = 150;
  const cx = 128;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <circle cx="${cx}" cy="128" r="120" fill="${bgColor}"/>
  <text x="${cx}" y="128" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="${fgColor}" text-anchor="middle" dominant-baseline="central">${ch}</text>
</svg>`;
  return new Resvg(svg, { fitTo: { mode: 'width', value: 256 } }).render().asPng();
}

const SRC = path.join(__dirname, '..', '..', '资料', 'en.txt');
const OUT = path.join(__dirname, '..', 'src', 'common', 'datasets', 'english');
const DATASET_ID = 2;
const BUCKET_SIZE = 2048;
const MAP_CHUNK = 200;
const DETAIL_CHUNK = 100;

// 与引擎完全一致的哈希（DJBXOR，见 SearchEngine.js hashCode）
function hashCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

// 与引擎 _parseQuery 对齐的入桶分词（bucket key 生成规则必须与查询侧完全一致，否则交集为空）：
// 引擎查询侧对纯字母词按「3..len 全部前缀小写」逐个哈希后求交，对其余词（中文/数字/混合/标点）逐非空字符哈希。
// 旧版只入桶整词 + 仅 CJK 字符 → 搜任何 ≥3 字母英文词（如 abandon）时，
// 首轮前缀桶为空/交集为空，英语集英文搜索必返回空。
function tokenize(text) {
  const tokens = [];
  const words = text.split(/[\s,，、]+/);
  for (const w of words) {
    if (!w) continue;
    if (/^[a-zA-Z]+$/.test(w)) {
      if (w.length >= 3) {
        for (let j = 3; j <= w.length; j++) tokens.push(w.substring(0, j).toLowerCase());
      } else {
        tokens.push(w.toLowerCase());
      }
    } else {
      for (const ch of w) {
        if (ch && ch.trim()) tokens.push(ch);
      }
    }
  }
  return [...new Set(tokens)];
}

function main() {
  const raw = fs.readFileSync(SRC, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const records = [];
  const levelSet = new Set(); // 学段（regionList，按出现顺序）
  let skipped = 0;

  for (const line of lines) {
    const parts = line.split('|');
    // 最少 8 列（释义+例句）；9 列行为释义内混入 | 的搭配短语
    if (parts.length < 8) { skipped++; continue; }
    const posFull = parts[2].trim().replace(/\|/g, '｜');   // 词性全称·词性英文（名词·noun）
    const level = parts[4].trim().replace(/\|/g, '｜') || '未知'; // 学段（初中/高中）
    const wordCol = parts[5].trim().replace(/\|/g, '｜');   // 词条,中文释义短语
    const commaIdx = wordCol.indexOf(',');
    const word = commaIdx >= 0 ? wordCol.slice(0, commaIdx) : wordCol; // 词条名（英文词）
    const wordZh = commaIdx >= 0 ? wordCol.slice(commaIdx + 1) : '';   // 中文释义短语
    // 释义 = 第 7 列..倒数第 2 列（9 列行的内嵌 | 归并为全角｜）
    const definition = parts.slice(6, parts.length - 1).join('｜').trim();
    const example = parts[parts.length - 1].trim(); // 例句恒为最后一列
    if (!word) { skipped++; continue; }
    levelSet.add(level);
    records.push({ word, wordZh, posFull, level, definition, example });
  }

  const levels = [...levelSet];
  const regionIndex = {};
  levels.forEach((d, i) => { regionIndex[d] = i; });

  // 重编号 localId 0..N-1
  records.forEach((r, i) => { r.localId = i; });

  // ---- map 分片（v4 引擎格式: localId|year(0)|regionId(学段idx)|title(词条·中文)）----
  const mapFiles = [];
  for (let c = 0; c * MAP_CHUNK < records.length; c++) {
    const seg = records.slice(c * MAP_CHUNK, (c + 1) * MAP_CHUNK);
    const body = seg.map(r => `${r.localId}|0|${regionIndex[r.level]}|${r.word}·${r.wordZh}`).join('\n');
    mapFiles.push(body);
  }

  // ---- detail 分片（v4 格式: localId|keywords|cause(释义)|impact(例句)）----
  const detailFiles = [];
  for (let c = 0; c * DETAIL_CHUNK < records.length; c++) {
    const seg = records.slice(c * DETAIL_CHUNK, (c + 1) * DETAIL_CHUNK);
    const body = seg.map(r => {
      // 关键词 = 第 6 列（词条,中文）合并第 3 列（词性全称·词性英文）
      const kw = [r.word, r.wordZh, r.posFull].filter(Boolean).join(',');
      const definition = (r.definition || '').replace(/\r?\n/g, '\\n');
      const example = (r.example || '').replace(/\r?\n/g, '\\n');
      return `${r.localId}|${kw}|${definition}|${example}`;
    }).join('\n');
    detailFiles.push(body);
  }

  // ---- 文本 block（bucketIdx|id1,id2,...）——关键词逐 token 入桶 ----
  const buckets = {};
  for (const r of records) {
    const kwText = [r.word, r.wordZh, r.posFull].filter(Boolean).join(',');
    for (const token of tokenize(kwText)) {
      const b = hashCode(token) % BUCKET_SIZE;
      if (!buckets[b]) buckets[b] = [];
      buckets[b].push(r.localId);
    }
  }
  const blockBody = Object.keys(buckets)
    .map(Number).sort((a, b) => a - b)
    .map(b => `${b}|${buckets[b].join(',')}`)
    .join('\n');

  // ---- 写文件 ----
  fs.mkdirSync(OUT, { recursive: true });
  mapFiles.forEach((body, i) => fs.writeFileSync(path.join(OUT, `map_${i}.txt`), body, 'utf-8'));
  detailFiles.forEach((body, i) => fs.writeFileSync(path.join(OUT, `detail_${i}.txt`), body, 'utf-8'));
  fs.writeFileSync(path.join(OUT, 'block_0.txt'), blockBody, 'utf-8');

  // ---- icon.png（资料集图标：圆底 + 集名首字）----
  fs.writeFileSync(path.join(OUT, 'icon.png'), buildDatasetIcon('英', '#5DBB6C', '#FFFFFF'));

  // ---- 卡片三行配置（meta.display.card.rows → 引擎透传 → UI 渲染）----
  // 学段当小标签（第一行/分类行 small），词条名大字（title large）
  const display = {
    card: {
      mainField: 'category1',
      rows: [
        { ref: 'mainField', size: 'small' }, // 学段小标签（mainField≠year → 卡片首行显 region 值）
        { ref: 'title', size: 'large' },     // 词条名大字
        { ref: 'category1', size: 'small' }  // 学段小标签
      ]
    }
  };

  // ---- meta.txt（v4 引擎物化视图）----
  const meta = {
    totalCount: records.length,
    regionList: levels,
    categoryList: [],
    bucketSize: BUCKET_SIZE,
    chunks: [{ id: 0, bucketStart: 0, bucketEnd: BUCKET_SIZE - 1, recordCount: records.length }],
    maps: mapFiles.map((_, i) => ({
      startId: i * MAP_CHUNK,
      endId: Math.min((i + 1) * MAP_CHUNK, records.length) - 1
    })),
    mapChunkSize: MAP_CHUNK,
    detailChunkSize: DETAIL_CHUNK,
    version: 'english-ds-1',
    display
  };
  fs.writeFileSync(path.join(OUT, 'meta.txt'), JSON.stringify(meta), 'utf-8');

  // ---- meta.json（规范 v1 自描述）----
  const metaJson = {
    datasetId: DATASET_ID,
    name: '英语集',
    version: 1,
    category: '教育',
    author: 'sudo',
    basePath: '/common/datasets/english/',
    totalCount: records.length,
    fields: {
      map: ['title', 'year', 'level'],
      keyword: 'keywords',
      detail: ['definition', 'example'],
      filter: ['level']
    },
    display,
    mapChunkSize: MAP_CHUNK,
    detailChunkSize: DETAIL_CHUNK,
    blockCount: 1,
    bucketSize: BUCKET_SIZE,
    yearIndex: false,
    icon: 'icon.png'
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(metaJson, null, 2), 'utf-8');

  console.log(`英语资料集生成完成: ${records.length} 条, ${mapFiles.length} 个 map 片, ${detailFiles.length} 个 detail 片, 学段: ${levels.join('/')}`);
  console.log(`跳过无效行: ${skipped}`);
  console.log('输出目录:', OUT);
}

main();

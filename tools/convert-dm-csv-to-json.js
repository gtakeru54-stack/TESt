#!/usr/bin/env node

/*
  duelmastersscrapingcarddata が出力するCSV専用の変換器です。
  CSVの列は日本語で、1枚の行に通常面・第2面・第3面が連結されています。
*/
const fs = require('fs');
const path = require('path');

const candidates = [
  process.env.DM_CSV_DIR,
  path.resolve(__dirname, '../../duelmastersscrapingcarddata/master'),
  path.resolve(__dirname, '../duelmastersscrapingcarddata/master')
].filter(Boolean);
const SRC_DIR = candidates.find(dir => fs.existsSync(dir));
const OUT_PATH = path.resolve(__dirname, '../data/cards.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell.trim());
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function number(value) {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function list(value) {
  return String(value ?? '').split(/[、,／/・]/).map(v => v.trim()).filter(Boolean);
}

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// 公式スクレイパーの1面あたりの列順（WriteCardBoxHeader）
const FACE_HEADERS = [
  '収録弾', 'カード名', 'カードの種類', '文明', 'レアリティ',
  'パワー', 'コスト', 'マナ', '種族', '特殊能力', 'フレーバー', '画像リンク'
];

function face(row, offset, index, faceName) {
  const pack = row[offset] || '';
  const name = row[offset + 1] || '';
  if (!name || name.includes('unlink card')) return null;

  const type = row[offset + 2] || 'カード';
  return {
    id: `dm-${index}-${faceName}`,
    name: text(name),
    type: text(type),
    civilization: list(row[offset + 3]),
    rarity: text(row[offset + 4]),
    power: number(row[offset + 5]),
    cost: number(row[offset + 6]),
    mana: text(row[offset + 7]),
    race: list(row[offset + 8]),
    text: text(row[offset + 9]),
    flavor: text(row[offset + 10]),
    image: text(row[offset + 11]),
    pack: text(pack)
  };
}

function convertFile(filePath, startIndex) {
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  if (rows.length < 2) return [];

  const header = rows[0].map(text);
  const result = [];
  let index = startIndex;

  for (const row of rows.slice(1)) {
    // ヘッダーで第2面・第3面を数えられる場合はそれを優先する。
    // 現行出力は通常、12列×3面です。
    const offsets = [0];
    for (let i = 12; i < row.length; i += 11) offsets.push(i);

    offsets.slice(0, 3).forEach((offset, faceIndex) => {
      const card = face(row, offset, index, faceIndex + 1);
      if (card) {
        result.push(card);
        index++;
      }
    });
  }
  return result;
}

function main() {
  if (!SRC_DIR) {
    console.error('CSVフォルダーが見つかりません。');
    console.error('環境変数 DM_CSV_DIR に master フォルダーの絶対パスを指定できます。');
    console.error('例: DM_CSV_DIR="/storage/.../duelmastersscrapingcarddata/master" node tools/convert-dm-csv-to-json.js');
    process.exit(1);
  }

  const files = fs.readdirSync(SRC_DIR)
    .filter(name => name.toLowerCase().endsWith('.csv'))
    .sort();
  if (!files.length) {
    console.error(`CSVがありません: ${SRC_DIR}`);
    process.exit(1);
  }

  const cards = [];
  let index = 1;
  for (const file of files) {
    const converted = convertFile(path.join(SRC_DIR, file), index);
    cards.push(...converted);
    index += converted.length;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(cards, null, 2), 'utf8');
  console.log(`${cards.length}枚を変換しました: ${OUT_PATH}`);
}

main();

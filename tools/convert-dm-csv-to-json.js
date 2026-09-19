#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '../duelmastersscrapingcarddata/master');
const OUT_PATH = path.resolve(__dirname, '../data/cards.json');

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(current);
  return cells.map(cell => cell.trim());
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[（）()]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '');
}

function splitValues(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[、,／/・]/)
    .map(v => v.trim())
    .filter(Boolean);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toText(value) {
  return String(value ?? '').replace(/\r/g, '');
}

function normalizeCard(row, index) {
  const keys = Object.keys(row).reduce((acc, key) => {
    acc[normalizeKey(key)] = row[key];
    return acc;
  }, {});

  const name =
    keys.name ||
    keys.card_name ||
    keys.カード名 ||
    keys.title ||
    '名称不明';

  const type =
    keys.type ||
    keys.種類 ||
    keys.card_type ||
    'カード';

  const civilization = splitValues(
    keys.civilization || keys.文明 || keys.color || keys.element || ''
  );

  const race = splitValues(
    keys.race || keys.種族 || keys.family || ''
  );

  const cost = toNumber(keys.cost ?? keys.コスト ?? keys.manacost ?? keys.mana_cost);
  const power = toNumber(keys.power ?? keys.パワー ?? keys.attack ?? keys.atk);

  const text = toText(keys.text ?? keys.effect ?? keys.能力 ?? keys.description ?? '');

  return {
    id: String(keys.id ?? keys.card_id ?? `dm-${index + 1}`),
    name: String(name),
    type: String(type),
    civilization,
    cost,
    power,
    race,
    text,
    image: keys.image || keys.img || '',
    source: keys.source || ''
  };
}

function loadCsvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < header.length) {
      while (values.length < header.length) values.push('');
    }

    const row = {};
    header.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });

    rows.push(row);
  }

  return rows;
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`CSV directory not found: ${SRC_DIR}`);
    console.error('Please run the scraping repo locally and export CSV files into ../duelmastersscrapingcarddata/master');
    process.exit(1);
  }

  const files = fs.readdirSync(SRC_DIR)
    .filter(name => name.toLowerCase().endsWith('.csv'))
    .sort();

  if (!files.length) {
    console.error(`No CSV files found in ${SRC_DIR}`);
    process.exit(1);
  }

  const cards = [];
  let index = 1;

  for (const file of files) {
    const csvPath = path.join(SRC_DIR, file);
    const rows = loadCsvFile(csvPath);
    rows.forEach(row => {
      cards.push(normalizeCard(row, index++));
    });
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(cards, null, 2), 'utf8');

  console.log(`Converted ${cards.length} cards to ${OUT_PATH}`);
}

main();

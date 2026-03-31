/**
 * 数据库模块
 * 使用 sql.js (纯 JavaScript SQLite，无需编译)
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { join, dirname } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { ContentRecord, PlatformOutput, ContentAtom, EvaluationResult } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const DB_PATH = process.env.DATABASE_PATH || join(DATA_DIR, 'content.db');

let db: SqlJsDatabase | null = null;
let dbReady: Promise<void>;

// 确保目录存在
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * 初始化数据库
 */
async function initDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();

  let data: Buffer | undefined;
  if (existsSync(DB_PATH)) {
    data = readFileSync(DB_PATH);
  }

  const database = new SQL.Database(data);

  // 创建表
  database.run(`
    CREATE TABLE IF NOT EXISTS content (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL,
      source_url TEXT,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT '草稿',
      overall_score REAL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS atoms (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      viral_elements TEXT,
      platform_suitability TEXT,
      reusability TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (content_id) REFERENCES content(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS outputs (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      title TEXT,
      content TEXT,
      word_count INTEGER,
      file_path TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (content_id) REFERENCES content(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      overall_score REAL,
      emotion_score REAL,
      utility_score REAL,
      narrative_score REAL,
      social_currency_score REAL,
      controversy_score REAL,
      timeliness_score REAL,
      decision_path TEXT,
      diagnostics TEXT,
      viral_predictions TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (content_id) REFERENCES content(id)
    )
  `);

  // 创建索引
  database.run(`CREATE INDEX IF NOT EXISTS idx_atoms_content_id ON atoms(content_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_outputs_content_id ON outputs(content_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_evaluations_content_id ON evaluations(content_id)`);

  return database;
}

/**
 * 获取数据库实例
 */
export async function getDatabase(): Promise<SqlJsDatabase> {
  if (!dbReady) {
    dbReady = initDatabase().then(database => {
      db = database;
    });
  }
  await dbReady;
  return db!;
}

/**
 * 保存数据库到磁盘
 */
function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
  }
}

/**
 * 保存内容记录
 */
export function saveContent(record: {
  id: string;
  sourceType: string;
  sourceUrl?: string;
  title: string;
  overallScore?: number;
}): void {
  if (!db) return;

  db.run(
    `INSERT OR REPLACE INTO content (id, source_type, source_url, title, created_at, status, overall_score)
     VALUES (?, ?, ?, ?, ?, '草稿', ?)`,
    [
      record.id,
      record.sourceType,
      record.sourceUrl || null,
      record.title,
      new Date().toISOString(),
      record.overallScore || null
    ]
  );
  saveDatabase();
}

/**
 * 保存原子内容块
 */
export function saveAtoms(contentId: string, atoms: ContentAtom[]): void {
  if (!db) return;

  for (const atom of atoms) {
    db.run(
      `INSERT INTO atoms (id, content_id, type, content, viral_elements, platform_suitability, reusability, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        atom.id,
        contentId,
        atom.type,
        atom.content,
        JSON.stringify(atom.viralElements),
        JSON.stringify(atom.platformSuitability),
        atom.reusability,
        new Date().toISOString()
      ]
    );
  }
  saveDatabase();
}

/**
 * 保存平台输出
 */
export function saveOutputs(contentId: string, outputs: PlatformOutput[]): void {
  if (!db) return;

  for (const output of outputs) {
    db.run(
      `INSERT INTO outputs (id, content_id, platform, title, content, word_count, file_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        contentId,
        output.platform,
        output.title,
        output.content,
        output.wordCount,
        output.filePath,
        new Date().toISOString()
      ]
    );
  }
  saveDatabase();
}

/**
 * 保存评估结果
 */
export function saveEvaluation(
  contentId: string,
  evaluation: EvaluationResult,
  evaluationId: string
): void {
  if (!db) return;

  db.run(
    `INSERT INTO evaluations (
      id, content_id, overall_score,
      emotion_score, utility_score, narrative_score,
      social_currency_score, controversy_score, timeliness_score,
      decision_path, diagnostics, viral_predictions, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      evaluationId,
      contentId,
      evaluation.overallScore,
      evaluation.dimensionScores.emotion,
      evaluation.dimensionScores.utility,
      evaluation.dimensionScores.narrative,
      evaluation.dimensionScores.socialCurrency,
      evaluation.dimensionScores.controversy,
      evaluation.dimensionScores.timeliness,
      evaluation.decisionPath,
      JSON.stringify(evaluation.diagnostics),
      JSON.stringify(evaluation.viralPredictions),
      new Date().toISOString()
    ]
  );
  saveDatabase();
}

/**
 * 查询内容列表
 */
export function getContentList(limit = 50): ContentRecord[] {
  if (!db) return [];

  const results = db.exec(`
    SELECT id, source_type as sourceType, source_url as sourceUrl,
           title, created_at as createdAt, status, overall_score as overallScore
    FROM content
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  if (results.length === 0) return [];

  const columns = results[0].columns;
  return results[0].values.map(row => {
    const record: any = {};
    columns.forEach((col, i) => {
      record[col] = row[i];
    });
    return record as ContentRecord;
  });
}

/**
 * 更新内容状态
 */
export function updateContentStatus(id: string, status: string): void {
  if (!db) return;
  db.run('UPDATE content SET status = ? WHERE id = ?', [status, id]);
  saveDatabase();
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
  }
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const outputFile = path.join(__dirname, '..', 'supabase', 'supabase_init_all.sql');

try {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Sorts 001, 002, ..., 20260415

  let combinedSql = `-- ==============================================================================\n`;
  combinedSql += `-- COMBINED INITIALIZATION SQL FOR GOCHOC-AI\n`;
  combinedSql += `-- Generated on ${new Date().toISOString()}\n`;
  combinedSql += `-- Run this script in Supabase SQL Editor to set up your database.\n`;
  combinedSql += `-- ==============================================================================\n\n`;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    combinedSql += `-- ------------------------------------------------------------------------------\n`;
    combinedSql += `-- Migration: ${file}\n`;
    combinedSql += `-- ------------------------------------------------------------------------------\n\n`;
    combinedSql += content;
    combinedSql += `\n\n`;
  }

  fs.writeFileSync(outputFile, combinedSql);
  console.log(`Successfully merged ${files.length} migrations into ${outputFile}`);
} catch (error) {
  console.error('Failed to merge migrations:', error);
  process.exit(1);
}

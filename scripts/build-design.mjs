#!/usr/bin/env node
/**
 * README.md を design.template.html に流し込み、design.html（仕様書）を生成する。
 * 正本は README.md。design.html は手編集しないこと。
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const README_PATH = join(ROOT, 'README.md');
const TEMPLATE_PATH = join(ROOT, 'design.template.html');
const OUTPUT_PATH = join(ROOT, 'design.html');

const headings = [];
const slugCounts = new Map();

function stripMarkdownInline(text) {
  return String(text || '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function slugify(text) {
  const base = stripMarkdownInline(text)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf-]+/g, '')
    .replace(/^-+|-+$/g, '') || 'section';
  const count = slugCounts.get(base) || 0;
  slugCounts.set(base, count + 1);
  return count > 0 ? `${base}-${count}` : base;
}

function extractVersion(markdown) {
  const m = markdown.match(/\*\*Version\s+([0-9]+\.[0-9]+\.[0-9]+)\*\*/i);
  return m ? `v${m[1]}` : '';
}

function buildTocHtml() {
  return headings.map(h => {
    const indent = h.depth === 3 ? 'pl-3' : '';
    const cls = h.depth === 2 ? 'font-medium text-slate-700' : 'text-slate-500';
    return `<li class="${indent}"><a href="#${h.id}" class="toc-link hover:text-indigo-600 transition ${cls}">${escapeHtml(h.text)}</a></li>`;
  }).join('\n            ');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      const plain = stripMarkdownInline(inner.replace(/<[^>]+>/g, ''));
      const id = slugify(plain);
      if (depth >= 2 && depth <= 3) {
        headings.push({ depth, text: plain, id });
      }
      return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
    }
  }
});

function formatGeneratedAt(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function main() {
  const readme = readFileSync(README_PATH, 'utf8');
  const template = readFileSync(TEMPLATE_PATH, 'utf8');
  const version = extractVersion(readme);
  const contentHtml = marked.parse(readme);
  const tocHtml = buildTocHtml();
  const generatedAt = formatGeneratedAt(new Date());

  const output = template
    .replace(/\{\{VERSION\}\}/g, escapeHtml(version))
    .replace(/\{\{GENERATED_AT\}\}/g, escapeHtml(generatedAt))
    .replace(/\{\{TOC_HTML\}\}/g, tocHtml)
    .replace(/\{\{CONTENT_HTML\}\}/g, contentHtml);

  writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`Generated ${OUTPUT_PATH}`);
  console.log(`  version: ${version || '(not found)'}`);
  console.log(`  headings: ${headings.length}`);
}

main();

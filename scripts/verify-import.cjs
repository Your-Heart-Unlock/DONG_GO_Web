require('./register-local-ts.cjs');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { parseImportJSON } = require('../lib/admin/importParser.ts');
const { planImport } = require('../lib/admin/importPlan.ts');
const { ALL_CATEGORY_KEYS } = require('../lib/utils/categoryIcon.ts');
const { RULE_VERSION } = require('../lib/admin/classification.ts');
const { KEYWORD_RULE_COUNT } = require('../lib/admin/categoryKeywords.ts');
const filename = process.argv[2];
if (!filename) throw new Error('Usage: node scripts/verify-import.cjs <source.json> [report.json]');
const input = fs.readFileSync(filename);
const rows = parseImportJSON(input.toString('utf8'));
const preview = planImport(rows, []);
const report = { inputSha256: createHash('sha256').update(input).digest('hex'), ruleVersion: RULE_VERSION, keywordRuleCount: KEYWORD_RULE_COUNT, total: rows.length, automatic: rows.filter(r => r.classification.source === 'rule').length,
  review: rows.filter(r => r.classification.needsReview).length,
  invalid: preview.filter(p => p.status === 'INVALID').length,
  possibleDuplicatesWithinFile: preview.filter(p => p.status === 'DUPLICATE').length,
  originalCodes: {}, categories: Object.fromEntries(ALL_CATEGORY_KEYS.map(k => [k, rows.filter(r => r.categoryKey === k).length])), unresolvedReasons: {}, ruleMethods: {} };
for (const row of rows) {
  const code = row.originalCategory.code;
  report.originalCodes[code] = (report.originalCodes[code] || 0) + 1;
  const method = row.classification.reason.split(':')[0].split(';')[0];
  report.ruleMethods[method] = (report.ruleMethods[method] || 0) + 1;
  if (row.classification.needsReview) report.unresolvedReasons[row.classification.reason] = (report.unresolvedReasons[row.classification.reason] || 0) + 1;
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const surfacePattern =
  /(?:^|\s)(?:rounded(?:-[\w\[\].%-]+)?|bg-[\w\[\]/.-]+|border(?:-[\w\[\]/.-]+)?|shadow-[\w\[\]/.-]+)(?=\s|$)/;
const surfaceProperties = new Set([
  'borderRadius',
  'backgroundColor',
  'boxShadow',
  'shadowColor',
  'shadowOpacity',
  'shadowRadius',
]);
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((item) =>
      item.isDirectory()
        ? files(path.join(dir, item.name))
        : item.name.endsWith('.tsx')
          ? [path.join(dir, item.name)]
          : []
    );
}
for (const file of files(path.join(root, 'src'))) {
  if (file.includes(`${path.sep}ui${path.sep}`)) continue;
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const themed = new Set(['NeonButton']);
  for (const node of source.statements) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      /(?:^|\/)ui\/Button$/.test(node.moduleSpecifier.text) &&
      node.importClause?.name
    )
      themed.add(node.importClause.name.text);
  }
  const fail = (node, message) =>
    failures.push(
      `${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${message}`
    );
  function visit(node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      themed.has(node.tagName.getText(source))
    ) {
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr) || !attr.initializer) continue;
        if (
          attr.name.getText(source) === 'className' &&
          surfacePattern.test(
            attr.initializer
              .getText(source)
              .replaceAll('"', '')
              .replaceAll("'", '')
          )
        )
          fail(
            attr,
            'Use the shared button material; only layout utilities belong at the call site.'
          );
        if (attr.name.getText(source) === 'style') {
          function inspect(item) {
            if (
              ts.isPropertyAssignment(item) &&
              surfaceProperties.has(item.name.getText(source))
            )
              fail(
                item,
                'Button surface overrides must move to buttonTheme.ts.'
              );
            ts.forEachChild(item, inspect);
          }
          inspect(attr);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log('Shared button theme: no shape, material or glow overrides.');

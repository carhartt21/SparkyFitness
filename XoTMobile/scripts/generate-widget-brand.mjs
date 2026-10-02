// Native widget assets share the app's semantic palette and approved X geometry.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'global.css'), 'utf8');
const geometry = JSON.parse(
  fs.readFileSync(
    path.join(root, '../shared/src/brand/progressionX.geometry.json'),
    'utf8'
  )
);
const roles = {
  surface: 'surface-primary',
  raised: 'surface-elevated',
  foreground: 'text-primary',
  secondary: 'text-secondary',
  accent: 'brand-secondary',
  energy: 'calories',
  track: 'energy-track',
  protein: 'macro-protein',
  carbs: 'macro-carbs',
  fat: 'macro-fat',
};
const theme = (variant) => {
  const block = css.split(`@variant ${variant} {`)[1]?.split('@variant')[0];
  if (!block) throw new Error(`Missing ${variant} theme`);
  return Object.fromEntries(
    Object.entries(roles).map(([role, token]) => {
      const hex = block.match(
        new RegExp(`--color-${token}:\\s*(#[a-f0-9]{6});`, 'i')
      )?.[1];
      if (!hex) throw new Error(`Missing ${variant} widget role ${token}`);
      return [role, hex];
    })
  );
};
const light = theme('light'),
  dark = theme('dark');
const [originX, originY, width, height] = geometry.viewBox
  .split(/\s+/)
  .map(Number);
if (originX !== 0 || originY !== 0 || !width || !height)
  throw new Error('Unsupported widget brand viewBox');
const channel = (hex, offset) =>
  Number((parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(4));
const swiftColor = (hex) =>
  `UIColor(red: ${channel(hex, 1)}, green: ${channel(hex, 3)}, blue: ${channel(hex, 5)}, alpha: 1)`;
const palette = `// Generated from global.css by scripts/generate-widget-brand.mjs. Do not edit.
import SwiftUI
import UIKit

enum WidgetPalette {
${Object.keys(roles)
  .map(
    (role) => `    static let ${role} = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? ${swiftColor(dark[role])} : ${swiftColor(light[role])}
    })`
  )
  .join('\n')}
}
`;
const kotlin = `// Generated from global.css by scripts/generate-widget-brand.mjs. Do not edit.
package com.sparkyapps.sparkyfitness.widget

import androidx.glance.unit.ColorProvider
import {{APPLICATION_ID}}.R

internal object WidgetPalette {
${Object.keys(roles)
  .map((role) => `    val ${role} = ColorProvider(R.color.xot_widget_${role})`)
  .join('\n')}
}
`;
function swiftPath(data) {
  const tokens = data.match(/[MLCZ]|-?\d+(?:\.\d+)?/g);
  let index = 0;
  const point = () => `CGPoint(x: ${tokens[index++]}, y: ${tokens[index++]})`;
  const commands = [];
  while (index < tokens.length) {
    switch (tokens[index++]) {
      case 'M':
        commands.push(`p.move(to: ${point()})`);
        break;
      case 'L':
        commands.push(`p.addLine(to: ${point()})`);
        break;
      case 'C': {
        const c1 = point(),
          c2 = point(),
          end = point();
        commands.push(
          `p.addCurve(to: ${end}, control1: ${c1}, control2: ${c2})`
        );
        break;
      }
      case 'Z':
        commands.push('p.closeSubpath()');
        break;
      default:
        throw new Error('Unsupported brand path command');
    }
  }
  return `Path { p in ${commands.join('; ')} }`;
}
const color = (hex) =>
  `Color(red: ${channel(hex, 1)}, green: ${channel(hex, 3)}, blue: ${channel(hex, 5)})`;
const mark = `// Generated from shared/src/brand/progressionX.geometry.json. Do not edit.
// Static identity artwork, never a completion or intake indicator.
import SwiftUI
import WidgetKit

struct WidgetBrandMark: View {
    @Environment(\\.widgetRenderingMode) private var mode
    var body: some View {
        Canvas { context, size in
            context.scaleBy(x: size.width / ${width}, y: size.height / ${height})
${geometry.segments
  .map((segment, index) => {
    const g = segment.gradient;
    const shading = `shade${index}`;
    return `            let ${shading}: GraphicsContext.Shading = mode == .fullColor
                ? .linearGradient(Gradient(colors: [${color(g.from)}, ${color(g.to)}]), startPoint: CGPoint(x: ${g.x1}, y: ${g.y1}), endPoint: CGPoint(x: ${g.x2}, y: ${g.y2})) : .color(.primary)
            context.${segment.kind === 'stroke' ? `stroke(${swiftPath(segment.path)}, with: ${shading}, style: StrokeStyle(lineWidth: ${segment.strokeWidth}, lineCap: ${segment.linecap === 'butt' ? '.butt' : '.round'}, lineJoin: .round))` : `fill(${swiftPath(segment.path)}, with: ${shading})`}
${segment.taperPath ? `            context.fill(${swiftPath(segment.taperPath)}, with: ${shading})\n` : ''}`;
  })
  .join('')}
        }
        .aspectRatio(1, contentMode: .fit)
        .widgetAccentable()
        .accessibilityHidden(true)
    }
}
`;
const gradient = (segment, attribute) => {
  const g = segment.gradient;
  return `<aapt:attr name="android:${attribute}"><gradient android:type="linear" android:startX="${g.x1}" android:startY="${g.y1}" android:endX="${g.x2}" android:endY="${g.y2}"><item android:offset="0" android:color="${g.from}"/><item android:offset="1" android:color="${g.to}"/></gradient></aapt:attr>`;
};
const vector = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from shared/src/brand/progressionX.geometry.json. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt" android:width="24dp" android:height="24dp" android:viewportWidth="${width}" android:viewportHeight="${height}">
${geometry.segments
  .map((segment) => {
    const stroke = segment.kind === 'stroke';
    return `    <path android:pathData="${segment.path}"${stroke ? ` android:fillColor="@android:color/transparent" android:strokeWidth="${segment.strokeWidth}" android:strokeLineCap="${segment.linecap === 'butt' ? 'butt' : 'round'}" android:strokeLineJoin="round"` : ''}>${gradient(segment, stroke ? 'strokeColor' : 'fillColor')}</path>
${segment.taperPath ? `    <path android:pathData="${segment.taperPath}">${gradient(segment, 'fillColor')}</path>\n` : ''}`;
  })
  .join('')}</vector>
`;
const outputs = new Map([
  ['targets/widget/WidgetPalette.swift', palette],
  ['targets/widget/WidgetBrandMark.swift', mark],
  [
    'targets/android-widget/kotlin/com/xot/widget/WidgetPalette.kt.tmpl',
    kotlin,
  ],
  ['targets/android-widget/res/drawable/ic_widget_brand_x.xml', vector],
]);
for (const [variant, colors] of [
  ['values', light],
  ['values-night', dark],
]) {
  outputs.set(
    `targets/android-widget/res/${variant}/widget_colors.xml`,
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from global.css. -->
<resources>
${Object.entries(colors)
  .map(([role, hex]) => `    <color name="xot_widget_${role}">${hex}</color>`)
  .join('\n')}
</resources>
`
  );
}
// A quiet neon wash behind dark widgets; no unsupported blur in RemoteViews.
const glow =
  '#' +
  [1, 3, 5]
    .map((offset) =>
      Math.round(
        parseInt(dark.surface.slice(offset, offset + 2), 16) * 0.84 +
          parseInt(dark.accent.slice(offset, offset + 2), 16) * 0.16
      )
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
for (const [directory, start] of [
  ['drawable', light.surface],
  ['drawable-night', glow],
]) {
  outputs.set(
    `targets/android-widget/res/${directory}/widget_surface.xml`,
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from global.css. -->
<shape xmlns:android="http://schemas.android.com/apk/res/android">
    <gradient android:angle="315" android:startColor="${start}" android:endColor="@color/xot_widget_surface" />
    <corners android:radius="16dp" />
</shape>
`
  );
}
for (const [relative, expected] of outputs) {
  const target = path.join(root, relative);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected)
      throw new Error(
        `${relative} is stale; run pnpm run widget-brand:generate`
      );
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, expected);
  }
}
console.log(
  process.argv.includes('--check')
    ? 'Widget brand assets are up to date.'
    : 'Widget brand assets generated.'
);

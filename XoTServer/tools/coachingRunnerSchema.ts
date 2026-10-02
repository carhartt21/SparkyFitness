import { z } from 'zod';
import {
  coachingRunnerOutputSchema,
  coachingMetricUnits,
  coachingDomainSchema,
  coachingMetricDomain,
  coachingActionDomain,
  type CoachingDomain,
} from '@workspace/shared';

type Node = Record<string, unknown>;
const node = (value: unknown): Node =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Node)
    : {};
const original = z.toJSONSchema(coachingRunnerOutputSchema, {
  target: 'draft-7',
  io: 'input',
});
const resolve = (schema: Node): Node => {
  const ref = schema.$ref;
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return schema;
  let current: unknown = original;
  for (const part of ref.slice(2).split('/'))
    current = node(current)[part.replaceAll('~1', '/').replaceAll('~0', '~')];
  return node(current);
};
const allowsNull = (schema: Node): boolean => {
  const resolved = resolve(schema);
  return (
    resolved.type === 'null' ||
    (Array.isArray(resolved.type) && resolved.type.includes('null')) ||
    [resolved.anyOf, resolved.oneOf].some(
      (branches) =>
        Array.isArray(branches) &&
        branches.some((branch) => allowsNull(node(branch)))
    )
  );
};
/** Provider subset only; the full shared contract still validates every result. */
export function coachingStructuredOutputSchema(
  domains: readonly CoachingDomain[] = coachingDomainSchema.options
): Node {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (!value || typeof value !== 'object') return value;
    const source = node(value),
      result: Node = {};
    for (const [key, item] of Object.entries(source)) {
      if (key === 'default') continue;
      const selected =
        key === 'oneOf' && Array.isArray(item)
          ? item.filter((branch) => {
              const kind = node(
                node(resolve(node(branch)).properties).kind
              ).const;
              if (kind === 'goals')
                return (
                  domains.includes('nutrition') || domains.includes('activity')
                );
              const domain =
                typeof kind === 'string' ? coachingActionDomain(kind) : null;
              return !domain || domains.includes(domain);
            })
          : key === 'enum' &&
              Array.isArray(item) &&
              item.every((choice) =>
                coachingDomainSchema.options.includes(choice)
              )
            ? item.filter((choice) => domains.includes(choice))
            : item;
      result[key === 'oneOf' ? 'anyOf' : key] = convert(selected);
    }
    if (source.properties) {
      const required = Array.isArray(source.required) ? source.required : [];
      const properties = node(result.properties);
      for (const [key, schema] of Object.entries(properties))
        if (
          !required.includes(key) &&
          !allowsNull(node(node(source.properties)[key]))
        )
          properties[key] = { anyOf: [schema, { type: 'null' }] };
      result.required = Object.keys(properties);
      result.additionalProperties = false;
      // Zod refinements do not appear in JSON Schema. Express the canonical
      // metric/unit relation and adherence range in the provider schema too.
      const discriminator = properties.metric
        ? 'metric'
        : properties.field
          ? 'field'
          : null;
      const choices = discriminator
        ? resolve(node(node(source.properties)[discriminator])).enum
        : null;
      if (
        discriminator &&
        properties.unit &&
        Array.isArray(choices) &&
        choices.every(
          (choice) =>
            typeof choice === 'string' && choice in coachingMetricUnits
        )
      ) {
        return {
          anyOf: choices
            .filter((choice) =>
              domains.includes(coachingMetricDomain(String(choice)))
            )
            .map((choice) => {
              const metric = choice as keyof typeof coachingMetricUnits;
              const bounded =
                metric.endsWith('_completion') ||
                metric === 'meal_confirmation';
              return {
                ...result,
                properties: {
                  ...properties,
                  [discriminator]: { type: 'string', const: metric },
                  unit: { type: 'string', const: coachingMetricUnits[metric] },
                  ...(bounded && properties.target
                    ? {
                        target: {
                          ...node(properties.target),
                          minimum: 0,
                          maximum: 1,
                        },
                      }
                    : {}),
                },
              };
            }),
        };
      }
    }
    return result;
  };
  return node(convert(original));
}

/** Null on optional non-nullable fields means "leave unchanged", never a write. */
export function parseCoachingRunnerOutput(value: unknown) {
  const normalize = (schema: Node, input: unknown): unknown => {
    schema = resolve(schema);
    const branches = schema.oneOf ?? schema.anyOf;
    if (Array.isArray(branches)) {
      const match = branches.find((branch) => {
        const candidate = resolve(node(branch));
        if (input === null) return allowsNull(candidate);
        const fields = node(candidate.properties);
        const discriminator = Object.entries(fields).find(
          ([, field]) => 'const' in node(field)
        );
        if (discriminator)
          return node(input)[discriminator[0]] === node(discriminator[1]).const;
        return (
          candidate.type === (Array.isArray(input) ? 'array' : typeof input)
        );
      });
      if (match) return normalize(node(match), input);
    }
    if (Array.isArray(input))
      return input.map((item) => normalize(node(schema.items), item));
    if (!input || typeof input !== 'object') return input;
    const properties = node(schema.properties),
      required = Array.isArray(schema.required) ? schema.required : [];
    return Object.fromEntries(
      Object.entries(node(input))
        .filter(
          ([key, item]) =>
            !(key in properties) ||
            item !== null ||
            required.includes(key) ||
            allowsNull(node(properties[key]))
        )
        .map(([key, item]) => [key, normalize(node(properties[key]), item)])
    );
  };
  return coachingRunnerOutputSchema.parse(normalize(node(original), value));
}

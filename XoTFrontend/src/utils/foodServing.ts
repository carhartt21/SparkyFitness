type ServingLike = {
  serving_size?: number | null;
  serving_unit?: string | null;
  serving_description?: string | null;
  /** Saved portion name ("Medium"). */
  serving_label?: string | null;
  /** Weight (g) or volume (ml) of one serving, when known. */
  metric_amount?: number | string | null;
  metric_unit?: string | null;
};

function isMetricUnit(unit: string | null | undefined): boolean {
  const normalized = unit?.trim().toLowerCase();
  return normalized === 'g' || normalized === 'ml';
}

/** "130 g" for a portion with a stated weight in another unit. */
function weightSuffix(variant: ServingLike): string | null {
  const amount = Number(variant.metric_amount);
  if (!(amount > 0) || !variant.metric_unit) return null;
  if (isMetricUnit(variant.serving_unit)) return null;
  return `${Number(amount.toFixed(1))} ${variant.metric_unit}`;
}

export function formatServingLabel(variant: ServingLike): string {
  const description = variant.serving_description?.trim();
  if (description) return description;

  const unit = variant.serving_unit?.trim() || '';
  const amount =
    variant.serving_size == null ? unit : `${variant.serving_size} ${unit}`;
  const weight = weightSuffix(variant);
  const label = variant.serving_label?.trim();
  if (label) {
    // "Medium (130 g)"; without a weight the amount explains the portion.
    return `${label} (${weight ?? amount.trim()})`;
  }
  return weight ? `${amount.trim()} (${weight})` : amount.trim();
}

export function formatQuantityServingLabel(
  quantity: number,
  variant: ServingLike
): string {
  if (
    variant.serving_size === quantity &&
    variant.serving_description?.trim()
  ) {
    return variant.serving_description.trim();
  }

  return `${quantity} ${variant.serving_unit || ''}`.trim();
}

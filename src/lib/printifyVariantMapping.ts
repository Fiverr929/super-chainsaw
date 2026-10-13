type Variant = { id: number; title: string; options: Record<string, string> };
type Combination = { id: string; isEnabled: boolean; values: Record<string, string> };
const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Match enabled combinations exactly. Never silently substitute a different blank. */
export function mapPrintifyVariants(variants: Variant[], combinations: Combination[], fixedColor?: string) {
  const enabled = combinations.filter(combination => combination.isEnabled);
  if (!enabled.length) throw new Error('Configure at least one enabled size/color variation before creating a Printify product.');
  return enabled.map(combination => {
    const entries = Object.entries(combination.values);
    const color = entries.find(([key]) => normalize(key) === 'color')?.[1] || fixedColor || '';
    const size = entries.find(([key]) => normalize(key) === 'size')?.[1] || '';
    if (!color || ['auto', 'none', 'unspecified'].includes(normalize(color)) || !size) {
      throw new Error('Each Printify variation needs an explicit color and size.');
    }
    const matches = variants.filter(variant => {
      const options = Object.fromEntries(Object.entries(variant.options || {}).map(([key, value]) => [normalize(key), normalize(value)]));
      return options.color === normalize(color) && options.size === normalize(size);
    });
    if (matches.length !== 1) throw new Error(`No unique Printify variant matches ${color} / ${size}. Check the provider and variation values.`);
    return { combinationId: combination.id, variantId: matches[0].id };
  });
}

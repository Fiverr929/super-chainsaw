import { useState, useCallback } from 'react';

export type EtsyPropertyValue = {
  value_id: number;
  name: string;
};

export type EtsyProperty = {
  property_id: number;
  name: string;
  display_name: string;
  possible_values: EtsyPropertyValue[];
};

// Global cache to prevent duplicate fetches across components
export const taxonomyCache: Record<number, EtsyProperty[]> = {};

export function useEtsyTaxonomy() {
  const [loading, setLoading] = useState(false);

  const fetchPropertiesForTaxonomy = useCallback(async (taxonomyId: number): Promise<EtsyProperty[]> => {
    if (taxonomyCache[taxonomyId]) {
      return taxonomyCache[taxonomyId];
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/etsy/taxonomy?taxonomy_id=${taxonomyId}`);
      if (!res.ok) throw new Error('Failed to fetch taxonomy properties');
      const data = await res.json();
      
      const properties: EtsyProperty[] = data.results || [];
      // Only keep properties that have predefined values (dropdowns)
      const validProperties = properties.filter(p => p.possible_values && p.possible_values.length > 0);
      
      taxonomyCache[taxonomyId] = validProperties;
      return validProperties;
    } catch (err) {
      console.error(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchPropertiesForTaxonomy, loading };
}

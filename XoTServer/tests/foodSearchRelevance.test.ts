import { describe, expect, it } from 'vitest';
import {
  foodSearchTokens,
  foodSearchRetrievalQuery,
  rankFoodSearchCandidates,
} from '@workspace/shared';

const foods = [
  { source: 'bls4', id: 'tomato-raw', name: 'Tomate, roh', brand: null },
  {
    source: 'off',
    id: 'tomato-sauce',
    name: 'Tomatensauce',
    brand: 'Supermarkt',
  },
  {
    source: 'saved',
    id: 'sauce',
    name: 'Tomate Sauce',
    brand: null,
    favorite: true,
  },
  { source: 'bls4', id: 'celeriac', name: 'Sellerieknolle, roh', brand: null },
  { source: 'bls4', id: 'apple', name: 'Apfel', brand: null },
  { source: 'bls4', id: 'apples', name: 'Äpfel, frisch', brand: null },
  { source: 'bls4', id: 'rice-cooked', name: 'Reis, gekocht', brand: null },
  { source: 'bls4', id: 'rice-dry', name: 'Reis, ungekocht', brand: null },
  { source: 'off', id: 'meat', name: 'Rindfleisch, gekocht', brand: 'Marke' },
  { source: 'off', id: 'freshona', name: 'Tomate Frito', brand: 'Freshona' },
  { source: 'bls4', id: 'egg', name: 'Ei', brand: null },
  {
    source: 'off',
    id: 'dried-tomato',
    name: 'Tomate en polvo o deshidratado',
    brand: null,
  },
  {
    source: 'off',
    id: 'tomato-extract',
    name: 'Extrato de Tomate',
    brand: null,
  },
  {
    source: 'off',
    id: 'dry-chickpeas',
    name: 'Kichererbsen weiss trocken',
    brand: 'Reis',
  },
];

const ids = (query: string) =>
  rankFoodSearchCandidates(foods, query).map(({ item }) => item.id);

describe('food search relevance', () => {
  it('keeps ordinary tomato ahead of sauces and rejects unrelated raw foods', () => {
    expect(ids('tomate')[0]).toBe('tomato-raw');
    expect(ids('tomate roh')[0]).toBe('tomato-raw');
    expect(ids('tomate roh')).not.toContain('celeriac');
    expect(ids('tomate roh').indexOf('sauce')).toBeGreaterThan(0);
    expect(ids('tomate roh').indexOf('dried-tomato')).toBeGreaterThan(0);
    expect(ids('tomate roh').indexOf('tomato-extract')).toBeGreaterThan(0);
  });

  it('recognizes apple spelling variants and a small tomato typo', () => {
    for (const query of ['apfel', 'äpfel', 'aepfel']) {
      expect(ids(query).slice(0, 3)).toContain('apple');
    }
    expect(ids('tomat')[0]).toBe('tomato-raw');
  });

  it('respects cooked and dry rice without promoting cooked meat', () => {
    expect(ids('reis')[0]).toMatch(/^rice-/);
    expect(ids('reis gekocht')[0]).toBe('rice-cooked');
    expect(ids('gekochter reis')[0]).toBe('rice-cooked');
    expect(ids('reis trocken')[0]).toBe('rice-dry');
    expect(ids('reis trocken').indexOf('dry-chickpeas')).toBeGreaterThan(0);
    expect(ids('reis gekocht')).not.toContain('meat');
    expect(foodSearchTokens('gekochter Reis')).toEqual(['gekocht', 'reis']);
    expect(foodSearchRetrievalQuery('gekochter Reis')).toBe('reis gekocht');
  });

  it('protects explicit brands, short foods, and exact barcode matches', () => {
    expect(ids('tomate frito freshona')[0]).toBe('freshona');
    expect(ids('Ei')[0]).toBe('egg');
    expect(ids('Eier')[0]).toBe('egg');
    const barcoded = [
      ...foods,
      { source: 'off', id: 'coded', name: 'Egg', barcode: '12345678' },
    ];
    expect(rankFoodSearchCandidates(barcoded, '12345678')[0]?.item.id).toBe(
      'coded'
    );
  });

  it('deduplicates stable IDs and barcodes without collapsing same-name nutrient records', () => {
    const rows = rankFoodSearchCandidates(
      [
        { source: 'a', id: '1', name: 'Apfel' },
        { source: 'a', id: '1', name: 'Apfel' },
        { source: 'b', id: '2', name: 'Apfel' },
      ],
      'apfel'
    );
    expect(rows.map(({ item }) => item.id)).toEqual(['1', '2']);
    const barcodeRows = rankFoodSearchCandidates(
      [
        { source: 'a', id: 'sauce', name: 'Tomatensauce', barcode: '12345678' },
        { source: 'b', id: 'raw', name: 'Tomate, roh', barcode: '12345678' },
      ],
      'tomate roh'
    );
    expect(barcodeRows.map(({ item }) => item.id)).toEqual(['raw']);
  });
});

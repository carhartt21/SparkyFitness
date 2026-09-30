import { parseFddbExport } from '@/utils/fddbExport';

const line = (...cells: string[]) => cells.join(';');
const section = (name: string, header: string[], rows: string[][]) => [
  name,
  line(...header),
  ...rows.map((row) => line(...row)),
];

function fixture() {
  const customFood = Array(43).fill('') as string[];
  customFood[0] = 'Example food';
  customFood[1] = '418,4';
  customFood[2] = '20';
  customFood[3] = '1';
  customFood[4] = '3';
  customFood[6] = '123';
  customFood[8] = '2';
  customFood[9] = '10';
  customFood[29] = '0,5';
  customFood[41] = '100 g';
  return [
    ...section('profile', ['secret'], [['private profile value']]),
    ...section(
      'diary',
      [
        'datum_tag_monat_jahr_stunde_minute',
        'bezeichnung',
        'interne_id',
        'kj',
        'kj_aktivitaeten',
        'fett_g',
        'kh_g',
        'protein_g',
      ],
      [
        [
          '26.09.2026 08:30',
          '100 g Example food',
          '123',
          '418,4',
          '0',
          '1',
          '20',
          '3',
        ],
        [
          '26.09.2026 08:30',
          '100 g Example food',
          '123',
          '418,4',
          '0',
          '1',
          '20',
          '3',
        ],
        [
          '26.09.2026 09:30',
          '0 ml Rounded drink',
          '456',
          '41,84',
          '0',
          '0',
          '10',
          '0',
        ],
        [
          '26.09.2026 10:00',
          '60 Minuten Walk',
          '789',
          '0',
          '836,8',
          '0',
          '0',
          '0',
        ],
      ]
    ),
    ...section(
      'lists',
      [
        'name',
        'beschreibung',
        'anzahl_portionen',
        'zeit_vorbereitung',
        'zeit_kochen',
        'produkte',
      ],
      [['Example recipe', '', '2', '10', '15', '1 item, 2 item']]
    ),
    ...section('marker', ['produkt'], [['Example food']]),
    ...section(
      'newitems',
      Array.from({ length: 43 }, (_, i) => `field${i}`),
      [customFood]
    ),
    ...section(
      'userhistory',
      ['datum_tag_monat_jahr', 'gewicht_kg'],
      [['25.09.2026', '70,5']]
    ),
    ...section('transactions', ['secret'], [['private payment value']]),
  ].join('\n');
}

describe('FDDB complete export parser', () => {
  it('preserves duplicate logged occurrences and source energy, including a rounded-zero portion', () => {
    const result = parseFddbExport(fixture());
    expect(result.diary).toHaveLength(3);
    expect(new Set(result.diary.map((row) => row.sourceKey)).size).toBe(3);
    expect(result.diary[0]).toMatchObject({
      date: '2026-09-26',
      time: '08:30',
      quantity: 100,
      unit: 'g',
      calories: 100,
      protein: 3,
    });
    expect(result.diary[2]).toMatchObject({
      foodName: '0 ml Rounded drink',
      quantity: 1,
      unit: 'serving',
      calories: 10,
    });
    expect(result.activities).toMatchObject([
      {
        durationMinutes: 60,
        caloriesBurned: 200,
      },
    ]);
    expect(result.warnings).toHaveLength(0);
  });

  it('keeps optional sections separate and discards profile and payment content', () => {
    const result = parseFddbExport(fixture());
    expect(result.customFoods[0]).toMatchObject({
      name: 'Example food',
      calories: 100,
      sodium: 200,
      caffeine: 10,
      alcoholG: 2,
    });
    expect(result.recipes[0]).toMatchObject({
      name: 'Example recipe',
      ingredientsText: '1 item, 2 item',
      servings: 2,
    });
    expect(result.favorites).toEqual(['Example food']);
    expect(result.measurements).toEqual([
      { date: '2026-09-25', weightKg: 70.5 },
    ]);
    expect(JSON.stringify(result)).not.toContain('private profile value');
    expect(JSON.stringify(result)).not.toContain('private payment value');
    expect(result.ignoredProfileCount).toBe(1);
    expect(result.ignoredTransactionCount).toBe(1);
  });

  it('rejects a flat or unrelated CSV before any upload', () => {
    expect(() => parseFddbExport('name;calories\nFood;100')).toThrow(
      'not a supported complete FDDB account export'
    );
  });
});

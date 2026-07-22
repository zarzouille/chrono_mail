const { zonedTimeToUtc } = require('../lib/tz');

describe('zonedTimeToUtc', () => {
    test('heure locale Europe/Paris (été, UTC+2) → instant UTC correct', () => {
        expect(zonedTimeToUtc('2026-08-01T14:00', 'Europe/Paris').toISOString())
            .toBe('2026-08-01T12:00:00.000Z');
    });

    test('même heure locale, fuseau America/New_York (été, UTC-4) → instant UTC différent', () => {
        expect(zonedTimeToUtc('2026-08-01T14:00', 'America/New_York').toISOString())
            .toBe('2026-08-01T18:00:00.000Z');
    });

    test('Europe/Paris en hiver (UTC+1)', () => {
        expect(zonedTimeToUtc('2026-01-15T09:00', 'Europe/Paris').toISOString())
            .toBe('2026-01-15T08:00:00.000Z');
    });

    test('chaîne déjà pourvue d\'un offset explicite → pas de reconversion', () => {
        expect(zonedTimeToUtc('2026-08-01T12:00:00.000Z', 'America/New_York').toISOString())
            .toBe('2026-08-01T12:00:00.000Z');
    });

    test('date invalide → Invalid Date (pas d\'exception)', () => {
        expect(isNaN(zonedTimeToUtc('n\'importe quoi', 'Europe/Paris').getTime())).toBe(true);
    });

    test('fuseau IANA inconnu → lève une erreur', () => {
        expect(() => zonedTimeToUtc('2026-08-01T14:00', 'Not/AZone')).toThrow();
    });

    test('valeur vide → Invalid Date', () => {
        expect(isNaN(zonedTimeToUtc('', 'Europe/Paris').getTime())).toBe(true);
    });
});

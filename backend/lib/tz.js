// Convertit une date/heure "naïve" (ex. "2026-08-01T14:00", sans offset,
// telle qu'envoyée par un <input type="datetime-local">) en instant UTC réel,
// en l'interprétant dans le fuseau IANA fourni (ex. "Europe/Paris").
// Une chaîne qui porte déjà un offset explicite ('Z' ou +hh:mm) est respectée
// telle quelle, sans reconversion.
function getTimeZoneOffsetMs(utcGuess, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = dtf.formatToParts(utcGuess).reduce((acc, p) => {
        if (p.type !== 'literal') acc[p.type] = p.value;
        return acc;
    }, {});
    const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asIfUtc - utcGuess.getTime();
}

function zonedTimeToUtc(naiveDateTime, timeZone) {
    if (!naiveDateTime) return new Date(NaN);
    const raw = String(naiveDateTime).trim();

    if (/[Zz]|[+-]\d{2}:\d{2}$/.test(raw)) return new Date(raw);

    const utcGuess = new Date(`${raw}Z`);
    if (isNaN(utcGuess.getTime())) return utcGuess;

    const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
    return new Date(utcGuess.getTime() - offsetMs);
}

module.exports = { zonedTimeToUtc };

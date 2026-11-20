export const ROLL_REGEX = /^(SP|FA)\d{2}-[A-Z]{3}-(00[1-9]|0[1-9]\d|1\d{2}|200)$/;

// Auto-formats live input as XX00-XXX-000 while allowing clean backspace deletion
export function formatRollInput(raw: string, prevValue = ''): string {
    const isDeleting = raw.length < prevValue.length;
    const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

    if (alnum.length < 4) return alnum;
    if (alnum.length === 4) return isDeleting ? alnum : `${alnum}-`;
    if (alnum.length < 7) return `${alnum.slice(0, 4)}-${alnum.slice(4)}`;
    if (alnum.length === 7) return isDeleting ? `${alnum.slice(0, 4)}-${alnum.slice(4)}` : `${alnum.slice(0, 4)}-${alnum.slice(4)}-`;
    return `${alnum.slice(0, 4)}-${alnum.slice(4, 7)}-${alnum.slice(7)}`;
}

// Normalizes both "sp26bcs114" and "sp26-bcs-114" into "SP26-BCS-114"
export function normalizeRoll(input: string): string {
    const alnum = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^(SP|FA)\d{2}[A-Z]{3}\d{3}$/.test(alnum)) {
        return `${alnum.slice(0, 4)}-${alnum.slice(4, 7)}-${alnum.slice(7)}`;
    }
    return input.trim().toUpperCase();
}

export function isValidRoll(input: string): boolean {
    return ROLL_REGEX.test(normalizeRoll(input));
}

export const ROLL_ERROR_MSG =
    "Invalid format. Use SP/FA + Year + Program + Roll (001–200), e.g., SP26-BCS-114";
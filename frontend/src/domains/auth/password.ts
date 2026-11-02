// Mirrors backend/app/core/passwords.py so people see the same rules the API enforces.

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

const COMMON_BASES = new Set([
  "password", "passw0rd", "qwerty", "qwertyuiop", "asdfgh", "asdfghjkl", "zxcvbnm", "abc", "abcdef", "abcd",
  "admin", "administrator", "welcome", "letmein", "iloveyou", "monkey", "dragon", "football", "baseball",
  "sunshine", "princess", "master", "shadow", "superman", "trustno", "freedom", "whatever", "login",
  "nigeria", "naija", "enugu", "lagos", "abuja", "jesus", "jesuslovesme", "godisgood", "blessing", "davorescue",
]);
const COMMON_EXACT = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "0123456789", "111111", "000000", "123123",
  "987654321", "1q2w3e4r", "1qaz2wsx", "qwerty123", "password1", "password123", "p@ssw0rd", "p@ssword1",
]);

export type PasswordCheck = { id: string; label: string; ok: boolean };

function isCommon(password: string): boolean {
  const lowered = password.toLowerCase();
  const base = lowered.replace(/^[\d\W_]+/, "").replace(/[\d\W_]+$/, "");
  return COMMON_EXACT.has(lowered) || COMMON_BASES.has(base) || new Set(password).size <= 3;
}

function isPersonal(password: string, name: string, phone: string): boolean {
  const lowered = password.toLowerCase();
  const names = name.toLowerCase().split(/[\s\-']+/).filter((part) => part.length >= 3);
  if (names.some((part) => lowered.includes(part))) return true;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && (password.includes(digits.slice(-7)) || password.includes(digits.slice(1)));
}

export function checkPassword(password: string, context: { name?: string; phone?: string } = {}): PasswordCheck[] {
  return [
    { id: "length", label: `At least ${PASSWORD_MIN} characters`, ok: password.length >= PASSWORD_MIN },
    { id: "case", label: "Upper- and lower-case letters", ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: "number", label: "A number", ok: /\d/.test(password) },
    { id: "symbol", label: "A symbol, such as ! @ # ?", ok: /[^A-Za-z0-9]/.test(password) },
    { id: "common", label: "Not a common password", ok: password.length > 0 && !isCommon(password) },
    {
      id: "personal",
      label: "Doesn’t contain your name or phone number",
      ok: password.length > 0 && !isPersonal(password, context.name ?? "", context.phone ?? ""),
    },
  ];
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string };

export function passwordStrength(checks: PasswordCheck[], password: string): Strength {
  if (!password) return { score: 0, label: "" };
  const passed = checks.filter((c) => c.ok).length;
  if (passed < checks.length) {
    return passed <= 3 ? { score: 1, label: "Too weak" } : { score: 2, label: "Almost there" };
  }
  // Every rule met; length is what makes it hard to guess from here.
  return password.length >= 14 ? { score: 4, label: "Very strong" } : { score: 3, label: "Strong" };
}

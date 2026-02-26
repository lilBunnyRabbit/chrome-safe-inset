const fmt = (code: string) => (s: string) => `\x1b[${code}m${s}\x1b[0m`;

export const dim = fmt("2");
export const bold = fmt("1");
export const cyan = fmt("36");
export const green = fmt("32");
export const yellow = fmt("33");
export const red = fmt("31");
export const boldCyan = fmt("36;1");

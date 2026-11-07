const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const index = new Map([...alphabet].map((c, i) => [c, i]));

/** Null on a character outside the alphabet. Leading "1"s are leading zero bytes. */
export function decodeBase58(s: string): Uint8Array | null {
    const bytes: number[] = [];
    for (const c of s) {
        let carry = index.get(c);
        if (carry === undefined) return null;
        for (let i = 0; i < bytes.length; i++) {
            carry += (bytes[i] as number) * 58;
            bytes[i] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
    }
    let zeros = 0;
    while (zeros < s.length && s[zeros] === "1") zeros++;
    return Uint8Array.from([...new Array<number>(zeros).fill(0), ...bytes.reverse()]);
}

// The decoded size is the test, never the character count: a 64-byte value can take 87 characters
function hasBytes(s: string, size: number): boolean {
    // No 64-byte value needs more than 88 characters, so a longer string is refused cheaply
    if (s.length === 0 || s.length > 90) return false;
    return decodeBase58(s)?.length === size;
}

export const isWallet = (s: string): boolean => hasBytes(s, 32);
export const isTx = (s: string): boolean => hasBytes(s, 64);

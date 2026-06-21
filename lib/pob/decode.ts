import pako from "pako";

/**
 * Decode a PoB/PoB2 export code's base64 payload into raw bytes.
 *
 * PoB uses URL-safe base64 ("-"/"_" instead of "+"/"/"). We normalize so both
 * the URL-safe and standard alphabets decode. Works in Node (Buffer) and the
 * browser (atob).
 */
export function base64ToBytes(code: string): Uint8Array {
  const normalized = code
    .trim()
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/\s+/g, "");

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export class PobDecodeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PobDecodeError";
  }
}

/**
 * Decode a full PoB2 export code into its inner XML string.
 *
 * Pipeline: URL-safe base64 -> zlib inflate -> XML text. Falls back to raw
 * inflate in case a producer emitted a headerless deflate stream.
 */
export function decodePobCode(code: string): string {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(code);
  } catch (cause) {
    throw new PobDecodeError("Export code is not valid base64.", { cause });
  }

  if (bytes.length === 0) {
    throw new PobDecodeError("Export code is empty after decoding.");
  }

  try {
    return pako.inflate(bytes, { to: "string" });
  } catch (zlibErr) {
    try {
      return pako.inflateRaw(bytes, { to: "string" });
    } catch {
      throw new PobDecodeError(
        "Could not decompress export code (not a valid PoB2 deflate stream).",
        { cause: zlibErr },
      );
    }
  }
}

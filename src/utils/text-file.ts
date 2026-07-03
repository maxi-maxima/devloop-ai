import { readFile } from 'node:fs/promises';

export async function readTextFile(filePath: string): Promise<string> {
  return decodeTextBuffer(await readFile(filePath));
}

export function decodeTextBuffer(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString('utf16le');
  }
  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return swapUtf16Bytes(buffer.subarray(2)).toString('utf16le');
  }
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString('utf8');
  }

  const likelyUtf16Le = buffer.length > 4 && buffer[1] === 0 && buffer[3] === 0;
  if (likelyUtf16Le) {
    return buffer.toString('utf16le');
  }

  return buffer.toString('utf8');
}

function swapUtf16Bytes(buffer: Buffer): Buffer {
  const swapped = Buffer.from(buffer);
  for (let index = 0; index + 1 < swapped.length; index += 2) {
    const first = swapped[index]!;
    swapped[index] = swapped[index + 1]!;
    swapped[index + 1] = first;
  }

  return swapped;
}

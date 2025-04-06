import { getBlobForArrayBuffer } from 'react-native-blob-jsi-helper';
export const createBlob = (binary: string, type: string) => {
  const buffer = Buffer.from(binary, 'binary');

  // @ts-ignore
  const blob = getBlobForArrayBuffer(buffer.buffer);
  return blob;
};

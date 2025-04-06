import type { BinarySerializer } from 'pouchdb-adapter-sqlite-core/interface';
import { getBlobForArrayBuffer } from 'react-native-blob-jsi-helper';
import { fromByteArray } from 'react-native-quick-base64';
import toBuffer from 'blob-to-buffer';

export const serializer: BinarySerializer = {
  serialize: async (data) => {
    // if is a ArrayBuffer, convert to Uint8Array
    if (typeof data === 'object' && data instanceof ArrayBuffer) {
      const array = new Uint8Array(data);
      return array;
    }
    // if is a Blob, convert to Uint8Array
    if (typeof data === 'object' && data instanceof Blob) {
      const promise = new Promise((res) => {
        toBuffer(data, (err, buffer) => {
          if (err) {
            throw err;
          }
          const array = Uint8Array.from(buffer);
          res(array);
        });
      });
      return promise;
      //const buffer = getArrayBufferForBlob(data);
      //return buffer;
    }

    const binary: string = data.toString();
    const buffer = Buffer.from(binary, 'binary');
    const array = Uint8Array.from(buffer);
    return array;
  },
  deserialize: (data) => {
    return data;
  },
};
export const createBlob = (binary: Uint8Array) => {
  const arrayBuffer = binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
  // @ts-ignore
  const b = getBlobForArrayBuffer(arrayBuffer);
  return b;
};
export const btoa = (uint8Array: Uint8Array) => {
  const base = fromByteArray(uint8Array);
  return base;
};

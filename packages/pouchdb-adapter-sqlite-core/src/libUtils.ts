import { BinarySerializer } from './interfaces';
import { blobOrBufferToBinaryString } from 'pouchdb-binary-utils';

export function escapeBlob(str: string) {
  return str
    .replace(/\u0002/g, '\u0002\u0002')
    .replace(/\u0001/g, '\u0001\u0002')
    .replace(/\u0000/g, '\u0001\u0001');
}
export function unescapeBlob(str: string) {
  return str
    .replace(/\u0001\u0001/g, '\u0000')
    .replace(/\u0001\u0002/g, '\u0001')
    .replace(/\u0002\u0002/g, '\u0002');
}

// This Funtion is used for serilizer!
// data is the processAttachment's Response Which type is one of the following: buffer,blob,binary string
export const parseDataToBinary = async (data: any) => {
  if (typeof data === 'string') {
    // do nothing
    return data;
  }
  const promise = new Promise<string>((resolve) => {
    blobOrBufferToBinaryString(data, (binstring: string) => {
      resolve(binstring);
    });
  });
  return promise;
};

export const escapeSerializer: BinarySerializer = {
  serialize: async (data) => {
    const bin = await parseDataToBinary(data);
    return escapeBlob(bin);
  },
  deserialize: async (data) => {
    return unescapeBlob(data);
  },
};

export const defaultSerializer: BinarySerializer = {
  serialize: async (data) => {
    const bin = await parseDataToBinary(data);
    return bin;
  },
  deserialize: (data) => {
    return data;
  },
};

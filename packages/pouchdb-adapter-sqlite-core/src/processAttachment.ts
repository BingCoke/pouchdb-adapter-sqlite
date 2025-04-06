import { atob } from 'pouchdb-binary-utils';
import { createError, BAD_ARG } from 'pouchdb-errors';

import { binaryMd5 } from 'pouchdb-md5';

// att.data muse be one of the following: bse64 string, Blob, or Buffer
// the data output will be a Blob or Buffer or binary string
function preprocessAttachment(att: any, blobType: string, callback: any) {
  if (att.stub) {
    return callback();
  }

  let data = att.data;
  if (typeof data === 'string') {
    data = parseBase64(data);
  }
  att.length = data.size || data.length || 0;
  att.data = data;

  binaryMd5(data, function (result: string) {
    att.digest = 'md5-' + result;
    callback();
  });
}

export function preprocessAttachments(docInfos: any, blobType: string, callback: any) {
  if (!docInfos.length) {
    return callback();
  }

  let docv = 0;
  let overallErr: any;

  docInfos.forEach(function (docInfo: any) {
    const attachments =
      docInfo.data && docInfo.data._attachments ? Object.keys(docInfo.data._attachments) : [];
    let recv = 0;

    if (!attachments.length) {
      return done();
    }

    function processedAttachment(err: any) {
      overallErr = err;
      recv++;
      if (recv === attachments.length) {
        done();
      }
    }

    for (const key in docInfo.data._attachments) {
      if (Object.prototype.hasOwnProperty.call(docInfo.data._attachments, key)) {
        preprocessAttachment(docInfo.data._attachments[key], blobType, processedAttachment);
      }
    }
  });

  function done() {
    docv++;
    if (docInfos.length === docv) {
      if (overallErr) {
        callback(overallErr);
      } else {
        callback();
      }
    }
  }
}
function parseBase64(data: any) {
  try {
    return atob(data);
  } catch (e) {
    const err = createError(BAD_ARG, 'Attachment is not a valid base64 string');
    return { error: err };
  }
}

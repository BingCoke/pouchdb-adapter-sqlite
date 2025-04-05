/**
 * Adapter version
 * Used for database schema versioning
 */
export const ADAPTER_VERSION = 1;

/**
 * Add quotes to table name
 * @param str Table name
 * @returns Quoted table name
 */
function quote(str: string) {
  return "'" + str + "'";
}

/**
 * Document store table name
 * Stores document metadata
 */
export const DOC_STORE = quote('document-store');

/**
 * Sequence store table name
 * Stores specific document versions, indexed by sequence ID
 */
export const BY_SEQ_STORE = quote('by-sequence');

/**
 * Attachment store table name
 * Stores document attachments
 */
export const ATTACH_STORE = quote('attach-store');

/**
 * Local document store table name
 * Stores local documents (non-replicated)
 */
export const LOCAL_STORE = quote('local-store');

/**
 * Metadata store table name
 * Stores database metadata
 */
export const META_STORE = quote('metadata-store');

/**
 * Attachment-sequence relationship store table name
 * Stores many-to-many relationships between attachment digests and sequences
 */
export const ATTACH_AND_SEQ_STORE = quote('attach-seq-store');

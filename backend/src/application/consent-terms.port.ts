export interface ConsentDocument {
  readonly token: string;
  readonly permalink: string;
}

export interface ConsentTerms {
  readonly publicKey: string;
  readonly endUserPolicy: ConsentDocument;
  readonly personalDataAuthorization: ConsentDocument;
}

/** Current documents and tokens required before submitting a card payment. */
export interface ConsentTermsReader {
  getCurrent(): Promise<ConsentTerms>;
}

export type ConsentFailureCategory = 'auth' | 'timeout' | 'invalid_response' | 'network';

export class ConsentTermsUnavailable extends Error {
  constructor(readonly category: ConsentFailureCategory) {
    super('Consent terms are temporarily unavailable');
    this.name = 'ConsentTermsUnavailable';
  }
}

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

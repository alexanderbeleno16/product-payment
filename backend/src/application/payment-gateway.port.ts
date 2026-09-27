export interface PaymentCredentials {
  readonly cardToken: string;
  readonly acceptanceToken: string;
  readonly personalDataToken: string;
}

export interface PaymentSubmission extends PaymentCredentials {
  readonly reference: string;
  readonly amountCents: number;
  readonly currency: 'COP';
  readonly installments: number;
  readonly customerEmail: string;
}

export type PaymentSubmissionOutcome =
  | { readonly kind: 'ACCEPTED'; readonly providerTransactionId: string }
  | { readonly kind: 'REJECTED' | 'UNKNOWN' };

export interface PaymentGateway {
  submit(command: PaymentSubmission): Promise<PaymentSubmissionOutcome>;
}

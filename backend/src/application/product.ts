export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly currency: string;
  readonly priceCents: number;
  readonly stock: number;
}

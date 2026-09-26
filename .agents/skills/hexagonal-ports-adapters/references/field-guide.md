# Hexagonal architecture field guide

The pattern's goal is to keep application behavior usable and testable without UI, database, or external network. It is not a requirement for six directories, an interface per class, or a specific ORM. Apply it to real boundaries in the checkout use cases.

## Dependency map

```text
HTTP controller / CLI / test driver  -->  input port / use case
                                            | domain policies
                                            v
                                    output port contracts
                                            ^
                persistence / remote API / clock adapters

Nest modules wire the outer adapters to the inner contracts.
```

Arrows show source dependencies toward the application core. Runtime calls may go outward through a port; that does not permit the core to import adapter implementations.

### R01 — Start with a use case and invariant

Describe the buyer's command, trusted product lookup, amount calculation, transaction lifecycle, stock policy, delivery rule, and failure states before creating folders. The domain should express what must be true; the application use case sequences external capabilities needed to uphold it.

### R02 — Separate input and output ports

An input port expresses an operation the application offers, independent of HTTP. A driving adapter translates a route request into that operation. An output port expresses a needed capability (for example, loading a product or recording a transaction); a driven adapter implements it with a database or remote service. Port names should match intent, not technology.

### R03 — Keep contracts core-owned

Use cases should accept domain/application types, not Nest `Request`, ORM entities, or raw SDK payloads. Translate at adapters, including validation and safe error mapping. If the external API changes, the adapter should absorb the change without rewriting business policy.

```ts
interface ProductCatalog {
  findById(id: string): Promise<Product | null>;
}
```

This is illustrative only: the final contract must be shaped by an actual use case and persistence choice.

### R04 — Avoid ceremonial ports

Create a port when a use case depends on an external capability or when a boundary needs independent testing/replacement. Do not wrap a pure function in an interface simply to satisfy a diagram. Prefer a small capability-oriented port over a giant `Repository` exposing every table operation.

### R05 — Keep Nest at the edge

Nest controllers and modules are adapters/composition. Domain values and use cases should not import decorators, HTTP exceptions, or framework-specific injection types. Since TypeScript interfaces disappear at runtime, the Nest composition root needs concrete injection tokens and provider bindings for abstract ports.

### R06 — Define consistency, not just interfaces

If payment confirmation, stock decrement, and delivery creation span resources, document which state is authoritative and where a transaction can be atomic. A port interface does not make a remote payment and database write one transaction. Consider idempotency, retry, and recovery after partial failure when implementation is designed. Do not claim exactly-once behavior without proof.

### R07 — Separate expected outcomes from faults

Use typed domain outcomes for validation, unavailable stock, or rejected payment. Keep transport timeouts, unavailable databases, and malformed external responses as infrastructure concerns translated at the boundary. The ROP skill covers composition; the hexagonal boundary determines where translation happens.

### R08 — Test ports and adapters differently

Run the application core with small in-memory fakes; verify invariants and call sequencing without a database/network. Test an adapter against its actual protocol or contract, including errors and serialization. Add a narrow E2E test for Nest wiring so a missing provider does not escape.

### R09 — Review dependency direction mechanically

Search for imports from `@nestjs/*`, database/ORM clients, HTTP response types, or remote SDKs inside domain/use-case directories. Such imports are architecture warnings. A directory name alone is not proof of architecture; the dependency graph and isolated tests are.

## Review checklist

- Can the use case execute with fakes and no HTTP server or database?
- Are ports capability-oriented and owned by the application core?
- Are all transport/ORM/SDK types translated at adapter boundaries?
- Is provider wiring outside domain code and covered by integration tests?
- Are payment/stock/delivery consistency and recovery assumptions explicit?
- Is any interface present only for ceremony rather than a real boundary?

## Primary sources

- [Alistair Cockburn: original Hexagonal Architecture article](https://alistair.cockburn.us/hexagonal-architecture/)
- [Nest providers](https://docs.nestjs.com/providers)
- [Nest custom providers](https://docs.nestjs.com/fundamentals/custom-providers)

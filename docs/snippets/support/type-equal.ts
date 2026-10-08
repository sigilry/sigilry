/**
 * Resolves to `true` only when `A` and `B` are the same type. Snippets that
 * restate a published type use it to fail typecheck when the two drift apart.
 */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

export type ConstructorReturnType<T> = T extends new (
  // biome-ignore lint/suspicious/noExplicitAny: biome is dumb
  ...args: any[]
) => infer U
  ? U
  : never;

export type ConstructorReturnType<T> = T extends new (
  ...args: never[]
) => infer U
  ? U
  : never;

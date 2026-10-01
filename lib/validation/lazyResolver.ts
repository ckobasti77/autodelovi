import type { FieldValues, Resolver } from "react-hook-form";

/**
 * A react-hook-form resolver whose implementation (zod + the schema) is imported on first use
 * instead of with the page, so it stays off the hydration path (PERF-01). `preload()` starts
 * the import early — on the first focus in the form, or in idle time — so validation normally
 * runs without waiting; a validation that comes first simply awaits the import (react-hook-form
 * accepts async resolvers). A failed import is retried on the next call.
 */
export function lazyResolver<
  TValues extends FieldValues,
  TContext = unknown,
  TTransformed = TValues,
>(load: () => Promise<Resolver<TValues, TContext, TTransformed>>) {
  let pending: Promise<Resolver<TValues, TContext, TTransformed>> | null = null;
  const preload = () => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
  const resolver: Resolver<TValues, TContext, TTransformed> = async (values, context, options) =>
    (await preload())(values, context, options);
  return { resolver, preload };
}

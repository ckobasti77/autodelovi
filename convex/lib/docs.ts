/** Strips `_id` / `_creationTime` so a stored document can be written back with `replace`. */
export function withoutSystemFields<T extends { _id: unknown; _creationTime: number }>(
  doc: T,
): Omit<T, "_id" | "_creationTime"> {
  const copy: Partial<T> = { ...doc };
  delete copy._id;
  delete copy._creationTime;
  return copy as Omit<T, "_id" | "_creationTime">;
}

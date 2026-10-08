/**
 * Some storages send null for fields the UI reads as strings or lists
 * (thumb, hash_info, type, sign...). A null is "absent": drop those keys so
 * no row has to guard against it.
 */
export const withoutNulls = <T extends object>(objs: T[]): T[] =>
  objs.map((o) =>
    Object.values(o).some((v) => v === null)
      ? (Object.fromEntries(
          Object.entries(o).filter(([, v]) => v !== null),
        ) as T)
      : o,
  )

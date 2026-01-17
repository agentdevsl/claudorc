type AnyRecord = Record<string, unknown>;

type MergeOptions = {
  seen: WeakMap<object, object>;
};

const isPlainObject = (value: unknown): value is AnyRecord => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const mergeObject = <T extends AnyRecord>(
  target: T,
  source: Partial<T>,
  options: MergeOptions
): T => {
  const result: AnyRecord = { ...target };

  options.seen.set(target as object, result);
  options.seen.set(source as object, result);

  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === 'object' && value !== null && options.seen.has(value)) {
      result[key] = options.seen.get(value) as AnyRecord;
    }
  }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (typeof sourceValue === 'object' && sourceValue !== null && options.seen.has(sourceValue)) {
      result[key] = options.seen.get(sourceValue) as AnyRecord;
      continue;
    }

    const targetValue = result[key];

    if (Array.isArray(sourceValue)) {
      result[key] = sourceValue.slice();
      continue;
    }

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = mergeObject(targetValue, sourceValue, options);
      continue;
    }

    result[key] = sourceValue;
  }

  return result as T;
};

export const deepMerge = <T extends object>(target: T, ...sources: Partial<T>[]): T => {
  if (sources.length === 0) {
    return target;
  }

  return sources.reduce((accumulator, source) => {
    if (source === undefined || source === null) {
      return accumulator;
    }

    if (!isPlainObject(source) || !isPlainObject(accumulator)) {
      return source as T;
    }

    return mergeObject(accumulator as AnyRecord, source as Partial<AnyRecord>, {
      seen: new WeakMap<object, object>(),
    });
  }, target);
};

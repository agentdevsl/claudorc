type ClassValue = string | number | boolean | null | undefined;

type ClassInput = ClassValue | ClassInput[] | { [key: string]: boolean };

const toClassName = (input: ClassInput): string => {
  if (!input) {
    return '';
  }

  if (Array.isArray(input)) {
    return input.map(toClassName).filter(Boolean).join(' ');
  }

  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, value]) => value)
      .map(([key]) => key)
      .join(' ');
  }

  return String(input);
};

export const cn = (...inputs: ClassInput[]): string => {
  return inputs.map(toClassName).filter(Boolean).join(' ');
};

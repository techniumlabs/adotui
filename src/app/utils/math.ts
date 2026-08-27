export const clamp = (value: number, min: number, max: number): number => {
  if (max < min) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
};

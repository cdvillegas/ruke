export type TimeGroup<T> = {
  label: string;
  items: T[];
};

export function groupByTime<T>(
  items: T[] | undefined | null,
  getDate: (item: T) => string | Date,
): TimeGroup<T>[] {
  if (!items || !Array.isArray(items)) return [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  const groups: Record<string, T[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    'Previous 30 Days': [],
    Older: [],
  };

  for (const item of items) {
    const d = new Date(getDate(item));
    if (d >= today) groups['Today'].push(item);
    else if (d >= yesterday) groups['Yesterday'].push(item);
    else if (d >= weekAgo) groups['Previous 7 Days'].push(item);
    else if (d >= monthAgo) groups['Previous 30 Days'].push(item);
    else groups['Older'].push(item);
  }

  return Object.entries(groups)
    .filter(([, v]) => v.length > 0)
    .map(([label, items]) => ({ label, items }));
}

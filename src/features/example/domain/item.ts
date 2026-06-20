// STUB FEATURE — delete src/features/example to start your project.
export interface Item {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function renameItem(item: Item, name: string): Item {
  return { ...item, name, updatedAt: new Date() };
}

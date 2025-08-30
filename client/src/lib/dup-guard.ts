export function markModule(id: string) {
  const g = globalThis as any;
  g.__MOK_LOADED__ ??= new Set<string>();
  if (g.__MOK_LOADED__.has(id)) {
    console.warn("[DupModule]", id, "loaded again");
  }
  g.__MOK_LOADED__.add(id);
}
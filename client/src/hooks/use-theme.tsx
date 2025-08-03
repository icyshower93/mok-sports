// Simple theme utility without React hooks to avoid issues
export function applyDarkTheme() {
  if (typeof window !== "undefined") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }
}

// Initialize dark theme immediately
if (typeof window !== "undefined") {
  applyDarkTheme();
}
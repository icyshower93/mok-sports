import { trace } from "@/debug/trace";
trace("App.tsx");

// App.tsx (TEMP) - Binary search for TDZ culprit
export default function App() {
  return <div data-probe="bare-app">ok</div>;
}
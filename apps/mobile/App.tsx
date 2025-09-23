import { ExpoRoot } from 'expo-router';

// Must be exported or Fast Refresh won't update the context
export default function App() {
  const ctx = (require as any).context('./app');
  return <ExpoRoot context={ctx} />;
}

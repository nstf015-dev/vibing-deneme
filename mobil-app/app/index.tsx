import { Redirect } from 'expo-router';

export default function Index() {
  // Uygulama açılınca direkt Welcome'a git
  return <Redirect href="/welcome" />;
}
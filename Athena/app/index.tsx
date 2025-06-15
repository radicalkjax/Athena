import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();
  
  useEffect(() => {
    // Force navigation to tabs
    router.replace('/(tabs)');
  }, []);
  
  return <Redirect href="/(tabs)" />;
}

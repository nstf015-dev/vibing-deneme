import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// BURAYA KENDİ BİLGİLERİNİ YAPIŞTIRMAYI UNUTMA
const supabaseUrl = 'https://dsomglzwpwqutwlmipdp.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzb21nbHp3cHdxdXR3bG1pcGRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NzE5NjksImV4cCI6MjA3OTI0Nzk2OX0.032LFxFJkUDj8VfmiqmX9fi3rnrXZWORX4UmR7mArkg';

// Web'de "window is not defined" hatasını engelleyen özel Depo
const customStorage = {
  getItem: (key: string) => {
    if (Platform.OS === 'web') {
      // Eğer sunucudaysak (build aşaması) null döndür
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
      return;
    }
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage, // Özel depomuzu kullanıyoruz
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
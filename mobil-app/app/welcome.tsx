import { LinearGradient } from 'expo-linear-gradient'; // Renk geçişi için (Expo'da yüklü gelir)
import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Arkaplan Görseli (Moda/Güzellik Temalı) */}
      <ImageBackground 
        source={{ uri: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&h=1200&fit=crop' }} 
        style={styles.background}
      >
        {/* Karartma Efekti */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <Text style={styles.title}>VibeBeauty</Text>
            <Text style={styles.subtitle}>Güzelliği Keşfet,{"\n"}Tarzını Yansıt.</Text>
            
            <Text style={styles.description}>
              En iyi kuaförler, tırnak stüdyoları ve güzellik merkezleri tek dokunuş uzağında.
            </Text>

            {/* Butonlar */}
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.primaryText}>Giriş Yap</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.secondaryText}>Hesap Oluştur</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, justifyContent: 'flex-end' },
  gradient: { flex: 1, justifyContent: 'flex-end', padding: 20, paddingBottom: 50 },
  content: { alignItems: 'center' },
  title: { color: '#fff', fontSize: 42, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
  subtitle: { color: '#fff', fontSize: 24, textAlign: 'center', fontWeight: '600', marginBottom: 15 },
  description: { color: '#ccc', textAlign: 'center', fontSize: 14, marginBottom: 40, paddingHorizontal: 20, lineHeight: 20 },
  primaryButton: { backgroundColor: '#fff', width: '100%', padding: 16, borderRadius: 30, alignItems: 'center', marginBottom: 15 },
  primaryText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: { backgroundColor: 'transparent', width: '100%', padding: 16, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: '#fff' },
  secondaryText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/auth/AuthContext';

import AuthScreen from './src/screens/AuthScreen';
import AcompanhamentoGate from './src/navigation/AcompanhamentoGate';

function Conteudo() {
  const { carregando, erroInicial, usuario } = useAuth();

  if (carregando || erroInicial) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: '#FAF7FC',
        }}
      >
        {erroInicial ? (
          <Text>{erroInicial}</Text>
        ) : (
          <ActivityIndicator size="large" color="#8563A6" />
        )}
      </View>
    );
  }

  if (!usuario) {
    return <AuthScreen />;
  }

  return <AcompanhamentoGate />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Conteudo />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
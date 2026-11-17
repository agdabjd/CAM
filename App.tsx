import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { obterBanco } from './src/database/database';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    obterBanco()
      .then(() => {
        if (ativo) setPronto(true);
      })
      .catch((falha) => {
        console.error('Erro ao inicializar banco:', falha);

        if (ativo) {
          setErro('Não foi possível abrir os dados do aplicativo.');
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />

      {!pronto ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            backgroundColor: '#FAF7FC',
          }}
        >
          {erro ? (
            <Text>{erro}</Text>
          ) : (
            <ActivityIndicator size="large" color="#8563A6" />
          )}
        </View>
      ) : (
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
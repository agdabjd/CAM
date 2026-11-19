import { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Button,
  Text,
  View,
} from 'react-native';

import { NavigationContainer } from '@react-navigation/native';

import { existeConfiguracao } from '../database/onboardingRepository';

import OnboardingScreen from '../screens/OnboardingScreen';
import AppNavigator from './AppNavigator';

import { RegistrosProvider } from '../features/registros/RegistrosProvider';

export default function AcompanhamentoGate() {
  const [configurado, setConfigurado] = useState<boolean | null>(
    null
  );
  const [erro, setErro] = useState(false);

  const verificar = useCallback(async () => {
    setErro(false);
    setConfigurado(null);

    try {
      setConfigurado(await existeConfiguracao());
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    void verificar();
  }, [verificar]);

  if (erro || configurado === null) {
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FAF7FC',
          gap: 16,
        }}
      >
        {erro ? (
          <>
            <Text>Não foi possível consultar sua configuração.</Text>

            <Button
              title="Tentar novamente"
              onPress={() => void verificar()}
            />
          </>
        ) : (
          <ActivityIndicator size="large" color="#8563A6" />
        )}
      </View>
    );
  }

  if (!configurado) {
    return (
      <OnboardingScreen
        onConcluido={() => setConfigurado(true)}
      />
    );
  }

  return (
    <NavigationContainer>
      <RegistrosProvider>
        <AppNavigator />
      </RegistrosProvider>
    </NavigationContainer>
  );
}
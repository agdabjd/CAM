import TelaBase from '../components/TelaBase';

import { Alert, Button, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';

export function InicioScreen() {
  return (
    <TelaBase
      titulo="CAM - Calendário Anticoncepcional e Menstrual"
      descricao="Seu acompanhamento diário aparecerá aqui."
    />
  );
}

export function CalendarioScreen() {
  return (
    <TelaBase
      titulo="Calendário"
      descricao="Aqui você acompanhará as datas previstas e seus registros."
    />
  );
}

export function RegistrosScreen() {
  return (
    <TelaBase
      titulo="Registros"
      descricao="Seu histórico de registros aparecerá aqui."
    />
  );
}

export function PerfilScreen() {
  const { usuario, sair } = useAuth();

  function confirmarSaida() {
    Alert.alert(
      'Encerrar sessão',
      'Você precisará entrar novamente para acessar seus dados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          onPress: () => {
            sair().catch(() => {
              Alert.alert(
                'Não foi possível sair',
                'Tente novamente.'
              );
            });
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView
      edges={['top']}
      style={{
        flex: 1,
        padding: 24,
        backgroundColor: '#FAF7FC',
      }}
    >
      <Text
        style={{
          fontSize: 26,
          fontWeight: '600',
          color: '#182235',
          marginBottom: 24,
        }}
      >
        Perfil
      </Text>

      <View style={{ gap: 12, marginBottom: 24 }}>
        <Text style={{ fontSize: 20 }}>{usuario?.nome}</Text>
        <Text>{usuario?.email}</Text>
      </View>

      <Button
        title="Encerrar sessão"
        color="#8563A6"
        onPress={confirmarSaida}
      />
    </SafeAreaView>
  );
}
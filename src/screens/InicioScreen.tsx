import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';

import ResumoConfiguracao from '../components/ResumoConfiguracao';

import {
  buscarConfiguracaoDaData,
  type NovaConfiguracao,
} from '../database/acompanhamentoRepository';

import { hojeLocal } from '../domain/datas';

import { configuracaoParaRegime } from '../domain/contraceptivo/configuracaoParaRegime';

import { configuracaoParaCiclo } from '../domain/menstrual/configuracaoParaCiclo';

export default function InicioScreen() {
  const { usuario } = useAuth();

  const [dados, setDados] = useState<NovaConfiguracao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      setCarregando(true);
      setErro(false);

      buscarConfiguracaoDaData(hojeLocal())
        .then((configuracao) => {
          if (!ativo) return;

          if (!configuracao) {
            setDados(null);
            return;
          }

          const convertida: NovaConfiguracao =
            configuracao.modo === 'anticoncepcional'
              ? {
                  modo: 'anticoncepcional',
                  vigenteDesde: configuracao.vigente_desde,
                  metodo: configuracao.metodo ?? '',
                  acao: configuracao.acao ?? '',
                  ...configuracaoParaRegime(configuracao),
                }
              : {
                  modo: 'menstrual',
                  vigenteDesde: configuracao.vigente_desde,
                  ...configuracaoParaCiclo(configuracao),
                };

          setDados(convertida);
        })
        .catch(() => {
          if (ativo) setErro(true);
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });

      return () => {
        ativo = false;
      };
    }, [])
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: '#FAF7FC' }}
    >
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <Text
          style={{
            fontSize: 26,
            fontWeight: '600',
            color: '#182235',
            marginBottom: 8,
          }}
        >
          Olá, {usuario?.nome}
        </Text>

        <Text style={{ color: '#71677E', marginBottom: 24 }}>
          Sua agenda prevista
        </Text>

        {carregando ? (
          <ActivityIndicator size="large" color="#8563A6" />
        ) : erro ? (
          <Text>Não foi possível carregar o acompanhamento.</Text>
        ) : dados ? (
          <View
            style={{
              padding: 20,
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#EAE3F0',
            }}
          >
            <ResumoConfiguracao dados={dados} />
          </View>
        ) : (
          <Text>Não há uma configuração vigente para hoje.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
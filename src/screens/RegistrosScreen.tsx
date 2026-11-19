import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  excluirDia,
  excluirPeriodo,
  listarDiarios,
  listarPeriodos,
} from '../database/registrosRepository';

import { buscarConfiguracaoDaData } from '../database/acompanhamentoRepository';

import { useRegistros } from '../features/registros/RegistrosProvider';

import { hojeLocal } from '../domain/datas';
import { formatarData } from '../domain/onboarding';

type Diarios = Awaited<ReturnType<typeof listarDiarios>>;
type Periodos = Awaited<ReturnType<typeof listarPeriodos>>;

export default function RegistrosScreen() {
  const {
    versao,
    atualizar,
    abrirDia,
    abrirPeriodo,
  } = useRegistros();

  const [diarios, setDiarios] = useState<Diarios>([]);
  const [periodos, setPeriodos] = useState<Periodos>([]);
  const [modoMenstrual, setModoMenstrual] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      setCarregando(true);
      setErro(false);

      Promise.all([
        listarDiarios(),
        listarPeriodos(),
        buscarConfiguracaoDaData(hojeLocal()),
      ])
        .then(([dias, menstruacoes, configuracao]) => {
          if (!ativo) return;

          setDiarios(dias);
          setPeriodos(menstruacoes);
          setModoMenstrual(configuracao?.modo === 'menstrual');
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
    }, [versao])
  );

  function confirmarExclusao(
    tipo: 'dia' | 'periodo',
    id: number
  ) {
    Alert.alert(
      'Excluir registro?',
      tipo === 'dia'
        ? 'As anotações e ações deste dia serão removidas. ' +
          'Os períodos menstruais serão mantidos.'
        : 'Este período menstrual será removido. ' +
          'As anotações diárias serão mantidas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            const operacao =
              tipo === 'dia'
                ? excluirDia(id)
                : excluirPeriodo(id);

            operacao
              .then(atualizar)
              .catch(() =>
                Alert.alert(
                  'Não foi possível excluir',
                  'Tente novamente.'
                )
              );
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.pagina}>
      <ScrollView contentContainerStyle={{ padding: 22 }}>
        <View style={s.linha}>
          <Text style={s.titulo}>Registros</Text>

          <Pressable onPress={() => abrirDia()} style={s.adicionar}>
            <Text style={{ color: '#FFFFFF', fontSize: 25 }}>+</Text>
          </Pressable>
        </View>

        {modoMenstrual && (
          <Pressable
            onPress={() => abrirPeriodo()}
            style={{ marginTop: 20 }}
          >
            <Text style={s.link}>+ Registrar menstruação</Text>
          </Pressable>
        )}

        {carregando ? (
          <ActivityIndicator
            color="#8563A6"
            style={{ marginTop: 30 }}
          />
        ) : erro ? (
          <Text style={{ marginTop: 24 }}>
            Não foi possível carregar os registros.
          </Text>
        ) : (
          <>
            <Text style={s.secao}>REGISTROS DIÁRIOS</Text>

            {diarios.length === 0 && (
              <Text style={s.discreto}>
                Seus registros aparecerão aqui.
              </Text>
            )}

            {diarios.map((item) => (
              <View key={item.id} style={s.cartao}>
                <Pressable onPress={() => abrirDia(item.data)}>
                  <Text style={s.data}>
                    {formatarData(item.data)}
                    {item.horario ? ` às ${item.horario}` : ''}
                  </Text>

                  {!!item.humor && <Text>{item.humor}</Text>}

                  {item.sangramento_fluxo !== 'nenhum' && (
                    <Text>
                      Sangramento: {item.sangramento_fluxo}
                    </Text>
                  )}

                  {!!item.observacoes && (
                    <Text numberOfLines={2}>
                      {item.observacoes}
                    </Text>
                  )}

                  <Text style={s.link}>
                    Ver ações, sintomas e editar
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    confirmarExclusao('dia', item.id)
                  }
                >
                  <Text style={s.excluir}>Excluir</Text>
                </Pressable>
              </View>
            ))}

            <Text style={s.secao}>MENSTRUAÇÕES REGISTRADAS</Text>

            {periodos.length === 0 && (
              <Text style={s.discreto}>
                Nenhuma menstruação registrada.
              </Text>
            )}

            {periodos.map((item) => (
              <View key={item.id} style={s.cartao}>
                <Pressable onPress={() => abrirPeriodo(item.id)}>
                  <Text style={s.data}>
                    {formatarData(item.data_inicio)}
                    {item.data_fim
                      ? ` a ${formatarData(item.data_fim)}`
                      : ' — em andamento'}
                  </Text>

                  {!!item.observacoes && (
                    <Text numberOfLines={2}>
                      {item.observacoes}
                    </Text>
                  )}

                  <Text style={s.link}>
                    Editar início, fim e observações
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    if (item.id !== undefined) {
                      confirmarExclusao('periodo', item.id);
                    }
                  }}
                >
                  <Text style={s.excluir}>Excluir</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#FAF7FC' },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titulo: {
    fontSize: 26,
    fontWeight: '600',
    color: '#182235',
  },
  adicionar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8563A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secao: {
    color: '#80768B',
    fontSize: 12,
    letterSpacing: 1.2,
    marginTop: 28,
    marginBottom: 12,
  },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    gap: 12,
  },
  data: {
    color: '#182235',
    fontWeight: '600',
    marginBottom: 10,
  },
  link: { color: '#8563A6', marginTop: 10 },
  excluir: { color: '#B64F74', marginTop: 4 },
  discreto: { color: '#80768B' },
});
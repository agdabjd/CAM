import { useMemo } from 'react';

import {
  ActivityIndicator,
  Alert,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  excluirDia,
  excluirPeriodo,
} from '../database/registrosRepository';

import { useRegistros } from '../features/registros/RegistrosProvider';
import { useLinhaDoTempo } from '../features/registros/useLinhaDoTempo';

import {
  criarConsultaLinhaDoTempo,
  type GrupoHistorico,
  type TipoLinha,
} from '../domain/linhaDoTempo';

import { hojeLocal, somarDias } from '../domain/datas';

const MESES = [
  'JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN',
  'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ',
];

const ICONES: Record<
  TipoLinha,
  keyof typeof Ionicons.glyphMap
> = {
  acao: 'checkmark-circle-outline',
  humor: 'happy-outline',
  sangramento: 'water-outline',
  sintomas: 'pulse-outline',
  observacao: 'create-outline',
  menstruacao: 'flower-outline',
  registro: 'document-text-outline',
};

const CORES: Record<TipoLinha, string> = {
  acao: '#8563A6',
  humor: '#DF5D83',
  sangramento: '#DF5D83',
  sintomas: '#9DBFA9',
  observacao: '#80768B',
  menstruacao: '#DF5D83',
  registro: '#80768B',
};

function tituloData(data: string, hoje: string) {
  const dia = Number(data.slice(8, 10));
  const mes = MESES[Number(data.slice(5, 7)) - 1];

  const prefixo =
    data === hoje
      ? 'HOJE, '
      : data === somarDias(hoje, -1)
        ? 'ONTEM, '
        : '';

  const ano =
    data.slice(0, 4) !== hoje.slice(0, 4)
      ? ` ${data.slice(0, 4)}`
      : '';

  return `${prefixo}${dia} ${mes}${ano}`;
}

export default function RegistrosScreen() {
  const {
    abrirDia,
    abrirPeriodo,
    atualizar,
  } = useRegistros();

  const {
    dados,
    carregando,
    erro,
    recarregar,
  } = useLinhaDoTempo();

  const hoje = hojeLocal();

  const consulta = useMemo(
    () => dados ? criarConsultaLinhaDoTempo(dados, hoje) : null,
    [dados, hoje]
  );

  function confirmarExclusao(
    tipo: 'dia' | 'periodo',
    id: number
  ) {
    Alert.alert(
      'Excluir registro?',
      tipo === 'dia'
        ? 'As ações e anotações deste diário serão removidas. ' +
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

  function menuDiario(grupo: GrupoHistorico) {
    const id = grupo.diarioId;
    if (id === null) return;

    Alert.alert('Registro diário', 'O que deseja fazer?', [
      {
        text: 'Editar',
        onPress: () => abrirDia(grupo.data),
      },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => confirmarExclusao('dia', id),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function menuPeriodo(id: number) {
    Alert.alert('Menstruação', 'O que deseja fazer?', [
      {
        text: 'Editar',
        onPress: () => abrirPeriodo(id),
      },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => confirmarExclusao('periodo', id),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function abrirOpcoes(grupo: GrupoHistorico) {
    const periodoId = grupo.periodoIds[0];

    if (grupo.diarioId !== null && periodoId !== undefined) {
      Alert.alert('Opções do dia', 'Escolha o registro:', [
        {
          text: 'Registro diário',
          onPress: () => menuDiario(grupo),
        },
        {
          text: 'Menstruação',
          onPress: () => menuPeriodo(periodoId),
        },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    } else if (grupo.diarioId !== null) {
      menuDiario(grupo);
    } else if (periodoId !== undefined) {
      menuPeriodo(periodoId);
    }
  }

  function adicionar() {
    const modo = consulta?.consultarDia(hoje).modo;

    if (modo !== 'menstrual') {
      abrirDia();
      return;
    }

    Alert.alert('Novo registro', 'O que deseja registrar?', [
      {
        text: 'Registro diário',
        onPress: () => abrirDia(),
      },
      {
        text: 'Menstruação',
        onPress: () => abrirPeriodo(),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView edges={['top']} style={s.pagina}>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.cabecalho}>
          <Text style={s.titulo}>Registros</Text>

          <Pressable
            onPress={adicionar}
            style={s.adicionar}
            accessibilityLabel="Adicionar registro"
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {carregando ? (
          <ActivityIndicator
            color="#8563A6"
            style={{ marginTop: 24 }}
          />
        ) : erro ? (
          <View style={{ gap: 12 }}>
            <Text>Não foi possível carregar o histórico.</Text>
            <Button title="Tentar novamente" onPress={recarregar} />
          </View>
        ) : consulta?.historico.length === 0 ? (
          <Text style={s.vazio}>
            Seus registros aparecerão aqui.
          </Text>
        ) : (
          consulta?.historico.map((grupo) => (
            <View key={grupo.data} style={{ marginBottom: 22 }}>
              <Text style={s.data}>
                {tituloData(grupo.data, hoje)}
              </Text>

              <View style={s.cartao}>
                <Pressable
                  style={s.opcoes}
                  onPress={() => abrirOpcoes(grupo)}
                  accessibilityLabel="Opções dos registros deste dia"
                  hitSlop={8}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color="#80768B"
                  />
                </Pressable>

                {grupo.linhas.map((linha, indice) => (
                  <Pressable
                    key={`${linha.tipo}-${indice}`}
                    onPress={() => {
                      if (linha.periodoId !== undefined) {
                        abrirPeriodo(linha.periodoId);
                      } else {
                        abrirDia(grupo.data);
                      }
                    }}
                    style={[
                      s.linha,
                      indice < grupo.linhas.length - 1 &&
                        s.separador,
                    ]}
                  >
                    <Ionicons
                      name={ICONES[linha.tipo]}
                      size={19}
                      color={CORES[linha.tipo]}
                    />

                    <Text style={s.textoLinha}>
                      {linha.texto}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#FAF7FC' },
  conteudo: { padding: 22, paddingBottom: 32 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '600',
    color: '#182235',
  },
  adicionar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#8563A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  data: {
    color: '#80768B',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  opcoes: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 1,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingRight: 24,
  },
  separador: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAF5',
  },
  textoLinha: {
    flex: 1,
    color: '#182235',
    fontSize: 14,
    lineHeight: 21,
  },
  vazio: {
    color: '#80768B',
    lineHeight: 22,
    marginTop: 12,
  },
});
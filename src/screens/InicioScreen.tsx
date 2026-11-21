import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { useRegistros } from '../features/registros/RegistrosProvider';

import {
  buscarConfiguracaoDaData,
  type ConfiguracaoSalva,
} from '../database/acompanhamentoRepository';

import {
  carregarDia,
  listarPeriodos,
  type Diario,
  type PeriodoMenstrual,
} from '../database/registrosRepository';

import { hojeLocal, diferencaDias } from '../domain/datas';
import { formatarData } from '../domain/onboarding';

import {
  calcularDia,
  pausaAtualOuProxima,
} from '../domain/contraceptivo/regime';

import { configuracaoParaRegime } from '../domain/contraceptivo/configuracaoParaRegime';

import {
  calcularDiaMenstrual,
  periodoPrevistoAtualOuProximo,
} from '../domain/menstrual/cicloMenstrual';

import { configuracaoParaCiclo } from '../domain/menstrual/configuracaoParaCiclo';

import { useNotificacoes } from '../features/notificacoes/NotificacoesProvider';

export default function InicioScreen() {
  const { usuario } = useAuth();
  const { versao, abrirDia, abrirPeriodo } = useRegistros();

  const [dados, setDados] = useState<{
    configuracao: ConfiguracaoSalva;
    diario: Diario;
    periodo: PeriodoMenstrual | null;
  } | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const { abrirNotificacoes } = useNotificacoes();

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const hoje = hojeLocal();

      setCarregando(true);
      setErro(false);

      Promise.all([
        buscarConfiguracaoDaData(hoje),
        carregarDia(hoje),
        listarPeriodos(),
      ])
        .then(([configuracao, diario, periodos]) => {
          if (!ativo) return;

          if (!configuracao) {
            setDados(null);
            return;
          }

          setDados({
            configuracao,
            diario,
            periodo:
              periodos.find((item) => item.data_fim === null) ??
              null,
          });
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

  if (carregando || erro || !dados) {
    return (
      <SafeAreaView style={s.centralizado}>
        {carregando ? (
          <ActivityIndicator color="#8563A6" />
        ) : (
          <Text>
            {erro
              ? 'Não foi possível carregar o acompanhamento.'
              : 'Não há configuração vigente para hoje.'}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  const hoje = hojeLocal();
  const c = dados.configuracao;
  const anticoncepcional = c.modo === 'anticoncepcional';

  let titulo = '';
  let status = '';
  let proximoTitulo = '';
  let proximoTexto = '';
  let proximaData = '';
  let indicadorTitulo = '';
  let indicadorValor = '';
  let duracaoTitulo = '';
  let duracaoValor = '';

  if (anticoncepcional) {
    const regime = configuracaoParaRegime(c);
    const dia = calcularDia(regime, hoje);
    const pausa = pausaAtualOuProxima(regime, hoje);

    titulo = c.metodo ?? 'Anticoncepcional';

    const textos = {
      antes_inicio: 'O período de uso ainda não começou',
      acao_prevista: 'Ação de hoje ainda não registrada',
      uso_em_andamento: 'Período de uso',
      pausa: `Dia ${dia.diaDePausa} da pausa`,
    };

    status =
      dados.diario.acoes.length > 0
        ? `${dados.diario.acoes.length} ação(ões) registrada(s) hoje`
        : textos[dia.situacao];

    proximoTitulo = pausa?.emAndamento
      ? 'Retomada prevista'
      : 'Próxima pausa';

    proximaData = pausa
      ? pausa.emAndamento
        ? pausa.retomada
        : pausa.inicio
      : '';

    proximoTexto = proximaData
      ? `em ${diferencaDias(hoje, proximaData)} dia(s)`
      : 'Uso contínuo';

    indicadorTitulo =
      dia.situacao === 'pausa' ? 'Dia da pausa' : 'Dia de uso';

    indicadorValor = String(
      dia.diaDePausa ?? dia.diaDeUso ?? '—'
    );

    duracaoTitulo = 'Período de uso';
    duracaoValor =
      regime.pausa.tipo === 'nenhuma'
        ? 'Contínuo'
        : String(
            regime.pausa.tipo === 'dias'
              ? regime.pausa.apos
              : regime.pausa.apos * regime.intervaloDias
          );
  } else {
    const ciclo = configuracaoParaCiclo(c);
    const dia = calcularDiaMenstrual(ciclo, hoje);
    const previsto = periodoPrevistoAtualOuProximo(ciclo, hoje);

    titulo = dados.periodo
      ? 'Menstruação em andamento'
      : 'Acompanhamento menstrual';

    status = dados.periodo
      ? `Iniciada em ${formatarData(dados.periodo.data_inicio)}`
      : 'Acompanhe seus registros e estimativas';

    proximoTitulo = previsto.emAndamento
      ? 'Período previsto atual'
      : 'Próxima menstruação prevista';

    proximaData = previsto.inicio;

    proximoTexto = previsto.emAndamento
      ? `até ${formatarData(previsto.fim)}`
      : `em ${diferencaDias(hoje, previsto.inicio)} dia(s)`;

    indicadorTitulo = 'Dia estimado do ciclo';
    indicadorValor = String(dia.diaDoCicloEstimado ?? '—');
    duracaoTitulo = 'Ciclo configurado';
    duracaoValor = String(ciclo.duracaoCicloDias);
  }

  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? 'Bom dia,' : hora < 18 ? 'Boa tarde,' : 'Boa noite,';

  return (
    <SafeAreaView edges={['top']} style={s.pagina}>
      <ScrollView contentContainerStyle={s.conteudo}>
        <View style={s.linha}>
          <View>
            <Text style={s.discreto}>{saudacao}</Text>
            <Text style={s.nome}>{usuario?.nome} ✨</Text>
          </View>

          <Pressable
            style={s.sino}
            accessibilityRole="button"
            accessibilityLabel="Configurar notificações"
            onPress={abrirNotificacoes}
          >
            <Ionicons
              name="notifications-outline"
              size={22}
              color="#8563A6"
            />
          </Pressable>
        </View>

        <View style={s.principal}>
          <Text style={s.rotuloRoxo}>HOJE</Text>
          <Text style={s.titulo}>{titulo}</Text>
          <Text style={s.discreto}>{status}</Text>

          <Pressable
            style={s.botao}
            onPress={() => {
              if (anticoncepcional) {
                abrirDia();
              } else {
                abrirPeriodo(dados.periodo?.id);
              }
            }}
          >
            <Text style={s.textoBotao}>
              {anticoncepcional
                ? 'Registrar uso'
                : dados.periodo
                  ? 'Informar fim da menstruação'
                  : 'Registrar menstruação'}
            </Text>
          </Pressable>
        </View>

        <View style={[s.cartao, s.linha]}>
          <View style={{ flex: 1 }}>
            <Text style={s.discreto}>{proximoTitulo}</Text>
            <Text style={s.subtitulo}>{proximoTexto}</Text>
          </View>

          {!!proximaData && (
            <Text style={s.data}>
              {formatarData(proximaData).slice(0, 5)}
            </Text>
          )}
        </View>

        <Text style={s.secao}>REGISTRAR AGORA</Text>

        <View style={s.atalhos}>
          {[
            {
              titulo: 'Humor',
              icone: 'happy-outline' as const,
              cor: '#E9B4C8',
            },
            {
              titulo: 'Sintomas',
              icone: 'pulse-outline' as const,
              cor: '#E9DFF2',
            },
            {
              titulo: 'Sangramento',
              icone: 'water-outline' as const,
              cor: '#FFE3EC',
            },
          ].map((item) => (
            <Pressable
              key={item.titulo}
              onPress={() => abrirDia()}
              style={[s.atalho, { backgroundColor: item.cor }]}
            >
              <Ionicons
                name={item.icone}
                size={23}
                color="#8563A6"
              />
              <Text style={s.textoAtalho}>{item.titulo}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.secao}>
          {anticoncepcional ? 'ACOMPANHAMENTO ATUAL' : 'CICLO ATUAL'}
        </Text>

        <View style={s.atalhos}>
          <View style={[s.cartao, { flex: 1 }]}>
            <Text style={s.discreto}>{indicadorTitulo}</Text>
            <Text style={[s.numero, { color: '#8563A6' }]}>
              {indicadorValor}
            </Text>
          </View>

          <View style={[s.cartao, { flex: 1 }]}>
            <Text style={s.discreto}>{duracaoTitulo}</Text>
            <Text style={s.numero}>{duracaoValor}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#FAF7FC' },
  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF7FC',
    padding: 24,
  },
  conteudo: { padding: 22, paddingBottom: 32 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nome: {
    fontSize: 24,
    fontWeight: '600',
    color: '#182235',
    marginTop: 4,
  },
  discreto: {
    color: '#80768B',
    fontSize: 13,
    lineHeight: 20,
  },
  sino: {
    width: 42,
    height: 42,
    borderRadius: 18,
    backgroundColor: '#E9DFF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  principal: {
    backgroundColor: '#E9DFF2',
    borderRadius: 24,
    padding: 20,
    marginTop: 24,
    marginBottom: 18,
    gap: 8,
  },
  rotuloRoxo: {
    color: '#8563A6',
    fontSize: 12,
    letterSpacing: 1,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '600',
    color: '#182235',
  },
  botao: {
    backgroundColor: '#8563A6',
    minHeight: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  textoBotao: { color: '#FFFFFF', fontWeight: '600' },
  cartao: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 22,
    padding: 17,
  },
  subtitulo: {
    fontSize: 17,
    fontWeight: '600',
    color: '#182235',
    marginTop: 4,
  },
  data: {
    backgroundColor: '#E9B4C8',
    padding: 10,
    borderRadius: 14,
    color: '#78445B',
    fontSize: 12,
  },
  secao: {
    color: '#80768B',
    fontSize: 12,
    letterSpacing: 1.4,
    marginTop: 24,
    marginBottom: 12,
  },
  atalhos: { flexDirection: 'row', gap: 10 },
  atalho: {
    flex: 1,
    minHeight: 86,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  textoAtalho: { color: '#78558F', fontSize: 12 },
  numero: {
    fontSize: 27,
    fontWeight: '600',
    color: '#182235',
    marginTop: 8,
  },
});
import { useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRegistros } from '../features/registros/RegistrosProvider';
import { useLinhaDoTempo } from '../features/registros/useLinhaDoTempo';

import {
  criarConsultaLinhaDoTempo,
  type Marcador,
} from '../domain/linhaDoTempo';

import {
  diferencaDias,
  hojeLocal,
  somarDias,
} from '../domain/datas';

import { formatarData } from '../domain/onboarding';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const LEGENDAS: Record<
  Marcador,
  { texto: string; cor: string; vazado: boolean }
> = {
  acao_prevista: {
    texto: 'Ação prevista',
    cor: '#8563A6',
    vazado: true,
  },
  acao_realizada: {
    texto: 'Ação realizada',
    cor: '#8563A6',
    vazado: false,
  },
  pausa: {
    texto: 'Pausa',
    cor: '#817889',
    vazado: false,
  },
  menstruacao_prevista: {
    texto: 'Menstruação prevista',
    cor: '#DE8DAA',
    vazado: true,
  },
  sangramento: {
    texto: 'Sangramento registrado',
    cor: '#DF5D83',
    vazado: false,
  },
  registro: {
    texto: 'Registro diário',
    cor: '#9DBFA9',
    vazado: false,
  },
};

function primeiroDiaDoMes(data: string) {
  return `${data.slice(0, 7)}-01`;
}

function deslocarMes(mes: string, quantidade: number) {
  const valor = new Date(`${mes}T12:00:00Z`);

  valor.setUTCMonth(valor.getUTCMonth() + quantidade);

  return valor.toISOString().slice(0, 10);
}

function montarGrade(mes: string) {
  const primeiro = new Date(`${mes}T12:00:00Z`).getUTCDay();

  const quantidade = diferencaDias(
    mes,
    deslocarMes(mes, 1)
  );

  const tamanho = Math.ceil((primeiro + quantidade) / 7) * 7;

  return Array.from({ length: tamanho }, (_, indice) => {
    const dia = indice - primeiro;

    return dia < 0 || dia >= quantidade
      ? null
      : somarDias(mes, dia);
  });
}

function MarcadorVisual({
  tipo,
  selecionado = false,
  grande = false,
}: {
  tipo: Marcador;
  selecionado?: boolean;
  grande?: boolean;
}) {
  const legenda = LEGENDAS[tipo];

  const cor =
    selecionado && legenda.cor === '#8563A6'
      ? '#FFFFFF'
      : legenda.cor;

  const tamanho = grande ? 9 : 5;

  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        borderWidth: 1,
        borderColor: cor,
        backgroundColor: legenda.vazado ? 'transparent' : cor,
      }}
    />
  );
}

export default function CalendarioScreen() {
  const { abrirDia } = useRegistros();
  const { dados, carregando, erro, recarregar } = useLinhaDoTempo();

  const hoje = hojeLocal();

  const [mes, setMes] = useState(() => primeiroDiaDoMes(hoje));
  const [selecionado, setSelecionado] = useState(hoje);

  const consulta = useMemo(
    () => dados ? criarConsultaLinhaDoTempo(dados, hoje) : null,
    [dados, hoje]
  );

  const grade = useMemo(() => montarGrade(mes), [mes]);

  function navegar(quantidade: number) {
    const novoMes = deslocarMes(mes, quantidade);

    setMes(novoMes);
    setSelecionado(novoMes);
  }

  function selecionar(data: string) {
    setSelecionado(data);

    if (data <= hojeLocal()) {
      abrirDia(data);
    }
  }

  const detalhes = consulta?.consultarDia(selecionado);
  const numeroMes = Number(mes.slice(5, 7)) - 1;

  return (
    <SafeAreaView edges={['top']} style={s.pagina}>
      <ScrollView contentContainerStyle={s.conteudo}>
        <Text style={s.titulo}>Calendário</Text>

        {carregando ? (
          <ActivityIndicator color="#8563A6" />
        ) : erro ? (
          <View style={{ gap: 12 }}>
            <Text>Não foi possível carregar o calendário.</Text>
            <Button title="Tentar novamente" onPress={recarregar} />
          </View>
        ) : consulta ? (
          <>
            <View style={s.calendario}>
              <View style={s.cabecalhoMes}>
                <Pressable
                  onPress={() => navegar(-1)}
                  accessibilityLabel="Mês anterior"
                  hitSlop={12}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color="#8563A6"
                  />
                </Pressable>

                <Text style={s.mes}>
                  {MESES[numeroMes]} {mes.slice(0, 4)}
                </Text>

                <Pressable
                  onPress={() => navegar(1)}
                  accessibilityLabel="Próximo mês"
                  hitSlop={12}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="#8563A6"
                  />
                </Pressable>
              </View>

              <View style={s.grade}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(
                  (nome, indice) => (
                    <View key={`semana-${indice}`} style={s.semana}>
                      <Text style={s.textoSemana}>{nome}</Text>
                    </View>
                  )
                )}

                {grade.map((data, indice) => {
                  if (!data) {
                    return (
                      <View key={`vazio-${indice}`} style={s.celula} />
                    );
                  }

                  const dia = consulta.consultarDia(data);
                  const ativo = data === selecionado;

                  return (
                    <Pressable
                      key={data}
                      onPress={() => selecionar(data)}
                      style={s.celula}
                      accessibilityRole="button"
                      accessibilityLabel={
                        `${formatarData(data)}. ` +
                        dia.agenda.join('. ')
                      }
                      accessibilityState={{ selected: ativo }}
                    >
                      <View
                        style={[
                          s.conteudoDia,
                          ativo && s.diaSelecionado,
                          data === hoje && !ativo && s.hoje,
                        ]}
                      >
                        <Text
                          style={[
                            s.numeroDia,
                            ativo && { color: '#FFFFFF' },
                          ]}
                        >
                          {Number(data.slice(8, 10))}
                        </Text>

                        <View style={s.marcadores}>
                          {dia.marcadores.map((tipo) => (
                            <MarcadorVisual
                              key={tipo}
                              tipo={tipo}
                              selecionado={ativo}
                            />
                          ))}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={s.legendas}>
              {(Object.keys(LEGENDAS) as Marcador[]).map((tipo) => (
                <View key={tipo} style={s.legenda}>
                  <MarcadorVisual tipo={tipo} grande />
                  <Text style={s.textoLegenda}>
                    {LEGENDAS[tipo].texto}
                  </Text>
                </View>
              ))}
            </View>

            <View style={s.detalhes}>
              <Text style={s.dataDetalhe}>
                {formatarData(selecionado)}
              </Text>

              <Text style={s.subtitulo}>PREVISÕES</Text>

              {detalhes?.agenda.map((texto, indice) => (
                <Text key={`agenda-${indice}`} style={s.linhaTexto}>
                  • {texto}
                </Text>
              ))}

              {!!detalhes?.acontecimentos.length && (
                <>
                  <Text style={s.subtitulo}>REGISTROS REALIZADOS</Text>

                  {detalhes.acontecimentos.map((linha, indice) => (
                    <Text
                      key={`registro-${indice}`}
                      style={s.linhaTexto}
                    >
                      • {linha.texto}
                    </Text>
                  ))}
                </>
              )}

              {!detalhes?.futura && (
                <Pressable
                  onPress={() => abrirDia(selecionado)}
                  style={{ marginTop: 16 }}
                >
                  <Text style={{ color: '#8563A6' }}>
                    Abrir registro deste dia
                  </Text>
                </Pressable>
              )}

              {detalhes?.futura && (
                <Text style={s.aviso}>
                  Datas futuras permitem apenas consulta.
                </Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#FAF7FC' },
  conteudo: { padding: 22, paddingBottom: 32 },
  titulo: {
    fontSize: 26,
    fontWeight: '600',
    color: '#182235',
    marginBottom: 24,
  },
  calendario: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 24,
    padding: 14,
  },
  cabecalhoMes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    marginBottom: 12,
  },
  mes: { fontSize: 16, fontWeight: '600', color: '#182235' },
  grade: { flexDirection: 'row', flexWrap: 'wrap' },
  semana: {
    width: '14.285714%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  textoSemana: { fontSize: 11, color: '#80768B' },
  celula: {
    width: '14.285714%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudoDia: {
    width: '96%',
    minHeight: 39,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  diaSelecionado: { backgroundColor: '#8563A6' },
  hoje: { borderColor: '#CBB8DD' },
  numeroDia: { fontSize: 13, color: '#182235' },
  marcadores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    marginTop: 3,
    minHeight: 7,
  },
  legendas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 20,
  },
  legenda: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  textoLegenda: { fontSize: 11, color: '#80768B' },
  detalhes: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 22,
    padding: 18,
  },
  dataDetalhe: { color: '#8563A6', marginBottom: 10 },
  subtitulo: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#80768B',
    marginTop: 12,
    marginBottom: 8,
  },
  linhaTexto: {
    color: '#182235',
    lineHeight: 22,
    marginBottom: 5,
  },
  aviso: { marginTop: 14, color: '#80768B', fontSize: 12 },
});
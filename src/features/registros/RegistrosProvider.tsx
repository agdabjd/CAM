import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  carregarDia,
  carregarPeriodo,
  diarioVazio,
  horarioAgora,
  salvarDia,
  salvarPeriodo,
  type Diario,
} from '../../database/registrosRepository';

import {
  buscarConfiguracaoDaData,
  type ConfiguracaoSalva,
} from '../../database/acompanhamentoRepository';

import { hojeLocal, validarData } from '../../domain/datas';
import { formatarData } from '../../domain/onboarding';
import { calcularDia } from '../../domain/contraceptivo/regime';
import { configuracaoParaRegime } from '../../domain/contraceptivo/configuracaoParaRegime';

import {
  CampoTextoVisivel,
  RolagemFormulario,
} from '../../components/FormularioComTeclado';

type ContextoRegistros = {
  versao: number;
  atualizar: () => void;
  abrirDia: (data?: string) => void;
  abrirPeriodo: (id?: number, finalizar?: boolean) => void;
};

type ModalAberto =
  | { tipo: 'dia'; data: string }
  | {
      tipo: 'periodo';
      id?: number;
      finalizar?: boolean;
    }
  | null;

const Contexto = createContext<ContextoRegistros | undefined>(
  undefined
);

function paraISO(texto: string) {
  const resultado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(
    texto.trim()
  );

  if (!resultado) {
    throw new Error('Informe a data no formato dd/mm/aaaa.');
  }

  const [, dia, mes, ano] = resultado;
  const data = `${ano}-${mes}-${dia}`;

  validarData(data);

  return data;
}

function avisar(erro: unknown) {
  Alert.alert(
    'Confira o registro',
    erro instanceof Error ? erro.message : 'Tente novamente.'
  );
}

function Campo({
  rotulo,
  ...props
}: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <CampoTextoVisivel
        {...props}
        style={[
          s.input,
          props.multiline && s.observacoes,
          props.style,
        ]}
        placeholderTextColor="#938A9D"
      />
    </View>
  );
}

function Opcoes({
  valores,
  selecionados,
  onPress,
}: {
  valores: string[];
  selecionados: string[];
  onPress: (valor: string) => void;
}) {
  return (
    <View style={s.opcoes}>
      {valores.map((valor) => (
        <Pressable
          key={valor}
          onPress={() => onPress(valor)}
          style={[
            s.chip,
            selecionados.includes(valor) && s.chipSelecionado,
          ]}
        >
          <Text style={{ color: '#182235' }}>{valor}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Pagina({
  titulo,
  ocupado,
  fechar,
  salvar,
  children,
}: {
  titulo: string;
  ocupado: boolean;
  fechar: () => void;
  salvar: () => void;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={s.pagina}>
      <View style={s.cabecalho}>
        <Text style={s.titulo}>{titulo}</Text>

        <Pressable onPress={fechar} disabled={ocupado}>
          <Text style={s.link}>Cancelar</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <RolagemFormulario
          contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          pointerEvents={ocupado ? 'none' : 'auto'}
        >
          {children}

          <Pressable
            onPress={salvar}
            disabled={ocupado}
            style={[s.botao, ocupado && { opacity: 0.6 }]}
          >
            {ocupado ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={s.textoBotao}>Salvar registro</Text>
            )}
          </Pressable>
        </RolagemFormulario>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormularioDia({
  data,
  fechar,
  salvo,
}: {
  data: string;
  fechar: () => void;
  salvo: () => void;
}) {
  const [form, setForm] = useState<Diario>(() => diarioVazio(data));
  const [configuracao, setConfiguracao] =
    useState<ConfiguracaoSalva | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;

    carregarDia(data)
      .then((registro) => {
        if (!ativo) return;

        setForm({
          ...registro,
          data: formatarData(registro.data),
          acoes: registro.acoes.map((acao) => ({
            ...acao,
            data_prevista: acao.data_prevista
              ? formatarData(acao.data_prevista)
              : null,
          })),
        });
      })
      .catch(() => {
        if (ativo) setErroCarga(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [data]);

  useEffect(() => {
    let ativo = true;
    let dataISO: string;

    try {
      dataISO = paraISO(form.data);
    } catch {
      setConfiguracao(null);
      return;
    }

    buscarConfiguracaoDaData(dataISO)
      .then((valor) => {
        if (ativo) setConfiguracao(valor);
      })
      .catch(() => {
        if (ativo) setConfiguracao(null);
      });

    return () => {
      ativo = false;
    };
  }, [form.data]);

  function alterar<K extends keyof Diario>(
    campo: K,
    valor: Diario[K]
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function adicionarAcao() {
    if (
      !configuracao ||
      configuracao.modo !== 'anticoncepcional'
    ) {
      return;
    }

    try {
      const dataISO = paraISO(form.data);

      const prevista =
        calcularDia(
          configuracaoParaRegime(configuracao),
          dataISO
        ).situacao === 'acao_prevista';

      alterar('acoes', [
        ...form.acoes,
        {
          configuracao_id: configuracao.id,
          titulo: configuracao.acao ?? 'Ação',
          horario_real: horarioAgora(),
          data_prevista: prevista ? form.data : null,
        },
      ]);
    } catch (erro) {
      avisar(erro);
    }
  }

  async function enviar() {
    if (ocupado) return;
    setOcupado(true);

    try {
      await salvarDia({
        ...form,
        data: paraISO(form.data),
        acoes: form.acoes.map((acao) => ({
          ...acao,
          data_prevista: acao.data_prevista?.trim()
            ? paraISO(acao.data_prevista)
            : null,
        })),
      });

      salvo();
    } catch (erro) {
      avisar(erro);
    } finally {
      setOcupado(false);
    }
  }

  if (carregando || erroCarga) {
    return (
      <SafeAreaView style={s.centralizado}>
        {erroCarga ? (
          <>
            <Text>Não foi possível carregar o registro.</Text>
            <Pressable onPress={fechar}>
              <Text style={s.link}>Fechar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color="#8563A6" />
        )}
      </SafeAreaView>
    );
  }

  const sintomas = [
    'Cólica',
    'Inchaço',
    'Dor de cabeça',
    'Náusea',
    'Sensibilidade',
    'Fadiga',
    'Irritabilidade',
    'Ansiedade',
  ];

  const fluxos = {
    Nenhum: 'nenhum',
    Manchas: 'manchas',
    Leve: 'leve',
    Moderado: 'moderado',
    Intenso: 'intenso',
  };

  const tipos = {
    Menstruação: 'menstruacao',
    'Outro sangramento': 'outro',
    'Não informado': 'nao_informado',
  };

  return (
    <Pagina
      titulo={form.id ? 'Editar registro' : 'Novo registro'}
      ocupado={ocupado}
      fechar={fechar}
      salvar={enviar}
    >
      <Campo
        rotulo="Data do acontecimento"
        value={form.data}
        onChangeText={(v) => alterar('data', v)}
        placeholder="dd/mm/aaaa"
        maxLength={10}
      />

      <Campo
        rotulo="Horário do registro"
        value={form.horario}
        onChangeText={(v) => alterar('horario', v)}
        placeholder="HH:mm"
        maxLength={5}
      />

      {(
        configuracao?.modo === 'anticoncepcional' ||
        form.acoes.length > 0
      ) && (
        <>
          <Text style={s.secao}>ANTICONCEPCIONAL</Text>

          {form.acoes.map((acao, indice) => (
            <View key={indice} style={s.cartao}>
              <Text style={{ marginBottom: 12 }}>
                {acao.titulo ?? 'Ação realizada'}
              </Text>

              <Campo
                rotulo="Horário real da ação"
                value={acao.horario_real}
                maxLength={5}
                onChangeText={(valor) => {
                  alterar(
                    'acoes',
                    form.acoes.map((item, i) =>
                      i === indice
                        ? { ...item, horario_real: valor }
                        : item
                    )
                  );
                }}
              />

              <Campo
                rotulo="Data prevista correspondente — opcional"
                value={acao.data_prevista ?? ''}
                placeholder="dd/mm/aaaa"
                maxLength={10}
                onChangeText={(valor) => {
                  alterar(
                    'acoes',
                    form.acoes.map((item, i) =>
                      i === indice
                        ? { ...item, data_prevista: valor || null }
                        : item
                    )
                  );
                }}
              />

              <Pressable
                onPress={() =>
                  alterar(
                    'acoes',
                    form.acoes.filter((_, i) => i !== indice)
                  )
                }
              >
                <Text style={s.link}>Remover esta ação</Text>
              </Pressable>
            </View>
          ))}

          {configuracao?.modo === 'anticoncepcional' && (
            <Pressable style={s.cartao} onPress={adicionarAcao}>
              <Text style={s.link}>
                + {configuracao.acao ?? 'Registrar ação'}
              </Text>
            </Pressable>
          )}

          <Text style={s.ajuda}>
            A data do registro é a data real. A data prevista
            apenas identifica qual ação da agenda foi realizada.
          </Text>
        </>
      )}

      <Text style={s.secao}>SANGRAMENTO</Text>

      <Opcoes
        valores={Object.keys(fluxos)}
        selecionados={Object.entries(fluxos)
          .filter(([, valor]) => valor === form.sangramento_fluxo)
          .map(([rotulo]) => rotulo)}
        onPress={(rotulo) => {
          const fluxo = fluxos[rotulo as keyof typeof fluxos];

          setForm((anterior) => ({
            ...anterior,
            sangramento_fluxo: fluxo,
            sangramento_tipo:
              fluxo === 'nenhum'
                ? 'nao_informado'
                : anterior.sangramento_tipo,
          }));
        }}
      />

      {form.sangramento_fluxo !== 'nenhum' && (
        <>
          <Text style={s.rotulo}>Como deseja classificar?</Text>

          <Opcoes
            valores={Object.keys(tipos)}
            selecionados={Object.entries(tipos)
              .filter(([, valor]) => valor === form.sangramento_tipo)
              .map(([rotulo]) => rotulo)}
            onPress={(rotulo) =>
              alterar(
                'sangramento_tipo',
                tipos[rotulo as keyof typeof tipos]
              )
            }
          />
        </>
      )}

      <Text style={s.secao}>HUMOR</Text>

      <Opcoes
        valores={[
          '😊 Bem',
          '😁 Animada',
          '😔 Triste',
          '🥰 Carinhosa',
          '😴 Cansada',
          '😣 Irritada',
        ]}
        selecionados={form.humor ? [form.humor] : []}
        onPress={(valor) =>
          alterar('humor', form.humor === valor ? null : valor)
        }
      />

      <Text style={s.secao}>SINTOMAS</Text>

      <Opcoes
        valores={sintomas}
        selecionados={form.sintomas}
        onPress={(valor) =>
          alterar(
            'sintomas',
            form.sintomas.includes(valor)
              ? form.sintomas.filter((item) => item !== valor)
              : [...form.sintomas, valor]
          )
        }
      />

      <Text style={s.secao}>OBSERVAÇÕES</Text>

      <Campo
        rotulo="Como você está se sentindo?"
        value={form.observacoes}
        onChangeText={(v) => alterar('observacoes', v)}
        placeholder="Como você está se sentindo hoje?"
        multiline
        textAlignVertical="top"
      />
    </Pagina>
  );
}

function FormularioPeriodo({
  id,
  finalizar = false,
  fechar,
  salvo,
}: {
  id?: number;
  finalizar?: boolean;
  fechar: () => void;
  salvo: () => void;
}) {
  const [inicio, setInicio] = useState(formatarData(hojeLocal()));
  const [fim, setFim] = useState('');
  const [horaInicio, setHoraInicio] = useState(horarioAgora());
  const [horaFim, setHoraFim] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [carregando, setCarregando] = useState(id !== undefined);
  const [erroCarga, setErroCarga] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (id === undefined) return;

    let ativo = true;

    carregarPeriodo(id)
      .then((periodo) => {
        if (!ativo) return;

        if (!periodo) {
          throw new Error('Menstruação não encontrada.');
        }

        setInicio(formatarData(periodo.data_inicio));
        setFim(
          periodo.data_fim
            ? formatarData(periodo.data_fim)
            : finalizar
              ? formatarData(hojeLocal())
              : ''
        );

        setHoraInicio(periodo.horario_inicio ?? '');

        setHoraFim(
          periodo.horario_fim ??
            (finalizar ? horarioAgora() : '')
        );
        setObservacoes(periodo.observacoes);
      })
      .catch(() => {
        if (ativo) setErroCarga(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [id, finalizar]);

  async function enviar() {
    if (ocupado) return;
    setOcupado(true);

    try {

      if (finalizar && !fim.trim()) {
        throw new Error('Informe a data de fim da menstruação.');
      }

      await salvarPeriodo({
        id,
        data_inicio: paraISO(inicio),
        data_fim: fim.trim() ? paraISO(fim) : null,
        horario_inicio: horaInicio.trim() || null,
        horario_fim: horaFim.trim() || null,
        observacoes,
      });

      salvo();
    } catch (erro) {
      avisar(erro);
    } finally {
      setOcupado(false);
    }
  }

  if (carregando || erroCarga) {
    return (
      <SafeAreaView style={s.centralizado}>
        {erroCarga ? (
          <>
            <Text>Não foi possível carregar a menstruação.</Text>
            <Pressable onPress={fechar}>
              <Text style={s.link}>Fechar</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color="#8563A6" />
        )}
      </SafeAreaView>
    );
  }

  return (
    <Pagina
      titulo={
        finalizar
          ? 'Registrar fim da menstruação'
          : id
            ? 'Editar menstruação'
            : 'Registrar menstruação'
      }
      ocupado={ocupado}
      fechar={fechar}
      salvar={enviar}
    >
      <Text style={s.ajuda}>
        Informe o início e, quando souber, o fim.
        Os detalhes de fluxo podem ser registrados em cada dia.
      </Text>

      <Campo
        rotulo="Data de início"
        value={inicio}
        onChangeText={setInicio}
        placeholder="dd/mm/aaaa"
        maxLength={10}
      />

      <Campo
        rotulo="Horário de início — opcional"
        value={horaInicio}
        onChangeText={setHoraInicio}
        placeholder="HH:mm"
        maxLength={5}
      />

      <Campo
        rotulo="Data de fim — deixe vazia se ainda não terminou"
        value={fim}
        onChangeText={setFim}
        placeholder="dd/mm/aaaa"
        maxLength={10}
      />

      <Campo
        rotulo="Horário de fim — opcional"
        value={horaFim}
        onChangeText={setHoraFim}
        placeholder="HH:mm"
        maxLength={5}
      />

      <Campo
        rotulo="Observações"
        value={observacoes}
        onChangeText={setObservacoes}
        multiline
        textAlignVertical="top"
      />
    </Pagina>
  );
}

export function RegistrosProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [modal, setModal] = useState<ModalAberto>(null);
  const [versao, setVersao] = useState(0);

  function atualizar() {
    setVersao((valor) => valor + 1);
  }

  function salvo() {
    atualizar();
    setModal(null);
  }

  return (
    <Contexto.Provider
      value={{
        versao,
        atualizar,
        abrirDia: (data = hojeLocal()) =>
          setModal({ tipo: 'dia', data }),
        abrirPeriodo: (id, finalizar = false) =>
          setModal({
            tipo: 'periodo',
            id,
            finalizar,
          }),
      }}
    >
      {children}

      <Modal
        visible={modal !== null}
        animationType="slide"
        onRequestClose={() => setModal(null)}
      >
        <SafeAreaProvider>
          {modal?.tipo === 'dia' && (
            <FormularioDia
              key={`dia-${modal.data}`}
              data={modal.data}
              fechar={() => setModal(null)}
              salvo={salvo}
            />
          )}

          {modal?.tipo === 'periodo' && (
            <FormularioPeriodo
              key={
                `periodo-${modal.id ?? 'novo'}-` +
                `${modal.finalizar ? 'fim' : 'editar'}`
              }
              id={modal.id}
              finalizar={modal.finalizar}
              fechar={() => setModal(null)}
              salvo={salvo}
            />
          )}
        </SafeAreaProvider>
      </Modal>
    </Contexto.Provider>
  );
}

export function useRegistros() {
  const contexto = useContext(Contexto);

  if (!contexto) {
    throw new Error(
      'useRegistros deve ser usado dentro de RegistrosProvider.'
    );
  }

  return contexto;
}

const s = StyleSheet.create({
  pagina: {
    flex: 1,
    backgroundColor: '#FAF7FC',
  },
  centralizado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#FAF7FC',
  },
  cabecalho: {
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE8F3',
  },
  titulo: {
    fontSize: 20,
    fontWeight: '600',
    color: '#182235',
  },
  link: {
    color: '#8563A6',
    fontSize: 15,
  },
  secao: {
    color: '#71677E',
    fontSize: 12,
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 12,
  },
  rotulo: {
    color: '#71677E',
    marginBottom: 8,
  },
  input: {
    minHeight: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    paddingHorizontal: 14,
    color: '#182235',
  },
  observacoes: {
    minHeight: 100,
    paddingTop: 14,
  },
  opcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    backgroundColor: '#FFFFFF',
  },
  chipSelecionado: {
    backgroundColor: '#E9DFF2',
    borderColor: '#8563A6',
  },
  cartao: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    marginBottom: 12,
  },
  ajuda: {
    color: '#71677E',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  botao: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8563A6',
    borderRadius: 14,
    marginTop: 20,
  },
  textoBotao: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
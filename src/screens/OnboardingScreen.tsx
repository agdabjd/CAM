import { useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import ResumoConfiguracao from '../components/ResumoConfiguracao';

import {
  carregarRascunho,
  finalizarOnboarding,
  salvarRascunho,
} from '../database/onboardingRepository';

import type {
  ConfiguracaoSalva,
  NovaConfiguracao,
} from '../database/acompanhamentoRepository';

import { salvarAlteracaoConfiguracao } from '../database/configuracaoPerfilRepository';

import {
  FORM_INICIAL,
  formatarData,
  lerData,
  montarConfiguracao,
  validarConfiguracao,
  validarMetodo,
  type Formulario,
} from '../domain/onboarding';

import { hojeLocal, somarDias } from '../domain/datas';

import { formularioDaConfiguracao } from '../domain/formularioConfiguracao';

import {
  CampoTextoVisivel,
  RolagemFormulario,
} from '../components/FormularioComTeclado';

const ETAPAS = [
  'modo',
  'metodo',
  'regime',
  'menstrual',
  'resumo',
] as const;

type Etapa = (typeof ETAPAS)[number];

type Props = {
  onConcluido: () => void;
  configuracaoEdicao?: ConfiguracaoSalva;
  onCancelar?: () => void;
};

const METODOS = [
  { nome: 'Pílula', acao: 'Tomar dose' },
  { nome: 'Injeção', acao: 'Aplicar dose' },
  { nome: 'Adesivo', acao: 'Trocar adesivo' },
  { nome: 'Anel vaginal', acao: 'Trocar anel' },
  { nome: 'Outro', acao: '' },
];

function Campo({
  rotulo,
  ...props
}: TextInputProps & { rotulo: string }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.rotulo}>{rotulo}</Text>

      <CampoTextoVisivel
        {...props}
        style={[styles.input, props.style]}
        placeholderTextColor="#938A9D"
      />
    </View>
  );
}

function Opcao({
  texto,
  selecionada,
  onPress,
}: {
  texto: string;
  selecionada: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: selecionada }}
      style={[
        styles.opcao,
        selecionada && styles.opcaoSelecionada,
      ]}
    >
      <Text style={styles.textoOpcao}>{texto}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen({
  onConcluido,
  configuracaoEdicao,
  onCancelar,
}: Props) {
  const [form, setForm] = useState<Formulario>({
    ...FORM_INICIAL,
    dataReferencia: formatarData(hojeLocal()),
  });

  const [vigenciaEdicao, setVigenciaEdicao] = useState(
    formatarData(somarDias(hojeLocal(), 1))
  );

  const [etapa, setEtapa] = useState<Etapa>('modo');

  const [revisao, setRevisao] =
    useState<NovaConfiguracao | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const emExecucao = useRef(false);

  const editando = configuracaoEdicao !== undefined;

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErroCarga(false);
      setRevisao(null);
      setEtapa('modo');

      try {
        const hoje = hojeLocal();

        if (configuracaoEdicao) {
          const formulario = formularioDaConfiguracao(
            configuracaoEdicao
          );

          const inicioAlteracao =
            configuracaoEdicao.vigente_desde > hoje
              ? configuracaoEdicao.vigente_desde
              : somarDias(hoje, 1);

          if (!ativo) return;

          setForm(formulario);
          setVigenciaEdicao(formatarData(inicioAlteracao));

          return;
        }

        const formularioInicial: Formulario = {
          ...FORM_INICIAL,
          dataReferencia: formatarData(hoje),
        };

        const rascunho = await carregarRascunho();

        if (!ativo) return;

        if (!rascunho) {
          setForm(formularioInicial);
          return;
        }

        const recuperado: Formulario = {
          ...formularioInicial,
          ...rascunho.campos,
        };

        let etapaRecuperada: Etapa =
          ETAPAS.find((item) => item === rascunho.etapa) ??
          'modo';

        let resumo: NovaConfiguracao | null = null;

        if (etapaRecuperada === 'resumo') {
          try {
            resumo = montarConfiguracao(recuperado);
          } catch {
            etapaRecuperada = 'modo';
          }
        }

        setForm(recuperado);
        setEtapa(etapaRecuperada);
        setRevisao(resumo);
      } catch {
        if (ativo) {
          setErroCarga(true);
        }
      } finally {
        if (ativo) {
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [configuracaoEdicao]);

  function alterar(campo: keyof Formulario, valor: string) {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function obterVigenciaEdicao() {
    const vigenteDesde = lerData(vigenciaEdicao);

    if (vigenteDesde <= hojeLocal()) {
      throw new Error(
        'A alteração deve começar amanhã ou em uma data posterior.'
      );
    }

    return vigenteDesde;
  }

  function obterDados(): NovaConfiguracao {
    const dados = montarConfiguracao(form);

    if (!editando) {
      return dados;
    }

    const alteracao: NovaConfiguracao = {
      ...dados,
      vigenteDesde: obterVigenciaEdicao(),
    };

    validarConfiguracao(alteracao);

    return alteracao;
  }

  async function irPara(proxima: Etapa) {
    const resumo =
      proxima === 'resumo' ? obterDados() : null;

    // A edição pelo Perfil não modifica o rascunho
    // utilizado no primeiro acesso.
    if (!editando) {
      await salvarRascunho(proxima, form);
    }

    setRevisao(resumo);
    setEtapa(proxima);
  }

  async function executar(acao: () => Promise<void>) {
    if (emExecucao.current) return;

    emExecucao.current = true;
    setOcupado(true);

    try {
      await acao();
    } catch (erro) {
      Alert.alert(
        'Confira as informações',
        erro instanceof Error ? erro.message : 'Tente novamente.'
      );
    } finally {
      emExecucao.current = false;
      setOcupado(false);
    }
  }

  async function avancar() {
    await executar(async () => {
      if (etapa === 'modo') {
        if (
          form.modo !== 'anticoncepcional' &&
          form.modo !== 'menstrual'
        ) {
          throw new Error('Escolha o acompanhamento.');
        }

        if (editando) {
          obterVigenciaEdicao();
        }

        await irPara(
          form.modo === 'anticoncepcional'
            ? 'metodo'
            : 'menstrual'
        );

        return;
      }

      if (etapa === 'metodo') {
        validarMetodo(form);
        await irPara('regime');
        return;
      }

      if (etapa === 'regime' || etapa === 'menstrual') {
        await irPara('resumo');
        return;
      }

      const dados = obterDados();

      if (editando) {
        await salvarAlteracaoConfiguracao(dados);
      } else {
        await finalizarOnboarding(dados);
      }

      onConcluido();
    });
  }

  async function voltar() {
    await executar(async () => {
      const anterior: Etapa =
        etapa === 'resumo'
          ? form.modo === 'anticoncepcional'
            ? 'regime'
            : 'menstrual'
          : etapa === 'regime'
            ? 'metodo'
            : 'modo';

      await irPara(anterior);
    });
  }

  if (carregando || erroCarga) {
    return (
      <SafeAreaView style={styles.centralizado}>
        {erroCarga ? (
          <>
            <Text style={styles.mensagemErro}>
              Não foi possível carregar a configuração.
              Feche e abra esta tela para tentar novamente.
            </Text>

            {onCancelar && (
              <Pressable
                onPress={onCancelar}
                style={{ marginTop: 20 }}
              >
                <Text style={styles.link}>Fechar</Text>
              </Pressable>
            )}
          </>
        ) : (
          <ActivityIndicator size="large" color="#8563A6" />
        )}
      </SafeAreaView>
    );
  }

  const titulos: Record<Etapa, string> = {
    modo: editando
      ? 'Alterar acompanhamento'
      : 'Como você quer acompanhar?',
    metodo: 'Seu anticoncepcional',
    regime: 'Frequência e pausas',
    menstrual: 'Seu acompanhamento menstrual',
    resumo: 'Confira sua configuração',
  };

  const unidade =
    form.metodo === 'Pílula' || form.metodo === 'Injeção'
      ? 'doses'
      : form.metodo === 'Adesivo' ||
          form.metodo === 'Anel vaginal'
        ? 'trocas'
        : 'ações';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <RolagemFormulario
          contentContainerStyle={[
            styles.conteudo,
            styles.conteudoCentralizado,
          ]}
          keyboardShouldPersistTaps="handled"
          pointerEvents={ocupado ? 'none' : 'auto'}
        >
          <Text style={styles.titulo}>{titulos[etapa]}</Text>

          {onCancelar && (
            <Pressable
              onPress={onCancelar}
              disabled={ocupado}
              style={styles.cancelar}
            >
              <Text style={styles.link}>
                Cancelar alteração
              </Text>
            </Pressable>
          )}

          {etapa === 'modo' && (
            <>
              <Text style={styles.ajuda}>
                {editando
                  ? 'Escolha o acompanhamento e a data em que a nova configuração começará.'
                  : 'Escolha como deseja acompanhar sua rotina. Você poderá alterar essa configuração pelo Perfil.'}
              </Text>

              {editando && (
                <Campo
                  rotulo="A alteração começará em"
                  value={vigenciaEdicao}
                  onChangeText={setVigenciaEdicao}
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  editable={!ocupado}
                />
              )}

              <Opcao
                texto="Uso anticoncepcional"
                selecionada={form.modo === 'anticoncepcional'}
                onPress={() =>
                  alterar('modo', 'anticoncepcional')
                }
              />

              <Opcao
                texto="Acompanhamento menstrual"
                selecionada={form.modo === 'menstrual'}
                onPress={() => alterar('modo', 'menstrual')}
              />
            </>
          )}

          {etapa === 'metodo' && (
            <>
              <Text style={styles.rotulo}>Método</Text>

              {METODOS.map((metodo) => (
                <Opcao
                  key={metodo.nome}
                  texto={metodo.nome}
                  selecionada={form.metodo === metodo.nome}
                  onPress={() => {
                    setForm((anterior) => ({
                      ...anterior,
                      metodo: metodo.nome,
                      acao: metodo.acao,
                    }));
                  }}
                />
              ))}

              {form.metodo === 'Outro' && (
                <Campo
                  rotulo="Nome do método"
                  value={form.outroMetodo}
                  onChangeText={(valor) =>
                    alterar('outroMetodo', valor)
                  }
                  editable={!ocupado}
                />
              )}

              <Campo
                rotulo="Ação que deseja acompanhar"
                value={form.acao}
                onChangeText={(valor) => alterar('acao', valor)}
                placeholder="Ex.: trocar adesivo"
                editable={!ocupado}
              />

              <Campo
                rotulo="Primeiro dia do período de uso"
                value={form.dataReferencia}
                onChangeText={(valor) =>
                  alterar('dataReferencia', valor)
                }
                placeholder="dd/mm/aaaa"
                maxLength={10}
                editable={!ocupado}
              />

              <Text style={styles.ajuda}>
                Essa data será a referência para os cálculos.
                Pode ser anterior à instalação ou à data em que
                a alteração começará a valer.
              </Text>

              <Campo
                rotulo="Horário da ação"
                value={form.horario}
                onChangeText={(valor) =>
                  alterar('horario', valor)
                }
                placeholder="08:00"
                maxLength={5}
                editable={!ocupado}
              />
            </>
          )}

          {etapa === 'regime' && (
            <>
              <Campo
                rotulo="Realizar a ação a cada quantos dias?"
                value={form.intervaloDias}
                onChangeText={(valor) =>
                  alterar('intervaloDias', valor)
                }
                keyboardType="number-pad"
                placeholder="Informe a quantidade de dias"
                editable={!ocupado}
              />

              <Opcao
                texto="Uso contínuo, sem pausa"
                selecionada={form.pausaTipo === 'nenhuma'}
                onPress={() =>
                  alterar('pausaTipo', 'nenhuma')
                }
              />

              <Opcao
                texto="Pausa após uma quantidade de dias de uso"
                selecionada={form.pausaTipo === 'dias'}
                onPress={() => alterar('pausaTipo', 'dias')}
              />

              <Opcao
                texto={`Pausa após uma quantidade de ${unidade}`}
                selecionada={form.pausaTipo === 'acoes'}
                onPress={() => alterar('pausaTipo', 'acoes')}
              />

              {form.pausaTipo !== 'nenhuma' && (
                <>
                  <Campo
                    rotulo={
                      form.pausaTipo === 'dias'
                        ? 'Pausar após quantos dias de uso?'
                        : `Pausar após quantas ${unidade} previstas?`
                    }
                    value={form.pausaApos}
                    onChangeText={(valor) =>
                      alterar('pausaApos', valor)
                    }
                    keyboardType="number-pad"
                    editable={!ocupado}
                  />

                  <Campo
                    rotulo="Quantos dias dura a pausa?"
                    value={form.pausaDuracao}
                    onChangeText={(valor) =>
                      alterar('pausaDuracao', valor)
                    }
                    keyboardType="number-pad"
                    editable={!ocupado}
                  />

                  {form.pausaTipo === 'acoes' && (
                    <Text style={styles.ajuda}>
                      A pausa começa após terminar o intervalo
                      completo da última ação prevista.
                    </Text>
                  )}
                </>
              )}
            </>
          )}

          {etapa === 'menstrual' && (
            <>
              <Campo
                rotulo="Primeiro dia da última menstruação"
                value={form.dataReferencia}
                onChangeText={(valor) =>
                  alterar('dataReferencia', valor)
                }
                placeholder="dd/mm/aaaa"
                maxLength={10}
                editable={!ocupado}
              />

              <Campo
                rotulo="Duração habitual do ciclo, em dias"
                value={form.duracaoCiclo}
                onChangeText={(valor) =>
                  alterar('duracaoCiclo', valor)
                }
                keyboardType="number-pad"
                editable={!ocupado}
              />

              <Campo
                rotulo="Duração habitual da menstruação, em dias"
                value={form.duracaoMenstruacao}
                onChangeText={(valor) =>
                  alterar('duracaoMenstruacao', valor)
                }
                keyboardType="number-pad"
                editable={!ocupado}
              />

              <Text style={styles.ajuda}>
                O ciclo é contado entre o início de uma
                menstruação e o início da próxima.
                As datas calculadas serão estimativas.
              </Text>
            </>
          )}

          {etapa === 'resumo' && revisao && (
            <View style={styles.cartao}>
              {editando && (
                <>
                  <Text style={styles.vigenciaResumo}>
                    Válida a partir de{' '}
                    {formatarData(revisao.vigenteDesde)}
                  </Text>

                  <Text style={styles.ajuda}>
                    Os registros anteriores serão preservados.
                    Alterações já programadas a partir dessa
                    data serão substituídas.
                  </Text>
                </>
              )}

              <ResumoConfiguracao
                dados={revisao}
                aPartirDe={
                  revisao.vigenteDesde > hojeLocal()
                    ? revisao.vigenteDesde
                    : hojeLocal()
                }
              />
            </View>
          )}

          <View style={styles.botoes}>
            {etapa !== 'modo' && (
              <Pressable
                onPress={voltar}
                disabled={ocupado}
                style={styles.botaoSecundario}
              >
                <Text style={styles.textoSecundario}>
                  Voltar
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={avancar}
              disabled={ocupado}
              style={[
                styles.botao,
                ocupado && { opacity: 0.6 },
              ]}
            >
              {ocupado ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.textoBotao}>
                  {etapa === 'resumo'
                    ? editando
                      ? 'Salvar alteração'
                      : 'Confirmar e começar'
                    : 'Continuar'}
                </Text>
              )}
            </Pressable>
          </View>
        </RolagemFormulario>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF7FC',
  },
  centralizado: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FAF7FC',
  },
  conteudo: {
    padding: 24,
    paddingBottom: 40,
  },
  conteudoCentralizado: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  titulo: {
    fontSize: 24,
    fontWeight: '600',
    color: '#182235',
    marginBottom: 24,
  },
  cancelar: {
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  link: {
    color: '#8563A6',
    fontSize: 14,
  },
  campo: {
    marginTop: 12,
    marginBottom: 12,
  },
  rotulo: {
    color: '#71677E',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    color: '#182235',
  },
  ajuda: {
    color: '#71677E',
    lineHeight: 22,
    marginBottom: 16,
  },
  opcao: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  opcaoSelecionada: {
    backgroundColor: '#E9DFF2',
    borderColor: '#8563A6',
  },
  textoOpcao: {
    color: '#182235',
  },
  cartao: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    backgroundColor: '#FFFFFF',
  },
  vigenciaResumo: {
    fontWeight: '600',
    color: '#182235',
    marginBottom: 12,
  },
  botoes: {
    marginTop: 24,
    gap: 12,
  },
  botao: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#8563A6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoBotao: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  botaoSecundario: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoSecundario: {
    color: '#8563A6',
    fontSize: 16,
  },
  mensagemErro: {
    color: '#71677E',
    textAlign: 'center',
    lineHeight: 22,
  },
});
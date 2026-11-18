import { useEffect, useState } from 'react';

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

import type { NovaConfiguracao } from '../database/acompanhamentoRepository';

import {
  FORM_INICIAL,
  formatarData,
  montarConfiguracao,
  validarMetodo,
  type Formulario,
} from '../domain/onboarding';

import { hojeLocal } from '../domain/datas';

const ETAPAS = [
  'modo',
  'metodo',
  'regime',
  'menstrual',
  'resumo',
] as const;

type Etapa = (typeof ETAPAS)[number];

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

      <TextInput
        {...props}
        style={styles.input}
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
      <Text>{texto}</Text>
    </Pressable>
  );
}

export default function OnboardingScreen({
  onConcluido,
}: {
  onConcluido: () => void;
}) {
  const [form, setForm] = useState<Formulario>({
    ...FORM_INICIAL,
    dataReferencia: formatarData(hojeLocal()),
  });

  const [etapa, setEtapa] = useState<Etapa>('modo');
  const [revisao, setRevisao] = useState<NovaConfiguracao | null>(
    null
  );

  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const rascunho = await carregarRascunho();

        if (!ativo || !rascunho) return;

        const recuperado = {
          ...FORM_INICIAL,
          ...rascunho.campos,
        };

        let etapaRecuperada =
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
        if (ativo) setErroCarga(true);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  function alterar(campo: keyof Formulario, valor: string) {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  async function irPara(proxima: Etapa) {
    const resumo =
      proxima === 'resumo' ? montarConfiguracao(form) : null;

    await salvarRascunho(proxima, form);

    setRevisao(resumo);
    setEtapa(proxima);
  }

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;

    setOcupado(true);

    try {
      await acao();
    } catch (erro) {
      Alert.alert(
        'Confira as informações',
        erro instanceof Error ? erro.message : 'Tente novamente.'
      );
    } finally {
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

        await irPara(
          form.modo === 'anticoncepcional'
            ? 'metodo'
            : 'menstrual'
        );
      } else if (etapa === 'metodo') {
        validarMetodo(form);
        await irPara('regime');
      } else if (etapa === 'regime' || etapa === 'menstrual') {
        await irPara('resumo');
      } else {
        const dados = montarConfiguracao(form);

        await finalizarOnboarding(dados);
        onConcluido();
      }
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
          <Text>
            Não foi possível carregar a configuração.
            Feche e abra o aplicativo para tentar novamente.
          </Text>
        ) : (
          <ActivityIndicator size="large" color="#8563A6" />
        )}
      </SafeAreaView>
    );
  }

  const titulos: Record<Etapa, string> = {
    modo: 'Como você quer acompanhar?',
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.conteudo,
            etapa === 'modo' && styles.conteudoCentralizado,
          ]}
          keyboardShouldPersistTaps="handled"
          pointerEvents={ocupado ? 'none' : 'auto'}
        >
          <Text style={styles.titulo}>{titulos[etapa]}</Text>

          {etapa === 'modo' && (
            <>
              <Text style={styles.ajuda}>
                Você poderá alterar o acompanhamento pelo Perfil
                quando essa função estiver disponível.
              </Text>

              <Opcao
                texto="Uso anticoncepcional"
                selecionada={form.modo === 'anticoncepcional'}
                onPress={() => alterar('modo', 'anticoncepcional')}
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
                  onChangeText={(v) => alterar('outroMetodo', v)}
                />
              )}

              <Campo
                rotulo="Ação que deseja acompanhar"
                value={form.acao}
                onChangeText={(v) => alterar('acao', v)}
                placeholder="Ex.: trocar adesivo"
              />

              <Campo
                rotulo="Primeiro dia do período de uso"
                value={form.dataReferencia}
                onChangeText={(v) => alterar('dataReferencia', v)}
                placeholder="dd/mm/aaaa"
                maxLength={10}
              />

              <Text style={styles.ajuda}>
                Pode ser uma data anterior à instalação.
                Ela será a referência para os cálculos.
              </Text>

              <Campo
                rotulo="Horário da ação"
                value={form.horario}
                onChangeText={(v) => alterar('horario', v)}
                placeholder="08:00"
                maxLength={5}
              />
            </>
          )}

          {etapa === 'regime' && (
            <>
              <Campo
                rotulo="Realizar a ação a cada quantos dias?"
                value={form.intervaloDias}
                onChangeText={(v) => alterar('intervaloDias', v)}
                keyboardType="number-pad"
                placeholder="Informe a quantidade de dias"
              />

              <Opcao
                texto="Uso contínuo, sem pausa"
                selecionada={form.pausaTipo === 'nenhuma'}
                onPress={() => alterar('pausaTipo', 'nenhuma')}
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
                    onChangeText={(v) => alterar('pausaApos', v)}
                    keyboardType="number-pad"
                  />

                  <Campo
                    rotulo="Quantos dias dura a pausa?"
                    value={form.pausaDuracao}
                    onChangeText={(v) => alterar('pausaDuracao', v)}
                    keyboardType="number-pad"
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
                onChangeText={(v) => alterar('dataReferencia', v)}
                placeholder="dd/mm/aaaa"
                maxLength={10}
              />

              <Campo
                rotulo="Duração habitual do ciclo, em dias"
                value={form.duracaoCiclo}
                onChangeText={(v) => alterar('duracaoCiclo', v)}
                keyboardType="number-pad"
              />

              <Campo
                rotulo="Duração habitual da menstruação, em dias"
                value={form.duracaoMenstruacao}
                onChangeText={(v) =>
                  alterar('duracaoMenstruacao', v)
                }
                keyboardType="number-pad"
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
              <ResumoConfiguracao dados={revisao} />
            </View>
          )}

          <View style={styles.botoes}>
            {etapa !== 'modo' && (
              <Pressable
                onPress={voltar}
                disabled={ocupado}
                style={styles.botaoSecundario}
              >
                <Text style={styles.textoSecundario}>Voltar</Text>
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
                    ? 'Confirmar e começar'
                    : 'Continuar'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
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
  titulo: {
    fontSize: 24,
    fontWeight: '600',
    color: '#182235',
    marginBottom: 24,
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
  cartao: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    backgroundColor: '#FFFFFF',
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
  conteudoCentralizado: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});
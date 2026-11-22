import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
  excluirLembrete,
  listarLembretes,
  salvarLembrete,
  type Lembrete,
} from '../../database/lembretesRepository';

import { formatarData } from '../../domain/onboarding';
import { validarData, hojeLocal, } from '../../domain/datas';

import {
  agendarTeste,
  solicitarPermissoes,
  sincronizarNotificacoes,
  type ResultadoSincronizacao,
} from './notificacoesService';

import { buscarConfiguracaoDaData } from '../../database/acompanhamentoRepository';

import { tipoPermitidoNoModo } from '../../domain/planoNotificacoes';

function Campo({
  titulo,
  valor,
  alterar,
}: {
  titulo: string;
  valor: string;
  alterar: (valor: string) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.rotulo}>{titulo}</Text>
      <TextInput
        value={valor}
        onChangeText={alterar}
        style={s.input}
        autoCapitalize="none"
      />
    </View>
  );
}

function lerData(texto: string) {
  const resultado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);

  if (!resultado) {
    throw new Error('Informe a data como dd/mm/aaaa.');
  }

  const [, dia, mes, ano] = resultado;
  const data = `${ano}-${mes}-${dia}`;

  validarData(data);

  return data;
}

function mensagemErro(erro: unknown) {
  Alert.alert(
    'Não foi possível concluir',
    erro instanceof Error ? erro.message : 'Tente novamente.'
  );
}

export default function NotificacoesScreen({
  fechar,
}: {
  fechar: () => void;
}) {
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [resultado, setResultado] =
    useState<ResultadoSincronizacao | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [editor, setEditor] = useState<Lembrete | null>(null);
  const [dataTexto, setDataTexto] = useState('');
  const [modoAtual, setModoAtual] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);

    try {
      const resumo = await sincronizarNotificacoes();

      const [lista, configuracao] = await Promise.all([
        listarLembretes(),
        buscarConfiguracaoDaData(hojeLocal()),
      ]);

      const modo = configuracao?.modo ?? null;

      setResultado(resumo);
      setLembretes(lista);
      setModoAtual(modo);

      // Fecha um editor que deixou de pertencer ao modo atual.
      setEditor((atual) =>
        atual && !tipoPermitidoNoModo(atual.tipo, modo)
          ? null
          : atual
      );
    } catch (erro) {
      mensagemErro(erro);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();

    const assinatura = AppState.addEventListener(
      'change',
      (estado) => {
        if (estado === 'active') {
          void carregar();
        }
      }
    );

    return () => assinatura.remove();
  }, []);

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;

    setOcupado(true);

    try {
      await acao();
    } catch (erro) {
      mensagemErro(erro);
    } finally {
      setOcupado(false);
    }
  }

  function editar(lembrete: Lembrete) {
    setEditor({ ...lembrete });
    setDataTexto(
      lembrete.data ? formatarData(lembrete.data) : ''
    );
  }

  function novo() {
    editar({
      id: 0,
      tipo: 'personalizado',
      titulo: '',
      mensagem: '',
      ativo: 0,
      repeticao: 'diario',
      data: null,
      horario: '08:00',
      dia_semana: 0,
      antecedencia_dias: 0,
      ids_notificacoes_json: '[]',
    });
  }

  async function persistir(lembrete: Lembrete) {
    if (lembrete.ativo) {
      const permitido = await solicitarPermissoes();

      if (!permitido) {
        throw new Error(
          'Autorize as notificações nas configurações do Android.'
        );
      }
    }

    await salvarLembrete(lembrete);
    setEditor(null);

    try {
      await carregar();
    } catch {
      throw new Error(
        'A preferência foi salva. Reabra esta tela para atualizar os avisos.'
      );
    }
  }

  const lembretesVisiveis = lembretes.filter(
    (lembrete) =>
      tipoPermitidoNoModo(lembrete.tipo, modoAtual)
  );

  return (
    <SafeAreaView style={s.pagina}>
      <View style={s.cabecalho}>
        <Text style={s.titulo}>
          {editor ? 'Editar lembrete' : 'Notificações'}
        </Text>

        <Pressable
          disabled={ocupado}
          onPress={() => editor ? setEditor(null) : fechar()}
        >
          <Text style={s.link}>
            {editor ? 'Voltar' : 'Fechar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 22, paddingBottom: 40 }}
        pointerEvents={ocupado ? 'none' : 'auto'}
        keyboardShouldPersistTaps="handled"
      >
        {editor ? (
          <>
            <Campo
              titulo="Título"
              valor={editor.titulo}
              alterar={(v) => setEditor({ ...editor, titulo: v })}
            />

            <Campo
              titulo="Mensagem"
              valor={editor.mensagem}
              alterar={(v) => setEditor({ ...editor, mensagem: v })}
            />

            <View style={s.linha}>
              <Text>Ativo</Text>
              <Switch
                value={Boolean(editor.ativo)}
                onValueChange={(v) =>
                  setEditor({ ...editor, ativo: v ? 1 : 0 })
                }
                trackColor={{ true: '#8563A6' }}
              />
            </View>

            <Campo
              titulo={
                editor.tipo === 'acao'
                  ? 'Horário do aviso — vazio usa o horário do regime'
                  : 'Horário do aviso — HH:mm'
              }
              valor={editor.horario ?? ''}
              alterar={(v) =>
                setEditor({ ...editor, horario: v || null })
              }
            />

            {(
              editor.tipo === 'inicio_pausa' ||
              editor.tipo === 'fim_pausa' ||
              editor.tipo === 'inicio_menstruacao' ||
              editor.tipo === 'fim_menstruacao'
            ) && (
              <Campo
                titulo="Avisar quantos dias antes? De 0 a 30"
                valor={String(editor.antecedencia_dias)}
                alterar={(v) =>
                  setEditor({
                    ...editor,
                    antecedencia_dias:
                      /^\d+$/.test(v) ? Number(v) : NaN,
                  })
                }
              />
            )}

            {editor.tipo === 'personalizado' && (
              <View style={s.opcoes}>
                {[
                  ['unico', 'Uma vez'],
                  ['diario', 'Diário'],
                  ['semanal', 'Semanal'],
                ].map(([valor, titulo]) => (
                  <Pressable
                    key={valor}
                    onPress={() =>
                      setEditor({ ...editor, repeticao: valor })
                    }
                    style={[
                      s.chip,
                      editor.repeticao === valor && s.selecionado,
                    ]}
                  >
                    <Text>{titulo}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {editor.repeticao === 'unico' && (
              <Campo
                titulo="Data — dd/mm/aaaa"
                valor={dataTexto}
                alterar={setDataTexto}
              />
            )}

            {editor.repeticao === 'semanal' && (
              <View style={s.opcoes}>
                {[
                  'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb',
                ].map((nome, indice) => (
                  <Pressable
                    key={nome}
                    onPress={() =>
                      setEditor({ ...editor, dia_semana: indice })
                    }
                    style={[
                      s.chip,
                      editor.dia_semana === indice && s.selecionado,
                    ]}
                  >
                    <Text>{nome}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Pressable
              style={s.botao}
              onPress={() => void executar(async () => {
                const atualizado = {
                  ...editor,
                  data:
                    editor.repeticao === 'unico'
                      ? lerData(dataTexto)
                      : null,
                };

                if (
                  atualizado.repeticao === 'unico' &&
                  atualizado.data &&
                  atualizado.horario
                ) {
                  const instante = new Date(
                    `${atualizado.data}T${atualizado.horario}:00`
                  ).getTime();

                  if (!Number.isFinite(instante) || instante <= Date.now()) {
                    throw new Error('Escolha uma data e horário futuros.');
                  }
                }

                await persistir(atualizado);
              })}
            >
              <Text style={s.textoBotao}>Salvar lembrete</Text>
            </Pressable>

            {editor.tipo === 'personalizado' && editor.id > 0 && (
              <Pressable
                style={{ marginTop: 24 }}
                onPress={() =>
                  Alert.alert('Excluir lembrete?', '', [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Excluir',
                      style: 'destructive',
                      onPress: () => void executar(async () => {
                        await excluirLembrete(editor.id);
                        setEditor(null);
                        await carregar();
                      }),
                    },
                  ])
                }
              >
                <Text style={{ color: '#B64F74' }}>
                  Excluir lembrete
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Text style={s.ajuda}>
              Ative os avisos que deseja receber.
              As permissões também podem ser alteradas no Android.
            </Text>

            <Pressable
              style={s.botao}
              onPress={() => void executar(async () => {
                const permitido = await solicitarPermissoes();

                if (!permitido) {
                  Alert.alert(
                    'Notificações desativadas',
                    'Abra as configurações do aplicativo para autorizar.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Abrir configurações',
                        onPress: () => void Linking.openSettings(),
                      },
                    ]
                  );
                }

                await carregar();
              })}
            >
              <Text style={s.textoBotao}>Autorizar notificações</Text>
            </Pressable>

            <Pressable
            style={{ marginVertical: 18 }}
            onPress={() => {
                Alert.alert(
                'Alarmes e lembretes',
                'No Android, procure: Configurações → Aplicativos → ' +
                    'Acesso especial → Alarmes e lembretes. ' +
                    'Selecione CAM e permita o acesso. ' +
                    'Os nomes podem variar conforme o aparelho.',
                [
                    { text: 'Fechar', style: 'cancel' },
                    {
                    text: 'Abrir configurações do aplicativo',
                    onPress: () => {
                        void Linking.openSettings();
                    },
                    },
                ]
                );
            }}
            >
            <Text style={s.link}>Como autorizar horários exatos</Text>
            </Pressable>

            {carregando ? (
              <ActivityIndicator color="#8563A6" />
            ) : (
              lembretesVisiveis.map((lembrete) => (
                <View key={lembrete.id} style={s.cartao}>
                  <View style={s.linha}>
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => editar(lembrete)}
                    >
                      <Text style={s.nome}>{lembrete.titulo}</Text>

                      <Text style={s.ajuda}>
                        {lembrete.horario ??
                          'Horário definido no acompanhamento'}
                      </Text>
                    </Pressable>

                    <Switch
                      value={Boolean(lembrete.ativo)}
                      trackColor={{ true: '#8563A6' }}
                      onValueChange={(v) =>
                        void executar(() =>
                          persistir({
                            ...lembrete,
                            ativo: v ? 1 : 0,
                          })
                        )
                      }
                    />
                  </View>

                  <Pressable onPress={() => editar(lembrete)}>
                    <Text style={s.link}>Editar preferências</Text>
                  </Pressable>
                </View>
              ))
            )}

            <Pressable onPress={novo} style={{ marginVertical: 18 }}>
              <Text style={s.link}>+ Adicionar lembrete</Text>
            </Pressable>

            <Pressable
              style={s.botao}
              onPress={() => void executar(async () => {
                await agendarTeste();

                Alert.alert(
                  'Teste agendado',
                  'Aguarde aproximadamente 30 segundos.'
                );
              })}
            >
              <Text style={s.textoBotao}>Testar notificação</Text>
            </Pressable>

            {resultado && (
              <Text style={[s.ajuda, { marginTop: 20 }]}>
                {resultado.permitido
                  ? `${resultado.quantidade} aviso(s) agendado(s). ` +
                    `Agenda recorrente preparada até ${
                      formatarData(resultado.ate)
                    }. Abra o aplicativo para renovar.`
                  : 'O Android ainda não autorizou as notificações.'}
              </Text>
            )}
          </>
        )}

        {ocupado && (
          <ActivityIndicator
            color="#8563A6"
            style={{ marginTop: 16 }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#FAF7FC' },
  cabecalho: {
    padding: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titulo: { fontSize: 22, fontWeight: '600', color: '#182235' },
  cartao: {
    padding: 18,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  nome: { color: '#182235', fontSize: 16 },
  ajuda: { color: '#80768B', lineHeight: 21, marginTop: 6 },
  link: { color: '#8563A6' },
  rotulo: { color: '#80768B', marginBottom: 8 },
  input: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    backgroundColor: '#FFFFFF',
    color: '#182235',
  },
  botao: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#8563A6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 12,
  },
  textoBotao: { color: '#FFFFFF', fontWeight: '600' },
  opcoes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 14,
  },
  chip: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  selecionado: { backgroundColor: '#E9DFF2' },
});
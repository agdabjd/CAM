import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { useRegistros } from '../features/registros/RegistrosProvider';
import { useNotificacoes } from '../features/notificacoes/NotificacoesProvider';

import {
  buscarPrimeiroDiaSemana,
  listarConfiguracoesPerfil,
  salvarDadosPessoais,
  salvarPrimeiroDiaSemana,
} from '../database/perfilRepository';

import type { ConfiguracaoSalva } from '../database/acompanhamentoRepository';

import { hojeLocal } from '../domain/datas';
import { formatarData, lerData } from '../domain/onboarding';

import OnboardingScreen from './OnboardingScreen';

type Painel = 'dados' | 'privacidade' | 'preferencias' | null;

function calcularIdade(nascimento: string | null) {
  if (!nascimento) return null;

  const hoje = hojeLocal();

  let idade =
    Number(hoje.slice(0, 4)) -
    Number(nascimento.slice(0, 4));

  if (hoje.slice(5) < nascimento.slice(5)) idade--;

  return idade;
}

function Campo({
  titulo,
  valor,
  alterar,
  email = false,
}: {
  titulo: string;
  valor: string;
  alterar: (valor: string) => void;
  email?: boolean;
}) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={s.rotulo}>{titulo}</Text>

      <TextInput
        value={valor}
        onChangeText={alterar}
        style={s.input}
        autoCapitalize={email ? 'none' : 'words'}
        autoCorrect={!email}
        keyboardType={email ? 'email-address' : 'default'}
      />
    </View>
  );
}

export default function PerfilScreen() {
  const {
    usuario,
    sair,
    atualizarUsuario,
  } = useAuth();

  const { versao, atualizar } = useRegistros();
  const { abrirNotificacoes } = useNotificacoes();

  const [configuracoes, setConfiguracoes] =
    useState<ConfiguracaoSalva[]>([]);

  const [primeiroDia, setPrimeiroDia] = useState<0 | 1>(0);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const [painel, setPainel] = useState<Painel>(null);

  const [edicaoConfiguracao, setEdicaoConfiguracao] =
    useState<ConfiguracaoSalva | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [nascimento, setNascimento] = useState('');

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      setCarregando(true);
      setErroCarga(false);

      Promise.all([
        listarConfiguracoesPerfil(),
        buscarPrimeiroDiaSemana(),
      ])
        .then(([lista, preferencia]) => {
          if (!ativo) return;

          setConfiguracoes(lista);
          setPrimeiroDia(preferencia);
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
    }, [versao])
  );

  const hoje = hojeLocal();

  const atual = configuracoes.find(
    (item) =>
      item.vigente_desde <= hoje &&
      (item.vigente_ate === null || hoje < item.vigente_ate)
  );

  const futuras = configuracoes
    .filter((item) => item.vigente_desde > hoje)
    .sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde));

  const idade = calcularIdade(usuario?.data_nascimento ?? null);

  function abrirDados() {
    setNome(usuario?.nome ?? '');
    setEmail(usuario?.email ?? '');
    setNascimento(
      usuario?.data_nascimento
        ? formatarData(usuario.data_nascimento)
        : ''
    );

    setPainel('dados');
  }

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);

    try {
      await acao();
    } catch (erro) {
      Alert.alert(
        'Não foi possível concluir',
        erro instanceof Error ? erro.message : 'Tente novamente.'
      );
    } finally {
      setOcupado(false);
    }
  }

  function salvarPerfil() {
    void executar(async () => {
      await salvarDadosPessoais({
        nome,
        email,
        dataNascimento: nascimento.trim()
          ? lerData(nascimento)
          : null,
      });

      await atualizarUsuario();

      setPainel(null);
      atualizar();
    });
  }

  function alterarSemana(valor: 0 | 1) {
    void executar(async () => {
      await salvarPrimeiroDiaSemana(valor);
      setPrimeiroDia(valor);
      atualizar();
    });
  }

  function confirmarSaida() {
    Alert.alert(
      'Encerrar sessão?',
      'Você precisará entrar novamente para acessar seus dados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          onPress: () => void executar(sair),
        },
      ]
    );
  }

  return (
    <SafeAreaView edges={['top']} style={s.pagina}>
      <ScrollView contentContainerStyle={s.conteudo}>
        <Text style={s.titulo}>Perfil</Text>

        <Pressable
          style={s.identificacao}
          onPress={abrirDados}
          accessibilityLabel="Editar dados pessoais"
        >
          <View style={s.avatar}>
            <Text style={{ fontSize: 28 }}>🌸</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.nome}>{usuario?.nome}</Text>

            <Text style={s.discreto}>
              {idade !== null ? `${idade} anos` : 'Editar dados pessoais'}
            </Text>
          </View>

          <Ionicons
            name="create-outline"
            size={19}
            color="#8563A6"
          />
        </Pressable>

        {carregando ? (
          <ActivityIndicator color="#8563A6" />
        ) : erroCarga ? (
          <Text style={s.discreto}>
            Não foi possível carregar as configurações.
            Saia desta aba e volte para tentar novamente.
          </Text>
        ) : (
          <>
            <View style={s.cartao}>
              <Text style={s.secao}>
                {atual?.modo === 'anticoncepcional'
                  ? 'MÉTODO CONTRACEPTIVO'
                  : 'ACOMPANHAMENTO'}
              </Text>

              <View style={s.linha}>
                <View style={s.iconeMetodo}>
                  <Ionicons
                    name={
                      atual?.modo === 'anticoncepcional'
                        ? 'medical-outline'
                        : 'flower-outline'
                    }
                    size={19}
                    color="#8563A6"
                  />
                </View>

                <Text style={[s.texto, { flex: 1 }]}>
                  {atual?.modo === 'anticoncepcional'
                    ? atual.metodo
                    : 'Acompanhamento menstrual'}
                </Text>

                {atual && (
                  <Pressable
                    onPress={() => setEdicaoConfiguracao(atual)}
                  >
                    <Text style={s.link}>Alterar</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {futuras.map((configuracao) => (
              <Pressable
                key={configuracao.id}
                style={s.cartao}
                onPress={() => setEdicaoConfiguracao(configuracao)}
              >
                <Text style={s.secao}>ALTERAÇÃO PROGRAMADA</Text>

                <Text style={s.texto}>
                  {configuracao.modo === 'anticoncepcional'
                    ? configuracao.metodo
                    : 'Acompanhamento menstrual'}
                </Text>

                <Text style={s.discreto}>
                  A partir de{' '}
                  {formatarData(configuracao.vigente_desde)}
                </Text>

                <Text style={[s.link, { marginTop: 10 }]}>
                  Editar agendamento
                </Text>
              </Pressable>
            ))}
          </>
        )}

        <Pressable style={s.cartao} onPress={abrirDados}>
          <Text style={s.secao}>DADOS PESSOAIS</Text>

          <View style={s.linha}>
            <Text style={[s.discreto, { flex: 1 }]}>
              Data de nascimento
            </Text>

            <Text style={s.texto}>
              {usuario?.data_nascimento
                ? formatarData(usuario.data_nascimento)
                : 'Não informada'}
            </Text>
          </View>
        </Pressable>

        <View style={s.cartao}>
          <Pressable
            style={[s.itemMenu, s.separador]}
            onPress={abrirNotificacoes}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color="#80768B"
            />
            <Text style={[s.texto, { flex: 1 }]}>Notificações</Text>
            <Ionicons
              name="chevron-forward"
              size={17}
              color="#80768B"
            />
          </Pressable>

          <Pressable
            style={[s.itemMenu, s.separador]}
            onPress={() => setPainel('privacidade')}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#80768B"
            />
            <Text style={[s.texto, { flex: 1 }]}>Privacidade</Text>
            <Ionicons
              name="chevron-forward"
              size={17}
              color="#80768B"
            />
          </Pressable>

          <Pressable
            style={s.itemMenu}
            onPress={() => setPainel('preferencias')}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color="#80768B"
            />
            <Text style={[s.texto, { flex: 1 }]}>Preferências</Text>
            <Ionicons
              name="chevron-forward"
              size={17}
              color="#80768B"
            />
          </Pressable>
        </View>

        <View style={s.aviso}>
          <Text style={{ fontSize: 19 }}>🔒</Text>
          <Text style={s.textoAviso}>
            Seus registros ficam neste dispositivo.
            O aplicativo não envia seu histórico para um servidor.
          </Text>
        </View>

        <Pressable
          onPress={confirmarSaida}
          disabled={ocupado}
          style={{ alignSelf: 'center', marginTop: 24 }}
        >
          <Text style={s.link}>Encerrar sessão</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={painel !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!ocupado) setPainel(null);
        }}
      >
        <SafeAreaProvider>
          <SafeAreaView style={s.pagina}>
            <View style={s.cabecalhoModal}>
              <Text style={s.tituloModal}>
                {painel === 'dados'
                  ? 'Dados pessoais'
                  : painel === 'privacidade'
                    ? 'Privacidade'
                    : 'Preferências'}
              </Text>

              <Pressable
                disabled={ocupado}
                onPress={() => setPainel(null)}
              >
                <Text style={s.link}>Fechar</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={s.conteudo}
              keyboardShouldPersistTaps="handled"
            >
              {painel === 'dados' && (
                <>
                  <Campo
                    titulo="Como quer ser chamada?"
                    valor={nome}
                    alterar={setNome}
                  />

                  <Campo
                    titulo="E-mail de acesso"
                    valor={email}
                    alterar={setEmail}
                    email
                  />

                  <Campo
                    titulo="Nascimento — dd/mm/aaaa, opcional"
                    valor={nascimento}
                    alterar={setNascimento}
                  />

                  <Pressable
                    style={s.botao}
                    disabled={ocupado}
                    onPress={salvarPerfil}
                  >
                    {ocupado ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={s.textoBotao}>Salvar dados</Text>
                    )}
                  </Pressable>
                </>
              )}

              {painel === 'privacidade' && (
                <View style={{ gap: 20 }}>
                  <Text style={s.paragrafo}>
                    Seus registros ficam armazenados neste dispositivo.
                    O aplicativo não envia seu histórico para um servidor.
                  </Text>

                  <Text style={s.paragrafo}>
                    O acesso ao aplicativo é protegido por senha.
                    Ao encerrar a sessão, será necessário entrar novamente.
                  </Text>

                  <Text style={s.paragrafo}>
                    As notificações podem aparecer na tela bloqueada.
                    Você pode controlar sua exibição nas configurações
                    do Android.
                  </Text>

                  <Pressable
                    onPress={() => void Linking.openSettings()}
                  >
                    <Text style={s.link}>
                      Abrir configurações do aplicativo
                    </Text>
                  </Pressable>

                  <Text style={s.paragrafo}>
                    Ao desinstalar o aplicativo ou limpar seus dados,
                    o histórico local será removido.
                  </Text>
                </View>
              )}

              {painel === 'preferencias' && (
                <>
                  <Text style={s.secao}>
                    PRIMEIRO DIA DA SEMANA
                  </Text>

                  {[
                    { valor: 0 as const, nome: 'Domingo' },
                    { valor: 1 as const, nome: 'Segunda-feira' },
                  ].map((opcao) => (
                    <Pressable
                      key={opcao.valor}
                      disabled={ocupado}
                      onPress={() => alterarSemana(opcao.valor)}
                      style={[
                        s.opcao,
                        primeiroDia === opcao.valor &&
                          s.opcaoSelecionada,
                      ]}
                    >
                      <Text style={s.texto}>{opcao.nome}</Text>

                      {primeiroDia === opcao.valor && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color="#8563A6"
                        />
                      )}
                    </Pressable>
                  ))}

                  <Text style={s.discreto}>
                    A preferência será aplicada ao calendário.
                  </Text>

                  {ocupado && (
                    <ActivityIndicator
                      color="#8563A6"
                      style={{ marginTop: 20 }}
                    />
                  )}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      <Modal
        visible={edicaoConfiguracao !== null}
        animationType="slide"
        onRequestClose={() => setEdicaoConfiguracao(null)}
      >
        <SafeAreaProvider>
          {edicaoConfiguracao && (
            <OnboardingScreen
              configuracaoEdicao={edicaoConfiguracao}
              onCancelar={() => setEdicaoConfiguracao(null)}
              onConcluido={() => {
                setEdicaoConfiguracao(null);
                atualizar();
              }}
            />
          )}
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: '#FAF7FC' },
  conteudo: { padding: 22, paddingBottom: 36 },
  titulo: {
    fontSize: 26,
    fontWeight: '600',
    color: '#182235',
    marginBottom: 24,
  },
  identificacao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: '#E9DFF2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nome: {
    color: '#182235',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  discreto: { color: '#80768B', fontSize: 13, lineHeight: 21 },
  cartao: {
    padding: 17,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  secao: {
    color: '#80768B',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconeMetodo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E9DFF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texto: { color: '#182235', fontSize: 15 },
  link: { color: '#8563A6', fontSize: 14 },
  itemMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
  },
  separador: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAF5',
  },
  aviso: {
    backgroundColor: '#E9DFF2',
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    gap: 12,
  },
  textoAviso: {
    color: '#8563A6',
    flex: 1,
    fontSize: 13,
    lineHeight: 21,
  },
  cabecalhoModal: {
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tituloModal: {
    fontSize: 22,
    fontWeight: '600',
    color: '#182235',
  },
  rotulo: { color: '#80768B', marginBottom: 8 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#182235',
  },
  botao: {
    minHeight: 48,
    backgroundColor: '#8563A6',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  textoBotao: { color: '#FFFFFF', fontWeight: '600' },
  paragrafo: { color: '#71677E', fontSize: 15, lineHeight: 24 },
  opcao: {
    padding: 18,
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  opcaoSelecionada: {
    backgroundColor: '#E9DFF2',
    borderColor: '#8563A6',
  },
});
import { useState } from 'react';
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

import { useAuth } from '../auth/AuthContext';

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

export default function AuthScreen() {
  const { temPerfil, cadastrar, entrar } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const cadastro = !temPerfil;

  async function enviar() {
    if (ocupado) return;

    if (cadastro && senha !== confirmacao) {
      Alert.alert('Confira a senha', 'As senhas não são iguais.');
      return;
    }

    if (!email.trim() || !senha) {
      Alert.alert('Campos obrigatórios', 'Informe e-mail e senha.');
      return;
    }

    setOcupado(true);

    try {
      if (cadastro) {
        await cadastrar({ nome, email, senha });
      } else {
        await entrar(email, senha);
      }
    } catch (erro) {
      Alert.alert(
        'Não foi possível continuar',
        erro instanceof Error ? erro.message : 'Tente novamente.'
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.conteudo}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.marca}>CAM</Text>

          <Text style={styles.titulo}>
            {cadastro ? 'Vamos começar' : 'Que bom ter você aqui'}
          </Text>

          <Text style={styles.descricao}>
            {cadastro
              ? 'Crie seu acesso. Seus dados ficam neste dispositivo.'
              : 'Entre para acessar seu acompanhamento.'}
          </Text>

          {cadastro && (
            <Campo
              rotulo="Como quer ser chamada?"
              value={nome}
              onChangeText={setNome}
              placeholder="Seu nome"
              editable={!ocupado}
              autoCapitalize="words"
            />
          )}

          <Campo
            rotulo="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="seuemail@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!ocupado}
          />

          <Campo
            rotulo="Senha"
            value={senha}
            onChangeText={setSenha}
            placeholder={cadastro ? 'Pelo menos 8 caracteres' : 'Sua senha'}
            secureTextEntry={!mostrarSenha}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={128}
            editable={!ocupado}
          />

          {cadastro && (
            <Campo
              rotulo="Confirme a senha"
              value={confirmacao}
              onChangeText={setConfirmacao}
              placeholder="Digite a senha novamente"
              secureTextEntry={!mostrarSenha}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={128}
              editable={!ocupado}
            />
          )}

          <Pressable
            onPress={() => setMostrarSenha(!mostrarSenha)}
            disabled={ocupado}
            accessibilityRole="button"
          >
            <Text style={styles.link}>
              {mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.botao,
              ocupado && { opacity: 0.6 },
            ]}
            onPress={enviar}
            disabled={ocupado}
            accessibilityRole="button"
          >
            {ocupado ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.textoBotao}>
                {cadastro ? 'Criar perfil e continuar' : 'Entrar'}
              </Text>
            )}
          </Pressable>
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
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  marca: {
    fontSize: 28,
    fontWeight: '700',
    color: '#8563A6',
    marginBottom: 24,
  },
  titulo: {
    fontSize: 23,
    fontWeight: '600',
    color: '#182235',
  },
  descricao: {
    fontSize: 15,
    lineHeight: 22,
    color: '#71677E',
    marginTop: 8,
    marginBottom: 24,
  },
  campo: {
    marginBottom: 16,
  },
  rotulo: {
    color: '#71677E',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE3F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    color: '#182235',
  },
  link: {
    color: '#8563A6',
    paddingVertical: 8,
    marginBottom: 16,
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
});
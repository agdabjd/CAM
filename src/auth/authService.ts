import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import QuickCrypto from 'react-native-quick-crypto';

import {
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
} from '@noble/hashes/utils.js';

import { obterBanco } from '../database/database';

const CHAVE_SESSAO = 'oiutero.sessao.v1';

const PARAMETROS = {
  algoritmo: 'pbkdf2-sha256',
  iteracoes: 600_000,
  tamanho: 32,
};

export type Usuario = {
  id: number;
  nome: string;
  email: string;
  data_nascimento: string | null;
};

type PerfilBanco = Usuario & {
  senha_hash: string;
  senha_salt: string;
  senha_parametros: string;
  sessao_hash: string | null;
};

export type DadosCadastro = {
  nome: string;
  email: string;
  senha: string;
};

function usuarioPublico(perfil: PerfilBanco): Usuario {
  return {
    id: perfil.id,
    nome: perfil.nome,
    email: perfil.email,
    data_nascimento: perfil.data_nascimento,
  };
}

async function buscarPerfil() {
  const banco = await obterBanco();

  return banco.getFirstAsync<PerfilBanco>(
    'SELECT * FROM perfis WHERE id = 1'
  );
}

export async function existePerfil() {
  return (await buscarPerfil()) !== null;
}

function derivarSenha(
  senha: string,
  salt: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    QuickCrypto.pbkdf2(
      utf8ToBytes(senha),
      hexToBytes(salt),
      PARAMETROS.iteracoes,
      PARAMETROS.tamanho,
      'sha256',
      (erro, chave) => {
        if (erro) {
          reject(erro);
          return;
        }

        if (!chave) {
          reject(
            new Error('Não foi possível processar a senha.')
          );
          return;
        }

        resolve(chave.toString('hex'));
      }
    );
  });
}

function hashesIguais(a: string, b: string) {
  if (a.length !== b.length) return false;

  let diferenca = 0;

  for (let i = 0; i < a.length; i++) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diferenca === 0;
}

async function hashDaSessao(token: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    token
  );
}

async function iniciarSessao(usuario: Usuario) {
  const banco = await obterBanco();

  const token = bytesToHex(
    await Crypto.getRandomBytesAsync(32)
  );

  const hash = await hashDaSessao(token);

  await banco.runAsync(
    'UPDATE perfis SET sessao_hash = ? WHERE id = 1',
    hash
  );

  try {
    await SecureStore.setItemAsync(CHAVE_SESSAO, token, {
      keychainAccessible:
        SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (erro) {
    await banco.runAsync(
      'UPDATE perfis SET sessao_hash = NULL WHERE id = 1'
    );

    throw erro;
  }

  return usuario;
}

export async function cadastrar(dados: DadosCadastro) {
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();

  if (!nome) {
    throw new Error('Informe seu nome.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Informe um e-mail válido.');
  }

  if (dados.senha.length < 8 || dados.senha.length > 128) {
    throw new Error('A senha deve ter entre 8 e 128 caracteres.');
  }

  if (await existePerfil()) {
    throw new Error('Já existe um perfil neste dispositivo.');
  }

  const salt = bytesToHex(
    await Crypto.getRandomBytesAsync(16)
  );

  console.log('Cadastro: iniciando derivação da senha');
  console.time('Tempo de derivação');

  const senhaHash = await derivarSenha(dados.senha, salt);

  console.timeEnd('Tempo de derivação');
  console.log('Cadastro: senha derivada; iniciando gravação');

  const banco = await obterBanco();

  await banco.runAsync(
    `
      INSERT INTO perfis (
        id, nome, email, senha_hash,
        senha_salt, senha_parametros
      )
      VALUES (1, ?, ?, ?, ?, ?)
    `,
    nome,
    email,
    senhaHash,
    salt,
    JSON.stringify(PARAMETROS)
  );

  console.log('Cadastro: perfil salvo; iniciando sessão');

  const usuario: Usuario = {
    id: 1,
    nome,
    email,
    data_nascimento: null,
  };

  try {
    const resultado = await iniciarSessao(usuario);

    console.log('Cadastro: sessão iniciada');

    return resultado;
  } catch {
    throw new Error(
      'Seu perfil foi criado, mas não foi possível iniciar a sessão. ' +
      'Tente entrar pela tela de login.'
    );
  }
}

export async function entrar(email: string, senha: string) {
  const perfil = await buscarPerfil();

  if (
    !perfil ||
    perfil.email !== email.trim().toLowerCase()
  ) {
    throw new Error('E-mail ou senha incorretos.');
  }

  const parametros = JSON.parse(perfil.senha_parametros);

  if (
    parametros.algoritmo !== PARAMETROS.algoritmo ||
    parametros.iteracoes !== PARAMETROS.iteracoes ||
    parametros.tamanho !== PARAMETROS.tamanho
  ) {
    throw new Error('Os parâmetros de acesso não são compatíveis.');
  }

  const hash = await derivarSenha(senha, perfil.senha_salt);

  if (!hashesIguais(hash, perfil.senha_hash)) {
    throw new Error('E-mail ou senha incorretos.');
  }

  return iniciarSessao(usuarioPublico(perfil));
}

export async function restaurarSessao() {
  const perfil = await buscarPerfil();
  const token = await SecureStore.getItemAsync(CHAVE_SESSAO);

  if (!perfil || !token || !perfil.sessao_hash) {
    await SecureStore.deleteItemAsync(CHAVE_SESSAO);
    return null;
  }

  const hash = await hashDaSessao(token);

  if (!hashesIguais(hash, perfil.sessao_hash)) {
    await SecureStore.deleteItemAsync(CHAVE_SESSAO);
    return null;
  }

  return usuarioPublico(perfil);
}

export async function sair() {
  const banco = await obterBanco();

  // Invalida a sessão antes de remover o segredo do dispositivo.
  await banco.runAsync(
    'UPDATE perfis SET sessao_hash = NULL WHERE id = 1'
  );

  await SecureStore.deleteItemAsync(CHAVE_SESSAO).catch(() => {
    // Mesmo se a remoção falhar, o token já foi invalidado no banco.
  });
}
import { obterBanco } from './database';

import type { Usuario } from '../auth/authService';
import type { ConfiguracaoSalva } from './acompanhamentoRepository';

import { hojeLocal, validarData } from '../domain/datas';

export async function buscarPerfilPublico() {
  const banco = await obterBanco();

  return banco.getFirstAsync<Usuario>(
    `
      SELECT id, nome, email, data_nascimento
      FROM perfis
      WHERE id = 1
    `
  );
}

export async function salvarDadosPessoais(dados: {
  nome: string;
  email: string;
  dataNascimento: string | null;
}) {
  const nome = dados.nome.trim();
  const email = dados.email.trim().toLowerCase();

  if (!nome) {
    throw new Error('Informe seu nome.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Informe um e-mail válido.');
  }

  if (dados.dataNascimento) {
    validarData(dados.dataNascimento);

    if (dados.dataNascimento > hojeLocal()) {
      throw new Error('A data de nascimento não pode ser futura.');
    }
  }

  const banco = await obterBanco();

  const resultado = await banco.runAsync(
    `
      UPDATE perfis
      SET nome = ?, email = ?, data_nascimento = ?
      WHERE id = 1
    `,
    nome,
    email,
    dados.dataNascimento
  );

  if (resultado.changes !== 1) {
    throw new Error('Perfil não encontrado.');
  }
}

export async function listarConfiguracoesPerfil() {
  const banco = await obterBanco();

  return banco.getAllAsync<ConfiguracaoSalva>(
    `
      SELECT *
      FROM configuracoes
      WHERE perfil_id = 1
      ORDER BY vigente_desde DESC
    `
  );
}

export async function buscarPrimeiroDiaSemana(): Promise<0 | 1> {
  const banco = await obterBanco();

  const resultado = await banco.getFirstAsync<{
    primeiro_dia_semana: 0 | 1;
  }>(
    `
      SELECT primeiro_dia_semana
      FROM preferencias
      WHERE perfil_id = 1
    `
  );

  return resultado?.primeiro_dia_semana ?? 0;
}

export async function salvarPrimeiroDiaSemana(valor: 0 | 1) {
  if (valor !== 0 && valor !== 1) {
    throw new Error('Escolha domingo ou segunda-feira.');
  }

  const banco = await obterBanco();

  await banco.runAsync(
    `
      INSERT INTO preferencias (perfil_id, primeiro_dia_semana)
      VALUES (1, ?)
      ON CONFLICT(perfil_id)
      DO UPDATE SET
        primeiro_dia_semana = excluded.primeiro_dia_semana
    `,
    valor
  );
}
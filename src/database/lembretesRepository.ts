import { obterBanco } from './database';
import { validarData } from '../domain/datas';

export type Lembrete = {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  ativo: number;
  repeticao: string;
  data: string | null;
  horario: string | null;
  dia_semana: number | null;
  antecedencia_dias: number;
  ids_notificacoes_json: string;
};

const PADROES = [
  [
    'acao',
    'Ação do anticoncepcional',
    'Você tem uma ação prevista no seu acompanhamento.',
    'regime',
    null,
    null,
    0,
  ],
  [
    'inicio_pausa',
    'Início da pausa',
    'Confira o início da pausa no seu acompanhamento.',
    'regime',
    '08:00',
    null,
    2,
  ],
  [
    'fim_pausa',
    'Fim da pausa',
    'Confira a retomada prevista no seu acompanhamento.',
    'regime',
    '08:00',
    null,
    0,
  ],
  [
    'registro',
    'Registro diário',
    'Como você está hoje? Faça seu registro diário.',
    'diario',
    '21:00',
    null,
    0,
  ],
  [
    'resumo_semanal',
    'Resumo semanal',
    'Consulte os registros da semana no aplicativo.',
    'semanal',
    '20:00',
    0,
    0,
  ],
] as const;

export async function prepararLembretes() {
  const banco = await obterBanco();

  await banco.withExclusiveTransactionAsync(async (transacao) => {
    for (const padrao of PADROES) {
      const existente = await transacao.getFirstAsync<{ id: number }>(
        'SELECT id FROM lembretes WHERE perfil_id = 1 AND tipo = ?',
        padrao[0]
      );

      if (existente) continue;

      await transacao.runAsync(
        `
          INSERT INTO lembretes (
            perfil_id, tipo, titulo, mensagem, repeticao,
            horario, dia_semana, antecedencia_dias, ativo
          )
          VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [...padrao, 0]
      );
    }
  });
}

export async function listarLembretes() {
  const banco = await obterBanco();

  return banco.getAllAsync<Lembrete>(
    'SELECT * FROM lembretes WHERE perfil_id = 1 ORDER BY id'
  );
}

export async function salvarLembrete(dados: Lembrete) {
  if (!dados.titulo.trim() || !dados.mensagem.trim()) {
    throw new Error('Informe o título e a mensagem.');
  }

  if (
    dados.horario !== null &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(dados.horario)
  ) {
    throw new Error('Informe o horário no formato HH:mm.');
  }

  if (dados.tipo !== 'acao' && !dados.horario) {
    throw new Error('Informe o horário do aviso.');
  }

  if (
    !Number.isInteger(dados.antecedencia_dias) ||
    dados.antecedencia_dias < 0 ||
    dados.antecedencia_dias > 30
  ) {
    throw new Error('A antecedência deve estar entre 0 e 30 dias.');
  }

  if (
    dados.repeticao === 'semanal' &&
    (
      dados.dia_semana === null ||
      !Number.isInteger(dados.dia_semana) ||
      dados.dia_semana < 0 ||
      dados.dia_semana > 6
    )
  ) {
    throw new Error('Escolha o dia da semana.');
  }

  if (dados.repeticao === 'unico') {
    if (!dados.data) {
      throw new Error('Informe a data do lembrete.');
    }

    validarData(dados.data);
  }

  const banco = await obterBanco();

  if (dados.id > 0) {
    const resultado = await banco.runAsync(
      `
        UPDATE lembretes
        SET titulo = ?, mensagem = ?, ativo = ?, horario = ?,
            repeticao = ?, data = ?, dia_semana = ?,
            antecedencia_dias = ?
        WHERE id = ? AND perfil_id = 1
      `,
      dados.titulo.trim(),
      dados.mensagem.trim(),
      dados.ativo,
      dados.horario,
      dados.repeticao,
      dados.data,
      dados.dia_semana,
      dados.antecedencia_dias,
      dados.id
    );

    if (resultado.changes !== 1) {
      throw new Error('Lembrete não encontrado.');
    }
  } else {
    await banco.runAsync(
      `
        INSERT INTO lembretes (
          perfil_id, tipo, titulo, mensagem, ativo, repeticao,
          data, horario, dia_semana, antecedencia_dias
        )
        VALUES (1, 'personalizado', ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      dados.titulo.trim(),
      dados.mensagem.trim(),
      dados.ativo,
      dados.repeticao,
      dados.data,
      dados.horario,
      dados.dia_semana
    );
  }
}

export async function excluirLembrete(id: number) {
  const banco = await obterBanco();

  await banco.runAsync(
    `
      DELETE FROM lembretes
      WHERE id = ? AND perfil_id = 1 AND tipo = 'personalizado'
    `,
    id
  );
}
import { obterBanco } from './database';

export type Menstruacao = {
  id: number;
  perfil_id: number;
  configuracao_id: number;
  data_inicio: string;
  data_fim: string | null;
  observacoes: string;
};

type DadosMenstruacao = {
  id?: number;
  dataInicio: string;
  dataFim?: string | null;
  observacoes?: string;
};

function validarData(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error('A data deve estar no formato AAAA-MM-DD.');
  }

  const convertida = new Date(`${data}T00:00:00Z`);

  if (
    Number.isNaN(convertida.getTime()) ||
    convertida.toISOString().slice(0, 10) !== data
  ) {
    throw new Error('Data inválida.');
  }
}

export async function salvarMenstruacao(
  dados: DadosMenstruacao
) {
  validarData(dados.dataInicio);

  const dataFim = dados.dataFim ?? null;

  if (dataFim) {
    validarData(dataFim);

    if (dataFim < dados.dataInicio) {
      throw new Error(
        'O fim da menstruação não pode ser anterior ao início.'
      );
    }
  }

  const banco = await obterBanco();
  let idSalvo = dados.id ?? 0;

  await banco.withExclusiveTransactionAsync(async (transacao) => {
    if (dados.id !== undefined) {
      const existente = await transacao.getFirstAsync<{
        id: number;
      }>(
        `
          SELECT id
          FROM menstruacoes
          WHERE id = ? AND perfil_id = 1
        `,
        dados.id
      );

      if (!existente) {
        throw new Error('Menstruação não encontrada.');
      }
    }

    const configuracao = await transacao.getFirstAsync<{
      id: number;
      modo: string;
    }>(
      `
        SELECT id, modo
        FROM configuracoes
        WHERE perfil_id = 1
          AND vigente_desde <= ?
          AND (vigente_ate IS NULL OR ? < vigente_ate)
        ORDER BY vigente_desde DESC
        LIMIT 1
      `,
      dados.dataInicio,
      dados.dataInicio
    );

    if (!configuracao || configuracao.modo !== 'menstrual') {
      throw new Error(
        'É necessária uma configuração menstrual válida para essa data.'
      );
    }

    const conflito = await transacao.getFirstAsync<{
      id: number;
    }>(
      `
        SELECT id
        FROM menstruacoes
        WHERE perfil_id = 1
          AND id <> ?
          AND data_inicio <= ?
          AND COALESCE(data_fim, '9999-12-31') >= ?
        LIMIT 1
      `,
      dados.id ?? -1,
      dataFim ?? '9999-12-31',
      dados.dataInicio
    );

    if (conflito) {
      throw new Error(
        'Esse período coincide com outra menstruação registrada. ' +
        'Confira também se existe uma menstruação sem data de fim.'
      );
    }

    if (dados.id !== undefined) {
      await transacao.runAsync(
        `
          UPDATE menstruacoes
          SET configuracao_id = ?,
              data_inicio = ?,
              data_fim = ?,
              observacoes = ?
          WHERE id = ? AND perfil_id = 1
        `,
        configuracao.id,
        dados.dataInicio,
        dataFim,
        dados.observacoes ?? '',
        dados.id
      );
    } else {
      const resultado = await transacao.runAsync(
        `
          INSERT INTO menstruacoes (
            perfil_id,
            configuracao_id,
            data_inicio,
            data_fim,
            observacoes
          )
          VALUES (1, ?, ?, ?, ?)
        `,
        configuracao.id,
        dados.dataInicio,
        dataFim,
        dados.observacoes ?? ''
      );

      idSalvo = resultado.lastInsertRowId;
    }
  });

  return idSalvo;
}

export async function listarMenstruacoes() {
  const banco = await obterBanco();

  return banco.getAllAsync<Menstruacao>(
    `
      SELECT *
      FROM menstruacoes
      WHERE perfil_id = 1
      ORDER BY data_inicio DESC
    `
  );
}

export async function buscarMenstruacaoEmAndamento() {
  const banco = await obterBanco();

  return banco.getFirstAsync<Menstruacao>(
    `
      SELECT *
      FROM menstruacoes
      WHERE perfil_id = 1 AND data_fim IS NULL
      LIMIT 1
    `
  );
}
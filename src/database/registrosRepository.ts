import { obterBanco } from './database';

import type { ConfiguracaoSalva } from './acompanhamentoRepository';

import { hojeLocal, validarData } from '../domain/datas';
import { calcularDia } from '../domain/contraceptivo/regime';
import { configuracaoParaRegime } from '../domain/contraceptivo/configuracaoParaRegime';

import type { SQLiteDatabase } from 'expo-sqlite';

export type AcaoRegistrada = {
  configuracao_id: number;
  horario_real: string;
  data_prevista: string | null;
  titulo?: string;
};

export type Diario = {
  id?: number;
  data: string;
  horario: string;
  humor: string | null;
  sangramento_fluxo: string;
  sangramento_tipo: string;
  observacoes: string;
  sintomas: string[];
  acoes: AcaoRegistrada[];
};

export type PeriodoMenstrual = {
  id?: number;
  data_inicio: string;
  data_fim: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  observacoes: string;
};

export function horarioAgora() {
  const agora = new Date();

  return [
    agora.getHours(),
    agora.getMinutes(),
  ]
    .map((valor) => String(valor).padStart(2, '0'))
    .join(':');
}

function validarHorario(horario: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)) {
    throw new Error('Informe um horário válido no formato HH:mm.');
  }
}

function validarDataReal(data: string) {
  validarData(data);

  if (data > hojeLocal()) {
    throw new Error('Um registro realizado não pode ter data futura.');
  }
}

export function diarioVazio(data: string): Diario {
  return {
    data,
    horario: horarioAgora(),
    humor: null,
    sangramento_fluxo: 'nenhum',
    sangramento_tipo: 'nao_informado',
    observacoes: '',
    sintomas: [],
    acoes: [],
  };
}

export async function carregarDia(data: string): Promise<Diario> {
  const banco = await obterBanco();

  const registro = await banco.getFirstAsync<{
    id: number;
    data: string;
    horario: string | null;
    humor: string | null;
    sangramento_fluxo: string;
    sangramento_tipo: string;
    observacoes: string;
  }>(
    `
      SELECT *
      FROM registros_diarios
      WHERE perfil_id = 1 AND data = ?
    `,
    data
  );

  if (!registro) return diarioVazio(data);

  const sintomas = await banco.getAllAsync<{ descricao: string }>(
    `
      SELECT descricao
      FROM sintomas_registrados
      WHERE registro_diario_id = ?
      ORDER BY id
    `,
    registro.id
  );

  const acoes = await banco.getAllAsync<AcaoRegistrada>(
    `
      SELECT
        a.configuracao_id,
        a.horario_real,
        a.data_prevista,
        c.acao AS titulo
      FROM acoes_realizadas a
      JOIN configuracoes c ON c.id = a.configuracao_id
      WHERE a.registro_diario_id = ?
      ORDER BY a.horario_real, a.id
    `,
    registro.id
  );

  return {
    ...registro,
    horario: registro.horario ?? horarioAgora(),
    sintomas: sintomas.map((item) => item.descricao),
    acoes,
  };
}

async function registrarMenstruacaoPeloDiario(
  transacao: SQLiteDatabase,
  dados: Diario
) {
  if (
    dados.sangramento_fluxo === 'nenhum' ||
    dados.sangramento_tipo !== 'menstruacao'
  ) {
    return;
  }

  const configuracao =
    await transacao.getFirstAsync<ConfiguracaoSalva>(
      `
        SELECT *
        FROM configuracoes
        WHERE perfil_id = 1
          AND vigente_desde <= ?
          AND (vigente_ate IS NULL OR ? < vigente_ate)
        ORDER BY vigente_desde DESC
        LIMIT 1
      `,
      dados.data,
      dados.data
    );

  // A classificação não muda o regime anticoncepcional.
  if (!configuracao || configuracao.modo !== 'menstrual') {
    return;
  }

  const periodoExistente =
    await transacao.getFirstAsync<{
      id: number;
      data_inicio: string;
    }>(
      `
        SELECT id, data_inicio
        FROM menstruacoes
        WHERE perfil_id = 1
          AND data_inicio <= ?
          AND (data_fim IS NULL OR data_fim >= ?)
        ORDER BY data_inicio DESC
        LIMIT 1
      `,
      dados.data,
      dados.data
    );

  if (periodoExistente) {
    // Se o período já existe, preserva seu início.
    // Preenche apenas um horário inicial ainda não informado.
    if (periodoExistente.data_inicio === dados.data) {
      await transacao.runAsync(
        `
          UPDATE menstruacoes
          SET horario_inicio = COALESCE(horario_inicio, ?)
          WHERE id = ?
        `,
        dados.horario,
        periodoExistente.id
      );
    }

    return;
  }

  const periodoPosterior =
    await transacao.getFirstAsync<{ id: number }>(
      `
        SELECT id
        FROM menstruacoes
        WHERE perfil_id = 1 AND data_inicio > ?
        LIMIT 1
      `,
      dados.data
    );

  if (periodoPosterior) {
    throw new Error(
      'Existe uma menstruação registrada depois dessa data. ' +
      'Cadastre esse período anterior pelo formulário de menstruação, ' +
      'informando início e fim.'
    );
  }

  await transacao.runAsync(
    `
      INSERT INTO menstruacoes (
        perfil_id,
        configuracao_id,
        data_inicio,
        data_fim,
        horario_inicio,
        horario_fim,
        observacoes
      )
      VALUES (1, ?, ?, NULL, ?, NULL, '')
    `,
    configuracao.id,
    dados.data,
    dados.horario
  );
}

export async function salvarDia(dados: Diario) {
  validarDataReal(dados.data);
  validarHorario(dados.horario);

  const banco = await obterBanco();

  await banco.withExclusiveTransactionAsync(async (transacao) => {
    await registrarMenstruacaoPeloDiario(transacao, dados);
    const conflito = await transacao.getFirstAsync<{ id: number }>(
      `
        SELECT id FROM registros_diarios
        WHERE perfil_id = 1 AND data = ? AND id <> ?
      `,
      dados.data,
      dados.id ?? -1
    );

    if (conflito) {
      throw new Error(
        'Já existe um registro nessa data. Abra-o pelo histórico para editar.'
      );
    }

    let id = dados.id;

    if (id !== undefined) {
      const existente = await transacao.getFirstAsync<{ id: number }>(
        'SELECT id FROM registros_diarios WHERE id = ? AND perfil_id = 1',
        id
      );

      if (!existente) {
        throw new Error('O registro não foi encontrado.');
      }

      await transacao.runAsync(
        `
          UPDATE registros_diarios
          SET data = ?, horario = ?, humor = ?,
              sangramento_fluxo = ?, sangramento_tipo = ?,
              observacoes = ?
          WHERE id = ? AND perfil_id = 1
        `,
        dados.data,
        dados.horario,
        dados.humor,
        dados.sangramento_fluxo,
        dados.sangramento_fluxo === 'nenhum'
          ? 'nao_informado'
          : dados.sangramento_tipo,
        dados.observacoes,
        id
      );
    } else {
      const resultado = await transacao.runAsync(
        `
          INSERT INTO registros_diarios (
            perfil_id, data, horario, humor,
            sangramento_fluxo, sangramento_tipo, observacoes
          )
          VALUES (1, ?, ?, ?, ?, ?, ?)
        `,
        dados.data,
        dados.horario,
        dados.humor,
        dados.sangramento_fluxo,
        dados.sangramento_fluxo === 'nenhum'
          ? 'nao_informado'
          : dados.sangramento_tipo,
        dados.observacoes
      );

      id = resultado.lastInsertRowId;
    }

    await transacao.runAsync(
      'DELETE FROM sintomas_registrados WHERE registro_diario_id = ?',
      id
    );

    for (const sintoma of new Set(dados.sintomas)) {
      await transacao.runAsync(
        `
          INSERT INTO sintomas_registrados (
            registro_diario_id, descricao
          )
          VALUES (?, ?)
        `,
        id,
        sintoma
      );
    }

    // O conjunto de ações deste diário é substituído atomicamente.
    await transacao.runAsync(
      'DELETE FROM acoes_realizadas WHERE registro_diario_id = ?',
      id
    );

    const previsoesUsadas = new Set<string>();

    for (const acao of dados.acoes) {
      validarHorario(acao.horario_real);

      const configuracao =
        await transacao.getFirstAsync<ConfiguracaoSalva>(
          `
            SELECT * FROM configuracoes
            WHERE id = ? AND perfil_id = 1
          `,
          acao.configuracao_id
        );

      if (
        !configuracao ||
        configuracao.modo !== 'anticoncepcional'
      ) {
        throw new Error('A ação não possui um regime válido.');
      }

      if (acao.data_prevista) {
        validarData(acao.data_prevista);

        if (
          acao.data_prevista < configuracao.vigente_desde ||
          (
            configuracao.vigente_ate !== null &&
            acao.data_prevista >= configuracao.vigente_ate
          )
        ) {
          throw new Error(
            'A data prevista está fora da vigência desse regime.'
          );
        }

        const dia = calcularDia(
          configuracaoParaRegime(configuracao),
          acao.data_prevista
        );

        if (dia.situacao !== 'acao_prevista') {
          throw new Error(
            'Não existe uma ação prevista nesse dia. ' +
            'Corrija a data prevista ou deixe esse campo vazio.'
          );
        }

        const chave =
          `${acao.configuracao_id}:${acao.data_prevista}`;

        if (previsoesUsadas.has(chave)) {
          throw new Error('Uma previsão foi selecionada duas vezes.');
        }

        previsoesUsadas.add(chave);

        const outraConfirmacao =
          await transacao.getFirstAsync<{ id: number }>(
            `
              SELECT id FROM acoes_realizadas
              WHERE configuracao_id = ? AND data_prevista = ?
            `,
            acao.configuracao_id,
            acao.data_prevista
          );

        if (outraConfirmacao) {
          throw new Error(
            'Essa ação prevista já foi confirmada em outro registro.'
          );
        }
      }

      await transacao.runAsync(
        `
          INSERT INTO acoes_realizadas (
            registro_diario_id, configuracao_id,
            horario_real, data_prevista
          )
          VALUES (?, ?, ?, ?)
        `,
        id,
        acao.configuracao_id,
        acao.horario_real,
        acao.data_prevista
      );
    }
  });
}

export async function listarDiarios() {
  const banco = await obterBanco();

  return banco.getAllAsync<{
    id: number;
    data: string;
    horario: string | null;
    humor: string | null;
    sangramento_fluxo: string;
    observacoes: string;
  }>(
    `
      SELECT *
      FROM registros_diarios
      WHERE perfil_id = 1
      ORDER BY data DESC
    `
  );
}

export async function excluirDia(id: number) {
  const banco = await obterBanco();

  await banco.runAsync(
    'DELETE FROM registros_diarios WHERE id = ? AND perfil_id = 1',
    id
  );
}

export async function listarPeriodos() {
  const banco = await obterBanco();

  return banco.getAllAsync<PeriodoMenstrual>(
    `
      SELECT *
      FROM menstruacoes
      WHERE perfil_id = 1
      ORDER BY data_inicio DESC
    `
  );
}

export async function carregarPeriodo(id: number) {
  const banco = await obterBanco();

  return banco.getFirstAsync<PeriodoMenstrual>(
    'SELECT * FROM menstruacoes WHERE id = ? AND perfil_id = 1',
    id
  );
}

export async function salvarPeriodo(dados: PeriodoMenstrual) {
  validarDataReal(dados.data_inicio);

  if (dados.horario_inicio) {
    validarHorario(dados.horario_inicio);
  }

  if (dados.data_fim) {
    validarDataReal(dados.data_fim);

    if (dados.data_fim < dados.data_inicio) {
      throw new Error('O fim não pode ser anterior ao início.');
    }

    if (dados.horario_fim) {
      validarHorario(dados.horario_fim);
    }

    if (
      dados.data_inicio === dados.data_fim &&
      dados.horario_inicio &&
      dados.horario_fim &&
      dados.horario_fim < dados.horario_inicio
    ) {
      throw new Error('O horário final é anterior ao inicial.');
    }
  } else if (dados.horario_fim) {
    throw new Error('Informe a data de fim ou apague o horário final.');
  }

  const banco = await obterBanco();

  await banco.withExclusiveTransactionAsync(async (transacao) => {
    const configuracao =
      await transacao.getFirstAsync<ConfiguracaoSalva>(
        `
          SELECT * FROM configuracoes
          WHERE perfil_id = 1
            AND vigente_desde <= ?
            AND (vigente_ate IS NULL OR ? < vigente_ate)
          ORDER BY vigente_desde DESC
          LIMIT 1
        `,
        dados.data_inicio,
        dados.data_inicio
      );

    if (!configuracao || configuracao.modo !== 'menstrual') {
      throw new Error(
        'O início precisa estar em uma data de acompanhamento menstrual.'
      );
    }

    if (dados.id !== undefined) {
      const existente = await transacao.getFirstAsync<{ id: number }>(
        'SELECT id FROM menstruacoes WHERE id = ? AND perfil_id = 1',
        dados.id
      );

      if (!existente) {
        throw new Error('A menstruação não foi encontrada.');
      }
    }

    const conflito = await transacao.getFirstAsync<{ id: number }>(
      `
        SELECT id FROM menstruacoes
        WHERE perfil_id = 1
          AND id <> ?
          AND data_inicio <= ?
          AND COALESCE(data_fim, '9999-12-31') >= ?
        LIMIT 1
      `,
      dados.id ?? -1,
      dados.data_fim ?? '9999-12-31',
      dados.data_inicio
    );

    if (conflito) {
      throw new Error(
        'O período coincide com outra menstruação. ' +
        'Confira também se existe uma menstruação sem data de fim.'
      );
    }

    if (dados.id !== undefined) {
      await transacao.runAsync(
        `
          UPDATE menstruacoes
          SET configuracao_id = ?, data_inicio = ?, data_fim = ?,
              horario_inicio = ?, horario_fim = ?, observacoes = ?
          WHERE id = ? AND perfil_id = 1
        `,
        configuracao.id,
        dados.data_inicio,
        dados.data_fim,
        dados.horario_inicio,
        dados.horario_fim,
        dados.observacoes,
        dados.id
      );
    } else {
      await transacao.runAsync(
        `
          INSERT INTO menstruacoes (
            perfil_id, configuracao_id, data_inicio, data_fim,
            horario_inicio, horario_fim, observacoes
          )
          VALUES (1, ?, ?, ?, ?, ?, ?)
        `,
        configuracao.id,
        dados.data_inicio,
        dados.data_fim,
        dados.horario_inicio,
        dados.horario_fim,
        dados.observacoes
      );
    }
  });
}

export async function excluirPeriodo(id: number) {
  const banco = await obterBanco();

  await banco.runAsync(
    'DELETE FROM menstruacoes WHERE id = ? AND perfil_id = 1',
    id
  );
}
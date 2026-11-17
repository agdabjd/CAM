import { obterBanco } from './database';

export type NovaConfiguracao =
  | {
      modo: 'anticoncepcional';
      vigenteDesde: string;
      dataReferencia: string;
      metodo: string;
      acao: string;
      intervaloDias: number;
      horario: string;
      pausa:
        | { tipo: 'nenhuma' }
        | {
            tipo: 'dias' | 'acoes';
            apos: number;
            duracaoDias: number;
          };
    }
  | {
      modo: 'menstrual';
      vigenteDesde: string;
      dataReferencia: string;
      duracaoCicloDias: number;
      duracaoMenstruacaoDias: number;
    };

export type ConfiguracaoSalva = {
  id: number;
  modo: 'anticoncepcional' | 'menstrual';
  vigente_desde: string;
  vigente_ate: string | null;
  data_referencia: string;
  metodo: string | null;
  acao: string | null;
  intervalo_dias: number | null;
  horario: string | null;
  pausa_tipo: 'nenhuma' | 'dias' | 'acoes';
  pausa_apos: number | null;
  pausa_duracao_dias: number | null;
  duracao_ciclo_dias: number | null;
  duracao_menstruacao_dias: number | null;
};

export async function buscarConfiguracaoDaData(data: string) {
  const banco = await obterBanco();

  return banco.getFirstAsync<ConfiguracaoSalva>(
    `
      SELECT *
      FROM configuracoes
      WHERE perfil_id = 1
        AND vigente_desde <= ?
        AND (vigente_ate IS NULL OR ? < vigente_ate)
      ORDER BY vigente_desde DESC
      LIMIT 1
    `,
    data,
    data
  );
}

export async function criarVersaoConfiguracao(
  dados: NovaConfiguracao
) {
  const banco = await obterBanco();
  let novoId = 0;

  await banco.withExclusiveTransactionAsync(async (transacao) => {
    const ultima = await transacao.getFirstAsync<{
      id: number;
      vigente_desde: string;
    }>(
      `
        SELECT id, vigente_desde
        FROM configuracoes
        WHERE perfil_id = 1
        ORDER BY vigente_desde DESC
        LIMIT 1
      `
    );

    if (ultima && dados.vigenteDesde <= ultima.vigente_desde) {
      throw new Error(
        'A nova configuração deve começar depois da última configuração.'
      );
    }

    if (ultima) {
      await transacao.runAsync(
        'UPDATE configuracoes SET vigente_ate = ? WHERE id = ?',
        dados.vigenteDesde,
        ultima.id
      );
    }

    const anticoncepcional =
      dados.modo === 'anticoncepcional' ? dados : null;

    const menstrual = dados.modo === 'menstrual' ? dados : null;

    const pausa = anticoncepcional?.pausa;

    const resultado = await transacao.runAsync(
      `
        INSERT INTO configuracoes (
          perfil_id, modo, vigente_desde, data_referencia,
          metodo, acao, intervalo_dias, horario,
          pausa_tipo, pausa_apos, pausa_duracao_dias,
          duracao_ciclo_dias, duracao_menstruacao_dias
        )
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      dados.modo,
      dados.vigenteDesde,
      dados.dataReferencia,
      anticoncepcional?.metodo ?? null,
      anticoncepcional?.acao ?? null,
      anticoncepcional?.intervaloDias ?? null,
      anticoncepcional?.horario ?? null,
      pausa?.tipo ?? 'nenhuma',
      pausa && pausa.tipo !== 'nenhuma' ? pausa.apos : null,
      pausa && pausa.tipo !== 'nenhuma' ? pausa.duracaoDias : null,
      menstrual?.duracaoCicloDias ?? null,
      menstrual?.duracaoMenstruacaoDias ?? null
    );

    novoId = resultado.lastInsertRowId;
  });

  return novoId;
}

export async function obterOuCriarRegistroDiario(data: string) {
  const banco = await obterBanco();

  await banco.runAsync(
    `
      INSERT INTO registros_diarios (perfil_id, data)
      VALUES (1, ?)
      ON CONFLICT(perfil_id, data) DO NOTHING
    `,
    data
  );

  const registro = await banco.getFirstAsync<{ id: number }>(
    `
      SELECT id
      FROM registros_diarios
      WHERE perfil_id = 1 AND data = ?
    `,
    data
  );

  if (!registro) {
    throw new Error('Não foi possível obter o registro diário.');
  }

  return registro.id;
}

export async function listarRegistrosDiarios() {
  const banco = await obterBanco();

  return banco.getAllAsync<{
    id: number;
    data: string;
    humor: string | null;
    sangramento_fluxo: string;
    sangramento_tipo: string;
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
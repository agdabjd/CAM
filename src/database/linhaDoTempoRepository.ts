import { obterBanco } from './database';
import type { ConfiguracaoSalva } from './acompanhamentoRepository';

export type DiarioLinhaDoTempo = {
  id: number;
  data: string;
  horario: string | null;
  humor: string | null;
  sangramento_fluxo: string;
  sangramento_tipo: string;
  observacoes: string;
};

export type AcaoLinhaDoTempo = {
  id: number;
  registro_diario_id: number;
  configuracao_id: number;
  data_real: string;
  horario_real: string;
  data_prevista: string | null;
  acao: string;
  metodo: string;
};

export type MenstruacaoLinhaDoTempo = {
  id: number;
  data_inicio: string;
  data_fim: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  observacoes: string;
};

export type DadosLinhaDoTempo = {
  configuracoes: ConfiguracaoSalva[];
  diarios: DiarioLinhaDoTempo[];
  sintomas: {
    registro_diario_id: number;
    descricao: string;
  }[];
  acoes: AcaoLinhaDoTempo[];
  menstruacoes: MenstruacaoLinhaDoTempo[];
};

export async function carregarLinhaDoTempo() {
  const banco = await obterBanco();

  let dados: DadosLinhaDoTempo | null = null;

  // As consultas leem um conjunto consistente de dados.
  await banco.withExclusiveTransactionAsync(async (transacao) => {
    const configuracoes =
      await transacao.getAllAsync<ConfiguracaoSalva>(
        `
          SELECT *
          FROM configuracoes
          WHERE perfil_id = 1
          ORDER BY vigente_desde DESC
        `
      );

    const diarios =
      await transacao.getAllAsync<DiarioLinhaDoTempo>(
        `
          SELECT *
          FROM registros_diarios
          WHERE perfil_id = 1
          ORDER BY data DESC
        `
      );

    const sintomas = await transacao.getAllAsync<{
      registro_diario_id: number;
      descricao: string;
    }>(
      `
        SELECT s.registro_diario_id, s.descricao
        FROM sintomas_registrados s
        JOIN registros_diarios r ON r.id = s.registro_diario_id
        WHERE r.perfil_id = 1
        ORDER BY s.id
      `
    );

    const acoes =
      await transacao.getAllAsync<AcaoLinhaDoTempo>(
        `
          SELECT
            a.id,
            a.registro_diario_id,
            a.configuracao_id,
            r.data AS data_real,
            a.horario_real,
            a.data_prevista,
            c.acao,
            c.metodo
          FROM acoes_realizadas a
          JOIN registros_diarios r
            ON r.id = a.registro_diario_id
          JOIN configuracoes c
            ON c.id = a.configuracao_id
          WHERE r.perfil_id = 1 AND c.perfil_id = 1
          ORDER BY r.data DESC, a.horario_real
        `
      );

    const menstruacoes =
      await transacao.getAllAsync<MenstruacaoLinhaDoTempo>(
        `
          SELECT *
          FROM menstruacoes
          WHERE perfil_id = 1
          ORDER BY data_inicio DESC
        `
      );

    dados = {
      configuracoes,
      diarios,
      sintomas,
      acoes,
      menstruacoes,
    };
  });

  if (!dados) {
    throw new Error('Não foi possível carregar os acontecimentos.');
  }

  return dados as DadosLinhaDoTempo;
}
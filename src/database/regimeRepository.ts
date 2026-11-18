import { obterBanco } from './database';

import {
  buscarConfiguracaoDaData,
  type ConfiguracaoSalva,
} from './acompanhamentoRepository';

import {
  calcularDia,
  proximaAcao,
} from '../domain/contraceptivo/regime';

import { configuracaoParaRegime } from '../domain/contraceptivo/configuracaoParaRegime';

export async function buscarSituacaoAnticoncepcional(data: string) {
  const configuracao = await buscarConfiguracaoDaData(data);

  if (!configuracao || configuracao.modo !== 'anticoncepcional') {
    return null;
  }

  const regime = configuracaoParaRegime(configuracao);

  return {
    configuracaoId: configuracao.id,
    metodo: configuracao.metodo,
    acao: configuracao.acao,
    ...calcularDia(regime, data),
  };
}

export async function buscarProximaAcaoPrevista(
  aPartirDe: string
) {
  const banco = await obterBanco();

  const configuracoes = await banco.getAllAsync<ConfiguracaoSalva>(
    `
      SELECT *
      FROM configuracoes
      WHERE perfil_id = 1
        AND (vigente_ate IS NULL OR vigente_ate > ?)
      ORDER BY vigente_desde ASC
    `,
    aPartirDe
  );

  for (const configuracao of configuracoes) {
    if (configuracao.modo !== 'anticoncepcional') {
      continue;
    }

    const inicioBusca =
      aPartirDe > configuracao.vigente_desde
        ? aPartirDe
        : configuracao.vigente_desde;

    const prevista = proximaAcao(
      configuracaoParaRegime(configuracao),
      inicioBusca
    );

    if (
      configuracao.vigente_ate !== null &&
      prevista.data >= configuracao.vigente_ate
    ) {
      continue;
    }

    return {
      configuracaoId: configuracao.id,
      metodo: configuracao.metodo,
      acao: configuracao.acao,
      ...prevista,
    };
  }

  return null;
}
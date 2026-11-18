import { obterBanco } from './database';

import {
  buscarConfiguracaoDaData,
  type ConfiguracaoSalva,
} from './acompanhamentoRepository';

import {
  calcularDiaMenstrual,
  proximoInicioPrevisto,
} from '../domain/menstrual/cicloMenstrual';

import { configuracaoParaCiclo } from '../domain/menstrual/configuracaoParaCiclo';

export async function buscarDiaMenstrual(data: string) {
  const configuracao = await buscarConfiguracaoDaData(data);

  if (!configuracao || configuracao.modo !== 'menstrual') {
    return null;
  }

  return {
    configuracaoId: configuracao.id,
    ...calcularDiaMenstrual(
      configuracaoParaCiclo(configuracao),
      data
    ),
  };
}

export async function buscarProximaMenstruacaoPrevista(
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
    if (configuracao.modo !== 'menstrual') {
      continue;
    }

    const inicioBusca =
      aPartirDe > configuracao.vigente_desde
        ? aPartirDe
        : configuracao.vigente_desde;

    const inicio = proximoInicioPrevisto(
      configuracaoParaCiclo(configuracao),
      inicioBusca
    );

    if (
      configuracao.vigente_ate !== null &&
      inicio >= configuracao.vigente_ate
    ) {
      continue;
    }

    return {
      configuracaoId: configuracao.id,
      dataInicio: inicio,
    };
  }

  return null;
}
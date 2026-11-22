import { obterBanco } from './database';

import {
  buscarConfiguracaoDaData,
  type ConfiguracaoSalva,
} from './acompanhamentoRepository';

import { listarMenstruacoes } from './menstrualRepository';

import {
  calcularDiaMenstrual,
  proximoInicioPrevisto,
} from '../domain/menstrual/cicloMenstrual';

import { cicloComRegistros } from '../domain/menstrual/cicloComRegistros';

export async function buscarDiaMenstrual(data: string) {
  const configuracao = await buscarConfiguracaoDaData(data);

  if (!configuracao || configuracao.modo !== 'menstrual') {
    return null;
  }

  const menstruacoes = await listarMenstruacoes();

  const ciclo = cicloComRegistros(
    configuracao,
    menstruacoes,
    data
  );

  return {
    configuracaoId: configuracao.id,
    ...calcularDiaMenstrual(ciclo, data),
  };
}

export async function buscarProximaMenstruacaoPrevista(
  aPartirDe: string
) {
  const banco = await obterBanco();
  const menstruacoes = await listarMenstruacoes();

  const configuracoes =
    await banco.getAllAsync<ConfiguracaoSalva>(
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

    const ciclo = cicloComRegistros(
      configuracao,
      menstruacoes,
      inicioBusca
    );

    const inicio = proximoInicioPrevisto(
      ciclo,
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
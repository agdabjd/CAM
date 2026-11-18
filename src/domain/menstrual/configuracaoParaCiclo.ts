import type { ConfiguracaoSalva } from '../../database/acompanhamentoRepository';

import {
  validarCiclo,
  type CicloMenstrual,
} from './cicloMenstrual';

export function configuracaoParaCiclo(
  configuracao: ConfiguracaoSalva
): CicloMenstrual {
  if (configuracao.modo !== 'menstrual') {
    throw new Error('Esta configuração não é menstrual.');
  }

  if (
    configuracao.duracao_ciclo_dias === null ||
    configuracao.duracao_menstruacao_dias === null
  ) {
    throw new Error('A configuração menstrual está incompleta.');
  }

  const ciclo: CicloMenstrual = {
    dataReferencia: configuracao.data_referencia,
    duracaoCicloDias: configuracao.duracao_ciclo_dias,
    duracaoMenstruacaoDias:
      configuracao.duracao_menstruacao_dias,
  };

  validarCiclo(ciclo);

  return ciclo;
}
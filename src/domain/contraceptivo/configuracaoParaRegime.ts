import type { ConfiguracaoSalva } from '../../database/acompanhamentoRepository';
import type { Pausa, Regime } from './regime';

export function configuracaoParaRegime(
  configuracao: ConfiguracaoSalva
): Regime {
  if (configuracao.modo !== 'anticoncepcional') {
    throw new Error('Esta configuração pertence ao modo menstrual.');
  }

  if (
    configuracao.intervalo_dias === null ||
    configuracao.horario === null
  ) {
    throw new Error('A configuração anticoncepcional está incompleta.');
  }

  let pausa: Pausa;

  if (configuracao.pausa_tipo === 'nenhuma') {
    pausa = { tipo: 'nenhuma' };
  } else {
    if (
      configuracao.pausa_apos === null ||
      configuracao.pausa_duracao_dias === null
    ) {
      throw new Error('A configuração da pausa está incompleta.');
    }

    pausa = {
      tipo: configuracao.pausa_tipo,
      apos: configuracao.pausa_apos,
      duracaoDias: configuracao.pausa_duracao_dias,
    };
  }

  return {
    dataReferencia: configuracao.data_referencia,
    intervaloDias: configuracao.intervalo_dias,
    horario: configuracao.horario,
    pausa,
  };
}
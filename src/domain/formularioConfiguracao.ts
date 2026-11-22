import type { ConfiguracaoSalva } from '../database/acompanhamentoRepository';

import {
  FORM_INICIAL,
  formatarData,
  type Formulario,
} from './onboarding';

export function formularioDaConfiguracao(
  configuracao: ConfiguracaoSalva
): Formulario {
  const conhecidos = [
    'Pílula',
    'Injeção',
    'Adesivo',
    'Anel vaginal',
  ];

  const metodoConhecido = conhecidos.includes(
    configuracao.metodo ?? ''
  );

  return {
    ...FORM_INICIAL,
    modo: configuracao.modo,
    metodo:
      configuracao.modo === 'anticoncepcional'
        ? metodoConhecido
          ? configuracao.metodo ?? ''
          : 'Outro'
        : '',
    outroMetodo:
      metodoConhecido ? '' : configuracao.metodo ?? '',
    acao: configuracao.acao ?? '',
    dataReferencia: formatarData(configuracao.data_referencia),
    horario: configuracao.horario ?? '',
    intervaloDias:
      configuracao.intervalo_dias?.toString() ?? '',
    pausaTipo: configuracao.pausa_tipo,
    pausaApos:
      configuracao.pausa_apos?.toString() ?? '',
    pausaDuracao:
      configuracao.pausa_duracao_dias?.toString() ?? '',
    duracaoCiclo:
      configuracao.duracao_ciclo_dias?.toString() ?? '',
    duracaoMenstruacao:
      configuracao.duracao_menstruacao_dias?.toString() ?? '',
  };
}
import type { ConfiguracaoSalva } from '../../database/acompanhamentoRepository';

import { hojeLocal, validarData } from '../datas';
import { configuracaoParaCiclo } from './configuracaoParaCiclo';

type MenstruacaoRegistrada = {
  data_inicio: string;
};

export function cicloComRegistros(
  configuracao: ConfiguracaoSalva,
  menstruacoes: MenstruacaoRegistrada[],
  dataConsulta: string
) {
  validarData(dataConsulta);

  const ciclo = configuracaoParaCiclo(configuracao);

  const hoje = hojeLocal();

  // Um acontecimento realizado não pode estar no futuro.
  const limite = dataConsulta < hoje ? dataConsulta : hoje;

  const ultimaMenstruacao = menstruacoes
    .filter(
      (periodo) =>
        periodo.data_inicio >= ciclo.dataReferencia &&
        periodo.data_inicio <= limite
    )
    .sort((a, b) =>
      b.data_inicio.localeCompare(a.data_inicio)
    )[0];

  return {
    ...ciclo,
    dataReferencia:
      ultimaMenstruacao?.data_inicio ??
      ciclo.dataReferencia,
  };
}
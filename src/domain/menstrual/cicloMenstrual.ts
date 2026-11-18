import {
  diferencaDias,
  somarDias,
  validarData,
} from '../datas';

export type CicloMenstrual = {
  dataReferencia: string;
  duracaoCicloDias: number;
  duracaoMenstruacaoDias: number;
};

export function validarCiclo(ciclo: CicloMenstrual) {
  validarData(ciclo.dataReferencia);

  if (
    !Number.isSafeInteger(ciclo.duracaoCicloDias) ||
    ciclo.duracaoCicloDias <= 0
  ) {
    throw new Error('A duração do ciclo deve ser um inteiro positivo.');
  }

  if (
    !Number.isSafeInteger(ciclo.duracaoMenstruacaoDias) ||
    ciclo.duracaoMenstruacaoDias <= 0
  ) {
    throw new Error(
      'A duração da menstruação deve ser um inteiro positivo.'
    );
  }

  if (ciclo.duracaoMenstruacaoDias > ciclo.duracaoCicloDias) {
    throw new Error(
      'A duração da menstruação não pode superar a duração do ciclo.'
    );
  }
}

export function calcularDiaMenstrual(
  ciclo: CicloMenstrual,
  data: string
) {
  validarCiclo(ciclo);

  const deslocamento = diferencaDias(
    ciclo.dataReferencia,
    data
  );

  if (deslocamento < 0) {
    return {
      data,
      situacao: 'antes_inicio' as const,
      diaDoCicloEstimado: null,
      diaDaMenstruacaoPrevista: null,
    };
  }

  const posicao = deslocamento % ciclo.duracaoCicloDias;

  const menstruacaoPrevista =
    posicao < ciclo.duracaoMenstruacaoDias;

  return {
    data,
    situacao: menstruacaoPrevista
      ? ('menstruacao_prevista' as const)
      : ('fora_da_menstruacao_prevista' as const),
    diaDoCicloEstimado: posicao + 1,
    diaDaMenstruacaoPrevista:
      menstruacaoPrevista ? posicao + 1 : null,
  };
}

// Retorna o próximo início na data consultada ou depois dela.
export function proximoInicioPrevisto(
  ciclo: CicloMenstrual,
  aPartirDe: string
) {
  validarCiclo(ciclo);

  const deslocamento = diferencaDias(
    ciclo.dataReferencia,
    aPartirDe
  );

  const numeroDoCiclo =
    deslocamento <= 0
      ? 0
      : Math.ceil(deslocamento / ciclo.duracaoCicloDias);

  return somarDias(
    ciclo.dataReferencia,
    numeroDoCiclo * ciclo.duracaoCicloDias
  );
}

// Se a data estiver dentro de um período previsto,
// retorna esse período. Caso contrário, retorna o próximo.
export function periodoPrevistoAtualOuProximo(
  ciclo: CicloMenstrual,
  data: string
) {
  validarCiclo(ciclo);

  const deslocamento = diferencaDias(
    ciclo.dataReferencia,
    data
  );

  let numeroDoCiclo = 0;

  if (deslocamento >= 0) {
    numeroDoCiclo = Math.floor(
      deslocamento / ciclo.duracaoCicloDias
    );

    const posicao = deslocamento % ciclo.duracaoCicloDias;

    if (posicao >= ciclo.duracaoMenstruacaoDias) {
      numeroDoCiclo++;
    }
  }

  const inicio = somarDias(
    ciclo.dataReferencia,
    numeroDoCiclo * ciclo.duracaoCicloDias
  );

  const fim = somarDias(
    inicio,
    ciclo.duracaoMenstruacaoDias - 1
  );

  return {
    inicio,
    fim,
    emAndamento:
      deslocamento >= 0 &&
      data >= inicio &&
      data <= fim,
  };
}

export function calcularDuracaoMenstruacao(
  dataInicio: string,
  dataFim: string
) {
  const diferenca = diferencaDias(dataInicio, dataFim);

  if (diferenca < 0) {
    throw new Error('O fim não pode ser anterior ao início.');
  }

  return diferenca + 1;
}
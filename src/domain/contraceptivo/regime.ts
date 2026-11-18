export type Pausa =
  | { tipo: 'nenhuma' }
  | {
      tipo: 'dias' | 'acoes';
      apos: number;
      duracaoDias: number;
    };

export type Regime = {
  dataReferencia: string;
  intervaloDias: number;
  horario: string;
  pausa: Pausa;
};

export type SituacaoDia = {
  data: string;
  situacao:
    | 'antes_inicio'
    | 'acao_prevista'
    | 'uso_em_andamento'
    | 'pausa';
  numeroPeriodo: number | null;
  diaDeUso: number | null;
  diaDePausa: number | null;
};

const MILISSEGUNDOS_POR_DIA = 86_400_000;

// UTC é usado apenas para fazer contas entre dias.
// As entradas e saídas continuam sendo datas locais AAAA-MM-DD.
function numeroDoDia(data: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error('Use uma data no formato AAAA-MM-DD.');
  }

  const [ano, mes, dia] = data.split('-').map(Number);

  const valor = new Date(0);
  valor.setUTCHours(0, 0, 0, 0);
  valor.setUTCFullYear(ano, mes - 1, dia);

  if (
    valor.getUTCFullYear() !== ano ||
    valor.getUTCMonth() !== mes - 1 ||
    valor.getUTCDate() !== dia
  ) {
    throw new Error('Data inválida.');
  }

  return valor.getTime() / MILISSEGUNDOS_POR_DIA;
}

function dataDoNumero(numero: number): string {
  const valor = new Date(numero * MILISSEGUNDOS_POR_DIA);

  if (
    Number.isNaN(valor.getTime()) ||
    valor.getUTCFullYear() < 0 ||
    valor.getUTCFullYear() > 9999
  ) {
    throw new Error('A data calculada está fora do intervalo suportado.');
  }

  return valor.toISOString().slice(0, 10);
}

export function somarDias(data: string, quantidade: number): string {
  if (!Number.isSafeInteger(quantidade)) {
    throw new Error('A quantidade de dias deve ser inteira.');
  }

  return dataDoNumero(numeroDoDia(data) + quantidade);
}

function validarInteiroPositivo(valor: number, nome: string) {
  if (!Number.isSafeInteger(valor) || valor <= 0) {
    throw new Error(`${nome} deve ser um número inteiro positivo.`);
  }
}

function preparar(regime: Regime) {
  const referencia = numeroDoDia(regime.dataReferencia);

  validarInteiroPositivo(
    regime.intervaloDias,
    'O intervalo entre ações'
  );

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(regime.horario)) {
    throw new Error('Informe um horário válido no formato HH:mm.');
  }

  if (regime.pausa.tipo === 'nenhuma') {
    return {
      referencia,
      diasDeUso: Infinity,
      diasDePausa: 0,
      tamanhoPeriodo: Infinity,
    };
  }

  validarInteiroPositivo(regime.pausa.apos, 'A quantidade até a pausa');
  validarInteiroPositivo(
    regime.pausa.duracaoDias,
    'A duração da pausa'
  );

  const diasDeUso =
    regime.pausa.tipo === 'dias'
      ? regime.pausa.apos
      : regime.pausa.apos * regime.intervaloDias;

  const tamanhoPeriodo = diasDeUso + regime.pausa.duracaoDias;

  if (
    !Number.isSafeInteger(diasDeUso) ||
    !Number.isSafeInteger(tamanhoPeriodo)
  ) {
    throw new Error('Os valores do regime são muito grandes.');
  }

  return {
    referencia,
    diasDeUso,
    diasDePausa: regime.pausa.duracaoDias,
    tamanhoPeriodo,
  };
}

export function calcularDia(
  regime: Regime,
  data: string
): SituacaoDia {
  const plano = preparar(regime);
  const deslocamento = numeroDoDia(data) - plano.referencia;

  if (deslocamento < 0) {
    return {
      data,
      situacao: 'antes_inicio',
      numeroPeriodo: null,
      diaDeUso: null,
      diaDePausa: null,
    };
  }

  const posicao =
    plano.tamanhoPeriodo === Infinity
      ? deslocamento
      : deslocamento % plano.tamanhoPeriodo;

  const numeroPeriodo =
    plano.tamanhoPeriodo === Infinity
      ? 1
      : Math.floor(deslocamento / plano.tamanhoPeriodo) + 1;

  if (posicao >= plano.diasDeUso) {
    return {
      data,
      situacao: 'pausa',
      numeroPeriodo,
      diaDeUso: null,
      diaDePausa: posicao - plano.diasDeUso + 1,
    };
  }

  return {
    data,
    situacao:
      posicao % regime.intervaloDias === 0
        ? 'acao_prevista'
        : 'uso_em_andamento',
    numeroPeriodo,
    diaDeUso: posicao + 1,
    diaDePausa: null,
  };
}

export function proximaAcao(
  regime: Regime,
  aPartirDe: string,
  incluirDia = true
): { data: string; horario: string } {
  const plano = preparar(regime);

  const inicioBusca = numeroDoDia(aPartirDe) + (incluirDia ? 0 : 1);
  const deslocamento = Math.max(
    0,
    inicioBusca - plano.referencia
  );

  const inicioPeriodo =
    plano.tamanhoPeriodo === Infinity
      ? 0
      : Math.floor(
          deslocamento / plano.tamanhoPeriodo
        ) * plano.tamanhoPeriodo;

  const posicao = deslocamento - inicioPeriodo;

  let proximoDeslocamento: number;

  if (posicao >= plano.diasDeUso) {
    proximoDeslocamento = inicioPeriodo + plano.tamanhoPeriodo;
  } else {
    const proximaPosicao =
      Math.ceil(posicao / regime.intervaloDias) *
      regime.intervaloDias;

    proximoDeslocamento =
      proximaPosicao < plano.diasDeUso
        ? inicioPeriodo + proximaPosicao
        : inicioPeriodo + plano.tamanhoPeriodo;
  }

  return {
    data: dataDoNumero(plano.referencia + proximoDeslocamento),
    horario: regime.horario,
  };
}

export function pausaAtualOuProxima(
  regime: Regime,
  data: string
) {
  const plano = preparar(regime);

  if (regime.pausa.tipo === 'nenhuma') {
    return null;
  }

  const deslocamento = numeroDoDia(data) - plano.referencia;
  const deslocamentoBusca = Math.max(0, deslocamento);

  const inicioPeriodo =
    Math.floor(
      deslocamentoBusca / plano.tamanhoPeriodo
    ) * plano.tamanhoPeriodo;

  const inicioPausa =
    plano.referencia + inicioPeriodo + plano.diasDeUso;

  return {
    inicio: dataDoNumero(inicioPausa),
    fim: dataDoNumero(
      inicioPausa + plano.diasDePausa - 1
    ),
    retomada: dataDoNumero(
      inicioPausa + plano.diasDePausa
    ),
    emAndamento:
      deslocamento >= 0 &&
      deslocamento - inicioPeriodo >= plano.diasDeUso,
  };
}

export function proximasAcoes(
  regime: Regime,
  aPartirDe: string,
  quantidade = 5
) {
  validarInteiroPositivo(quantidade, 'A quantidade de ações');

  const resultado: Array<{ data: string; horario: string }> = [];
  let dataBusca = aPartirDe;

  for (let i = 0; i < quantidade; i++) {
    const acao = proximaAcao(regime, dataBusca);

    resultado.push(acao);
    dataBusca = somarDias(acao.data, 1);
  }

  return resultado;
}
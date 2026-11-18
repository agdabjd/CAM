const MILISSEGUNDOS_POR_DIA = 86_400_000;

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

export function validarData(data: string) {
  numeroDoDia(data);
}

export function diferencaDias(
  dataInicial: string,
  dataFinal: string
) {
  return numeroDoDia(dataFinal) - numeroDoDia(dataInicial);
}

export function somarDias(data: string, quantidade: number) {
  if (!Number.isSafeInteger(quantidade)) {
    throw new Error('A quantidade de dias deve ser inteira.');
  }

  const valor = new Date(
    (numeroDoDia(data) + quantidade) * MILISSEGUNDOS_POR_DIA
  );

  if (
    Number.isNaN(valor.getTime()) ||
    valor.getUTCFullYear() < 0 ||
    valor.getUTCFullYear() > 9999
  ) {
    throw new Error('A data calculada está fora do intervalo suportado.');
  }

  return valor.toISOString().slice(0, 10);
}

export function hojeLocal() {
  const agora = new Date();

  const ano = String(agora.getFullYear()).padStart(4, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}
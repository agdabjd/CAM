import type { NovaConfiguracao } from '../database/acompanhamentoRepository';

import { hojeLocal, validarData } from './datas';
import { calcularDia } from './contraceptivo/regime';
import { validarCiclo } from './menstrual/cicloMenstrual';

export const FORM_INICIAL = {
  modo: '',
  metodo: '',
  outroMetodo: '',
  acao: '',
  dataReferencia: '',
  horario: '',
  intervaloDias: '',
  pausaTipo: 'nenhuma',
  pausaApos: '',
  pausaDuracao: '',
  duracaoCiclo: '',
  duracaoMenstruacao: '',
};

export type Formulario = typeof FORM_INICIAL;

export function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function lerData(texto: string) {
  const resultado = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(
    texto.trim()
  );

  if (!resultado) {
    throw new Error('Informe a data no formato dd/mm/aaaa.');
  }

  const [, dia, mes, ano] = resultado;
  const data = `${ano}-${mes}-${dia}`;

  validarData(data);

  return data;
}

function lerNumero(texto: string, nome: string) {
  const valor = texto.trim();

  if (!/^\d+$/.test(valor)) {
    throw new Error(`${nome}: informe um número inteiro positivo.`);
  }

  const numero = Number(valor);

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new Error(`${nome}: informe um número inteiro positivo.`);
  }

  return numero;
}

export function validarMetodo(form: Formulario) {
  if (!form.metodo) {
    throw new Error('Selecione o método anticoncepcional.');
  }

  if (form.metodo === 'Outro' && !form.outroMetodo.trim()) {
    throw new Error('Informe o nome do método.');
  }

  if (!form.acao.trim()) {
    throw new Error('Informe a ação que deseja acompanhar.');
  }

  lerData(form.dataReferencia);

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.horario.trim())) {
    throw new Error('Informe o horário no formato HH:mm.');
  }
}

export function validarConfiguracaoInicial(
  dados: NovaConfiguracao
) {
  validarData(dados.dataReferencia);
  validarData(dados.vigenteDesde);

  if (dados.vigenteDesde > dados.dataReferencia) {
    throw new Error(
      'A configuração inicial deve abranger a data de referência.'
    );
  }

  if (dados.modo === 'anticoncepcional') {
    if (!dados.metodo.trim() || !dados.acao.trim()) {
      throw new Error('Informe o método e a ação.');
    }

    calcularDia(dados, dados.dataReferencia);
  } else {
    if (dados.dataReferencia > hojeLocal()) {
      throw new Error(
        'O início da última menstruação não pode ser uma data futura.'
      );
    }

    validarCiclo(dados);
  }
}

export function montarConfiguracao(
  form: Formulario
): NovaConfiguracao {
  if (
    form.modo !== 'anticoncepcional' &&
    form.modo !== 'menstrual'
  ) {
    throw new Error('Escolha o tipo de acompanhamento.');
  }

  const referencia = lerData(form.dataReferencia);
  const hoje = hojeLocal();

  // A vigência cobre o histórico informado e a data atual.
  // A referência continua sendo a âncora dos cálculos.
  const vigenteDesde = referencia < hoje ? referencia : hoje;

  let dados: NovaConfiguracao;

  if (form.modo === 'anticoncepcional') {
    validarMetodo(form);

    if (
      form.pausaTipo !== 'nenhuma' &&
      form.pausaTipo !== 'dias' &&
      form.pausaTipo !== 'acoes'
    ) {
      throw new Error('Escolha uma regra de pausa válida.');
    }

    dados = {
      modo: 'anticoncepcional',
      vigenteDesde,
      dataReferencia: referencia,
      metodo:
        form.metodo === 'Outro'
          ? form.outroMetodo.trim()
          : form.metodo,
      acao: form.acao.trim(),
      horario: form.horario.trim(),
      intervaloDias: lerNumero(
        form.intervaloDias,
        'Intervalo entre ações'
      ),
      pausa:
        form.pausaTipo === 'nenhuma'
          ? { tipo: 'nenhuma' }
          : {
              tipo: form.pausaTipo,
              apos: lerNumero(
                form.pausaApos,
                'Quantidade até a pausa'
              ),
              duracaoDias: lerNumero(
                form.pausaDuracao,
                'Duração da pausa'
              ),
            },
    };
  } else {
    dados = {
      modo: 'menstrual',
      vigenteDesde,
      dataReferencia: referencia,
      duracaoCicloDias: lerNumero(
        form.duracaoCiclo,
        'Duração habitual do ciclo'
      ),
      duracaoMenstruacaoDias: lerNumero(
        form.duracaoMenstruacao,
        'Duração habitual da menstruação'
      ),
    };
  }

  validarConfiguracaoInicial(dados);

  return dados;
}
import type { Lembrete } from '../database/lembretesRepository';

import type {
  DadosLinhaDoTempo,
} from '../database/linhaDoTempoRepository';

import { somarDias } from './datas';

import { calcularDia } from './contraceptivo/regime';
import { configuracaoParaRegime } from './contraceptivo/configuracaoParaRegime';

import { calcularDiaMenstrual } from './menstrual/cicloMenstrual';
import { cicloComRegistros } from './menstrual/cicloComRegistros';

export const DIAS_AGENDADOS = 30;

export type AvisoPlanejado = {
  id: string;
  lembreteId: number;
  titulo: string;
  mensagem: string;
  instante: number;
};

const TIPOS_ANTICONCEPCIONAIS = new Set([
  'acao',
  'inicio_pausa',
  'fim_pausa',
]);

const TIPOS_MENSTRUAIS = new Set([
  'inicio_menstruacao',
  'fim_menstruacao',
]);

export function tipoPermitidoNoModo(
  tipo: string,
  modo: string | null
) {
  if (TIPOS_ANTICONCEPCIONAIS.has(tipo)) {
    return modo === 'anticoncepcional';
  }

  if (TIPOS_MENSTRUAIS.has(tipo)) {
    return modo === 'menstrual';
  }

  return (
    tipo === 'registro' ||
    tipo === 'resumo_semanal' ||
    tipo === 'personalizado'
  );
}

function dataLocal(data: string, horario: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [hora, minuto] = horario.split(':').map(Number);

  return new Date(
    ano,
    mes - 1,
    dia,
    hora,
    minuto
  ).getTime();
}

function diaSemana(data: string) {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

export function gerarPlanoNotificacoes(
  dados: DadosLinhaDoTempo,
  lembretes: Lembrete[],
  hoje: string,
  agora: number
) {
  const plano: AvisoPlanejado[] = [];

  const fimJanela = somarDias(hoje, DIAS_AGENDADOS);

  function configuracaoDaData(data: string) {
    return dados.configuracoes.find(
      (item) =>
        item.vigente_desde <= data &&
        (
          item.vigente_ate === null ||
          data < item.vigente_ate
        )
    );
  }

  function adicionar(
    lembrete: Lembrete,
    dataAviso: string,
    horario: string,
    chave: string
  ) {
    const configuracao = configuracaoDaData(dataAviso);

    // Verifica o modo na data em que o aviso será entregue.
    if (
      !tipoPermitidoNoModo(
        lembrete.tipo,
        configuracao?.modo ?? null
      )
    ) {
      return;
    }

    const instante = dataLocal(dataAviso, horario);

    if (
      !Number.isFinite(instante) ||
      instante <= agora
    ) {
      return;
    }

    plano.push({
      id: `oiutero:${lembrete.id}:${chave}`,
      lembreteId: lembrete.id,
      titulo: lembrete.titulo,
      mensagem: lembrete.mensagem,
      instante,
    });
  }

  function adicionarAvisoAntecipado(
    lembrete: Lembrete,
    dataEvento: string
  ) {
    const dataAviso = somarDias(
      dataEvento,
      -lembrete.antecedencia_dias
    );

    if (dataAviso < hoje || dataAviso >= fimJanela) {
      return;
    }

    adicionar(
      lembrete,
      dataAviso,
      lembrete.horario ?? '08:00',
      dataEvento
    );
  }

  for (const lembrete of lembretes) {
    if (!lembrete.ativo) continue;

    if (lembrete.repeticao === 'unico') {
      if (lembrete.data && lembrete.horario) {
        adicionar(
          lembrete,
          lembrete.data,
          lembrete.horario,
          lembrete.data
        );
      }

      continue;
    }

    const anticoncepcional =
      TIPOS_ANTICONCEPCIONAIS.has(lembrete.tipo);

    const menstrual =
      TIPOS_MENSTRUAIS.has(lembrete.tipo);

    const avisoAntecipado =
      menstrual ||
      lembrete.tipo === 'inicio_pausa' ||
      lembrete.tipo === 'fim_pausa';

    const limite =
      DIAS_AGENDADOS +
      (avisoAntecipado ? lembrete.antecedencia_dias : 0);

    for (let indice = 0; indice < limite; indice++) {
      const data = somarDias(hoje, indice);
      const configuracao = configuracaoDaData(data);

      if (anticoncepcional) {
        if (
          !configuracao ||
          configuracao.modo !== 'anticoncepcional'
        ) {
          continue;
        }

        const regime = configuracaoParaRegime(configuracao);
        const dia = calcularDia(regime, data);

        if (lembrete.tipo === 'acao') {
          if (dia.situacao !== 'acao_prevista') continue;

          const confirmado = dados.acoes.some(
            (acao) =>
              acao.configuracao_id === configuracao.id &&
              acao.data_prevista === data
          );

          if (confirmado) continue;

          adicionar(
            lembrete,
            data,
            lembrete.horario ?? regime.horario,
            data
          );

          continue;
        }

        let evento = false;

        if (lembrete.tipo === 'inicio_pausa') {
          evento =
            dia.situacao === 'pausa' &&
            dia.diaDePausa === 1;
        } else {
          const anterior = calcularDia(
            regime,
            somarDias(data, -1)
          );

          evento =
            dia.diaDeUso === 1 &&
            anterior.situacao === 'pausa';
        }

        if (evento) {
          adicionarAvisoAntecipado(lembrete, data);
        }

        continue;
      }

      if (menstrual) {
        if (
          !configuracao ||
          configuracao.modo !== 'menstrual'
        ) {
          continue;
        }

        const ciclo = cicloComRegistros(
          configuracao,
          dados.menstruacoes,
          data
        );

        const dia = calcularDiaMenstrual(ciclo, data);

        if (lembrete.tipo === 'inicio_menstruacao') {
          if (dia.diaDaMenstruacaoPrevista !== 1) {
            continue;
          }

          const inicioRegistrado = dados.menstruacoes.some(
            (periodo) => periodo.data_inicio === data
          );

          if (!inicioRegistrado) {
            adicionarAvisoAntecipado(lembrete, data);
          }

          continue;
        }

        const ultimoDiaPrevisto =
          dia.diaDaMenstruacaoPrevista ===
          ciclo.duracaoMenstruacaoDias;

        if (!ultimoDiaPrevisto) continue;

        const inicioDoPeriodo = somarDias(
          data,
          1 - ciclo.duracaoMenstruacaoDias
        );

        const fimJaRegistrado = dados.menstruacoes.some(
          (periodo) =>
            periodo.data_inicio === inicioDoPeriodo &&
            periodo.data_fim !== null
        );

        if (!fimJaRegistrado) {
          adicionarAvisoAntecipado(lembrete, data);
        }

        continue;
      }

      if (
        lembrete.tipo === 'registro' &&
        dados.diarios.some(
          (registro) => registro.data === data
        )
      ) {
        continue;
      }

      if (
        lembrete.repeticao === 'semanal' &&
        diaSemana(data) !== lembrete.dia_semana
      ) {
        continue;
      }

      adicionar(
        lembrete,
        data,
        lembrete.horario ?? '21:00',
        data
      );
    }
  }

  if (plano.length > 400) {
    throw new Error(
      'Há muitos avisos ativos. Reduza os lembretes personalizados.'
    );
  }

  return plano;
}
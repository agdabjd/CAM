import type { Lembrete } from '../database/lembretesRepository';
import type { DadosLinhaDoTempo } from '../database/linhaDoTempoRepository';

import { somarDias } from './datas';
import { calcularDia } from './contraceptivo/regime';
import { configuracaoParaRegime } from './contraceptivo/configuracaoParaRegime';

export const DIAS_AGENDADOS = 30;

export type AvisoPlanejado = {
  id: string;
  lembreteId: number;
  titulo: string;
  mensagem: string;
  instante: number;
};

function dataLocal(data: string, horario: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const [hora, minuto] = horario.split(':').map(Number);

  return new Date(ano, mes - 1, dia, hora, minuto).getTime();
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

  function adicionar(
    lembrete: Lembrete,
    dataAviso: string,
    horario: string,
    chave: string
  ) {
    const instante = dataLocal(dataAviso, horario);

    if (!Number.isFinite(instante) || instante <= agora) return;

    plano.push({
      id: `oiutero:${lembrete.id}:${chave}`,
      lembreteId: lembrete.id,
      titulo: lembrete.titulo,
      mensagem: lembrete.mensagem,
      instante,
    });
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

    const avisoDePausa =
      lembrete.tipo === 'inicio_pausa' ||
      lembrete.tipo === 'fim_pausa';

    const limite =
      DIAS_AGENDADOS +
      (avisoDePausa ? lembrete.antecedencia_dias : 0);

    for (let indice = 0; indice < limite; indice++) {
      const data = somarDias(hoje, indice);

      if (
        lembrete.tipo === 'acao' ||
        avisoDePausa
      ) {
        const configuracao = dados.configuracoes.find(
          (item) =>
            item.vigente_desde <= data &&
            (item.vigente_ate === null || data < item.vigente_ate)
        );

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

        if (!evento) continue;

        const aviso = somarDias(
          data,
          -lembrete.antecedencia_dias
        );

        if (
          aviso < hoje ||
          aviso >= somarDias(hoje, DIAS_AGENDADOS)
        ) {
          continue;
        }

        adicionar(
          lembrete,
          aviso,
          lembrete.horario ?? '08:00',
          data
        );

        continue;
      }

      if (
        lembrete.tipo === 'registro' &&
        dados.diarios.some((registro) => registro.data === data)
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
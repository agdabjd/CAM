import type {
  AcaoLinhaDoTempo,
  DadosLinhaDoTempo,
} from '../database/linhaDoTempoRepository';

import { validarData } from './datas';
import { formatarData } from './onboarding';

import { calcularDia } from './contraceptivo/regime';
import { configuracaoParaRegime } from './contraceptivo/configuracaoParaRegime';

import { calcularDiaMenstrual } from './menstrual/cicloMenstrual';
import { configuracaoParaCiclo } from './menstrual/configuracaoParaCiclo';

export type TipoLinha =
  | 'acao'
  | 'humor'
  | 'sangramento'
  | 'sintomas'
  | 'observacao'
  | 'menstruacao'
  | 'registro';

export type LinhaHistorico = {
  tipo: TipoLinha;
  texto: string;
  periodoId?: number;
};

export type GrupoHistorico = {
  data: string;
  diarioId: number | null;
  periodoIds: number[];
  linhas: LinhaHistorico[];
};

export type Marcador =
  | 'acao_prevista'
  | 'acao_realizada'
  | 'pausa'
  | 'menstruacao_prevista'
  | 'sangramento'
  | 'registro';

function textoAcao(acao: AcaoLinhaDoTempo) {
  const conhecidos: Record<string, string> = {
    'Tomar dose':
      acao.metodo === 'Pílula' ? 'Pílula tomada' : 'Dose tomada',
    'Aplicar dose': 'Dose aplicada',
    'Trocar adesivo': 'Adesivo trocado',
    'Trocar anel': 'Anel trocado',
  };

  let texto =
    `${conhecidos[acao.acao] ?? `Ação registrada: ${acao.acao}`} ` +
    `às ${acao.horario_real}`;

  if (
    acao.data_prevista &&
    acao.data_prevista !== acao.data_real
  ) {
    texto += ` — prevista para ${formatarData(acao.data_prevista)}`;
  }

  return texto;
}

export function criarConsultaLinhaDoTempo(
  dados: DadosLinhaDoTempo,
  hoje: string
) {
  validarData(hoje);

  const grupos = new Map<string, GrupoHistorico>();

  function grupo(data: string) {
    let existente = grupos.get(data);

    if (!existente) {
      existente = {
        data,
        diarioId: null,
        periodoIds: [],
        linhas: [],
      };

      grupos.set(data, existente);
    }

    return existente;
  }

  const acoesReais = dados.acoes.filter(
    (acao) => acao.data_real <= hoje
  );

  for (const diario of dados.diarios) {
    if (diario.data > hoje) continue;

    const atual = grupo(diario.data);
    atual.diarioId = diario.id;

    if (diario.humor) {
      atual.linhas.push({
        tipo: 'humor',
        texto: `Humor: ${diario.humor}`,
      });
    }

    if (diario.sangramento_fluxo !== 'nenhum') {
      const classificacao =
        diario.sangramento_tipo === 'menstruacao'
          ? 'Menstruação'
          : 'Sangramento';

      atual.linhas.push({
        tipo: 'sangramento',
        texto: `${classificacao}: ${diario.sangramento_fluxo}`,
      });
    }

    const sintomas = dados.sintomas
      .filter((item) => item.registro_diario_id === diario.id)
      .map((item) => item.descricao);

    if (sintomas.length > 0) {
      atual.linhas.push({
        tipo: 'sintomas',
        texto: `Sintomas: ${sintomas.join(', ')}`,
      });
    }

    if (diario.observacoes.trim()) {
      atual.linhas.push({
        tipo: 'observacao',
        texto: diario.observacoes,
      });
    }
  }

  for (const acao of acoesReais) {
    // Coloca as ações antes dos demais itens do dia.
    const atual = grupo(acao.data_real);

    atual.diarioId = acao.registro_diario_id;
  }

  for (const atual of grupos.values()) {
    const acoesDoDia = acoesReais
      .filter((acao) => acao.data_real === atual.data)
      .map((acao): LinhaHistorico => ({
        tipo: 'acao',
        texto: textoAcao(acao),
      }));

    atual.linhas.unshift(...acoesDoDia);
  }

  for (const periodo of dados.menstruacoes) {
    const eventos = [
      {
        data: periodo.data_inicio,
        horario: periodo.horario_inicio,
        descricao: 'Início da menstruação',
      },
      ...(periodo.data_fim
        ? [{
            data: periodo.data_fim,
            horario: periodo.horario_fim,
            descricao: 'Fim da menstruação',
          }]
        : []),
    ];

    for (const evento of eventos) {
      if (evento.data > hoje) continue;

      const atual = grupo(evento.data);

      if (!atual.periodoIds.includes(periodo.id)) {
        atual.periodoIds.push(periodo.id);
      }

      atual.linhas.push({
        tipo: 'menstruacao',
        texto:
          evento.descricao +
          (evento.horario ? ` às ${evento.horario}` : ''),
        periodoId: periodo.id,
      });
    }
  }

  for (const atual of grupos.values()) {
    if (atual.linhas.length === 0) {
      atual.linhas.push({
        tipo: 'registro',
        texto: 'Registro diário salvo',
      });
    }
  }

  const historico = [...grupos.values()].sort(
    (a, b) => b.data.localeCompare(a.data)
  );

  function consultarDia(data: string) {
    validarData(data);

    const configuracao = dados.configuracoes.find(
      (item) =>
        item.vigente_desde <= data &&
        (item.vigente_ate === null || data < item.vigente_ate)
    );

    const agenda: string[] = [];
    const marcadores = new Set<Marcador>();

    const acontecimentos = [
      ...(grupos.get(data)?.linhas ?? []),
    ];

    if (configuracao?.modo === 'anticoncepcional') {
      const regime = configuracaoParaRegime(configuracao);
      const dia = calcularDia(regime, data);

      if (dia.situacao === 'acao_prevista') {
        marcadores.add('acao_prevista');

        const confirmacoes = acoesReais.filter(
          (acao) =>
            acao.configuracao_id === configuracao.id &&
            acao.data_prevista === data
        );

        agenda.push(
          `${configuracao.acao} prevista às ${regime.horario}`
        );

        if (confirmacoes.length > 0) {
          for (const confirmacao of confirmacoes) {
            agenda.push(
              `Ação confirmada em ${
                formatarData(confirmacao.data_real)
              } às ${confirmacao.horario_real}`
            );
          }
        } else if (data <= hoje) {
          agenda.push('Não registrado');
        }
      } else if (dia.situacao === 'pausa') {
        marcadores.add('pausa');
        agenda.push(`Dia ${dia.diaDePausa} da pausa`);
      } else if (dia.situacao === 'uso_em_andamento') {
        agenda.push(
          'Uso em andamento — sem ação prevista neste dia'
        );
      } else {
        agenda.push(
          `O período de uso começa em ${
            formatarData(regime.dataReferencia)
          }`
        );
      }
    } else if (configuracao?.modo === 'menstrual') {
      const ciclo = configuracaoParaCiclo(configuracao);
      const dia = calcularDiaMenstrual(ciclo, data);

      if (dia.situacao === 'menstruacao_prevista') {
        marcadores.add('menstruacao_prevista');
        agenda.push(
          'Menstruação prevista — estimativa da configuração'
        );
      } else if (dia.situacao === 'antes_inicio') {
        agenda.push('Data anterior à referência do ciclo');
      } else {
        agenda.push(
          `Dia estimado do ciclo: ${dia.diaDoCicloEstimado}`
        );
      }
    } else {
      agenda.push('Sem previsão configurada para esta data');
    }

    const diario = dados.diarios.find(
      (item) => item.data === data && item.data <= hoje
    );

    if (diario) {
      marcadores.add('registro');

      if (diario.sangramento_fluxo !== 'nenhum') {
        marcadores.add('sangramento');
      }
    }

    if (acoesReais.some((acao) => acao.data_real === data)) {
      marcadores.add('acao_realizada');
    }

    // Um período real aberto vale até hoje, nunca para o futuro.
    if (data <= hoje) {
      for (const periodo of dados.menstruacoes) {
        const fim =
          periodo.data_fim && periodo.data_fim < hoje
            ? periodo.data_fim
            : hoje;

        if (periodo.data_inicio <= data && data <= fim) {
          marcadores.add('sangramento');

          if (
            !acontecimentos.some(
              (linha) => linha.periodoId === periodo.id
            )
          ) {
            acontecimentos.push({
              tipo: 'menstruacao',
              texto:
                `Dentro da menstruação registrada em ${
                  formatarData(periodo.data_inicio)
                }`,
              periodoId: periodo.id,
            });
          }
        }
      }
    }

    return {
      data,
      modo: configuracao?.modo ?? null,
      futura: data > hoje,
      agenda,
      acontecimentos,
      marcadores: [...marcadores],
    };
  }

  return { historico, consultarDia };
}
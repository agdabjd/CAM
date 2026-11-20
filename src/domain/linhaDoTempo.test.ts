import { describe, expect, it } from 'vitest';

import { criarConsultaLinhaDoTempo } from './linhaDoTempo';

import type { DadosLinhaDoTempo } from '../database/linhaDoTempoRepository';

function dadosVazios(): DadosLinhaDoTempo {
  return {
    configuracoes: [{
      id: 1,
      modo: 'anticoncepcional',
      vigente_desde: '2026-11-01',
      vigente_ate: null,
      data_referencia: '2026-11-01',
      metodo: 'Pílula',
      acao: 'Tomar dose',
      intervalo_dias: 1,
      horario: '08:00',
      pausa_tipo: 'dias',
      pausa_apos: 21,
      pausa_duracao_dias: 7,
      duracao_ciclo_dias: null,
      duracao_menstruacao_dias: null,
    }],
    diarios: [],
    sintomas: [],
    acoes: [],
    menstruacoes: [],
  };
}

describe('Calendário e histórico', () => {
  it('mostra não registrado para uma ação passada sem confirmação', () => {
    const consulta = criarConsultaLinhaDoTempo(
      dadosVazios(),
      '2026-11-12'
    );

    expect(
      consulta.consultarDia('2026-11-10').agenda
    ).toContain('Não registrado');
  });

  it('não classifica uma previsão futura como não registrada', () => {
    const consulta = criarConsultaLinhaDoTempo(
      dadosVazios(),
      '2026-11-12'
    );

    const dia = consulta.consultarDia('2026-11-13');

    expect(dia.futura).toBe(true);
    expect(dia.agenda).not.toContain('Não registrado');
  });

  it('mantém a ação atrasada na data real e confirma a previsão original', () => {
    const dados = dadosVazios();

    dados.acoes.push({
      id: 1,
      registro_diario_id: 1,
      configuracao_id: 1,
      data_real: '2026-11-11',
      horario_real: '09:15',
      data_prevista: '2026-11-10',
      acao: 'Tomar dose',
      metodo: 'Pílula',
    });

    const consulta = criarConsultaLinhaDoTempo(
      dados,
      '2026-11-12'
    );

    const previsto = consulta.consultarDia('2026-11-10');
    const realizado = consulta.consultarDia('2026-11-11');

    expect(previsto.agenda).not.toContain('Não registrado');

    expect(
      previsto.agenda.some((texto) =>
        texto.includes('confirmada em 11/11/2026')
      )
    ).toBe(true);

    expect(
      realizado.marcadores
    ).toContain('acao_realizada');

    expect(consulta.historico[0].data).toBe('2026-11-11');

    // A ação do dia 11 continua sem confirmação própria.
    expect(realizado.agenda).toContain('Não registrado');
  });

  it('distingue pausa de ausência de confirmação', () => {
    const consulta = criarConsultaLinhaDoTempo(
      dadosVazios(),
      '2026-11-25'
    );

    const dia = consulta.consultarDia('2026-11-22');

    expect(dia.marcadores).toContain('pausa');
    expect(dia.agenda).not.toContain('Não registrado');
  });

  it('não estende uma menstruação aberta para o futuro', () => {
    const dados = dadosVazios();

    dados.menstruacoes.push({
      id: 1,
      data_inicio: '2026-11-10',
      data_fim: null,
      horario_inicio: null,
      horario_fim: null,
      observacoes: '',
    });

    const consulta = criarConsultaLinhaDoTempo(
      dados,
      '2026-11-12'
    );

    expect(
      consulta.consultarDia('2026-11-12').marcadores
    ).toContain('sangramento');

    expect(
      consulta.consultarDia('2026-11-13').marcadores
    ).not.toContain('sangramento');
  });

  it('preserva o tipo de sangramento sem convertê-lo em menstruação', () => {
    const dados = dadosVazios();

    dados.diarios.push({
      id: 1,
      data: '2026-11-10',
      horario: '20:00',
      humor: null,
      sangramento_fluxo: 'leve',
      sangramento_tipo: 'nao_informado',
      observacoes: '',
    });

    const consulta = criarConsultaLinhaDoTempo(
      dados,
      '2026-11-12'
    );

    expect(consulta.historico[0].linhas).toContainEqual({
      tipo: 'sangramento',
      texto: 'Sangramento: leve',
    });
  });
});
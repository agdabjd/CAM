import { describe, expect, it } from 'vitest';

import {
  calcularDia,
  pausaAtualOuProxima,
  proximaAcao,
  proximasAcoes,
  somarDias,
  type Regime,
} from './regime';

const diario: Regime = {
  dataReferencia: '2026-11-01',
  intervaloDias: 1,
  horario: '08:00',
  pausa: {
    tipo: 'dias',
    apos: 21,
    duracaoDias: 7,
  },
};

describe('Regime anticoncepcional', () => {
  it('identifica datas anteriores ao início', () => {
    expect(
      calcularDia(diario, '2026-10-31').situacao
    ).toBe('antes_inicio');
  });

  it('inclui a última ação antes da pausa', () => {
    const dia = calcularDia(diario, '2026-11-21');

    expect(dia.situacao).toBe('acao_prevista');
    expect(dia.diaDeUso).toBe(21);
  });

  it('calcula o primeiro e o último dia da pausa', () => {
    expect(
      calcularDia(diario, '2026-11-22').diaDePausa
    ).toBe(1);

    expect(
      calcularDia(diario, '2026-11-28').diaDePausa
    ).toBe(7);
  });

  it('reinicia a contagem na retomada', () => {
    const dia = calcularDia(diario, '2026-11-29');

    expect(dia.situacao).toBe('acao_prevista');
    expect(dia.diaDeUso).toBe(1);
    expect(dia.numeroPeriodo).toBe(2);
  });

  it('encontra a próxima ação durante a pausa', () => {
    expect(
      proximaAcao(diario, '2026-11-24').data
    ).toBe('2026-11-29');
  });

  it('permite incluir ou excluir o dia consultado', () => {
    expect(
      proximaAcao(diario, '2026-11-21').data
    ).toBe('2026-11-21');

    expect(
      proximaAcao(diario, '2026-11-21', false).data
    ).toBe('2026-11-29');
  });

  it('calcula a pausa e a retomada', () => {
    expect(
      pausaAtualOuProxima(diario, '2026-11-24')
    ).toEqual({
      inicio: '2026-11-22',
      fim: '2026-11-28',
      retomada: '2026-11-29',
      emAndamento: true,
    });
  });

  it('conta 3 trocas com intervalos completos de 7 dias', () => {
    const trocas: Regime = {
      ...diario,
      intervaloDias: 7,
      pausa: {
        tipo: 'acoes',
        apos: 3,
        duracaoDias: 7,
      },
    };

    expect(
      proximasAcoes(trocas, '2026-11-01', 4)
        .map((acao) => acao.data)
    ).toEqual([
      '2026-11-01',
      '2026-11-08',
      '2026-11-15',
      '2026-11-29',
    ]);

    expect(
      calcularDia(trocas, '2026-11-16').situacao
    ).toBe('uso_em_andamento');

    expect(
      calcularDia(trocas, '2026-11-22').situacao
    ).toBe('pausa');
  });

  it('respeita uma pausa por dias não múltiplos da frequência', () => {
    const regime: Regime = {
      ...diario,
      intervaloDias: 7,
      pausa: {
        tipo: 'dias',
        apos: 20,
        duracaoDias: 7,
      },
    };

    expect(
      calcularDia(regime, '2026-11-21').situacao
    ).toBe('pausa');

    expect(
      proximaAcao(regime, '2026-11-16').data
    ).toBe('2026-11-28');
  });

  it('calcula uso contínuo sem pausas', () => {
    const continuo: Regime = {
      ...diario,
      intervaloDias: 3,
      pausa: { tipo: 'nenhuma' },
    };

    expect(
      proximasAcoes(continuo, '2026-11-01', 4)
        .map((acao) => acao.data)
    ).toEqual([
      '2026-11-01',
      '2026-11-04',
      '2026-11-07',
      '2026-11-10',
    ]);

    expect(
      pausaAtualOuProxima(continuo, '2026-11-10')
    ).toBeNull();
  });

  it('aceita referência antiga sem reiniciar no dia da consulta', () => {
    const antigo: Regime = {
      ...diario,
      dataReferencia: '2026-01-01',
      intervaloDias: 7,
      pausa: { tipo: 'nenhuma' },
    };

    expect(
      proximaAcao(antigo, '2026-01-10').data
    ).toBe('2026-01-15');
  });

  it('atravessa fevereiro de ano bissexto', () => {
    const regime: Regime = {
      ...diario,
      dataReferencia: '2028-02-28',
      pausa: {
        tipo: 'dias',
        apos: 2,
        duracaoDias: 1,
      },
    };

    expect(
      calcularDia(regime, '2028-02-29').situacao
    ).toBe('acao_prevista');

    expect(
      calcularDia(regime, '2028-03-01').situacao
    ).toBe('pausa');

    expect(
      proximaAcao(regime, '2028-03-01').data
    ).toBe('2028-03-02');
  });

  it('atravessa a mudança de ano', () => {
    expect(
      somarDias('2026-12-31', 1)
    ).toBe('2027-01-01');
  });

  it('rejeita datas e intervalos inválidos', () => {
    expect(() =>
      calcularDia(diario, '2026-02-30')
    ).toThrow();

    expect(() =>
      calcularDia(
        { ...diario, intervaloDias: 0 },
        '2026-11-01'
      )
    ).toThrow();
  });
});
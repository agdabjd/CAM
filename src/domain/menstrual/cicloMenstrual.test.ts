import { describe, expect, it } from 'vitest';

import {
  calcularDiaMenstrual,
  calcularDuracaoMenstruacao,
  periodoPrevistoAtualOuProximo,
  proximoInicioPrevisto,
  type CicloMenstrual,
} from './cicloMenstrual';

const ciclo: CicloMenstrual = {
  dataReferencia: '2026-11-01',
  duracaoCicloDias: 28,
  duracaoMenstruacaoDias: 5,
};

describe('Acompanhamento menstrual', () => {
  it('identifica datas anteriores à referência', () => {
    expect(
      calcularDiaMenstrual(ciclo, '2026-10-31').situacao
    ).toBe('antes_inicio');
  });

  it('considera a referência como primeiro dia', () => {
    const dia = calcularDiaMenstrual(ciclo, '2026-11-01');

    expect(dia.diaDoCicloEstimado).toBe(1);
    expect(dia.diaDaMenstruacaoPrevista).toBe(1);
  });

  it('inclui o último dia previsto da menstruação', () => {
    expect(
      calcularDiaMenstrual(ciclo, '2026-11-05').situacao
    ).toBe('menstruacao_prevista');
  });

  it('encerra o período previsto depois da duração configurada', () => {
    const dia = calcularDiaMenstrual(ciclo, '2026-11-06');

    expect(dia.situacao).toBe('fora_da_menstruacao_prevista');
    expect(dia.diaDoCicloEstimado).toBe(6);
  });

  it('reinicia a contagem no próximo ciclo previsto', () => {
    expect(
      calcularDiaMenstrual(ciclo, '2026-11-29')
        .diaDoCicloEstimado
    ).toBe(1);
  });

  it('calcula o próximo início e inclui a data consultada', () => {
    expect(
      proximoInicioPrevisto(ciclo, '2026-11-10')
    ).toBe('2026-11-29');

    expect(
      proximoInicioPrevisto(ciclo, '2026-11-29')
    ).toBe('2026-11-29');
  });

  it('retorna o período previsto atual', () => {
    expect(
      periodoPrevistoAtualOuProximo(ciclo, '2026-11-03')
    ).toEqual({
      inicio: '2026-11-01',
      fim: '2026-11-05',
      emAndamento: true,
    });
  });

  it('atravessa a mudança de mês', () => {
    expect(
      periodoPrevistoAtualOuProximo(ciclo, '2026-11-10')
    ).toEqual({
      inicio: '2026-11-29',
      fim: '2026-12-03',
      emAndamento: false,
    });
  });

  it('conta início e fim na duração real', () => {
    expect(
      calcularDuracaoMenstruacao(
        '2026-09-02',
        '2026-09-06'
      )
    ).toBe(5);

    expect(
      calcularDuracaoMenstruacao(
        '2026-09-02',
        '2026-09-02'
      )
    ).toBe(1);
  });

  it('atravessa fevereiro de ano bissexto', () => {
    const exemplo: CicloMenstrual = {
      dataReferencia: '2028-02-28',
      duracaoCicloDias: 28,
      duracaoMenstruacaoDias: 3,
    };

    expect(
      periodoPrevistoAtualOuProximo(exemplo, '2028-02-29')
    ).toEqual({
      inicio: '2028-02-28',
      fim: '2028-03-01',
      emAndamento: true,
    });
  });

  it('rejeita valores inválidos', () => {
    expect(() =>
      calcularDiaMenstrual(
        { ...ciclo, duracaoCicloDias: 0 },
        '2026-11-01'
      )
    ).toThrow();

    expect(() =>
      calcularDiaMenstrual(
        { ...ciclo, duracaoMenstruacaoDias: 29 },
        '2026-11-01'
      )
    ).toThrow();

    expect(() =>
      calcularDiaMenstrual(ciclo, '2026-02-30')
    ).toThrow();
  });
});
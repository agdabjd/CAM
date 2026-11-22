import { obterBanco } from './database';

import type { NovaConfiguracao } from './acompanhamentoRepository';

import { hojeLocal } from '../domain/datas';
import { validarConfiguracao } from '../domain/onboarding';

export async function salvarAlteracaoConfiguracao(
  dados: NovaConfiguracao
) {
  validarConfiguracao(dados);

  if (dados.vigenteDesde <= hojeLocal()) {
    throw new Error(
      'A alteração deve começar amanhã ou em uma data posterior.'
    );
  }

  const banco = await obterBanco();

  await banco.withExclusiveTransactionAsync(async (transacao) => {
    const futuras = await transacao.getAllAsync<{ id: number }>(
      `
        SELECT id
        FROM configuracoes
        WHERE perfil_id = 1 AND vigente_desde >= ?
      `,
      dados.vigenteDesde
    );

    for (const futura of futuras) {
      const acao = await transacao.getFirstAsync<{ id: number }>(
        `
          SELECT id FROM acoes_realizadas
          WHERE configuracao_id = ?
          LIMIT 1
        `,
        futura.id
      );

      const menstruacao =
        await transacao.getFirstAsync<{ id: number }>(
          `
            SELECT id FROM menstruacoes
            WHERE configuracao_id = ?
            LIMIT 1
          `,
          futura.id
        );

      if (acao || menstruacao) {
        throw new Error(
          'Uma configuração programada já possui registros vinculados. ' +
          'Escolha uma data posterior a ela para preservar o histórico.'
        );
      }
    }

    const anterior = await transacao.getFirstAsync<{ id: number }>(
      `
        SELECT id
        FROM configuracoes
        WHERE perfil_id = 1 AND vigente_desde < ?
        ORDER BY vigente_desde DESC
        LIMIT 1
      `,
      dados.vigenteDesde
    );

    if (!anterior) {
      throw new Error('Não foi encontrada a configuração anterior.');
    }

    await transacao.runAsync(
      `
        DELETE FROM configuracoes
        WHERE perfil_id = 1 AND vigente_desde >= ?
      `,
      dados.vigenteDesde
    );

    await transacao.runAsync(
      'UPDATE configuracoes SET vigente_ate = ? WHERE id = ?',
      dados.vigenteDesde,
      anterior.id
    );

    const anticoncepcional =
      dados.modo === 'anticoncepcional' ? dados : null;

    const menstrual =
      dados.modo === 'menstrual' ? dados : null;

    const pausa = anticoncepcional?.pausa;

    await transacao.runAsync(
      `
        INSERT INTO configuracoes (
          perfil_id, modo, vigente_desde, data_referencia,
          metodo, acao, intervalo_dias, horario,
          pausa_tipo, pausa_apos, pausa_duracao_dias,
          duracao_ciclo_dias, duracao_menstruacao_dias
        )
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      dados.modo,
      dados.vigenteDesde,
      dados.dataReferencia,
      anticoncepcional?.metodo ?? null,
      anticoncepcional?.acao ?? null,
      anticoncepcional?.intervaloDias ?? null,
      anticoncepcional?.horario ?? null,
      pausa?.tipo ?? 'nenhuma',
      pausa && pausa.tipo !== 'nenhuma' ? pausa.apos : null,
      pausa && pausa.tipo !== 'nenhuma'
        ? pausa.duracaoDias
        : null,
      menstrual?.duracaoCicloDias ?? null,
      menstrual?.duracaoMenstruacaoDias ?? null
    );
  });
}
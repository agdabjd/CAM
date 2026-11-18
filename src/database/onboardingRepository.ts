import { obterBanco } from './database';
import type { NovaConfiguracao } from './acompanhamentoRepository';

import { validarConfiguracaoInicial } from '../domain/onboarding';

type Rascunho = {
  etapa: string;
  campos: Record<string, string>;
};

export async function existeConfiguracao() {
  const banco = await obterBanco();

  const resultado = await banco.getFirstAsync<{ id: number }>(
    'SELECT id FROM configuracoes WHERE perfil_id = 1 LIMIT 1'
  );

  return resultado !== null;
}

export async function salvarRascunho(
  etapa: string,
  campos: Record<string, string>
) {
  const banco = await obterBanco();

  await banco.runAsync(
    `
      INSERT INTO onboarding_rascunhos (perfil_id, conteudo)
      VALUES (1, ?)
      ON CONFLICT(perfil_id)
      DO UPDATE SET conteudo = excluded.conteudo
    `,
    JSON.stringify({ versao: 1, etapa, campos })
  );
}

export async function carregarRascunho(): Promise<Rascunho | null> {
  const banco = await obterBanco();

  const resultado = await banco.getFirstAsync<{
    conteudo: string;
  }>(
    `
      SELECT conteudo
      FROM onboarding_rascunhos
      WHERE perfil_id = 1
    `
  );

  if (!resultado) return null;

  const dados = JSON.parse(resultado.conteudo);

  if (
    !dados ||
    dados.versao !== 1 ||
    typeof dados.etapa !== 'string' ||
    !dados.campos ||
    typeof dados.campos !== 'object' ||
    Array.isArray(dados.campos) ||
    !Object.values(dados.campos).every(
      (valor) => typeof valor === 'string'
    )
  ) {
    throw new Error('O rascunho do onboarding não é válido.');
  }

  return {
    etapa: dados.etapa,
    campos: dados.campos,
  };
}

export async function finalizarOnboarding(
  dados: NovaConfiguracao
) {
  validarConfiguracaoInicial(dados);

  const banco = await obterBanco();

  await banco.withExclusiveTransactionAsync(async (transacao) => {
    const existente = await transacao.getFirstAsync<{
      id: number;
    }>(
      'SELECT id FROM configuracoes WHERE perfil_id = 1 LIMIT 1'
    );

    // Evita criar uma segunda configuração caso a conclusão
    // seja repetida depois de uma atualização da interface.
    if (!existente) {
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
    }

    await transacao.runAsync(
      'DELETE FROM onboarding_rascunhos WHERE perfil_id = 1'
    );
  });
}
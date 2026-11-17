import { obterBanco } from './database';

class DesfazerTeste extends Error {}

export async function testarBanco() {
  const banco = await obterBanco();

  const perfil = await banco.getFirstAsync<{ id: number }>(
    'SELECT id FROM perfis LIMIT 1'
  );

  if (perfil) {
    throw new Error(
      'Este teste inicial deve ser executado antes do cadastro real.'
    );
  }

  try {
    await banco.withExclusiveTransactionAsync(async (transacao) => {
      await transacao.runAsync(
        `
          INSERT INTO perfis (
            id, nome, email, senha_hash,
            senha_salt, senha_parametros
          )
          VALUES (1, ?, ?, ?, ?, ?)
        `,
        'Perfil temporário',
        'teste@example.com',
        'valor-ficticio-apenas-para-teste',
        'salt-ficticio',
        '{}'
      );

      const configuracao = await transacao.runAsync(
        `
          INSERT INTO configuracoes (
            modo, vigente_desde, data_referencia,
            metodo, acao, intervalo_dias, horario,
            pausa_tipo, pausa_apos, pausa_duracao_dias
          )
          VALUES (
            'anticoncepcional', '2026-11-01', '2026-11-01',
            'Pílula', 'Tomar dose', 1, '08:00',
            'dias', 21, 7
          )
        `
      );

      const registro = await transacao.runAsync(
        `
          INSERT INTO registros_diarios (
            data, humor, observacoes
          )
          VALUES ('2026-11-02', 'Bem', 'Registro temporário')
        `
      );

      await transacao.runAsync(
        `
          INSERT INTO sintomas_registrados (
            registro_diario_id, descricao
          )
          VALUES (?, 'Cólica')
        `,
        registro.lastInsertRowId
      );

      await transacao.runAsync(
        `
          INSERT INTO acoes_realizadas (
            registro_diario_id, configuracao_id,
            horario_real, data_prevista
          )
          VALUES (?, ?, '09:15', '2026-11-01')
        `,
        registro.lastInsertRowId,
        configuracao.lastInsertRowId
      );

      await transacao.runAsync(
        `
          INSERT INTO lembretes (
            tipo, titulo, mensagem, repeticao, horario
          )
          VALUES (
            'registro', 'Registrar o dia',
            'Como você está hoje?', 'diario', '21:00'
          )
        `
      );

      const resultado = await transacao.getFirstAsync<{
        data_real: string;
        data_prevista: string;
        horario_real: string;
      }>(
        `
          SELECT
            r.data AS data_real,
            a.data_prevista,
            a.horario_real
          FROM acoes_realizadas a
          JOIN registros_diarios r
            ON r.id = a.registro_diario_id
          WHERE a.id = ?
        `,
        1
      );

      if (
        resultado?.data_real !== '2026-11-02' ||
        resultado.data_prevista !== '2026-11-01'
      ) {
        throw new Error('Falha na separação entre previsão e registro.');
      }

      console.log('Gravação e leitura funcionando:', resultado);

      // Provoca o rollback para remover todos os dados do teste.
      throw new DesfazerTeste();
    });
  } catch (erro) {
    if (!(erro instanceof DesfazerTeste)) {
      throw erro;
    }
  }

  const perfilRestante = await banco.getFirstAsync<{ id: number }>(
    'SELECT id FROM perfis LIMIT 1'
  );

  if (perfilRestante) {
    throw new Error('Os dados temporários não foram removidos.');
  }

  console.log('Teste concluído. Nenhum cadastro temporário foi mantido.');
}
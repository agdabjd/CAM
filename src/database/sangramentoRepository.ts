import { obterBanco } from './database';
import { hojeLocal, validarData } from '../domain/datas';

export type FluxoSangramento =
  | 'nenhum'
  | 'manchas'
  | 'leve'
  | 'moderado'
  | 'intenso';

export type TipoSangramento =
  | 'menstruacao'
  | 'outro'
  | 'nao_informado';

type DadosSangramento = {
  data: string;
  fluxo: FluxoSangramento;
  tipo: TipoSangramento;
};

export async function salvarSangramento(
  dados: DadosSangramento
) {
  validarData(dados.data);

  if (dados.data > hojeLocal()) {
    throw new Error(
      'Não é possível registrar sangramento em uma data futura.'
    );
  }

  if (
    dados.fluxo === 'nenhum' &&
    dados.tipo !== 'nao_informado'
  ) {
    throw new Error(
      'Sem sangramento, deixe a classificação como não informada.'
    );
  }

  const banco = await obterBanco();

  await banco.runAsync(
    `
      INSERT INTO registros_diarios (
        perfil_id,
        data,
        sangramento_fluxo,
        sangramento_tipo
      )
      VALUES (1, ?, ?, ?)

      ON CONFLICT(perfil_id, data)
      DO UPDATE SET
        sangramento_fluxo = excluded.sangramento_fluxo,
        sangramento_tipo = excluded.sangramento_tipo
    `,
    dados.data,
    dados.fluxo,
    dados.tipo
  );
}

export async function buscarSangramento(data: string) {
  validarData(data);

  const banco = await obterBanco();

  return banco.getFirstAsync<{
    id: number;
    data: string;
    sangramento_fluxo: FluxoSangramento;
    sangramento_tipo: TipoSangramento;
  }>(
    `
      SELECT
        id,
        data,
        sangramento_fluxo,
        sangramento_tipo
      FROM registros_diarios
      WHERE perfil_id = 1 AND data = ?
    `,
    data
  );
}
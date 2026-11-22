import * as SQLite from 'expo-sqlite';

import {
  SCHEMA_V1,
  SCHEMA_V2,
  SCHEMA_V3,
  SCHEMA_V4,
  SCHEMA_V5,
  SCHEMA_V6,
} from './schema';

let bancoPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function abrirEPrepararBanco() {
  const banco = await SQLite.openDatabaseAsync('oi-utero.db');

  await banco.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const resultado = await banco.getFirstAsync<{
    user_version: number;
  }>('PRAGMA user_version');

  const versao = resultado?.user_version ?? 0;

  if (versao > 6) {
    throw new Error(
      'O banco pertence a uma versão mais recente do aplicativo.'
    );
  }

  if (versao < 6) {
    await banco.withExclusiveTransactionAsync(async (transacao) => {
      if (versao === 0) {
        await transacao.execAsync(SCHEMA_V1);
      }

      if (versao < 2) {
        await transacao.execAsync(SCHEMA_V2);
      }

      if (versao < 3) {
        await transacao.execAsync(SCHEMA_V3);
      }

      if (versao < 4) {
        await transacao.execAsync(SCHEMA_V4);
      }

      if (versao < 5) {
        await transacao.execAsync(SCHEMA_V5);
      }

      await transacao.execAsync(SCHEMA_V6);
      await transacao.execAsync('PRAGMA user_version = 6');
    });
  }

  return banco;
}

export function obterBanco() {
  if (!bancoPromise) {
    bancoPromise = abrirEPrepararBanco().catch((erro) => {
      bancoPromise = null;
      throw erro;
    });
  }

  return bancoPromise;
}
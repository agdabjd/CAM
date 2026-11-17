import * as SQLite from 'expo-sqlite';

import { SCHEMA_V1 } from './schema';

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

  if (versao > 1) {
    throw new Error(
      'O banco foi criado por uma versão mais recente do aplicativo.'
    );
  }

  if (versao === 0) {
    await banco.withExclusiveTransactionAsync(async (transacao) => {
      await transacao.execAsync(SCHEMA_V1);
      await transacao.execAsync('PRAGMA user_version = 1');
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
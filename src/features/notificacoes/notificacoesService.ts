import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import {
  listarLembretes,
  prepararLembretes,
} from '../../database/lembretesRepository';

import { carregarLinhaDoTempo } from '../../database/linhaDoTempoRepository';

import {
  DIAS_AGENDADOS,
  gerarPlanoNotificacoes,
} from '../../domain/planoNotificacoes';

import { hojeLocal, somarDias } from '../../domain/datas';
import { obterBanco } from '../../database/database';

const CANAL = 'acompanhamento-v2';
const PREFIXO = 'oiutero:';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function prepararCanal() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Lembretes do acompanhamento',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function solicitarPermissoes() {
  await prepararCanal();

  let permissao = await Notifications.getPermissionsAsync();

  if (!permissao.granted && permissao.canAskAgain) {
    permissao = await Notifications.requestPermissionsAsync();
  }

  return permissao.granted;
}

export type ResultadoSincronizacao = {
  permitido: boolean;
  quantidade: number;
  ate: string;
};

async function sincronizarAgora(): Promise<ResultadoSincronizacao> {
  await prepararCanal();
  await prepararLembretes();

  const hoje = hojeLocal();
  const ate = somarDias(hoje, DIAS_AGENDADOS - 1);

  const permissao = await Notifications.getPermissionsAsync();

  const existentes =
    await Notifications.getAllScheduledNotificationsAsync();

  const nossos = existentes.filter(
    (item) => item.identifier.startsWith(PREFIXO)
  );

  if (!permissao.granted) {
    for (const item of nossos) {
      await Notifications.cancelScheduledNotificationAsync(
        item.identifier
      );
    }

    return { permitido: false, quantidade: 0, ate };
  }

  const dados = await carregarLinhaDoTempo();
  const lembretes = await listarLembretes();

  const plano = gerarPlanoNotificacoes(
    dados,
    lembretes,
    hoje,
    Date.now()
  );

  const desejados = new Set(plano.map((item) => item.id));

  for (const item of nossos) {
    if (!desejados.has(item.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(
        item.identifier
      );
    }
  }

  for (const aviso of plano) {
    const assinatura = JSON.stringify([
        CANAL,
        aviso.instante,
        aviso.titulo,
        aviso.mensagem,
    ]);

    const existente = nossos.find(
      (item) => item.identifier === aviso.id
    );

    if (
      existente?.content.data?.assinatura === assinatura
    ) {
      continue;
    }

    if (existente) {
      await Notifications.cancelScheduledNotificationAsync(
        existente.identifier
      );
    }

    await Notifications.scheduleNotificationAsync({
      identifier: aviso.id,
      content: {
        title: aviso.titulo,
        body: aviso.mensagem,
        data: { assinatura },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(aviso.instante),
        channelId: CANAL,
      },
    });
  }

  const banco = await obterBanco();

  for (const lembrete of lembretes) {
    const ids = plano
      .filter((item) => item.lembreteId === lembrete.id)
      .map((item) => item.id);

    await banco.runAsync(
      'UPDATE lembretes SET ids_notificacoes_json = ? WHERE id = ?',
      JSON.stringify(ids),
      lembrete.id
    );
  }

  return {
    permitido: true,
    quantidade: plano.length,
    ate,
  };
}

// Impede sincronizações simultâneas de disputarem os agendamentos.
let fila: Promise<unknown> = Promise.resolve();

export function sincronizarNotificacoes() {
  const tarefa = fila.then(sincronizarAgora);

  fila = tarefa.catch(() => undefined);

  return tarefa;
}

export async function agendarTeste() {
  const permitido = await solicitarPermissoes();

  if (!permitido) {
    throw new Error('As notificações não estão autorizadas.');
  }

  await Notifications.cancelScheduledNotificationAsync(
    'cam-teste'
  );

  const instante = new Date(Date.now() + 30_000);

  console.log(
    'Notificação de teste solicitada para:',
    instante.toLocaleTimeString()
  );

  await Notifications.scheduleNotificationAsync({
    identifier: 'cam-teste',
    content: {
      title: 'CAM!',
      body: 'Seu teste de notificação funcionou.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: instante,
      channelId: CANAL,
    },
  });
}
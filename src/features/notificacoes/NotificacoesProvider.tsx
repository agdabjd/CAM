import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { AppState, Modal } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useRegistros } from '../registros/RegistrosProvider';
import NotificacoesScreen from './NotificacoesScreen';

import { sincronizarNotificacoes } from './notificacoesService';

const Contexto = createContext<{
  abrirNotificacoes: () => void;
} | undefined>(undefined);

export function NotificacoesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { versao } = useRegistros();
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    function atualizar() {
      sincronizarNotificacoes().catch((erro) => {
        console.error('Falha ao atualizar os avisos:', erro);
      });
    }

    atualizar();

    const assinatura = AppState.addEventListener(
      'change',
      (estado) => {
        if (estado === 'active') atualizar();
      }
    );

    return () => assinatura.remove();
  }, [versao]);

  return (
    <Contexto.Provider
      value={{
        abrirNotificacoes: () => setAberto(true),
      }}
    >
      {children}

      <Modal
        visible={aberto}
        animationType="slide"
        onRequestClose={() => setAberto(false)}
      >
        <SafeAreaProvider>
          {aberto && (
            <NotificacoesScreen fechar={() => setAberto(false)} />
          )}
        </SafeAreaProvider>
      </Modal>
    </Contexto.Provider>
  );
}

export function useNotificacoes() {
  const contexto = useContext(Contexto);

  if (!contexto) {
    throw new Error(
      'useNotificacoes deve ser usado em NotificacoesProvider.'
    );
  }

  return contexto;
}
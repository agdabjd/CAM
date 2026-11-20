import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  carregarLinhaDoTempo,
  type DadosLinhaDoTempo,
} from '../../database/linhaDoTempoRepository';

import { useRegistros } from './RegistrosProvider';

export function useLinhaDoTempo() {
  const { versao } = useRegistros();

  const [dados, setDados] =
    useState<DadosLinhaDoTempo | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      setCarregando(true);
      setErro(false);

      carregarLinhaDoTempo()
        .then((resultado) => {
          if (ativo) setDados(resultado);
        })
        .catch(() => {
          if (ativo) setErro(true);
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });

      return () => {
        ativo = false;
      };
    }, [versao, tentativa])
  );

  return {
    dados,
    carregando,
    erro,
    recarregar: () => setTentativa((valor) => valor + 1),
  };
}
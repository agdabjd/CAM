import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ComponentRef,
} from 'react';

import {
  Keyboard,
  ScrollView,
  TextInput,
  type ScrollViewProps,
  type TextInputProps,
} from 'react-native';

type InstanciaRolagem = ComponentRef<typeof ScrollView>;
type InstanciaCampo = ComponentRef<typeof TextInput>;

const ContextoCampo = createContext<
  (campo: InstanciaCampo | null) => void
>(() => undefined);

export function RolagemFormulario({
  children,
  onScroll,
  onLayout,
  onContentSizeChange,
  ...props
}: ScrollViewProps) {
  const rolagem = useRef<InstanciaRolagem | null>(null);
  const campoAtivo = useRef<InstanciaCampo | null>(null);
  const deslocamento = useRef(0);

  const temporizador =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const ajustarRolagem = useCallback(() => {
    const campo = campoAtivo.current;
    const lista = rolagem.current;

    if (!campo || !lista) return;

    lista.measureInWindow(
      (_xLista, yLista, _larguraLista, alturaLista) => {
        if (alturaLista <= 0) return;

        campo.measureInWindow(
          (_xCampo, yCampo, _larguraCampo, alturaCampo) => {
            if (alturaCampo <= 0) return;

            const margem = 20;

            const fimVisivel = yLista + alturaLista;
            const fimCampo = yCampo + alturaCampo + margem;

            const excesso = fimCampo - fimVisivel;

            if (excesso > 0) {
              rolagem.current?.scrollTo({
                y: Math.max(
                  0,
                  deslocamento.current + excesso
                ),
                animated: true,
              });
            }
          }
        );
      }
    );
  }, []);

  const agendarAjuste = useCallback(() => {
    if (temporizador.current !== null) {
      clearTimeout(temporizador.current);
    }

    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      ajustarRolagem();
    }, 80);
  }, [ajustarRolagem]);

  const focarCampo = useCallback(
    (campo: InstanciaCampo | null) => {
      campoAtivo.current = campo;
      agendarAjuste();
    },
    [agendarAjuste]
  );

  useEffect(() => {
    const assinatura = Keyboard.addListener(
      'keyboardDidShow',
      agendarAjuste
    );

    return () => {
      assinatura.remove();

      if (temporizador.current !== null) {
        clearTimeout(temporizador.current);
      }
    };
  }, [agendarAjuste]);

  return (
    <ContextoCampo.Provider value={focarCampo}>
      <ScrollView
        {...props}
        ref={rolagem}
        keyboardShouldPersistTaps={
          props.keyboardShouldPersistTaps ?? 'handled'
        }
        scrollEventThrottle={props.scrollEventThrottle ?? 16}
        onScroll={(evento) => {
          deslocamento.current =
            evento.nativeEvent.contentOffset.y;

          onScroll?.(evento);
        }}
        onLayout={(evento) => {
          onLayout?.(evento);
          agendarAjuste();
        }}
        onContentSizeChange={(largura, altura) => {
          onContentSizeChange?.(largura, altura);
          agendarAjuste();
        }}
      >
        {children}
      </ScrollView>
    </ContextoCampo.Provider>
  );
}

export function CampoTextoVisivel(props: TextInputProps) {
  const campo = useRef<InstanciaCampo | null>(null);
  const focarCampo = useContext(ContextoCampo);

  return (
    <TextInput
      {...props}
      ref={campo}
      onFocus={(evento) => {
        props.onFocus?.(evento);
        focarCampo(campo.current);
      }}
    />
  );
}
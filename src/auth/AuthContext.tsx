import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  cadastrar as cadastrarLocal,
  entrar as entrarLocal,
  sair as sairLocal,
  existePerfil,
  restaurarSessao,
  type DadosCadastro,
  type Usuario,
} from './authService';

type AuthContextValue = {
  usuario: Usuario | null;
  temPerfil: boolean;
  carregando: boolean;
  erroInicial: string | null;
  cadastrar: (dados: DadosCadastro) => Promise<void>;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [temPerfil, setTemPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroInicial, setErroInicial] = useState<string | null>(
    null
  );

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const existe = await existePerfil();
        const sessao = await restaurarSessao();

        if (ativo) {
          setTemPerfil(existe);
          setUsuario(sessao);
        }
      } catch (erro) {
        console.error('Falha ao abrir o acesso local:', erro);

        if (ativo) {
          setErroInicial(
            'Não foi possível abrir os dados. Feche e abra o aplicativo.'
          );
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, []);

  async function cadastrar(dados: DadosCadastro) {
    try {
      const novoUsuario = await cadastrarLocal(dados);
      setTemPerfil(true);
      setUsuario(novoUsuario);
    } catch (erro) {
      setTemPerfil(await existePerfil());
      throw erro;
    }
  }

  async function entrar(email: string, senha: string) {
    const usuarioAutenticado = await entrarLocal(email, senha);
    setUsuario(usuarioAutenticado);
  }

  async function sair() {
    await sairLocal();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        temPerfil,
        carregando,
        erroInicial,
        cadastrar,
        entrar,
        sair,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return contexto;
}